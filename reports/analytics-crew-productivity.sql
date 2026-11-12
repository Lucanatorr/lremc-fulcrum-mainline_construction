-- Crew Productivity  (Sprint 28)
--
-- One row per crew x contractor x unit. Productivity is quantity per ACTIVE
-- working day (a day the crew booked approved production), never per elapsed
-- day: a crew rained off on Friday did not slow down. One row per unit
-- because a crew that bores 400 FT and sets 3 hand holes did not produce 403
-- of anything. productivity.sql gives the same per construction method.
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- trend compares quantity per active day over the last 14 days with the 14
-- before. sample_strength says how far to trust the numbers.

WITH params AS (
  SELECT CAST(NULL AS varchar) AS p_project_id, CAST(90 AS integer) AS p_window_days
),
p AS (
  SELECT x.*
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" x CROSS JOIN params
  WHERE x._status NOT IN ('VOID', 'REVERSED')
    AND x.work_date > CURRENT_DATE - p_window_days
    AND (p_project_id IS NULL OR x.project_id_snapshot = p_project_id)
),
approved AS (
  SELECT * FROM p
  WHERE _status = 'APPROVED' AND work_day_of_week NOT IN ('Saturday', 'Sunday')
    AND COALESCE(quantity, 0) > 0
),
prod AS (
  SELECT COALESCE(crew, '(no crew recorded)') AS crew, contractor_id_snapshot AS contractor_id,
         COALESCE(unit, '(no unit)') AS unit,
         COUNT(DISTINCT work_date)                                                  AS active_days,
         SUM(COALESCE(quantity, 0))                                                 AS qty,
         SUM(COALESCE(extended_value, 0))                                           AS value,
         COUNT(DISTINCT CASE WHEN work_date > CURRENT_DATE - 14 THEN work_date END)  AS days_recent,
         SUM(CASE WHEN work_date > CURRENT_DATE - 14 THEN quantity ELSE 0 END)       AS qty_recent,
         COUNT(DISTINCT CASE WHEN work_date <= CURRENT_DATE - 14 AND work_date > CURRENT_DATE - 28 THEN work_date END) AS days_prior,
         SUM(CASE WHEN work_date <= CURRENT_DATE - 14 AND work_date > CURRENT_DATE - 28 THEN quantity ELSE 0 END)       AS qty_prior,
         COUNT(DISTINCT labor_code)                                                 AS pay_units,
         MAX(work_date)                                                             AS last_work_date
  FROM approved
  GROUP BY COALESCE(crew, '(no crew recorded)'), contractor_id_snapshot, COALESCE(unit, '(no unit)')
),
quality AS (
  SELECT COALESCE(crew, '(no crew recorded)') AS crew, contractor_id_snapshot AS contractor_id,
         COALESCE(unit, '(no unit)') AS unit,
         COUNT(*)                                                                   AS records,
         COUNT(CASE WHEN correction_completed = 'yes' OR _status = 'CORRECTION REQUIRED' THEN 1 END) AS corrected,
         COUNT(CASE WHEN qa_status = 'Fail' THEN 1 END)                             AS qa_failed,
         COUNT(CASE WHEN _status = 'REJECTED' THEN 1 END)                           AS rejected
  FROM p
  GROUP BY COALESCE(crew, '(no crew recorded)'), contractor_id_snapshot, COALESCE(unit, '(no unit)')
)
SELECT
  q.crew,
  q.contractor_id,
  q.unit,
  COALESCE(pr.active_days, 0)                                                     AS active_days,
  ROUND(CAST(COALESCE(pr.qty, 0) AS numeric), 2)                                  AS approved_qty,
  CASE WHEN COALESCE(pr.active_days, 0) = 0 THEN NULL
       ELSE ROUND(CAST(pr.qty / pr.active_days AS numeric), 2) END                AS qty_per_active_day,
  CASE WHEN COALESCE(pr.active_days, 0) = 0 THEN NULL
       ELSE ROUND(CAST(pr.value / pr.active_days AS numeric), 2) END              AS value_per_active_day,
  CASE WHEN COALESCE(pr.days_recent, 0) = 0 THEN NULL
       ELSE ROUND(CAST(pr.qty_recent / pr.days_recent AS numeric), 2) END         AS qty_per_day_last_14d,
  CASE WHEN COALESCE(pr.days_prior, 0) = 0 THEN NULL
       ELSE ROUND(CAST(pr.qty_prior / pr.days_prior AS numeric), 2) END           AS qty_per_day_prior_14d,
  CASE WHEN COALESCE(pr.days_recent, 0) = 0 OR COALESCE(pr.days_prior, 0) = 0 THEN 'NOT COMPARABLE'
       WHEN pr.qty_recent / pr.days_recent > pr.qty_prior / pr.days_prior * 1.1 THEN 'FASTER'
       WHEN pr.qty_recent / pr.days_recent < pr.qty_prior / pr.days_prior * 0.9 THEN 'SLOWER'
       ELSE 'STEADY' END                                                          AS trend,
  q.records,
  CASE WHEN q.records = 0 THEN NULL ELSE ROUND(CAST(q.corrected * 100.0 / q.records AS numeric), 1) END AS correction_pct_floor,
  CASE WHEN q.records = 0 THEN NULL ELSE ROUND(CAST(q.qa_failed * 100.0 / q.records AS numeric), 1) END AS qa_fail_pct,
  CASE WHEN q.records = 0 THEN NULL ELSE ROUND(CAST(q.rejected * 100.0 / q.records AS numeric), 1) END  AS rejected_pct,
  COALESCE(pr.pay_units, 0)                                                       AS pay_units,
  pr.last_work_date,
  CASE WHEN COALESCE(pr.active_days, 0) = 0 THEN 'NO APPROVED PRODUCTION'
       WHEN pr.active_days < 3 THEN 'THIN - under 3 active days'
       WHEN pr.active_days < 10 THEN 'INDICATIVE'
       ELSE 'ESTABLISHED' END                                                     AS sample_strength
FROM quality q
LEFT JOIN prod pr ON pr.crew = q.crew AND pr.contractor_id = q.contractor_id AND pr.unit = q.unit
ORDER BY q.unit, qty_per_active_day DESC NULLS LAST, q.crew;
