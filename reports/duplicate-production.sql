-- Possible Duplicate Production  (Sprints 12/13)
--
-- See reports/_conventions.md for the shared rules.
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- SPRINT 13: THE FINGERPRINT DOES THE WORK NOW
-- Every production record derives two canonical fingerprints on the device
-- (v7.0.0 buildFingerprints), so detecting a duplicate is a GROUP BY rather
-- than a self-join over five weighted signals:
--
--   fingerprint_strict   project | contractor | date | pay unit | cable | seq range
--   fingerprint_segment  project | contractor | date | pay unit | normalized segment
--
-- Both are direction-normalized, so a crew pulling the other way does not
-- create a second identity for one physical cable. Both are readable rather
-- than hashed, on purpose: a reviewer can see which component differs.
--
-- fingerprint_strength counts how many identifying values a record actually
-- carries. Below 4 the fingerprint is too sparse to mean anything, and matching
-- on it would report every thin record as a duplicate of every other. Those are
-- reported separately as a data-quality finding, not as duplicates.
--
-- WHY THE HEURISTIC SECTION SURVIVES
-- Records saved before v7.0.0 carry no fingerprint, and the app version is not
-- deployed yet. Section 3 is the original scored self-join, kept so the report
-- works today and keeps working for historical records afterwards.
--
-- Rejected and void records are excluded throughout: a rejected record already
-- had its answer, and a resubmitted correction would otherwise pair with the
-- original forever.

-- SCALE (Sprint 19). Sections 1, 2 and 4 are GROUP BY over an indexed derived
-- column, so they are linear in the table -- which is the whole reason the
-- fingerprints exist. Section 3 is the only self-join, and it is keyed on
-- project + contractor + work_date + labor_code, so it compares records that
-- already share four values: a handful of rows per group, not the table.
--
-- The window below is one-sided in the same way as sequential-overlap.sql:
-- a duplicate raised today against a record from last month must still be
-- found, so only one side of each pair needs to fall inside it.

WITH params AS (
  SELECT
    CAST(NULL AS date)    AS p_date_from,
    CAST(NULL AS date)    AS p_date_to,
    CAST(NULL AS varchar) AS p_project_id
),
live AS (
  SELECT
    _record_id, production_id, work_date,
    project_id_snapshot    AS project_id,
    contractor_id_snapshot AS contractor_id,
    crew, labor_code, unit, quantity, extended_value,
    segment_id, from_location, to_location, reel_id, cable_id,
    starting_sequential, ending_sequential,
    fingerprint_strict, fingerprint_segment, fingerprint_strength,
    _status AS record_status, _created_at
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
  CROSS JOIN params
  WHERE _status NOT IN ('VOID', 'REJECTED')
    AND (p_project_id IS NULL OR project_id_snapshot = p_project_id)
)

-- 1. STRICT FINGERPRINT COLLISION. The same pay unit, on the same day, for the
--    same contractor, claiming the same cable and the same sequential range.
--    The same physical cable cannot be placed twice.
SELECT
  'STRICT FINGERPRINT MATCH'                   AS finding,
  'CRITICAL'                                   AS severity,
  COUNT(*)                                     AS records,
  STRING_AGG(production_id, ', ')              AS production_ids,
  MAX(work_date)                               AS work_date,
  MAX(project_id)                              AS project_id,
  MAX(contractor_id)                           AS contractor_id,
  MAX(labor_code)                              AS labor_code,
  SUM(COALESCE(quantity, 0))                   AS combined_quantity,
  ROUND(CAST(SUM(COALESCE(extended_value, 0)) AS numeric), 2) AS combined_value,
  -- What one of them is worth, i.e. the likely overstatement if these are the
  -- same work recorded twice.
  ROUND(CAST(SUM(COALESCE(extended_value, 0))
             - MAX(COALESCE(extended_value, 0)) AS numeric), 2) AS value_at_risk,
  fingerprint_strict                           AS fingerprint,
  'Same contractor, day, pay unit, cable and sequential range. The same cable '
    || 'cannot be placed twice - one of these is almost certainly a re-entry.'
                                               AS detail
FROM live
WHERE fingerprint_strict IS NOT NULL
  AND COALESCE(fingerprint_strength, 0) >= 5   -- needs the cable and range present
  AND starting_sequential IS NOT NULL
GROUP BY fingerprint_strict
HAVING COUNT(*) > 1

UNION ALL

-- 2. SEGMENT FINGERPRINT COLLISION. Same day, contractor and pay unit between
--    the same two structures. The only duplicate signal available for boring,
--    trenching and structure work, which have no sequentials.
SELECT
  'SEGMENT FINGERPRINT MATCH'                  AS finding,
  'WARNING'                                    AS severity,
  COUNT(*)                                     AS records,
  STRING_AGG(production_id, ', ')              AS production_ids,
  MAX(work_date)                               AS work_date,
  MAX(project_id)                              AS project_id,
  MAX(contractor_id)                           AS contractor_id,
  MAX(labor_code)                              AS labor_code,
  SUM(COALESCE(quantity, 0))                   AS combined_quantity,
  ROUND(CAST(SUM(COALESCE(extended_value, 0)) AS numeric), 2) AS combined_value,
  ROUND(CAST(SUM(COALESCE(extended_value, 0))
             - MAX(COALESCE(extended_value, 0)) AS numeric), 2) AS value_at_risk,
  fingerprint_segment                          AS fingerprint,
  'Same contractor, day and pay unit between the same two structures. '
    || 'Legitimate when the work genuinely took two passes - check the '
    || 'quantities add up to the segment length rather than repeating it.'
                                               AS detail
FROM live
WHERE fingerprint_segment IS NOT NULL
  AND COALESCE(fingerprint_strength, 0) >= 5   -- needs the segment present
  AND segment_id IS NOT NULL
  -- Suppress rows already caught by the stricter check above.
  AND starting_sequential IS NULL
GROUP BY fingerprint_segment
HAVING COUNT(*) > 1

UNION ALL

-- 3. HEURISTIC PAIRS, for records with no fingerprint (saved before v7.0.0, or
--    while it is undeployed). Scored rather than asserted: two records can
--    legitimately share a day, crew and pay unit - a bore crew doing 300 FT at
--    one crossing and 400 FT at another is two real transactions. Over-flagging
--    teaches reviewers to dismiss the report, which costs more than the
--    duplicates would.
SELECT
  'HEURISTIC MATCH - NO FINGERPRINT'           AS finding,
  CASE
    WHEN MAX(same_sequentials) = 1                                  THEN 'CRITICAL'
    WHEN MAX(same_quantity) = 1 AND MAX(same_segment) = 1           THEN 'CRITICAL'
    WHEN MAX(same_quantity) = 1 AND MAX(entered_together) = 1       THEN 'WARNING'
    WHEN MAX(same_quantity) = 1 OR MAX(same_segment) = 1            THEN 'WARNING'
    ELSE 'INFO'
  END                                          AS severity,
  2                                            AS records,
  MAX(production_a) || ', ' || MAX(production_b) AS production_ids,
  MAX(work_date)                               AS work_date,
  MAX(project_id)                              AS project_id,
  MAX(contractor_id)                           AS contractor_id,
  MAX(labor_code)                              AS labor_code,
  MAX(quantity_a) + MAX(quantity_b)            AS combined_quantity,
  ROUND(CAST(MAX(value_a) + MAX(value_b) AS numeric), 2) AS combined_value,
  ROUND(CAST(LEAST(MAX(value_a), MAX(value_b)) AS numeric), 2) AS value_at_risk,
  NULL                                         AS fingerprint,
  'Agreement score ' || CAST(MAX(agreement_score) AS varchar) || ' of 5. '
    || CASE
         WHEN MAX(same_sequentials) = 1
           THEN 'Identical sequential range - the same cable cannot be placed twice.'
         WHEN MAX(same_quantity) = 1 AND MAX(same_segment) = 1
           THEN 'Same quantity and segment; nothing distinguishes these records.'
         WHEN MAX(same_quantity) = 1 AND MAX(entered_together) = 1
           THEN 'Same quantity, entered within five minutes - the signature of a double save.'
         ELSE 'Same day, contractor and pay unit. Check the from/to structures.'
       END                                     AS detail
FROM (
  SELECT
    a.production_id AS production_a,
    b.production_id AS production_b,
    a.work_date, a.project_id, a.contractor_id, a.labor_code,
    a.quantity AS quantity_a, b.quantity AS quantity_b,
    a.extended_value AS value_a, b.extended_value AS value_b,
    a._record_id AS rid_a, b._record_id AS rid_b,
    CASE WHEN a.quantity = b.quantity THEN 1 ELSE 0 END AS same_quantity,
    CASE WHEN a.segment_id IS NOT NULL
              AND a.segment_id = b.segment_id THEN 1 ELSE 0 END AS same_segment,
    CASE WHEN a.starting_sequential IS NOT NULL
              AND a.starting_sequential = b.starting_sequential
              AND a.ending_sequential   = b.ending_sequential
         THEN 1 ELSE 0 END AS same_sequentials,
    CASE WHEN a.crew IS NOT NULL AND a.crew = b.crew THEN 1 ELSE 0 END AS same_crew,
    -- EXTRACT(EPOCH FROM ...) rather than a cast: a timestamp cannot be cast
    -- to bigint in Postgres, which is what the Query API runs.
    CASE WHEN ABS(EXTRACT(EPOCH FROM a._created_at) - EXTRACT(EPOCH FROM b._created_at)) < 300
         THEN 1 ELSE 0 END AS entered_together,
    (CASE WHEN a.quantity = b.quantity THEN 1 ELSE 0 END
     + CASE WHEN a.segment_id IS NOT NULL AND a.segment_id = b.segment_id THEN 1 ELSE 0 END
     + CASE WHEN a.starting_sequential IS NOT NULL
                 AND a.starting_sequential = b.starting_sequential
                 AND a.ending_sequential = b.ending_sequential THEN 1 ELSE 0 END
     + CASE WHEN a.crew IS NOT NULL AND a.crew = b.crew THEN 1 ELSE 0 END
     + CASE WHEN ABS(EXTRACT(EPOCH FROM a._created_at) - EXTRACT(EPOCH FROM b._created_at)) < 300
            THEN 1 ELSE 0 END) AS agreement_score
  FROM live a
  JOIN live b
    ON  a.project_id    = b.project_id
    AND a.contractor_id = b.contractor_id
    AND a.work_date     = b.work_date
    AND a.labor_code    = b.labor_code
    AND a._record_id    < b._record_id       -- each pair once, never self-matched
  CROSS JOIN params
  WHERE (a.fingerprint_strict IS NULL OR b.fingerprint_strict IS NULL)
    AND (p_date_from IS NULL
         OR a.work_date >= p_date_from OR b.work_date >= p_date_from)
    AND (p_date_to IS NULL
         OR a.work_date <= p_date_to OR b.work_date <= p_date_to)
) pairs
GROUP BY rid_a, rid_b

UNION ALL

-- 4. Records too sparse to duplicate-check at all. Not duplicates - the point
--    is that nobody can tell, which is worth saying rather than leaving the
--    check silently unperformed.
SELECT
  'TOO SPARSE TO CHECK'                        AS finding,
  'INFO'                                       AS severity,
  COUNT(*)                                     AS records,
  STRING_AGG(production_id, ', ')              AS production_ids,
  MAX(work_date)                               AS work_date,
  MAX(project_id)                              AS project_id,
  MAX(contractor_id)                           AS contractor_id,
  MAX(labor_code)                              AS labor_code,
  SUM(COALESCE(quantity, 0))                   AS combined_quantity,
  ROUND(CAST(SUM(COALESCE(extended_value, 0)) AS numeric), 2) AS combined_value,
  CAST(NULL AS numeric)                        AS value_at_risk,
  NULL                                         AS fingerprint,
  'Fewer than 4 identifying values recorded, so no duplicate check is possible. '
    || 'Add the cable ID and sequentials, or the from/to structures.'
                                               AS detail
FROM live
WHERE COALESCE(fingerprint_strength, 0) < 4
GROUP BY project_id, contractor_id, labor_code

ORDER BY severity, finding, value_at_risk DESC;
