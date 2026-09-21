-- Weekly Production Report  (Sprint 10)
--
-- Grouped by Project, Contractor, Week and Labor Code, with a
-- current-week-versus-previous-week comparison.
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- THE WEEK IS READ, NOT COMPUTED. work_week is derived on the record as
-- ISO-8601 with a Monday start (ruling 2026-09-16). Recomputing it here would
-- create a second definition of "week", which is how two reports come to
-- disagree about the same Monday.

WITH params AS (
  SELECT
    CAST(NULL AS varchar) AS p_project_id,
    CAST(NULL AS varchar) AS p_contractor_id,
    CAST(NULL AS varchar) AS p_labor_code
),
weekly AS (
  SELECT
    p.project_id_snapshot      AS project_id,
    MAX(p.project_name_snapshot)    AS project_name,
    p.contractor_id_snapshot   AS contractor_id,
    MAX(p.contractor_name_snapshot) AS contractor_name,
    p.work_week,
    p.labor_code,
    MAX(p.unit)                AS unit,
    MAX(p.labor_description)   AS labor_description,

    -- Quantity is safe to sum here: one labor code means one unit.
    SUM(CASE WHEN p._status = 'APPROVED' THEN COALESCE(p.quantity, 0) ELSE 0 END)
      AS approved_quantity,
    SUM(CASE WHEN p._status IN ('DRAFT','SUBMITTED','UNDER REVIEW','CORRECTION REQUIRED')
             THEN COALESCE(p.quantity, 0) ELSE 0 END)
      AS pending_quantity,

    SUM(CASE WHEN p._status = 'APPROVED' THEN COALESCE(p.extended_value, 0) ELSE 0 END)
      AS approved_value,
    SUM(CASE WHEN p._status IN ('DRAFT','SUBMITTED','UNDER REVIEW','CORRECTION REQUIRED')
             THEN COALESCE(p.extended_value, 0) ELSE 0 END)
      AS pending_value,

    COUNT(*)                                       AS transactions,
    COUNT(DISTINCT p.work_date)                    AS days_worked,
    MIN(p.work_date)                               AS week_first_work_date,
    MAX(p.work_date)                               AS week_last_work_date,
    -- Weekend work is legitimate but worth seeing: the working week is Mon-Fri.
    COUNT(DISTINCT CASE WHEN p.work_day_of_week IN ('Saturday','Sunday')
                        THEN p.work_date END)      AS weekend_days_worked
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
  CROSS JOIN params
  WHERE p._status <> 'VOID'
    AND p.work_week IS NOT NULL
    AND (p_project_id    IS NULL OR p.project_id_snapshot    = p_project_id)
    AND (p_contractor_id IS NULL OR p.contractor_id_snapshot = p_contractor_id)
    AND (p_labor_code    IS NULL OR p.labor_code             = p_labor_code)
  GROUP BY p.project_id_snapshot, p.contractor_id_snapshot, p.work_week, p.labor_code
)

SELECT
  w.project_id,
  w.project_name,
  w.contractor_id,
  w.contractor_name,
  w.work_week,
  w.labor_code,
  w.labor_description,
  w.unit,

  w.approved_quantity,
  w.approved_value,
  w.pending_quantity,
  w.pending_value,
  w.transactions,
  w.days_worked,
  w.weekend_days_worked,

  -- Previous week for the same project + contractor + labor code. LAG over
  -- work_week ordering is deliberately NOT used: a gap week with no production
  -- has no row, so LAG would compare against whatever week came before it and
  -- silently misreport the change. The self-join below matches on the actual
  -- preceding ISO week label, so a genuine gap reads as NULL.
  prev.approved_quantity                    AS prev_week_approved_quantity,
  prev.approved_value                       AS prev_week_approved_value,
  CASE WHEN prev.approved_quantity IS NULL THEN NULL
       ELSE w.approved_quantity - prev.approved_quantity END
                                            AS quantity_change,
  CASE WHEN prev.approved_quantity IS NULL OR prev.approved_quantity = 0 THEN NULL
       ELSE ROUND(CAST((w.approved_quantity - prev.approved_quantity)
                  / prev.approved_quantity * 100 AS numeric), 2) END
                                            AS quantity_change_pct,
  CASE WHEN prev.approved_value IS NULL THEN NULL
       ELSE ROUND(CAST(w.approved_value - prev.approved_value AS numeric), 2) END
                                            AS value_change,
  CASE
    WHEN prev.approved_quantity IS NULL                       THEN 'NO PRIOR WEEK'
    WHEN w.approved_quantity > prev.approved_quantity            THEN 'UP'
    WHEN w.approved_quantity < prev.approved_quantity            THEN 'DOWN'
    ELSE 'FLAT'
  END                                       AS trend
FROM weekly w
LEFT JOIN weekly prev
  ON  prev.project_id    = w.project_id
  AND prev.contractor_id = w.contractor_id
  AND prev.labor_code    = w.labor_code
  -- The ISO week label is YYYY-Www. The previous week is the label one step
  -- back, which across a year boundary means the last week of the prior year.
  -- ISO years have 52 or 53 weeks, so both are tried and at most one exists.
  AND prev.work_week IN (
        CASE WHEN CAST(SUBSTRING(w.work_week, 7, 2) AS integer) > 1
             THEN SUBSTRING(w.work_week, 1, 5)
                  || LPAD(CAST(CAST(SUBSTRING(w.work_week, 7, 2) AS integer) - 1 AS varchar), 2, '0')
        END,
        CASE WHEN CAST(SUBSTRING(w.work_week, 7, 2) AS integer) = 1
             THEN CAST(CAST(SUBSTRING(w.work_week, 1, 4) AS integer) - 1 AS varchar) || '-W52'
        END,
        CASE WHEN CAST(SUBSTRING(w.work_week, 7, 2) AS integer) = 1
             THEN CAST(CAST(SUBSTRING(w.work_week, 1, 4) AS integer) - 1 AS varchar) || '-W53'
        END
      )
ORDER BY w.project_id, w.contractor_id, w.work_week, w.labor_code;
