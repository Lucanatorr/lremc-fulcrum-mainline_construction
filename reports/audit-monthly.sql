-- Monthly Audit  (Sprint 27 - "Perform financial, rate, scope, material,
-- permission, exception-backlog, and data-quality reviews.")
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--   a5529dd0-54fa-4b8d-b595-d0218df0ee97  MC Contractor Rate - Development
--   aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b  MC Project Scope Line - Development
--   458ae172-b7b4-43b5-8917-d7a792c9e81a  MC Change Order - Development
--   ee204906-adb3-431b-a1d9-d7427a4c842c  MC Material Transaction - Development
--
-- One row per check. The month defaults to the current one; set p_month to
-- review a closed month. Some rows are measurements rather than problems
-- (severity INFO, result NOTE): they are what the reviewer signs off on.
-- History integrity - "verify that historical quantities, rates, values,
-- statuses, relationships, and material quantities have not unexpectedly
-- changed" - is audit-history-fingerprint.sql plus
-- scripts/audit_history_check.py, run in the same review.

WITH params AS (
  SELECT
    CAST(NULL AS varchar) AS p_month_override,     -- e.g. '2026-10'
    CAST(30 AS integer)   AS p_stale_days
),
m AS (
  SELECT COALESCE(p_month_override, TO_CHAR(CURRENT_DATE, 'YYYY-MM')) AS month, p_stale_days
  FROM params
),
prod AS (
  SELECT * FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
),
rates AS (
  SELECT * FROM "a5529dd0-54fa-4b8d-b595-d0218df0ee97" WHERE _status <> 'DRAFT'
),
checks AS (
  -- FINANCIAL ---------------------------------------------------------------
  SELECT 'M-1a' AS check_id, 'Financial: approved production in the month' AS check_name,
         'INFO' AS severity, COUNT(*) AS items,
         CAST(SUM(COALESCE(p.extended_value, 0)) AS numeric) AS value_at_risk,
         'contractor-financial = project-financial, to the cent' AS see_report
  FROM prod p CROSS JOIN m
  WHERE p._status = 'APPROVED' AND p.work_month = m.month
  UNION ALL
  SELECT 'M-1b', 'Financial: approved value that is not quantity x rate', 'CRITICAL', COUNT(*),
         CAST(SUM(ABS(p.extended_value - p.quantity * p.contractor_rate)) AS numeric), 'production-audit-trail'
  FROM prod p
  WHERE p._status = 'APPROVED'
    AND p.extended_value IS NOT NULL AND p.quantity IS NOT NULL AND p.contractor_rate IS NOT NULL
    AND ABS(p.extended_value - p.quantity * p.contractor_rate) > 0.01
  UNION ALL
  SELECT 'M-1c', 'Financial: pending production older than the stale threshold', 'WARNING', COUNT(*),
         CAST(SUM(COALESCE(p.extended_value, 0)) AS numeric), 'qa-review-queue'
  FROM prod p CROSS JOIN m
  WHERE p._status IN ('DRAFT', 'SUBMITTED', 'UNDER REVIEW', 'CORRECTION REQUIRED', 'REOPENED')
    AND p.work_date <= CURRENT_DATE - m.p_stale_days
  UNION ALL
  -- RATE ----------------------------------------------------------------------
  SELECT 'M-2a', 'Rate: active rates with no contract reference', 'WARNING', COUNT(*), CAST(NULL AS numeric),
         'rate-master-audit'
  FROM rates WHERE COALESCE(active, 'yes') = 'yes' AND (contract_reference IS NULL OR contract_reference = '')
  UNION ALL
  SELECT 'M-2b', 'Rate: expired but still marked active', 'WARNING', COUNT(*), CAST(NULL AS numeric),
         'rate-master-audit'
  FROM rates WHERE COALESCE(active, 'yes') = 'yes'
               AND expiration_date IS NOT NULL AND CAST(expiration_date AS date) < CURRENT_DATE
  UNION ALL
  SELECT 'M-2c', 'Rate: production priced off the expected rate', 'CRITICAL', COUNT(*), CAST(NULL AS numeric),
         'rate-expected-audit (severity CRITICAL)'
  FROM prod p
  JOIN rates r ON r.rate_id = p.rate_source_id
  WHERE p._status NOT IN ('VOID', 'REVERSED')
    AND ((r.expiration_date IS NOT NULL AND CAST(r.expiration_date AS date) < CAST(p.work_date AS date))
         OR CAST(r.effective_date AS date) > CAST(p.work_date AS date))
  UNION ALL
  -- SCOPE ---------------------------------------------------------------------
  SELECT 'M-3a', 'Scope: change orders open longer than the stale threshold', 'WARNING', COUNT(*),
         CAST(NULL AS numeric), 'project-scope-status (pending_change_orders)'
  FROM "458ae172-b7b4-43b5-8917-d7a792c9e81a" co CROSS JOIN m
  WHERE co._status IN ('DRAFT', 'SUBMITTED') AND CAST(co._created_at AS date) <= CURRENT_DATE - m.p_stale_days
  UNION ALL
  SELECT 'M-3b', 'Scope: scope lines still DRAFT (not authorized scope)', 'WARNING', COUNT(*),
         CAST(NULL AS numeric), 'remaining-work'
  FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b" s WHERE s._status = 'DRAFT'
  UNION ALL
  SELECT 'M-3c', 'Scope: production on pay units with no baselined scope', 'WARNING',
         COUNT(DISTINCT p.project_id_snapshot || '/' || p.labor_code), CAST(NULL AS numeric), 'unplanned-production'
  FROM prod p
  WHERE p._status NOT IN ('VOID', 'REVERSED', 'REJECTED')
    AND NOT EXISTS (SELECT 1 FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b" s
                    WHERE s._status IN ('BASELINED', 'CLOSED')
                      AND s.project_id_snap = p.project_id_snapshot AND s.labor_code = p.labor_code)
  UNION ALL
  -- MATERIAL ------------------------------------------------------------------
  SELECT 'M-4a', 'Material: ledger entries still DRAFT (OI-21)', 'WARNING', COUNT(*), CAST(NULL AS numeric),
         'material-variance'
  FROM "ee204906-adb3-431b-a1d9-d7427a4c842c" t CROSS JOIN m
  WHERE t._status = 'DRAFT' AND CAST(t._created_at AS date) <= CURRENT_DATE - m.p_stale_days
  UNION ALL
  SELECT 'M-4b', 'Material: conduit production with no material booked', 'INFO', COUNT(*), CAST(NULL AS numeric),
         'material-variance (NO MATERIAL REPORTED)'
  FROM prod p
  WHERE p._status = 'APPROVED' AND p.conduit_material_code IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM "ee204906-adb3-431b-a1d9-d7427a4c842c" t
                    WHERE t.production_id_snap = p.production_id AND t._status <> 'VOID')
  UNION ALL
  -- PERMISSION ----------------------------------------------------------------
  -- The memberships table also holds INACTIVE members; only active ones count.
  SELECT 'M-5a', 'Permission: active Owners (target: 2 or fewer)', 'WARNING',
         CASE WHEN COUNT(*) > 2 THEN COUNT(*) ELSE 0 END, CAST(NULL AS numeric),
         'docs/uat/role-model.md; memberships_list'
  FROM (SELECT role_name, status AS membership_status FROM memberships) ms
  WHERE ms.role_name = 'Owner' AND ms.membership_status = 'active'
  UNION ALL
  SELECT 'M-5b', 'Permission: active members (review the list for leavers)', 'INFO', COUNT(*),
         CAST(NULL AS numeric), 'memberships_list'
  FROM (SELECT status AS membership_status FROM memberships) ms
  WHERE ms.membership_status = 'active'
  UNION ALL
  -- EXCEPTION BACKLOG ---------------------------------------------------------
  SELECT 'M-6a', 'Backlog: CRITICAL exceptions older than the stale threshold', 'CRITICAL', COUNT(*),
         CAST(SUM(COALESCE(p.extended_value, 0)) AS numeric), 'exception-dashboard'
  FROM prod p CROSS JOIN m
  WHERE p._status NOT IN ('VOID', 'REVERSED', 'REJECTED', 'APPROVED')
    AND p.exception_severity = 'CRITICAL' AND p.work_date <= CURRENT_DATE - m.p_stale_days
  UNION ALL
  SELECT 'M-6b', 'Backlog: open QA deficiencies past their due date', 'WARNING', COUNT(*),
         CAST(SUM(COALESCE(p.extended_value, 0)) AS numeric), 'qa-review-queue'
  FROM prod p
  WHERE p._status NOT IN ('VOID', 'REVERSED')
    AND p.qa_status IN ('Fail', 'Conditional Pass') AND COALESCE(p.correction_completed, 'no') <> 'yes'
    AND p.qa_due_date IS NOT NULL AND CAST(p.qa_due_date AS date) < CURRENT_DATE
  UNION ALL
  -- DATA QUALITY --------------------------------------------------------------
  SELECT 'M-7a', 'Data quality: taken out of official totals this month (VOID / REVERSED)', 'INFO', COUNT(*),
         CAST(SUM(COALESCE(p.extended_value, 0)) AS numeric), 'voided-reversed'
  FROM prod p CROSS JOIN m
  WHERE p._status IN ('VOID', 'REVERSED') AND TO_CHAR(CAST(p._updated_at AS date), 'YYYY-MM') = m.month
  UNION ALL
  SELECT 'M-7b', 'Data quality: adjustments this month', 'INFO', COUNT(*),
         CAST(SUM(COALESCE(p.extended_value, 0)) AS numeric), 'voided-reversed (ADJUSTMENT)'
  FROM prod p CROSS JOIN m
  WHERE COALESCE(p.production_type, 'Original') = 'Adjustment' AND p.work_month = m.month
  UNION ALL
  SELECT 'M-7c', 'Data quality: records with fewer than 4 identifying values', 'WARNING', COUNT(*),
         CAST(NULL AS numeric), 'duplicate-production (TOO SPARSE TO CHECK)'
  FROM prod p
  WHERE p._status NOT IN ('VOID', 'REVERSED', 'REJECTED')
    AND CAST(COALESCE(p.fingerprint_strength, 0) AS integer) < 4
)
SELECT
  'MONTHLY'                                      AS frequency,
  (SELECT month FROM m)                          AS review_month,
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
