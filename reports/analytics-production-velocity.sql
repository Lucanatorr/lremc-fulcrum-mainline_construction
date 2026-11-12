-- Production Velocity  (Sprint 28)
--
-- One row per project x pay unit x ISO week: approved quantity in the pay
-- unit's own unit, week-on-week change, a 4-week moving average and whether
-- the pay unit is accelerating. The week is the record's own work_week (ISO,
-- Monday start), so this agrees with production-weekly.sql to the unit.
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- Weeks with no production for a pay unit do not appear, so the moving average
-- is over the last 4 WORKED weeks; `weeks_in_average` says how many.

WITH params AS (
  SELECT CAST(NULL AS varchar) AS p_project_id
),
weekly AS (
  SELECT project_id_snapshot AS project_id, labor_code, MAX(unit) AS unit, work_week,
         SUM(COALESCE(quantity, 0))       AS qty,
         SUM(COALESCE(extended_value, 0)) AS value,
         COUNT(DISTINCT work_date)        AS days_worked
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" CROSS JOIN params
  WHERE _status = 'APPROVED' AND work_week IS NOT NULL
    AND (p_project_id IS NULL OR project_id_snapshot = p_project_id)
  GROUP BY project_id_snapshot, labor_code, work_week
),
w AS (
  SELECT weekly.*,
         LAG(qty) OVER (PARTITION BY project_id, labor_code ORDER BY work_week)                           AS prev_qty,
         AVG(qty) OVER (PARTITION BY project_id, labor_code ORDER BY work_week ROWS BETWEEN 3 PRECEDING AND CURRENT ROW) AS avg_4wk,
         COUNT(*) OVER (PARTITION BY project_id, labor_code ORDER BY work_week ROWS BETWEEN 3 PRECEDING AND CURRENT ROW) AS weeks_in_average,
         SUM(qty) OVER (PARTITION BY project_id, labor_code ORDER BY work_week ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_qty
  FROM weekly
)
SELECT
  project_id,
  labor_code,
  unit,
  work_week,
  ROUND(CAST(qty AS numeric), 2)                                       AS approved_qty,
  ROUND(CAST(value AS numeric), 2)                                     AS approved_value,
  days_worked,
  CASE WHEN days_worked = 0 THEN NULL ELSE ROUND(CAST(qty / days_worked AS numeric), 2) END AS qty_per_day_worked,
  ROUND(CAST(prev_qty AS numeric), 2)                                  AS previous_week_qty,
  ROUND(CAST(qty - prev_qty AS numeric), 2)                            AS week_on_week_change,
  CASE WHEN prev_qty IS NULL OR prev_qty = 0 THEN NULL
       ELSE ROUND(CAST((qty - prev_qty) / prev_qty * 100 AS numeric), 1) END AS week_on_week_pct,
  ROUND(CAST(avg_4wk AS numeric), 2)                                   AS moving_avg_4wk,
  weeks_in_average,
  ROUND(CAST(cumulative_qty AS numeric), 2)                            AS cumulative_qty,
  CASE WHEN weeks_in_average < 2 THEN 'FIRST WEEK'
       WHEN qty > avg_4wk * 1.1 THEN 'ACCELERATING'
       WHEN qty < avg_4wk * 0.9 THEN 'DECELERATING'
       ELSE 'STEADY' END                                               AS velocity
FROM w
ORDER BY project_id, labor_code, work_week;
