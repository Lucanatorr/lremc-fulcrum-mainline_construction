-- Material Variance  (Sprint 12 QA flag)
--
-- Calculated material consumption against what the ledger says was installed.
-- See reports/_conventions.md for the shared rules.
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--   ee204906-adb3-431b-a1d9-d7427a4c842c  MC Material Transaction - Development
--
-- WHAT IS COMPARED
--   EXPECTED   production quantity x the mapping multiplier, which for conduit
--              the production app derives onto the record itself
--              (conduit_material_code + conduit_material_quantity)
--   ACTUAL     MC Material Transaction rows of type 'Installed' linked to that
--              production record
--
-- Only INSTALLED counts. Issued material is on a truck, not in the ground;
-- counting it as consumption would show every project over-consuming from the
-- day it was stocked.
--
-- THE WASTE FACTOR IS NOT APPLIED HERE. Conduit carries a 10% purchasing
-- allowance in the mapping master. Expected INSTALLED quantity is the clean
-- figure; comparing actual installed against a purchasing number grossed up for
-- waste would report a 10% shortfall on every correctly built run.
--
-- SCOPE: conduit only for now. Conduit is the only family whose expected
-- quantity the app derives onto the record. The other families' multipliers
-- live in the Labor-Material Mapping master, which has no records loaded yet -
-- 2" part numbers are still outstanding. This report widens to them without
-- structural change once that master is populated.

WITH expected AS (
  SELECT
    p._record_id            AS production_record_id,
    p.production_id,
    p.work_date,
    p.project_id_snapshot   AS project_id,
    p.contractor_id_snapshot AS contractor_id,
    p.crew,
    p.labor_code,
    p.conduit_material_code AS material_code,
    p.conduit_diameter,
    p.pull_count,
    p.quantity              AS production_quantity,
    p.conduit_material_quantity AS expected_quantity,
    p.total_duct_footage,
    p._status               AS record_status
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
  WHERE p._status <> 'VOID'
    AND p.conduit_material_code IS NOT NULL
    AND p.conduit_material_quantity IS NOT NULL
),
actual AS (
  SELECT
    t.production_id_snap,
    t.material_code_snap AS material_code,
    SUM(CASE WHEN t.transaction_type = 'Installed'
             THEN COALESCE(t.quantity, 0) ELSE 0 END) AS installed_quantity,
    SUM(CASE WHEN t.transaction_type = 'Adjusted'
             THEN COALESCE(t.quantity, 0) ELSE 0 END) AS adjusted_quantity,
    SUM(CASE WHEN t.transaction_type IN ('Damaged', 'Lost')
             THEN COALESCE(t.quantity, 0) ELSE 0 END) AS damaged_or_lost_quantity,
    COUNT(*)                                          AS ledger_rows
  FROM "ee204906-adb3-431b-a1d9-d7427a4c842c" t
  WHERE t._status <> 'VOID'
  GROUP BY t.production_id_snap, t.material_code_snap
)
SELECT
  e.production_id,
  e.record_status,
  e.work_date,
  e.project_id,
  e.contractor_id,
  e.crew,
  e.labor_code,
  e.conduit_diameter,
  e.pull_count,
  e.material_code,
  e.production_quantity,
  e.expected_quantity,
  COALESCE(a.installed_quantity, 0)                   AS installed_quantity,
  COALESCE(a.adjusted_quantity, 0)                    AS adjusted_quantity,
  COALESCE(a.damaged_or_lost_quantity, 0)             AS damaged_or_lost_quantity,
  COALESCE(a.ledger_rows, 0)                          AS ledger_rows,

  ROUND(COALESCE(a.installed_quantity, 0) - e.expected_quantity, 2) AS variance_quantity,
  CASE WHEN e.expected_quantity = 0 THEN NULL      -- guarded
       ELSE ROUND((COALESCE(a.installed_quantity, 0) - e.expected_quantity)
                  / e.expected_quantity * 100, 2) END AS variance_pct,

  CASE
    WHEN COALESCE(a.ledger_rows, 0) = 0
      THEN 'NO MATERIAL REPORTED'
    WHEN e.expected_quantity = 0
      THEN 'NO EXPECTED QUANTITY'
    -- A 10% band. Conduit is cut, coupled and wasted in the field; demanding
    -- an exact match would flag every honest run and train reviewers to ignore
    -- the report.
    WHEN ABS(COALESCE(a.installed_quantity, 0) - e.expected_quantity)
         <= 0.10 * e.expected_quantity
      THEN 'WITHIN TOLERANCE'
    WHEN COALESCE(a.installed_quantity, 0) > e.expected_quantity
      THEN 'OVER CONSUMPTION'
    ELSE 'UNDER CONSUMPTION'
  END AS variance_type,

  CASE
    WHEN COALESCE(a.ledger_rows, 0) = 0                                  THEN 'WARNING'
    WHEN e.expected_quantity = 0                                         THEN 'INFO'
    WHEN ABS(COALESCE(a.installed_quantity,0) - e.expected_quantity)
         <= 0.10 * e.expected_quantity                                   THEN 'INFO'
    WHEN ABS(COALESCE(a.installed_quantity,0) - e.expected_quantity)
         > 0.25 * e.expected_quantity                                    THEN 'CRITICAL'
    ELSE 'WARNING'
  END AS severity,

  CASE
    WHEN COALESCE(a.ledger_rows, 0) = 0
      THEN 'Production recorded conduit but no material transaction was posted '
           || 'against it. Either the material was never booked or it was booked '
           || 'without linking the production record.'
    WHEN COALESCE(a.installed_quantity, 0) > e.expected_quantity * 1.25
      THEN 'More than a quarter over the derived quantity. Check the pull count '
           || 'on the pay unit: a 2 inch or 4 inch multi-pull run consumes a '
           || 'multiple of the footage, a bundled 1.25 inch run does not.'
    WHEN COALESCE(a.installed_quantity, 0) < e.expected_quantity * 0.75
      THEN 'More than a quarter under. Either material is still unposted or the '
           || 'production quantity is overstated.'
    ELSE NULL
  END AS note
FROM expected e
LEFT JOIN actual a
  ON  a.production_id_snap = e.production_id
  AND a.material_code      = e.material_code
ORDER BY severity, ABS(COALESCE(a.installed_quantity, 0) - e.expected_quantity) DESC;
