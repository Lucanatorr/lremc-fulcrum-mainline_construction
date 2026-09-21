-- Fiber Reel Integrity Report  (Sprint 17)
--
-- Sequential problems that need another record, or the reel master, to see.
-- See reports/_conventions.md for the shared rules.
--
--   728477da-5f36-48cb-b3ab-cbc8c38d077f  MC Fiber Reel - Development
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- SCOPE, AND WHAT IS DELIBERATELY NOT HERE
-- The brief asks to detect: sequential overlap, sequential outside reel range,
-- duplicate range, impossible sequential.
--
-- Overlap and duplicate range are NOT repeated here. reports/sequential-overlap.sql
-- already classifies them properly (EXACT DUPLICATE / CONTAINED / PARTIAL
-- OVERLAP / ADJACENT, with touching ranges treated as legitimate adjacency).
-- Re-implementing that check with slightly different edge cases is how two
-- reports come to disagree about the same pair of records. Run both.
--
-- This report covers what that one does not: a single record judged against
-- the REEL it claims to come from, plus reel-level totals.
--
-- WHY THE DEVICE CHECK IS NOT ENOUGH
-- The production app already warns when a sequential falls outside the reel's
-- printed range, using values snapshotted onto the record so it works offline.
-- That check runs against the range AS IT WAS when the reel was linked. If the
-- reel master is later corrected, the device warning does not re-run -- by
-- design, since correcting a reel must never silently rewrite historical
-- installation records (Sprint 23.47.18). This report re-tests every record
-- against the reel's CURRENT range and is how those records get found.
--
-- Severity matches the app: INFO / WARNING / CRITICAL, and nothing here blocks
-- anything. These are findings for a reviewer.

WITH params AS (
  SELECT
    CAST(NULL AS varchar) AS p_reel_id,
    CAST(NULL AS varchar) AS p_project_id,
    CAST(NULL AS varchar) AS p_severity      -- 'CRITICAL', 'WARNING', 'INFO'
),

pulls AS (
  SELECT
    p._record_id,
    p.production_id,
    p._status                AS record_status,
    p.work_date,
    p.project_id_snapshot    AS project_id,
    p.contractor_id_snapshot AS contractor_id,
    p.crew,
    p.labor_code,
    p.cable_id,
    p.reel_id,
    p.starting_sequential,
    p.ending_sequential,
    LEAST(p.starting_sequential, p.ending_sequential)    AS seq_lo,
    GREATEST(p.starting_sequential, p.ending_sequential) AS seq_hi,
    COALESCE(p.sequential_footage, 0)    AS sequential_footage,
    COALESCE(p.slack_footage, 0)         AS slack_footage,
    COALESCE(p.total_installed_footage, 0) AS total_installed_footage
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
  WHERE p._status <> 'VOID'
    AND (p.starting_sequential IS NOT NULL OR p.ending_sequential IS NOT NULL)
),

reels AS (
  SELECT
    r.reel_id,
    r._status AS reel_status,
    LEAST(r.beginning_sequential, r.ending_sequential)    AS reel_lo,
    GREATEST(r.beginning_sequential, r.ending_sequential) AS reel_hi,
    COALESCE(r.original_reel_footage, 0) AS original_reel_footage,
    COALESCE(r.waste_recorded, 0)        AS waste_recorded
  FROM "728477da-5f36-48cb-b3ab-cbc8c38d077f" r
  WHERE r._status <> 'VOID'
),

reel_totals AS (
  SELECT reel_id, SUM(sequential_footage) AS approved_consumed
  FROM pulls
  WHERE record_status = 'APPROVED'
  GROUP BY reel_id
),

-- ---------------------------------------------------------------- findings
-- Each block emits at most one row per production record per problem, so a
-- record with two problems appears twice, once per finding. That is deliberate:
-- collapsing them would hide the second.

impossible AS (
  -- Columns are listed explicitly rather than x.*: the subquery below adds
  -- `detail`, so x.* would emit it in the wrong position and every branch of
  -- the UNION ALL would line up one column out.
  SELECT
    x._record_id, x.production_id, x.record_status, x.work_date,
    x.project_id, x.contractor_id, x.crew, x.labor_code,
    x.cable_id, x.reel_id, x.starting_sequential, x.ending_sequential,
    x.seq_lo, x.seq_hi,
    x.sequential_footage, x.slack_footage, x.total_installed_footage,
    'IMPOSSIBLE SEQUENTIAL' AS finding,
    'CRITICAL'              AS severity,
    x.detail
  FROM (
    SELECT p.*,
      CASE
        WHEN p.starting_sequential IS NULL OR p.ending_sequential IS NULL
          THEN 'Only one end of the range is recorded, so no footage can be derived'
        WHEN p.starting_sequential < 0 OR p.ending_sequential < 0
          THEN 'Negative sequential - cable footage markings do not go below zero'
        WHEN p.seq_lo = p.seq_hi
          THEN 'Start and end are identical - the pull would be 0 FT'
        WHEN p.seq_hi - p.seq_lo > 40000
          THEN 'Range spans ' || CAST(p.seq_hi - p.seq_lo AS varchar)
               || ' FT, beyond any single reel (40,000 FT ceiling)'
      END AS detail
    FROM pulls p
  ) x
  WHERE x.detail IS NOT NULL
),

no_reel AS (
  SELECT
    p.*,
    'NO REEL LINKED' AS finding,
    'WARNING'        AS severity,
    'Sequentials recorded but no reel identified, so the cable cannot be traced '
      || 'to a reel and the range cannot be range-checked' AS detail
  FROM pulls p
  WHERE p.reel_id IS NULL
),

unknown_reel AS (
  SELECT
    p.*,
    'UNKNOWN REEL' AS finding,
    'CRITICAL'     AS severity,
    'Reel ' || p.reel_id || ' is not in the reel master' AS detail
  FROM pulls p
  LEFT JOIN reels r ON r.reel_id = p.reel_id
  WHERE p.reel_id IS NOT NULL AND r.reel_id IS NULL
),

outside_range AS (
  SELECT
    p.*,
    'OUTSIDE REEL RANGE' AS finding,
    'WARNING'            AS severity,
    'Range ' || CAST(p.seq_lo AS varchar) || '-' || CAST(p.seq_hi AS varchar)
      || ' falls outside reel printed range '
      || CAST(r.reel_lo AS varchar) || '-' || CAST(r.reel_hi AS varchar)
      AS detail
  FROM pulls p
  JOIN reels r ON r.reel_id = p.reel_id
  WHERE p.seq_lo IS NOT NULL AND p.seq_hi IS NOT NULL
    AND r.reel_lo IS NOT NULL AND r.reel_hi IS NOT NULL
    AND (p.seq_lo < r.reel_lo OR p.seq_hi > r.reel_hi)
),

over_consumed AS (
  SELECT
    p.*,
    'REEL OVER-CONSUMED' AS finding,
    'CRITICAL'           AS severity,
    'Reel ' || p.reel_id || ' has '
      || CAST(ROUND(CAST(t.approved_consumed AS numeric), 0) AS varchar)
      || ' FT booked against a printed length of '
      || CAST(ROUND(CAST(r.original_reel_footage AS numeric), 0) AS varchar)
      || ' FT (plus ' || CAST(ROUND(CAST(r.waste_recorded AS numeric), 0) AS varchar)
      || ' FT waste)' AS detail
  FROM pulls p
  JOIN reels r       ON r.reel_id = p.reel_id
  JOIN reel_totals t ON t.reel_id = p.reel_id
  WHERE r.original_reel_footage > 0
    AND t.approved_consumed + r.waste_recorded > r.original_reel_footage
    AND p.record_status = 'APPROVED'
),

-- Slack larger than the route it was pulled along is not impossible, but it is
-- nearly always a unit mix-up or a figure typed into the wrong box.
implausible_slack AS (
  SELECT
    p.*,
    'SLACK EXCEEDS ROUTE' AS finding,
    'INFO'                AS severity,
    'Slack ' || CAST(ROUND(CAST(p.slack_footage AS numeric), 0) AS varchar)
      || ' FT exceeds the sequential footage of '
      || CAST(ROUND(CAST(p.sequential_footage AS numeric), 0) AS varchar)
      || ' FT for this pull' AS detail
  FROM pulls p
  WHERE p.sequential_footage > 0
    AND p.slack_footage > p.sequential_footage
),

findings AS (
  SELECT * FROM impossible
  UNION ALL SELECT * FROM no_reel
  UNION ALL SELECT * FROM unknown_reel
  UNION ALL SELECT * FROM outside_range
  UNION ALL SELECT * FROM over_consumed
  UNION ALL SELECT * FROM implausible_slack
)

SELECT
  f.severity,
  f.finding,
  f.detail,
  f.production_id,
  f.record_status,
  f.work_date,
  f.project_id,
  f.contractor_id,
  f.crew,
  f.labor_code,
  f.cable_id,
  f.reel_id,
  f.seq_lo,
  f.seq_hi,
  ROUND(CAST(f.sequential_footage AS numeric), 2)     AS sequential_footage,
  ROUND(CAST(f.slack_footage AS numeric), 2)          AS slack_footage,
  ROUND(CAST(f.total_installed_footage AS numeric), 2) AS total_installed_footage,
  f._record_id
FROM findings f
CROSS JOIN params
WHERE (p_reel_id    IS NULL OR f.reel_id    = p_reel_id)
  AND (p_project_id IS NULL OR f.project_id = p_project_id)
  AND (p_severity   IS NULL OR f.severity   = p_severity)
ORDER BY
  CASE f.severity WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END,
  f.reel_id,
  f.seq_lo,
  f.production_id;
