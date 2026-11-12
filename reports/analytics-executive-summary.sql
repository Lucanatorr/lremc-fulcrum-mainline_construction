-- Executive Project Summary  (Sprint 28)
--
-- One row per project: the page a director reads first. Everything here is
-- VALUE or a COUNT, never a quantity, because a project mixes feet, each,
-- splices and hours, and those do not add (rule 2). Quantities per pay unit
-- are in analytics-project-performance.sql.
-- See reports/_conventions.md for the shared rules.
--
--   5ce243d4-9ec1-4fbd-8659-7be9f632b55c  MC Project Master - Development
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--   aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b  MC Project Scope Line - Development
--   458ae172-b7b4-43b5-8917-d7a792c9e81a  MC Change Order - Development
--   ee204906-adb3-431b-a1d9-d7427a4c842c  MC Material Transaction - Development
--
-- DEFINITIONS (stated once here, and the same in every analytics report)
--   authorized value  = baselined scope x budget rate, plus approved change orders
--   earned value      = approved quantity x budget rate, capped at authorized
--                       quantity per pay unit (over-plan work is not "progress")
--   physical %        = earned value / authorized value
--   financial %       = approved production value / authorized value
--   current production = approved value with a work date in the last 7 days;
--                       trend compares it with the 7 days before
--   turnaround        = calendar days from submitted to approved, over records
--                       approved in the last 90 days
--   forecast          = remaining authorized value / average approved value per
--                       ACTIVE working day over the last 10 such days. NULL with
--                       fewer than 3 active days: too little history to say.

WITH params AS (
  SELECT CAST(NULL AS varchar) AS p_project_id
),
scope AS (
  SELECT s.project_id_snap AS project_id, s.labor_code,
         SUM(COALESCE(s.original_planned_quantity, 0))                        AS planned_qty,
         MAX(COALESCE(s.budget_rate, 0))                                      AS budget_rate
  FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b" s
  WHERE s._status IN ('BASELINED', 'CLOSED') AND COALESCE(s.active, 'yes') <> 'no'
  GROUP BY s.project_id_snap, s.labor_code
),
co AS (
  SELECT c.project_id_snap AS project_id, l.line_labor_code AS labor_code,
         SUM(l.line_quantity_change) AS qty_change
  FROM "458ae172-b7b4-43b5-8917-d7a792c9e81a/quantity_changes" l
  JOIN "458ae172-b7b4-43b5-8917-d7a792c9e81a" c ON c._record_id = l._parent_id
  WHERE c._status = 'APPROVED'
  GROUP BY c.project_id_snap, l.line_labor_code
),
prod AS (
  SELECT * FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" WHERE _status NOT IN ('VOID', 'REVERSED')
),
approved_qty AS (
  SELECT project_id_snapshot AS project_id, labor_code, SUM(COALESCE(quantity, 0)) AS qty
  FROM prod WHERE _status = 'APPROVED'
  GROUP BY project_id_snapshot, labor_code
),
lines AS (
  SELECT s.project_id,
         (s.planned_qty + COALESCE(co.qty_change, 0)) * s.budget_rate                         AS authorized_value,
         LEAST(COALESCE(a.qty, 0), s.planned_qty + COALESCE(co.qty_change, 0)) * s.budget_rate AS earned_value
  FROM scope s
  LEFT JOIN co ON co.project_id = s.project_id AND co.labor_code = s.labor_code
  LEFT JOIN approved_qty a ON a.project_id = s.project_id AND a.labor_code = s.labor_code
),
plan AS (
  SELECT project_id, SUM(authorized_value) AS authorized_value, SUM(earned_value) AS earned_value
  FROM lines GROUP BY project_id
),
active_days AS (
  SELECT project_id_snapshot AS project_id, work_date, SUM(COALESCE(extended_value, 0)) AS day_value,
         ROW_NUMBER() OVER (PARTITION BY project_id_snapshot ORDER BY work_date DESC) AS recency
  FROM prod
  WHERE _status = 'APPROVED' AND work_day_of_week NOT IN ('Saturday', 'Sunday')
  GROUP BY project_id_snapshot, work_date
  HAVING SUM(COALESCE(extended_value, 0)) > 0
),
pace AS (
  SELECT project_id, COUNT(*) AS days_in_window, AVG(day_value) AS avg_daily_value
  FROM active_days WHERE recency <= 10
  GROUP BY project_id
),
facts AS (
  SELECT
    project_id_snapshot AS project_id,
    SUM(CASE WHEN _status = 'APPROVED' THEN COALESCE(extended_value, 0) ELSE 0 END) AS approved_value,
    SUM(CASE WHEN _status IN ('DRAFT','SUBMITTED','UNDER REVIEW','CORRECTION REQUIRED','REOPENED')
             THEN COALESCE(extended_value, 0) ELSE 0 END)                        AS pending_value,
    SUM(CASE WHEN _status = 'APPROVED' AND work_date > CURRENT_DATE - 7
             THEN COALESCE(extended_value, 0) ELSE 0 END)                        AS value_last_7d,
    SUM(CASE WHEN _status = 'APPROVED' AND work_date <= CURRENT_DATE - 7 AND work_date > CURRENT_DATE - 14
             THEN COALESCE(extended_value, 0) ELSE 0 END)                        AS value_prior_7d,
    COUNT(CASE WHEN _status IN ('SUBMITTED','UNDER REVIEW','REOPENED') THEN 1 END)            AS awaiting_approval,
    COUNT(CASE WHEN _status <> 'REJECTED' AND exception_severity = 'CRITICAL' THEN 1 END)    AS critical_exceptions,
    COUNT(CASE WHEN _status <> 'REJECTED' AND exception_severity = 'WARNING' THEN 1 END)     AS warning_exceptions,
    COUNT(CASE WHEN qa_status = 'Fail' AND COALESCE(correction_completed, 'no') <> 'yes' THEN 1 END) AS open_qa_failures,
    COUNT(CASE WHEN _status = 'CORRECTION REQUIRED' THEN 1 END)                              AS open_corrections,
    COUNT(CASE WHEN correction_completed = 'yes' THEN 1 END)                                 AS corrections_completed,
    AVG(CASE WHEN _status = 'APPROVED' AND submitted_date IS NOT NULL AND approved_date IS NOT NULL
              AND CAST(approved_date AS date) > CURRENT_DATE - 90
             THEN CAST(approved_date AS date) - CAST(submitted_date AS date) END)            AS avg_turnaround_days,
    COUNT(DISTINCT contractor_id_snapshot)                                                   AS contractors,
    COUNT(CASE WHEN _status = 'APPROVED' AND conduit_material_code IS NOT NULL
                AND NOT EXISTS (SELECT 1 FROM "ee204906-adb3-431b-a1d9-d7427a4c842c" t
                                WHERE t.production_id_snap = prod.production_id AND t._status <> 'VOID')
               THEN 1 END)                                                                   AS approved_without_material
  FROM prod
  GROUP BY project_id_snapshot
)
SELECT
  m.project_id,
  m.project_name,
  m._status                                                       AS project_status,
  m.required_completion_date,
  ROUND(CAST(COALESCE(pl.authorized_value, 0) AS numeric), 2)     AS authorized_value,
  ROUND(CAST(COALESCE(pl.earned_value, 0) AS numeric), 2)         AS earned_value,
  ROUND(CAST(COALESCE(pl.authorized_value, 0) - COALESCE(pl.earned_value, 0) AS numeric), 2) AS remaining_value,
  CASE WHEN COALESCE(pl.authorized_value, 0) = 0 THEN NULL
       ELSE ROUND(CAST(pl.earned_value / pl.authorized_value * 100 AS numeric), 1) END        AS physical_pct,
  CASE WHEN COALESCE(pl.authorized_value, 0) = 0 THEN NULL
       ELSE ROUND(CAST(COALESCE(f.approved_value, 0) / pl.authorized_value * 100 AS numeric), 1) END AS financial_pct,
  ROUND(CAST(COALESCE(f.approved_value, 0) AS numeric), 2)        AS approved_value,
  ROUND(CAST(COALESCE(f.pending_value, 0) AS numeric), 2)         AS pending_value,
  ROUND(CAST(COALESCE(f.value_last_7d, 0) AS numeric), 2)         AS current_production_7d,
  ROUND(CAST(COALESCE(f.value_prior_7d, 0) AS numeric), 2)        AS prior_production_7d,
  CASE WHEN COALESCE(f.value_last_7d, 0) = 0 AND COALESCE(f.value_prior_7d, 0) = 0 THEN 'NO RECENT PRODUCTION'
       WHEN COALESCE(f.value_prior_7d, 0) = 0 THEN 'STARTED'
       WHEN f.value_last_7d > f.value_prior_7d * 1.1 THEN 'UP'
       WHEN f.value_last_7d < f.value_prior_7d * 0.9 THEN 'DOWN'
       ELSE 'STEADY' END                                          AS trend,
  COALESCE(f.awaiting_approval, 0)                                AS awaiting_approval,
  ROUND(CAST(f.avg_turnaround_days AS numeric), 1)                AS avg_turnaround_days,
  COALESCE(f.critical_exceptions, 0)                              AS critical_exceptions,
  COALESCE(f.warning_exceptions, 0)                               AS warning_exceptions,
  COALESCE(f.open_qa_failures, 0)                                 AS open_qa_failures,
  COALESCE(f.open_corrections, 0)                                 AS open_corrections,
  COALESCE(f.corrections_completed, 0)                            AS corrections_completed,
  COALESCE(f.approved_without_material, 0)                        AS approved_without_material,
  COALESCE(f.contractors, 0)                                      AS contractors,
  pc.days_in_window                                               AS forecast_active_days,
  CASE WHEN COALESCE(pc.days_in_window, 0) < 3 OR COALESCE(pc.avg_daily_value, 0) <= 0
            OR COALESCE(pl.authorized_value, 0) = 0 THEN NULL
       ELSE CEIL(CAST((pl.authorized_value - pl.earned_value) / pc.avg_daily_value AS numeric)) END
                                                                  AS forecast_working_days_remaining,
  CASE WHEN COALESCE(pl.authorized_value, 0) = 0 THEN 'NO BASELINE - scope not set'
       WHEN COALESCE(f.critical_exceptions, 0) > 0 THEN 'CRITICAL EXCEPTIONS OPEN'
       WHEN COALESCE(pc.days_in_window, 0) < 3 THEN 'TOO LITTLE HISTORY TO FORECAST'
       ELSE 'FORECAST FROM ' || CAST(pc.days_in_window AS varchar) || ' ACTIVE DAYS' END AS headline
FROM "5ce243d4-9ec1-4fbd-8659-7be9f632b55c" m
CROSS JOIN params
LEFT JOIN plan  pl ON pl.project_id = m.project_id
LEFT JOIN facts f  ON f.project_id  = m.project_id
LEFT JOIN pace  pc ON pc.project_id = m.project_id
WHERE (p_project_id IS NULL OR m.project_id = p_project_id)
ORDER BY m.project_id;
