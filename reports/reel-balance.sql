-- Fiber Reel Balance Report  (Sprint 17)
--
-- Per reel: printed sequential consumption, physical installed footage, slack,
-- waste and estimated remaining footage -- kept as five SEPARATE numbers.
-- See reports/_conventions.md for the shared rules.
--
--   728477da-5f36-48cb-b3ab-cbc8c38d077f  MC Fiber Reel - Development
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- WHY FIVE COLUMNS AND NOT ONE
-- The brief: "Maintain separate concepts for Printed Sequential Consumption,
-- Physical Installed Footage, Slack, Waste, Remaining Estimated Reel Footage.
-- This is important because cable handling can cause the physical quantity
-- consumed to differ from route footage."
--
--   PRINTED SEQUENTIAL CONSUMED  what the numbers printed on the jacket say was
--                                pulled off: ABS(end - start), summed. This is
--                                the only figure that measures the REEL.
--   PHYSICAL INSTALLED FOOTAGE   what went in the ground or on the strand:
--                                sequential + slack + other added footage.
--   SLACK                        coils left at structures for future splicing.
--                                Installed, but not route distance.
--   WASTE                        cable lost to handling, damage or cut-back.
--                                Off the reel and not installed anywhere.
--   REMAINING (ESTIMATE)         original footage - printed consumed - waste.
--
-- WHY SLACK IS NOT SUBTRACTED AGAIN
-- The brief warns: "Do not simply subtract slack from the printed sequential
-- range unless the business definition requires it." Slack is pulled off the
-- reel INSIDE the consumed sequential range -- the jacket numbers advance while
-- the coil is being pulled -- so it is already counted in printed consumed.
-- Subtracting it a second time would understate every reel by the size of its
-- coils. Waste IS subtracted separately because cut-back cable leaves the reel
-- without ever appearing in an installed sequential range.
--
-- WHY THIS IS A REPORT AND NOT FIELDS ON THE REEL
-- Four of these five are sums over production records. The reel record cannot
-- see other records, and storing a running total on the master would violate
-- the standing rule that totals are never stored (same reasoning as scope
-- totals in project-scope-status.sql). The reel master keeps only what is a
-- FACT about the reel: its printed range, and the waste somebody recorded.
--
-- APPROVED ONLY, with pending shown separately: a reel whose remaining footage
-- moved on unapproved records would mislead anyone deciding whether it can
-- cover the next pull.

WITH params AS (
  SELECT
    CAST(NULL AS varchar) AS p_reel_id,
    CAST(NULL AS varchar) AS p_project_id,
    CAST(NULL AS varchar) AS p_reel_status   -- 'AVAILABLE', 'IN USE', ...
),

consumption AS (
  SELECT
    p.reel_id,
    SUM(CASE WHEN p._status = 'APPROVED'
             THEN COALESCE(p.sequential_footage, 0) ELSE 0 END)
      AS printed_sequential_consumed,
    SUM(CASE WHEN p._status = 'APPROVED'
             THEN COALESCE(p.total_installed_footage, 0) ELSE 0 END)
      AS physical_installed_footage,
    SUM(CASE WHEN p._status = 'APPROVED'
             THEN COALESCE(p.slack_footage, 0) ELSE 0 END)
      AS slack_installed,
    SUM(CASE WHEN p._status = 'APPROVED'
             THEN COALESCE(p.other_added_footage, 0) ELSE 0 END)
      AS other_added_footage,
    SUM(CASE WHEN p._status IN ('DRAFT','SUBMITTED','UNDER REVIEW','CORRECTION REQUIRED')
             THEN COALESCE(p.sequential_footage, 0) ELSE 0 END)
      AS pending_sequential_consumed,
    COUNT(CASE WHEN p._status = 'APPROVED' THEN 1 END)  AS approved_pull_count,
    MIN(CASE WHEN p._status = 'APPROVED' THEN p.work_date END) AS first_pull_date,
    MAX(CASE WHEN p._status = 'APPROVED' THEN p.work_date END) AS last_pull_date,
    MIN(CASE WHEN p._status = 'APPROVED'
             THEN LEAST(p.starting_sequential, p.ending_sequential) END) AS lowest_sequential_used,
    MAX(CASE WHEN p._status = 'APPROVED'
             THEN GREATEST(p.starting_sequential, p.ending_sequential) END) AS highest_sequential_used
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
  WHERE p._status <> 'VOID'
    AND p.reel_id IS NOT NULL
  GROUP BY p.reel_id
),

rows AS (
  SELECT
    r.reel_id,
    r._status                              AS reel_status,
    r.manufacturer,
    r.cable_type,
    r.fiber_count,
    r.beginning_sequential,
    r.ending_sequential,
    COALESCE(r.original_reel_footage, 0)   AS original_reel_footage,
    COALESCE(r.waste_recorded, 0)          AS waste_recorded,
    COALESCE(c.printed_sequential_consumed, 0) AS printed_sequential_consumed,
    COALESCE(c.physical_installed_footage, 0)  AS physical_installed_footage,
    COALESCE(c.slack_installed, 0)             AS slack_installed,
    COALESCE(c.other_added_footage, 0)         AS other_added_footage,
    COALESCE(c.pending_sequential_consumed, 0) AS pending_sequential_consumed,
    COALESCE(c.approved_pull_count, 0)         AS approved_pull_count,
    c.first_pull_date,
    c.last_pull_date,
    c.lowest_sequential_used,
    c.highest_sequential_used,
    COALESCE(r.original_reel_footage, 0)
      - COALESCE(c.printed_sequential_consumed, 0)
      - COALESCE(r.waste_recorded, 0)          AS remaining_estimated_footage
  FROM "728477da-5f36-48cb-b3ab-cbc8c38d077f" r
  CROSS JOIN params
  LEFT JOIN consumption c ON c.reel_id = r.reel_id
  WHERE r._status <> 'VOID'
    AND (p_reel_id     IS NULL OR r.reel_id = p_reel_id)
    AND (p_reel_status IS NULL OR r._status = p_reel_status)
)

SELECT
  reel_id,
  reel_status,
  manufacturer,
  cable_type,
  fiber_count,
  beginning_sequential,
  ending_sequential,
  ROUND(CAST(original_reel_footage AS numeric), 2)       AS original_reel_footage,

  ROUND(CAST(printed_sequential_consumed AS numeric), 2) AS printed_sequential_consumed,
  ROUND(CAST(physical_installed_footage AS numeric), 2)  AS physical_installed_footage,
  ROUND(CAST(slack_installed AS numeric), 2)             AS slack_installed,
  ROUND(CAST(other_added_footage AS numeric), 2)         AS other_added_footage,
  ROUND(CAST(waste_recorded AS numeric), 2)              AS waste_recorded,
  ROUND(CAST(remaining_estimated_footage AS numeric), 2) AS remaining_estimated_footage,

  ROUND(CAST(pending_sequential_consumed AS numeric), 2) AS pending_sequential_consumed,

  -- The handling difference the brief exists to expose: physical installed
  -- minus what the jacket says came off. Positive is normal (slack and other
  -- added footage are installed but advance no sequential of their own beyond
  -- the range). A large figure means the two are being recorded inconsistently.
  ROUND(CAST(physical_installed_footage - printed_sequential_consumed AS numeric), 2)
    AS handling_difference,

  approved_pull_count,
  first_pull_date,
  last_pull_date,
  lowest_sequential_used,
  highest_sequential_used,

  CASE
    WHEN original_reel_footage = 0 THEN NULL
    ELSE ROUND(CAST(printed_sequential_consumed AS numeric)
               / CAST(original_reel_footage AS numeric) * 100, 1)
  END AS percent_consumed,

  CASE
    WHEN printed_sequential_consumed + waste_recorded > original_reel_footage
      THEN 'OVER-CONSUMED - more cable booked than the reel holds'
    WHEN original_reel_footage = 0 THEN 'NO PRINTED RANGE'
    WHEN printed_sequential_consumed = 0 THEN 'UNUSED'
    WHEN remaining_estimated_footage <= 0 THEN 'DEPLETED'
    WHEN remaining_estimated_footage < 500 THEN 'LOW - under 500 FT estimated'
    ELSE 'IN SERVICE'
  END AS balance_state
FROM rows
ORDER BY
  CASE WHEN printed_sequential_consumed + waste_recorded > original_reel_footage THEN 0 ELSE 1 END,
  remaining_estimated_footage,
  reel_id;
