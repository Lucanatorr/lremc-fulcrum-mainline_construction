-- Data-Quality Scorecard  (Sprint 32 periodic review)
--
-- The brief: "Maintain a data-quality scorecard: valid rates, approved
-- production, required documentation, duplicates, missing mappings, QA
-- failures, open corrections, orphans, and rate exceptions."
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--   a5529dd0-54fa-4b8d-b595-d0218df0ee97  MC Contractor Rate - Development
--   38e3d7fd-ca78-4016-8018-ec955446c13f  MC Labor-Material Mapping - Development
--   658143d1-edbd-430b-81bb-1b0bb1092729  MC Material Master - Development
--   5ce243d4-9ec1-4fbd-8659-7be9f632b55c  MC Project Master - Development
--   d8a368b5-1e19-4f5f-8cf9-ff8fbdd03ab4  MC Contractor Master - Development
--   aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b  MC Project Scope Line - Development
--
-- One row per measure: good / total, the score, the target, and a status.
-- score_pct is the share of the population that is GOOD, so higher is always
-- better. NO DATA when the population is empty: an empty table scores
-- nothing, it does not score 100%.
-- Detail for any measure below target is in the report named in drill_down.
-- Run monthly; keep the result with the periodic review
-- (docs/sprint-32-continuous-improvement.md section 3).

WITH prod AS (
  SELECT * FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" WHERE _status <> 'VOID'
),
rates AS (
  SELECT * FROM "a5529dd0-54fa-4b8d-b595-d0218df0ee97" WHERE _status = 'ACTIVE'
),
maps AS (
  SELECT * FROM "38e3d7fd-ca78-4016-8018-ec955446c13f" WHERE _status = 'APPROVED'
),
mat  AS (SELECT material_code FROM "658143d1-edbd-430b-81bb-1b0bb1092729"),
proj AS (SELECT project_id FROM "5ce243d4-9ec1-4fbd-8659-7be9f632b55c"),
con  AS (SELECT contractor_id FROM "d8a368b5-1e19-4f5f-8cf9-ff8fbdd03ab4"),
allrates AS (SELECT rate_id FROM "a5529dd0-54fa-4b8d-b595-d0218df0ee97"),
scope AS (SELECT * FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b" WHERE _status <> 'VOID'),
dup AS (
  SELECT COUNT(*) AS n FROM prod
  WHERE _status NOT IN ('REVERSED', 'REJECTED') AND fingerprint_strict IN (
    SELECT fingerprint_strict FROM prod
    WHERE _status NOT IN ('REVERSED', 'REJECTED') AND fingerprint_strict IS NOT NULL
    GROUP BY fingerprint_strict HAVING COUNT(*) > 1)
),
measures AS (
  SELECT 'DQ-01' AS measure_id, 'Valid rates' AS measure,
         'ACTIVE rates that can price work: a unit, a rate above zero, an effective date, not expired' AS definition,
         SUM(CASE WHEN COALESCE(unit, '') <> '' AND CAST(unit_rate AS numeric) > 0 AND effective_date IS NOT NULL
                   AND (expiration_date IS NULL OR CAST(expiration_date AS date) >= CURRENT_DATE) THEN 1 ELSE 0 END) AS good,
         COUNT(*) AS total, 100.0 AS target_pct, 'rate-master-audit.sql' AS drill_down
  FROM rates
  UNION ALL
  SELECT 'DQ-02', 'Rates traceable to a contract', 'ACTIVE rates with a contract reference (OI-09)',
         SUM(CASE WHEN COALESCE(contract_reference, '') <> '' THEN 1 ELSE 0 END), COUNT(*), 100.0, 'rate-master-audit.sql'
  FROM rates
  UNION ALL
  SELECT 'DQ-03', 'Approved production', 'Non-VOID production records that are APPROVED (informational: the rest is in the pipeline)',
         SUM(CASE WHEN _status = 'APPROVED' THEN 1 ELSE 0 END), COUNT(*), NULL, 'qa-review-queue.sql'
  FROM prod
  UNION ALL
  SELECT 'DQ-04', 'Required documentation', 'APPROVED production with at least one QA photo',
         SUM(CASE WHEN qa_photos IS NOT NULL AND CARDINALITY(qa_photos) > 0 THEN 1 ELSE 0 END), COUNT(*), 100.0, 'closeout-readiness.sql'
  FROM prod WHERE _status = 'APPROVED'
  UNION ALL
  SELECT 'DQ-05', 'No duplicates', 'Live production not sharing a strict fingerprint with another record',
         (SELECT COUNT(*) FROM prod WHERE _status NOT IN ('REVERSED', 'REJECTED')) - (SELECT n FROM dup),
         (SELECT COUNT(*) FROM prod WHERE _status NOT IN ('REVERSED', 'REJECTED')), 100.0, 'duplicate-production.sql'
  UNION ALL
  SELECT 'DQ-06', 'Material mappings', 'Pay units with an ACTIVE rate that have an APPROVED material mapping (the rest need a mapping or a no-material ruling: data/material-coverage-register.csv)',
         COUNT(DISTINCT CASE WHEN r.labor_code IN (SELECT labor_code FROM maps) THEN r.labor_code END),
         COUNT(DISTINCT r.labor_code), NULL, 'exception-dashboard.sql'
  FROM rates r
  UNION ALL
  SELECT 'DQ-07', 'QA failures corrected', 'Production that failed QA and has its correction completed',
         SUM(CASE WHEN COALESCE(correction_completed, 'no') = 'yes' THEN 1 ELSE 0 END), COUNT(*), 100.0, 'qa-review-queue.sql'
  FROM prod WHERE qa_status = 'Fail'
  UNION ALL
  SELECT 'DQ-08', 'No open corrections', 'Non-VOID production not waiting in CORRECTION REQUIRED or REJECTED',
         SUM(CASE WHEN _status IN ('CORRECTION REQUIRED', 'REJECTED') THEN 0 ELSE 1 END), COUNT(*), 100.0, 'qa-review-queue.sql'
  FROM prod
  UNION ALL
  SELECT 'DQ-09', 'No orphans', 'Production, scope, rate and mapping rows whose project, contractor, rate or material key exists in its master',
         (SELECT COUNT(*) FROM prod WHERE project_id_snapshot IN (SELECT project_id FROM proj)
             AND contractor_id_snapshot IN (SELECT contractor_id FROM con)
             AND (rate_source_id IS NULL OR rate_source_id IN (SELECT rate_id FROM allrates)))
         + (SELECT COUNT(*) FROM scope WHERE project_id_snap IN (SELECT project_id FROM proj))
         + (SELECT COUNT(*) FROM rates WHERE contractor_id_snap IN (SELECT contractor_id FROM con)
             AND (project_id_snap IS NULL OR project_id_snap IN (SELECT project_id FROM proj)))
         + (SELECT COUNT(*) FROM maps WHERE material_code IN (SELECT material_code FROM mat)),
         (SELECT COUNT(*) FROM prod) + (SELECT COUNT(*) FROM scope) + (SELECT COUNT(*) FROM rates) + (SELECT COUNT(*) FROM maps),
         100.0, 'integration-id-integrity.sql'
  UNION ALL
  SELECT 'DQ-10', 'No rate exceptions', 'Non-VOID production priced from a rate of its own pay unit and contractor, above zero',
         SUM(CASE WHEN rate_source_id IS NOT NULL AND COALESCE(contractor_rate, 0) > 0
                   AND rate_labor_code_snap = labor_code AND rate_contractor_id_snap = contractor_id_snapshot THEN 1 ELSE 0 END),
         COUNT(*), 100.0, 'rate-expected-audit.sql'
  FROM prod
)
SELECT
  measure_id, measure, good, total,
  CASE WHEN total = 0 THEN NULL ELSE ROUND(CAST(100.0 * good / total AS numeric), 1) END AS score_pct,
  target_pct,
  CASE WHEN total = 0 THEN 'NO DATA'
       WHEN target_pct IS NULL THEN 'INFO'
       WHEN 100.0 * good / total >= target_pct THEN 'MEETS TARGET'
       ELSE 'BELOW TARGET' END AS scorecard_status,
  definition, drill_down
FROM measures
ORDER BY measure_id;
