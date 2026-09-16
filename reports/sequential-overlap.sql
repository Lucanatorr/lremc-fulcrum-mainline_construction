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

WITH norm AS (
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
  FROM "Mainline Construction - Development"
  WHERE starting_sequential IS NOT NULL
    AND ending_sequential   IS NOT NULL
    AND reel_id             IS NOT NULL
    AND status <> 'VOID'
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
WHERE a.seq_lo <= b.seq_hi
  AND a.seq_hi >= b.seq_lo
ORDER BY severity, a.reel_id, a.seq_lo;
