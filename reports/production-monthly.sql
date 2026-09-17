-- Monthly Production Report  (Sprint 10)
--
-- Grouped by Project, Contractor, Month and Labor Code, plus project-to-date.
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- work_month is derived on the record as YYYY-MM. Read, not recomputed.

WITH params AS (
  SELECT
    CAST(NULL AS varchar) AS p_project_id,
    CAST(NULL AS varchar) AS p_contractor_id,
    CAST(NULL AS varchar) AS p_labor_code
),
base AS (
  SELECT
    p.project_id_snapshot      AS project_id,
    p.project_name_snapshot    AS project_name,
    p.contractor_id_snapshot   AS contractor_id,
    p.contractor_name_snapshot AS contractor_name,
    p.work_month,
    p.labor_code,
    p.labor_description,
    p.unit,
    p.quantity,
    p.extended_value,
    p.work_date,
    p._status AS record_status
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
  CROSS JOIN params
  WHERE p._status <> 'VOID'
    AND p.work_month IS NOT NULL
    AND (p_project_id    IS NULL OR p.project_id_snapshot    = p_project_id)
    AND (p_contractor_id IS NULL OR p.contractor_id_snapshot = p_contractor_id)
    AND (p_labor_code    IS NULL OR p.labor_code             = p_labor_code)
),
monthly AS (
  SELECT
    project_id,
    MAX(project_name)      AS project_name,
    contractor_id,
    MAX(contractor_name)   AS contractor_name,
    work_month,
    labor_code,
    MAX(labor_description) AS labor_description,
    MAX(unit)              AS unit,
    SUM(CASE WHEN record_status = 'APPROVED' THEN COALESCE(quantity, 0) ELSE 0 END)
      AS approved_quantity,
    SUM(CASE WHEN record_status = 'APPROVED' THEN COALESCE(extended_value, 0) ELSE 0 END)
      AS approved_value,
    SUM(CASE WHEN record_status IN ('DRAFT','SUBMITTED','UNDER REVIEW','CORRECTION REQUIRED')
             THEN COALESCE(quantity, 0) ELSE 0 END)
      AS pending_quantity,
    SUM(CASE WHEN record_status IN ('DRAFT','SUBMITTED','UNDER REVIEW','CORRECTION REQUIRED')
             THEN COALESCE(extended_value, 0) ELSE 0 END)
      AS pending_value,
    COUNT(*)                    AS transactions,
    COUNT(DISTINCT work_date)   AS days_worked
  FROM base
  GROUP BY project_id, contractor_id, work_month, labor_code
)
SELECT
  project_id,
  project_name,
  contractor_id,
  contractor_name,
  work_month,
  labor_code,
  labor_description,
  unit,
  approved_quantity,
  ROUND(approved_value, 2)  AS approved_value,
  pending_quantity,
  ROUND(pending_value, 2)   AS pending_value,
  transactions,
  days_worked,

  -- PROJECT-TO-DATE, the fourth period the brief asks for. A running total over
  -- months for this project + contractor + labor code, so a single row shows
  -- both the month and the cumulative position.
  SUM(approved_quantity) OVER (
    PARTITION BY project_id, contractor_id, labor_code
    ORDER BY work_month
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  )                         AS ptd_approved_quantity,
  ROUND(SUM(approved_value) OVER (
    PARTITION BY project_id, contractor_id, labor_code
    ORDER BY work_month
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ), 2)                     AS ptd_approved_value,

  -- Project-to-date VALUE across all pay units. Quantity is deliberately absent
  -- from this one: it would add feet to each (convention 2).
  ROUND(SUM(approved_value) OVER (
    PARTITION BY project_id, contractor_id
    ORDER BY work_month
    ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
  ), 2)                     AS ptd_project_approved_value
FROM monthly
ORDER BY project_id, contractor_id, labor_code, work_month;
