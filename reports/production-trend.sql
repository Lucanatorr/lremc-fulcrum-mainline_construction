-- Production Trend Report  (Sprint 10)
--
-- One row per project-contractor-day with daily, 7-day rolling, weekly,
-- monthly and average-daily figures.
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- WHY THIS REPORT TRENDS VALUE, NOT QUANTITY
-- A trend across a whole project has to add up pay units with different units
-- of measure - feet of conduit, each of handholes, splices, hours of flagging.
-- Summing those quantities gives a number that looks authoritative and means
-- nothing (convention 2). So the project-level trend is in VALUE, and quantity
-- trending is available per labor code via the by_unit columns.
--
-- AVERAGE DAILY PRODUCTION divides by WORKING days, Mon-Fri (ruling
-- 2026-09-16), not by calendar days. Dividing a five-day week's output by seven
-- understates a crew's rate by 29% and makes every target look missed.

WITH params AS (
  SELECT
    CAST(NULL AS varchar) AS p_project_id,
    CAST(NULL AS varchar) AS p_contractor_id
),
daily AS (
  SELECT
    p.project_id_snapshot     AS project_id,
    p.contractor_id_snapshot  AS contractor_id,
    p.work_date,
    MAX(p.work_week)          AS work_week,
    MAX(p.work_month)         AS work_month,
    MAX(p.work_day_of_week)   AS work_day_of_week,
    -- Approved only: a trend built on pending production reshapes itself every
    -- time a reviewer works through the queue.
    SUM(CASE WHEN p._status = 'APPROVED' THEN COALESCE(p.extended_value, 0) ELSE 0 END)
      AS approved_value,
    SUM(CASE WHEN p._status = 'APPROVED' AND p.unit NOT IN ('HR','EVENT')
             THEN COALESCE(p.extended_value, 0) ELSE 0 END)
      AS physical_value,
    SUM(CASE WHEN p._status = 'APPROVED' AND p.unit IN ('HR','EVENT')
             THEN COALESCE(p.extended_value, 0) ELSE 0 END)
      AS time_and_materials_value,
    -- Footage is the one quantity worth trending on its own: it is the bulk of
    -- the work and every FT pay unit shares a unit of measure.
    SUM(CASE WHEN p._status = 'APPROVED' AND p.unit = 'FT'
             THEN COALESCE(p.quantity, 0) ELSE 0 END)
      AS approved_footage,
    COUNT(CASE WHEN p._status = 'APPROVED' THEN 1 END) AS approved_transactions
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
  CROSS JOIN params
  WHERE p._status <> 'VOID'
    AND p.work_date IS NOT NULL
    AND (p_project_id    IS NULL OR p.project_id_snapshot    = p_project_id)
    AND (p_contractor_id IS NULL OR p.contractor_id_snapshot = p_contractor_id)
  GROUP BY p.project_id_snapshot, p.contractor_id_snapshot, p.work_date
),
windowed AS (
  SELECT
    d.*,
    CASE WHEN d.work_day_of_week IN ('Saturday','Sunday') THEN 0 ELSE 1 END
      AS is_working_day,

    -- Rolling 7 days by DATE, not by row: a crew that worked 3 days in a week
    -- must not have its window stretched back a fortnight by ROWS framing.
    SUM(d.approved_value) OVER (
      PARTITION BY d.project_id, d.contractor_id
      ORDER BY d.work_date
      RANGE BETWEEN INTERVAL '6' DAY PRECEDING AND CURRENT ROW
    ) AS rolling_7d_value,
    SUM(d.approved_footage) OVER (
      PARTITION BY d.project_id, d.contractor_id
      ORDER BY d.work_date
      RANGE BETWEEN INTERVAL '6' DAY PRECEDING AND CURRENT ROW
    ) AS rolling_7d_footage,
    SUM(d.approved_value) OVER (
      PARTITION BY d.project_id, d.contractor_id
      ORDER BY d.work_date
      RANGE BETWEEN INTERVAL '29' DAY PRECEDING AND CURRENT ROW
    ) AS rolling_30d_value,

    SUM(d.approved_value) OVER (
      PARTITION BY d.project_id, d.contractor_id, d.work_week
    ) AS week_value,
    SUM(d.approved_footage) OVER (
      PARTITION BY d.project_id, d.contractor_id, d.work_week
    ) AS week_footage,
    SUM(d.approved_value) OVER (
      PARTITION BY d.project_id, d.contractor_id, d.work_month
    ) AS month_value,
    SUM(d.approved_footage) OVER (
      PARTITION BY d.project_id, d.contractor_id, d.work_month
    ) AS month_footage,

    SUM(d.approved_value) OVER (
      PARTITION BY d.project_id, d.contractor_id
      ORDER BY d.work_date
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS ptd_value,
    SUM(d.approved_footage) OVER (
      PARTITION BY d.project_id, d.contractor_id
      ORDER BY d.work_date
      ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS ptd_footage
  FROM daily d
),
working_day_counts AS (
  SELECT
    project_id,
    contractor_id,
    work_month,
    -- Days with production, split working vs weekend. Average daily production
    -- uses working days that actually had production: a crew is not credited
    -- with a zero on a day it was not on site, and not penalised for Saturdays.
    COUNT(CASE WHEN is_working_day = 1 THEN 1 END) AS working_days_with_production,
    COUNT(CASE WHEN is_working_day = 0 THEN 1 END) AS weekend_days_with_production
  FROM windowed
  GROUP BY project_id, contractor_id, work_month
)
SELECT
  w.project_id,
  w.contractor_id,
  w.work_date,
  w.work_day_of_week,
  CASE WHEN w.is_working_day = 1 THEN 'WORKING' ELSE 'WEEKEND' END AS day_type,
  w.work_week,
  w.work_month,

  ROUND(w.approved_value, 2)             AS daily_value,
  w.approved_footage                     AS daily_footage,
  w.approved_transactions                AS daily_transactions,

  ROUND(w.rolling_7d_value, 2)           AS rolling_7d_value,
  w.rolling_7d_footage,
  ROUND(w.rolling_30d_value, 2)          AS rolling_30d_value,

  ROUND(w.week_value, 2)                 AS week_to_date_value,
  w.week_footage                         AS week_footage,
  ROUND(w.month_value, 2)                AS month_value,
  w.month_footage,

  ROUND(w.ptd_value, 2)                  AS project_to_date_value,
  w.ptd_footage                          AS project_to_date_footage,

  c.working_days_with_production,
  c.weekend_days_with_production,
  -- Guarded: a month whose only production fell on a weekend would otherwise
  -- divide by zero.
  CASE WHEN c.working_days_with_production = 0 THEN NULL
       ELSE ROUND(w.month_value / c.working_days_with_production, 2) END
                                         AS avg_daily_value_this_month,
  CASE WHEN c.working_days_with_production = 0 THEN NULL
       ELSE ROUND(w.month_footage / c.working_days_with_production, 2) END
                                         AS avg_daily_footage_this_month,

  ROUND(w.time_and_materials_value, 2)   AS time_and_materials_value,
  ROUND(w.physical_value, 2)             AS physical_value
FROM windowed w
JOIN working_day_counts c
  ON  c.project_id    = w.project_id
  AND c.contractor_id = w.contractor_id
  AND c.work_month    = w.work_month
ORDER BY w.project_id, w.contractor_id, w.work_date;
