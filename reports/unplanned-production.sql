-- Unplanned Production Exception Report  (Sprint 9)
--
-- Production booked against a Project + Labor Code with NO baselined scope
-- line. This is the scope equivalent of the billing gaps found in the material
-- data: real work, correctly recorded, that no budget anticipated.
--
-- It matters because the scope status report is driven FROM the scope lines, so
-- unplanned work is invisible there by construction - it would quietly never
-- appear in any percent-complete figure. Every foot of it is either a missing
-- scope line or a missing change order.
--
-- TABLES (Query API names tables by form ID; record status is _status)
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--   aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b  MC Project Scope Line - Development

WITH production AS (
  SELECT
    project_id_snapshot AS project_id,
    labor_code,
    unit,
    COUNT(*)                                AS transactions,
    SUM(COALESCE(quantity, 0))              AS quantity,
    SUM(COALESCE(extended_value, 0))        AS value,
    MIN(work_date)                          AS first_work_date,
    MAX(work_date)                          AS last_work_date
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
  WHERE _status NOT IN ('VOID', 'REJECTED')
    AND labor_code IS NOT NULL
  GROUP BY project_id_snapshot, labor_code, unit
),
scope AS (
  SELECT DISTINCT project_id_snap AS project_id, labor_code
  FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b"
  WHERE _status IN ('BASELINED', 'CLOSED')
)
SELECT
  p.project_id,
  p.labor_code,
  p.unit,
  p.transactions,
  p.quantity,
  ROUND(p.value, 2) AS value,
  p.first_work_date,
  p.last_work_date,
  'NO SCOPE LINE' AS exception_type,
  -- Money already committed against no budget is the higher-severity case.
  CASE WHEN p.value > 0 THEN 'CRITICAL' ELSE 'WARNING' END AS severity
FROM production p
LEFT JOIN scope s
  ON  s.project_id = p.project_id
  AND s.labor_code = p.labor_code
WHERE s.labor_code IS NULL
ORDER BY severity, p.value DESC;
