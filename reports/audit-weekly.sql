-- Weekly Audit  (Sprint 27 - "Check over-plan production, sequential overlaps,
-- aged approvals, missing mappings, inactive-code use, material variance, and
-- contractor anomalies.")  Plus the OI-22 self-approval check.
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--   a5529dd0-54fa-4b8d-b595-d0218df0ee97  MC Contractor Rate - Development
--   38e3d7fd-ca78-4016-8018-ec955446c13f  MC Labor-Material Mapping - Development
--   aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b  MC Project Scope Line - Development
--   458ae172-b7b4-43b5-8917-d7a792c9e81a  MC Change Order - Development
--   ee204906-adb3-431b-a1d9-d7427a4c842c  MC Material Transaction - Development
--
-- One row per check; items = 0 is a PASS. `see_report` lists the records.

WITH params AS (
  SELECT
    CAST(14 AS integer)    AS p_aged_days,           -- pending longer than this is aged
    CAST(0.25 AS numeric)  AS p_material_variance,   -- as material-variance.sql
    CAST(0.10 AS numeric)  AS p_rejected_share        -- contractor anomaly threshold
),
live AS (
  SELECT *
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
  WHERE _status NOT IN ('VOID', 'REVERSED')
),
authorized AS (
  SELECT s.project_id_snap AS project_id, s.labor_code,
         SUM(s.original_planned_quantity) + COALESCE(MAX(ac.qty), 0) AS authorized_quantity
  FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b" s
  LEFT JOIN (
    SELECT co.project_id_snap, line.line_labor_code AS labor_code, SUM(line.line_quantity_change) AS qty
    FROM "458ae172-b7b4-43b5-8917-d7a792c9e81a/quantity_changes" line
    JOIN "458ae172-b7b4-43b5-8917-d7a792c9e81a" co ON co._record_id = line._parent_id
    WHERE co._status = 'APPROVED'
    GROUP BY co.project_id_snap, line.line_labor_code
  ) ac ON ac.project_id_snap = s.project_id_snap AND ac.labor_code = s.labor_code
  WHERE s._status IN ('BASELINED', 'CLOSED')
  GROUP BY s.project_id_snap, s.labor_code
),
over_plan AS (
  SELECT l.project_id_snapshot, l.labor_code
  FROM live l
  JOIN authorized a ON a.project_id = l.project_id_snapshot AND a.labor_code = l.labor_code
  WHERE l._status = 'APPROVED'
  GROUP BY l.project_id_snapshot, l.labor_code, a.authorized_quantity
  HAVING SUM(COALESCE(l.quantity, 0)) > a.authorized_quantity
),
spans AS (
  SELECT _record_id, reel_id,
         LEAST(starting_sequential, ending_sequential)    AS lo,
         GREATEST(starting_sequential, ending_sequential) AS hi
  FROM live
  WHERE reel_id IS NOT NULL AND starting_sequential IS NOT NULL AND ending_sequential IS NOT NULL
    AND COALESCE(production_type, 'Original') <> 'Adjustment'
),
mapped AS (
  SELECT DISTINCT labor_code
  FROM "38e3d7fd-ca78-4016-8018-ec955446c13f"
  WHERE _status NOT IN ('VOID', 'REJECTED', 'SUPERSEDED') AND COALESCE(active, 'yes') <> 'no'
),
installed AS (
  SELECT production_id_snap, material_code_snap,
         SUM(CASE WHEN transaction_type = 'Installed' THEN COALESCE(quantity, 0) ELSE 0 END) AS qty
  FROM "ee204906-adb3-431b-a1d9-d7427a4c842c"
  WHERE _status <> 'VOID'
  GROUP BY production_id_snap, material_code_snap
),
contractor_30d AS (
  SELECT contractor_id_snapshot,
         SUM(CASE WHEN _status = 'REJECTED' THEN COALESCE(extended_value, 0) ELSE 0 END) AS rejected_value,
         SUM(COALESCE(extended_value, 0)) AS total_value
  FROM live
  WHERE work_date >= CURRENT_DATE - 30
  GROUP BY contractor_id_snapshot
),
checks AS (
  SELECT 'W-1' AS check_id, 'Pay units over authorized scope' AS check_name, 'WARNING' AS severity,
         COUNT(*) AS items, CAST(NULL AS numeric) AS value_at_risk, 'remaining-work (OVER PLAN)' AS see_report
  FROM over_plan
  UNION ALL
  SELECT 'W-2', 'Sequential overlaps on one reel', 'WARNING', COUNT(*), CAST(NULL AS numeric), 'sequential-overlap'
  FROM spans a JOIN spans b ON a.reel_id = b.reel_id AND a._record_id < b._record_id
  WHERE LEAST(a.hi, b.hi) - GREATEST(a.lo, b.lo) > 0
  UNION ALL
  SELECT 'W-3', 'Aged approvals (pending past the threshold)', 'WARNING', COUNT(*),
         CAST(SUM(COALESCE(extended_value, 0)) AS numeric), 'exception-dashboard (Old Pending Production)'
  FROM live CROSS JOIN params
  WHERE _status IN ('DRAFT', 'SUBMITTED', 'UNDER REVIEW', 'CORRECTION REQUIRED', 'REOPENED')
    AND work_date <= CURRENT_DATE - p_aged_days
  UNION ALL
  -- Distinct pay units used this week with no mapping. Many legitimately need
  -- none: check each against data/material-coverage-register.csv.
  SELECT 'W-4', 'Pay units used with no material mapping', 'INFO', COUNT(DISTINCT l.labor_code),
         CAST(NULL AS numeric), 'data/material-coverage-register.csv; exception-dashboard'
  FROM live l LEFT JOIN mapped m ON m.labor_code = l.labor_code
  WHERE l.labor_code IS NOT NULL AND m.labor_code IS NULL AND l.work_date >= CURRENT_DATE - 7
  UNION ALL
  -- Inactive-code use: priced from a rate that is inactive now AND was not in
  -- force on the work date (expired, or not yet effective).
  SELECT 'W-5', 'Production priced from a rate not in force on the work date', 'CRITICAL', COUNT(*),
         CAST(SUM(COALESCE(l.extended_value, 0)) AS numeric), 'rate-expected-audit'
  FROM live l
  JOIN "a5529dd0-54fa-4b8d-b595-d0218df0ee97" r ON r.rate_id = l.rate_source_id
  WHERE (r.expiration_date IS NOT NULL AND CAST(r.expiration_date AS date) < CAST(l.work_date AS date))
     OR CAST(r.effective_date AS date) > CAST(l.work_date AS date)
  UNION ALL
  SELECT 'W-6', 'Material variance beyond tolerance', 'WARNING', COUNT(*), CAST(NULL AS numeric), 'material-variance'
  FROM live l CROSS JOIN params
  JOIN installed i ON i.production_id_snap = l.production_id AND i.material_code_snap = l.conduit_material_code
  WHERE l.conduit_material_quantity > 0
    AND ABS(i.qty - l.conduit_material_quantity) / l.conduit_material_quantity > p_material_variance
  UNION ALL
  SELECT 'W-7a', 'Production priced on another contractor''s rate', 'CRITICAL', COUNT(*),
         CAST(SUM(COALESCE(extended_value, 0)) AS numeric), 'contractor-financial'
  FROM live
  WHERE rate_contractor_id_snap IS NOT NULL AND rate_contractor_id_snap <> contractor_id_snapshot
  UNION ALL
  SELECT 'W-7b', 'Contractors with rejected value above the threshold (30 days)', 'WARNING', COUNT(*),
         CAST(SUM(rejected_value) AS numeric), 'contractor-financial (rejected_value_pct)'
  FROM contractor_30d CROSS JOIN params
  WHERE total_value > 0 AND rejected_value / total_value > p_rejected_share
  UNION ALL
  -- OI-22. v7.7.0 refuses this in the app; this catches API writes and
  -- devices on an older script.
  SELECT 'W-8', 'Self-approved production', 'CRITICAL', COUNT(*),
         CAST(SUM(COALESCE(l.extended_value, 0)) AS numeric), 'production-audit-trail (approval_independence)'
  FROM live l
  LEFT JOIN memberships cb ON cb.user_id = l._created_by_id
  WHERE l.approved_by IS NOT NULL
    AND LOWER(TRIM(l.approved_by)) IN (LOWER(TRIM(COALESCE(l.inspector, ''))),
                                       LOWER(TRIM(COALESCE(l.submitted_by, ''))),
                                       LOWER(TRIM(COALESCE(cb.name, ''))))
  UNION ALL
  SELECT 'W-9', 'Approved production changed after approval', 'WARNING', COUNT(*),
         CAST(SUM(COALESCE(extended_value, 0)) AS numeric), 'production-audit-trail (changed_after_approval)'
  FROM live
  WHERE _status = 'APPROVED' AND approved_date IS NOT NULL AND _updated_at > approved_date
)
SELECT
  'WEEKLY'                                       AS frequency,
  CURRENT_DATE                                   AS run_date,
  check_id,
  check_name,
  severity,
  items,
  ROUND(CAST(value_at_risk AS numeric), 2)       AS value_at_risk,
  CASE WHEN items = 0 THEN 'PASS'
       WHEN severity = 'INFO' THEN 'NOTE'
       ELSE 'REVIEW' END                         AS result,
  see_report
FROM checks
ORDER BY check_id;
