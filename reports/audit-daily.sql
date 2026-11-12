-- Daily Audit  (Sprint 27 - "Check missing/zero rates, failed calculations,
-- missing project/contractor, potential duplicates, and critical QA failures.")
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- One row per check. `items` = 0 is a PASS. Anything else is REVIEW: open the
-- report named in `see_report`, which lists the records. This is a checklist,
-- not a second copy of those reports, so each check is the smallest SQL that
-- counts the problem.
--
-- Scope: live production - not VOID, REVERSED or REJECTED. A rejected record
-- is not billable, so its rate problems are not today's problem.

WITH live AS (
  SELECT *
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
  WHERE _status NOT IN ('VOID', 'REVERSED', 'REJECTED')
),
dup_groups AS (
  SELECT fingerprint_strict
  FROM live
  WHERE fingerprint_strict IS NOT NULL
    AND CAST(COALESCE(fingerprint_strength, 0) AS integer) >= 5
    AND starting_sequential IS NOT NULL
    AND COALESCE(production_type, 'Original') <> 'Adjustment'
  GROUP BY fingerprint_strict
  HAVING COUNT(*) > 1
),
checks AS (
  SELECT 'D-1' AS check_id, 'Missing rate' AS check_name, 'CRITICAL' AS severity,
         COUNT(*) AS items, CAST(NULL AS numeric) AS value_at_risk,
         'exception-dashboard (Missing Rate)' AS see_report
  FROM live WHERE rate_source_id IS NULL
  UNION ALL
  SELECT 'D-2', 'Zero rate', 'CRITICAL', COUNT(*), CAST(0 AS numeric), 'rate-audit'
  FROM live WHERE rate_source_id IS NOT NULL AND COALESCE(contractor_rate, 0) = 0
  UNION ALL
  -- A derivation that should have run and did not: no unit, no reporting week,
  -- no production ID, or a priced quantity with no extended value.
  SELECT 'D-3', 'Failed calculation (missing derived value)', 'CRITICAL', COUNT(*),
         CAST(SUM(COALESCE(quantity, 0) * COALESCE(contractor_rate, 0)) AS numeric), 'production-audit-trail'
  FROM live
  WHERE unit IS NULL OR work_week IS NULL OR production_id IS NULL
     OR (quantity IS NOT NULL AND contractor_rate IS NOT NULL AND extended_value IS NULL)
  UNION ALL
  -- Extended value must equal quantity x rate. A difference means the value was
  -- written by something other than the app's calculation (import, API).
  SELECT 'D-4', 'Value does not equal quantity x rate', 'CRITICAL', COUNT(*),
         CAST(SUM(ABS(extended_value - quantity * contractor_rate)) AS numeric), 'production-audit-trail'
  FROM live
  WHERE extended_value IS NOT NULL AND quantity IS NOT NULL AND contractor_rate IS NOT NULL
    AND ABS(extended_value - quantity * contractor_rate) > 0.01
  UNION ALL
  SELECT 'D-5', 'Missing project or contractor', 'CRITICAL', COUNT(*),
         CAST(SUM(COALESCE(extended_value, 0)) AS numeric), 'exception-dashboard'
  FROM live
  WHERE project_id_snapshot IS NULL OR project_id_snapshot = ''
     OR contractor_id_snapshot IS NULL OR contractor_id_snapshot = ''
  UNION ALL
  SELECT 'D-6', 'Potential duplicate (identical strict fingerprint)', 'CRITICAL', COUNT(*),
         CAST(SUM(COALESCE(extended_value, 0)) AS numeric), 'duplicate-production'
  FROM live WHERE fingerprint_strict IN (SELECT fingerprint_strict FROM dup_groups)
  UNION ALL
  SELECT 'D-7', 'Critical QA failure not yet corrected', 'CRITICAL', COUNT(*),
         CAST(SUM(COALESCE(extended_value, 0)) AS numeric), 'qa-review-queue'
  FROM live WHERE qa_status = 'Fail' AND COALESCE(correction_completed, 'no') <> 'yes'
  UNION ALL
  SELECT 'D-8', 'Record carrying a CRITICAL exception', 'CRITICAL', COUNT(*),
         CAST(SUM(COALESCE(extended_value, 0)) AS numeric), 'exception-dashboard'
  FROM live WHERE exception_severity = 'CRITICAL'
  UNION ALL
  -- D-019: records last saved before calc_version existed have not been
  -- recalculated by any current script. Informational: they re-derive on save.
  SELECT 'D-9', 'Not recalculated since calc_version (D-019) was introduced', 'INFO', COUNT(*),
         CAST(NULL AS numeric), 'production-audit-trail'
  FROM live WHERE calc_version IS NULL
)
SELECT
  'DAILY'                                        AS frequency,
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
