-- Daily Burn Rate  (Sprint 28)
--
-- One row per project per working day over the window: approved value earned
-- that day, the average burn over the last 5 working days (one working week),
-- cumulative earned, what is left, and the
-- burn needed each remaining working day to finish by the required completion
-- date. Value, not quantity, because a day mixes units.
-- See reports/_conventions.md for the shared rules, and the definitions block
-- in analytics-executive-summary.sql.
--
--   5ce243d4-9ec1-4fbd-8659-7be9f632b55c  MC Project Master - Development
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--   aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b  MC Project Scope Line - Development
--   458ae172-b7b4-43b5-8917-d7a792c9e81a  MC Change Order - Development
--
-- Every Mon-Fri day in the window gets a row, worked or not: a burn rate that
-- skips idle days flatters the crew. (Productivity reports divide by ACTIVE
-- days on purpose; a burn rate measures the PROJECT, which pays for idle days.)
-- Working days remaining are counted Mon-Fri from tomorrow to the required
-- completion date, with no holiday calendar (not supplied).

WITH params AS (
  SELECT CAST(NULL AS varchar) AS p_project_id, CAST(42 AS integer) AS p_window_days
),
projects AS (
  SELECT m.project_id, m.project_name, CAST(m.required_completion_date AS date) AS required_completion_date
  FROM "5ce243d4-9ec1-4fbd-8659-7be9f632b55c" m CROSS JOIN params
  WHERE m._status NOT IN ('CLOSED') AND (p_project_id IS NULL OR m.project_id = p_project_id)
),
days AS (
  SELECT CAST(g.d AS date) AS day
  FROM params, generate_series(CURRENT_DATE - p_window_days, CURRENT_DATE, INTERVAL '1' DAY) AS g(d)
  WHERE EXTRACT(ISODOW FROM g.d) < 6
),
authorized AS (
  SELECT s.project_id_snap AS project_id,
         SUM((COALESCE(s.original_planned_quantity, 0) + COALESCE(co.qty_change, 0)) * COALESCE(s.budget_rate, 0)) AS authorized_value
  FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b" s
  LEFT JOIN (
    SELECT c.project_id_snap, l.line_labor_code, SUM(l.line_quantity_change) AS qty_change
    FROM "458ae172-b7b4-43b5-8917-d7a792c9e81a/quantity_changes" l
    JOIN "458ae172-b7b4-43b5-8917-d7a792c9e81a" c ON c._record_id = l._parent_id
    WHERE c._status = 'APPROVED'
    GROUP BY c.project_id_snap, l.line_labor_code
  ) co ON co.project_id_snap = s.project_id_snap AND co.line_labor_code = s.labor_code
  WHERE s._status IN ('BASELINED', 'CLOSED') AND COALESCE(s.active, 'yes') <> 'no'
  GROUP BY s.project_id_snap
),
earned_by_day AS (
  SELECT project_id_snapshot AS project_id, CAST(work_date AS date) AS day,
         SUM(COALESCE(extended_value, 0)) AS value
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
  WHERE _status = 'APPROVED'
  GROUP BY project_id_snapshot, CAST(work_date AS date)
),
earned_before AS (
  SELECT e.project_id, SUM(e.value) AS value
  FROM earned_by_day e CROSS JOIN params
  WHERE e.day < CURRENT_DATE - p_window_days
  GROUP BY e.project_id
),
grid AS (
  SELECT pj.project_id, pj.project_name, pj.required_completion_date, d.day,
         COALESCE(e.value, 0) AS day_value
  FROM projects pj
  CROSS JOIN days d
  LEFT JOIN earned_by_day e ON e.project_id = pj.project_id AND e.day = d.day
),
rolled AS (
  SELECT g.*,
         AVG(g.day_value) OVER (PARTITION BY g.project_id ORDER BY g.day ROWS BETWEEN 4 PRECEDING AND CURRENT ROW) AS avg_burn_5_working_days,
         COALESCE(b.value, 0) + SUM(g.day_value) OVER (PARTITION BY g.project_id ORDER BY g.day ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS cumulative_earned
  FROM grid g
  LEFT JOIN earned_before b ON b.project_id = g.project_id
),
left_to_go AS (
  SELECT pj.project_id,
         (SELECT COUNT(*) FROM generate_series(CURRENT_DATE + 1, pj.required_completion_date, INTERVAL '1' DAY) AS w(d)
           WHERE EXTRACT(ISODOW FROM w.d) < 6) AS working_days_remaining
  FROM projects pj
  WHERE pj.required_completion_date IS NOT NULL AND pj.required_completion_date > CURRENT_DATE
)
SELECT
  r.project_id,
  r.project_name,
  r.day                                                                        AS work_day,
  ROUND(CAST(r.day_value AS numeric), 2)                                       AS approved_value_that_day,
  ROUND(CAST(r.avg_burn_5_working_days AS numeric), 2)                         AS avg_burn_last_5_working_days,
  ROUND(CAST(r.cumulative_earned AS numeric), 2)                               AS cumulative_approved_value,
  ROUND(CAST(a.authorized_value AS numeric), 2)                                AS authorized_value,
  ROUND(CAST(a.authorized_value - r.cumulative_earned AS numeric), 2)          AS remaining_value,
  r.required_completion_date,
  lg.working_days_remaining,
  CASE WHEN COALESCE(lg.working_days_remaining, 0) = 0 OR a.authorized_value IS NULL THEN NULL
       ELSE ROUND(CAST((a.authorized_value - r.cumulative_earned) / lg.working_days_remaining AS numeric), 2) END
                                                                               AS required_daily_burn,
  CASE WHEN a.authorized_value IS NULL THEN 'NO BASELINE'
       WHEN r.required_completion_date IS NULL THEN 'NO REQUIRED COMPLETION DATE'
       WHEN COALESCE(lg.working_days_remaining, 0) = 0 THEN 'PAST REQUIRED COMPLETION'
       WHEN r.avg_burn_5_working_days >= (a.authorized_value - r.cumulative_earned) / lg.working_days_remaining THEN 'ON PACE'
       ELSE 'BEHIND PACE' END                                                  AS pace
FROM rolled r
LEFT JOIN authorized a  ON a.project_id  = r.project_id
LEFT JOIN left_to_go lg ON lg.project_id = r.project_id
ORDER BY r.project_id, r.day;
