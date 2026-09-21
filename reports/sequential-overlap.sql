-- Sequential Overlap Exception Report
-- Mainline Construction - Development
--
-- WHY THIS IS A REPORT AND NOT A DEVICE CHECK
-- Detecting that another production record already consumed part of a
-- sequential range requires scanning other records. Fulcrum Data Events offer
-- only REQUEST (HTTP), which is online-only, so a device-side overlap check
-- would silently disappear whenever a crew loses service. A control that works
-- only sometimes, without saying so, is worse than no control: people trust it.
-- Reel-range validation stays on the device (it needs only snapshotted values);
-- cross-record overlap lives here, server-side, where it always runs.
--
-- Run via the Fulcrum Query API.
--
-- CORRECTED 2026-09-17: the Query API names tables by FORM ID, not by form
-- name, and the record status column is _status, not status. This query
-- previously used both wrong and would not have run.
--
-- CLASSIFICATION (Sprint 23.4)
--   EXACT DUPLICATE  identical normalized range          -> CRITICAL
--   CONTAINED        one range wholly inside the other   -> CRITICAL
--   PARTIAL OVERLAP  ranges intersect over >1 sequential -> WARNING
--   ADJACENT         share exactly one boundary value    -> INFO, valid
--
-- ADOPTED RULE: touching ranges (a.end = b.start) are legitimate adjacency,
-- not an overlap. Reels are consumed continuously, so the end of one pull is
-- routinely the start of the next. Flagging those would bury real overlaps in
-- noise. Only an intersection of MORE than a single sequential is an overlap.

-- SCALE (Sprint 19). This is a self-join, so its cost is quadratic in the
-- number of rows that share a reel -- not in the table. reel_id is the
-- partition key and the join's first equality, so at 100k production records
-- across a few thousand reels the engine compares tens of records per reel,
-- not 100k against 100k.
--
-- The date window is ONE-SIDED on purpose. Bounding both sides would hide the
-- case this report exists for: a new pull that overlaps a range booked months
-- ago. So at least one record of each pair must fall inside the window, and
-- its partner is matched against all history. Leave the window NULL to scan
-- everything; set it for a routine run.

WITH params AS (
  SELECT
    CAST(NULL AS date)    AS p_date_from,
    CAST(NULL AS date)    AS p_date_to,
    CAST(NULL AS varchar) AS p_reel_id
),
norm AS (
  SELECT
    _record_id,
    production_id,
    project_id_snapshot,
    contractor_id_snapshot,
    reel_id,
    cable_id,
    work_date,
    LEAST(starting_sequential, ending_sequential)    AS seq_lo,
    GREATEST(starting_sequential, ending_sequential) AS seq_hi
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"   -- Mainline Construction - Development
  CROSS JOIN params
  WHERE starting_sequential IS NOT NULL
    AND ending_sequential   IS NOT NULL
    AND reel_id             IS NOT NULL
    AND _status <> 'VOID'
    AND (p_reel_id IS NULL OR reel_id = p_reel_id)
)
SELECT
  a.production_id AS production_a,
  b.production_id AS production_b,
  a.reel_id,
  a.seq_lo AS a_from, a.seq_hi AS a_to,
  b.seq_lo AS b_from, b.seq_hi AS b_to,
  LEAST(a.seq_hi, b.seq_hi) - GREATEST(a.seq_lo, b.seq_lo) AS overlap_ft,
  CASE
    WHEN a.seq_lo = b.seq_lo AND a.seq_hi = b.seq_hi                     THEN 'EXACT DUPLICATE'
    WHEN (a.seq_lo >= b.seq_lo AND a.seq_hi <= b.seq_hi)
      OR (b.seq_lo >= a.seq_lo AND b.seq_hi <= a.seq_hi)                 THEN 'CONTAINED'
    WHEN LEAST(a.seq_hi, b.seq_hi) - GREATEST(a.seq_lo, b.seq_lo) = 0    THEN 'ADJACENT'
    ELSE 'PARTIAL OVERLAP'
  END AS overlap_type,
  CASE
    WHEN a.seq_lo = b.seq_lo AND a.seq_hi = b.seq_hi                     THEN 'CRITICAL'
    WHEN (a.seq_lo >= b.seq_lo AND a.seq_hi <= b.seq_hi)
      OR (b.seq_lo >= a.seq_lo AND b.seq_hi <= a.seq_hi)                 THEN 'CRITICAL'
    WHEN LEAST(a.seq_hi, b.seq_hi) - GREATEST(a.seq_lo, b.seq_lo) = 0    THEN 'INFO'
    ELSE 'WARNING'
  END AS severity
FROM norm a
JOIN norm b
  ON  a.reel_id = b.reel_id
  AND a._record_id < b._record_id          -- each pair once, never self-matched
CROSS JOIN params
WHERE a.seq_lo <= b.seq_hi
  AND a.seq_hi >= b.seq_lo
  -- One-sided window: either record may be the recent one.
  AND (p_date_from IS NULL
       OR a.work_date >= p_date_from OR b.work_date >= p_date_from)
  AND (p_date_to IS NULL
       OR a.work_date <= p_date_to OR b.work_date <= p_date_to)
ORDER BY severity, a.reel_id, a.seq_lo;
