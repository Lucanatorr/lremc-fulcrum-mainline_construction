-- Daily Production Report  (Sprint 10)
--
-- Transaction-level detail for a day or a date range, with totals.
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- APPROVED vs PENDING are separate columns throughout. A single "Production
-- Value" column that quietly mixes the two is the most common way a report
-- overstates what a contractor has earned.

WITH params AS (
  SELECT
    CAST(NULL AS varchar) AS p_project_id,     -- e.g. 'PRJ-0001'
    CAST(NULL AS varchar) AS p_contractor_id,  -- e.g. 'CON-0001'
    CAST(NULL AS varchar) AS p_crew,
    CAST(NULL AS varchar) AS p_work_category,  -- e.g. 'Underground'
    CAST(NULL AS varchar) AS p_labor_code,
    CAST(NULL AS date)    AS p_date_from,
    CAST(NULL AS date)    AS p_date_to
),
rows AS (
  SELECT
    p.work_date,
    p.work_day_of_week,
    p.project_id_snapshot     AS project_id,
    p.project_name_snapshot   AS project_name,
    p.contractor_id_snapshot  AS contractor_id,
    p.contractor_name_snapshot AS contractor_name,
    p.crew,
    p.route,
    p.work_category,
    p.labor_code,
    p.labor_description,
    p.quantity,
    p.unit,
    p.contractor_rate,
    p.extended_value,
    p._status                 AS record_status,
    p.qa_status,
    p.exception_severity,
    p.production_id,
    p.segment_id,
    p.from_location,
    p.to_location,
    -- Physical production excludes time-and-materials units (convention 3).
    CASE WHEN p.unit IN ('HR', 'EVENT') THEN 0 ELSE 1 END AS is_physical
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
  CROSS JOIN params
  WHERE p._status <> 'VOID'
    AND (p_project_id    IS NULL OR p.project_id_snapshot    = p_project_id)
    AND (p_contractor_id IS NULL OR p.contractor_id_snapshot = p_contractor_id)
    AND (p_crew          IS NULL OR p.crew                   = p_crew)
    AND (p_work_category IS NULL OR p.work_category          = p_work_category)
    AND (p_labor_code    IS NULL OR p.labor_code             = p_labor_code)
    AND (p_date_from     IS NULL OR p.work_date             >= p_date_from)
    AND (p_date_to       IS NULL OR p.work_date             <= p_date_to)
)

-- Detail lines, then one totals row per day, then a grand total. The grouping
-- sets keep quantity out of any row that spans more than one labor code,
-- because feet and each cannot be added (convention 2).
SELECT
  CASE
    WHEN GROUPING(production_id) = 0 THEN 'DETAIL'
    WHEN GROUPING(work_date)     = 0 THEN 'DAY TOTAL'
    ELSE 'GRAND TOTAL'
  END                                        AS row_type,
  work_date,
  MAX(work_day_of_week)                      AS day_of_week,
  MAX(project_id)                            AS project_id,
  MAX(project_name)                          AS project_name,
  MAX(contractor_id)                         AS contractor_id,
  MAX(crew)                                  AS crew,
  MAX(work_category)                         AS work_category,
  labor_code,
  MAX(labor_description)                     AS labor_description,
  MAX(segment_id)                            AS segment_id,

  -- Quantity only where the row is a single labor code, so one unit.
  CASE WHEN GROUPING(labor_code) = 0
       THEN SUM(quantity) END                AS quantity,
  CASE WHEN GROUPING(labor_code) = 0
       THEN MAX(unit) END                    AS unit,
  CASE WHEN GROUPING(production_id) = 0
       THEN MAX(contractor_rate) END         AS rate,

  ROUND(SUM(extended_value), 2)              AS production_value,
  ROUND(SUM(CASE WHEN record_status = 'APPROVED'
                 THEN extended_value ELSE 0 END), 2)  AS approved_value,
  ROUND(SUM(CASE WHEN record_status IN ('SUBMITTED', 'UNDER REVIEW', 'DRAFT', 'CORRECTION REQUIRED')
                 THEN extended_value ELSE 0 END), 2)  AS pending_value,
  ROUND(SUM(CASE WHEN record_status = 'REJECTED'
                 THEN extended_value ELSE 0 END), 2)  AS rejected_value,

  COUNT(*)                                   AS transactions,
  SUM(is_physical)                           AS physical_transactions,
  MAX(production_id)                         AS production_id,
  MAX(record_status)                         AS record_status,
  MAX(qa_status)                             AS qa_status,
  MAX(exception_severity)                    AS exception_severity
FROM rows
GROUP BY GROUPING SETS (
  (work_date, labor_code, production_id),   -- detail
  (work_date),                              -- per-day totals
  ()                                        -- grand total
)
ORDER BY work_date, GROUPING(production_id), labor_code;
