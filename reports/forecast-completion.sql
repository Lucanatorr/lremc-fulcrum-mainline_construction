-- Estimated Completion Report  (Sprint 16)
--
-- Remaining quantity / recent average daily production = estimated working
-- days remaining, per project and pay unit.
-- See reports/_conventions.md for the shared rules.
--
--   aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b  MC Project Scope Line - Development
--   458ae172-b7b4-43b5-8917-d7a792c9e81a  MC Change Order - Development
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- THIS IS AN OPERATIONAL ESTIMATE, NOT A COMPLETION DATE
-- The brief is explicit: "Do not treat this as a contractual completion
-- guarantee." It is arithmetic on recent output. It knows nothing about
-- permits, make-ready, weather, crew moves, rock, or the fact that the last
-- 10% of a route is usually the hardest. Every row carries a forecast_basis
-- column saying how much history it rests on, so a thin estimate cannot be
-- mistaken for a firm one.
--
-- WHY THE WINDOW IS RECENT AND ACTIVE
-- p_window_days is the configurable "recent production window" the brief asks
-- for, counted in ACTIVE working days -- days this project and pay unit
-- actually booked approved production. Two reasons:
--
--   Recent, because a crew that averaged 300 FT/day during easy plow and is now
--   at 80 FT/day in rock will finish at 80. A project-to-date average would
--   forecast from work that is already done and conditions that are gone.
--
--   Active, because zero-production days are excluded per the brief. A gap for
--   weather or a crew reassignment is not a slow day; including it as a zero
--   silently halves the rate and doubles the forecast.
--
-- ONE ROW PER PAY UNIT, NEVER PER PROJECT
-- Convention 2: feet, each and splices are not addable, so there is no such
-- thing as "the project's average daily production". Each pay unit forecasts
-- on its own scale. The days-remaining column across a project is therefore a
-- MAX, not a SUM -- the pay units run concurrently, so the longest pole is when
-- the project finishes, not the total of all of them.

WITH params AS (
  SELECT
    CAST(NULL AS varchar) AS p_project_id,
    CAST(NULL AS varchar) AS p_labor_code,
    -- The brief's own example: "Average production during the last 10 active
    -- working days." Edit here to widen or tighten the window.
    CAST(10 AS integer)   AS p_window_days,
    -- Below this many active days in the window, a rate is not reported at all
    -- rather than reported badly.
    CAST(3 AS integer)    AS p_min_days_for_forecast
),

approved_changes AS (
  SELECT co.project_id_snap, line.line_labor_code AS labor_code,
         SUM(line.line_quantity_change) AS approved_quantity_change
  FROM "458ae172-b7b4-43b5-8917-d7a792c9e81a/quantity_changes" line
  JOIN "458ae172-b7b4-43b5-8917-d7a792c9e81a" co
    ON co._record_id = line._parent_id
  WHERE co._status = 'APPROVED'
  GROUP BY co.project_id_snap, line.line_labor_code
),

-- One row per project + pay unit + day that actually produced something.
-- HAVING > 0 is what makes the window "active days": a day that nets to zero
-- (a booking and its reversal, say) is not a day of production.
active_days AS (
  SELECT
    p.project_id_snapshot AS project_id,
    p.labor_code,
    p.work_date,
    SUM(COALESCE(p.quantity, 0)) AS day_quantity
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
  WHERE p._status = 'APPROVED'
    AND p.unit NOT IN ('HR', 'EVENT')
    AND p.work_day_of_week NOT IN ('Saturday', 'Sunday')
  GROUP BY p.project_id_snapshot, p.labor_code, p.work_date
  HAVING SUM(COALESCE(p.quantity, 0)) > 0
),

ranked_days AS (
  SELECT
    project_id, labor_code, work_date, day_quantity,
    ROW_NUMBER() OVER (
      PARTITION BY project_id, labor_code ORDER BY work_date DESC
    ) AS recency_rank
  FROM active_days
),

recent_rate AS (
  SELECT
    r.project_id,
    r.labor_code,
    COUNT(*)              AS days_in_window,
    SUM(r.day_quantity)   AS window_quantity,
    MIN(r.work_date)      AS window_from,
    MAX(r.work_date)      AS window_to
  FROM ranked_days r
  CROSS JOIN params
  WHERE r.recency_rank <= p_window_days
  GROUP BY r.project_id, r.labor_code
),

production AS (
  SELECT
    project_id_snapshot AS project_id,
    labor_code,
    SUM(CASE WHEN _status = 'APPROVED' THEN COALESCE(quantity, 0) ELSE 0 END)
      AS approved_quantity,
    MAX(CASE WHEN _status = 'APPROVED' THEN work_date END) AS last_approved_work_date
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
  WHERE _status <> 'VOID'
  GROUP BY project_id_snapshot, labor_code
),

rows AS (
  SELECT
    s.project_id_snap   AS project_id,
    s.project_name_snap AS project_name,
    s.labor_code,
    s.unit,
    s.original_planned_quantity + COALESCE(ac.approved_quantity_change, 0)
                                                 AS authorized_quantity,
    COALESCE(p.approved_quantity, 0)             AS approved_quantity,
    -- Not clamped at zero: an over-run reads negative, which is the thing a
    -- manager needs to see (same rule as remaining-work.sql).
    s.original_planned_quantity + COALESCE(ac.approved_quantity_change, 0)
      - COALESCE(p.approved_quantity, 0)         AS remaining_quantity,
    p.last_approved_work_date,
    rr.days_in_window,
    rr.window_quantity,
    rr.window_from,
    rr.window_to,
    CASE WHEN COALESCE(rr.days_in_window, 0) > 0
         THEN CAST(rr.window_quantity AS numeric) / rr.days_in_window
    END                                          AS avg_daily_quantity
  FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b" s
  CROSS JOIN params
  LEFT JOIN approved_changes ac
    ON ac.project_id_snap = s.project_id_snap AND ac.labor_code = s.labor_code
  LEFT JOIN production p
    ON p.project_id = s.project_id_snap AND p.labor_code = s.labor_code
  LEFT JOIN recent_rate rr
    ON rr.project_id = s.project_id_snap AND rr.labor_code = s.labor_code
  WHERE s._status <> 'VOID'
    AND (p_project_id IS NULL OR s.project_id_snap = p_project_id)
    AND (p_labor_code IS NULL OR s.labor_code      = p_labor_code)
)

SELECT
  r.project_id,
  r.project_name,
  r.labor_code,
  r.unit,
  ROUND(CAST(r.authorized_quantity AS numeric), 2) AS authorized_quantity,
  ROUND(CAST(r.approved_quantity   AS numeric), 2) AS approved_quantity,
  ROUND(CAST(r.remaining_quantity  AS numeric), 2) AS remaining_quantity,

  r.days_in_window,
  r.window_from,
  r.window_to,
  ROUND(CAST(r.window_quantity AS numeric), 2) AS window_quantity,
  ROUND(CAST(r.avg_daily_quantity AS numeric), 2)               AS avg_daily_quantity,

  -- The estimate itself. NULL rather than a number whenever the arithmetic
  -- would be dishonest: nothing left to do, no recent rate, or too little
  -- history to compute one.
  CASE
    WHEN r.remaining_quantity <= 0 THEN NULL
    WHEN COALESCE(r.days_in_window, 0) < p.p_min_days_for_forecast THEN NULL
    WHEN COALESCE(r.avg_daily_quantity, 0) <= 0 THEN NULL
    ELSE CEIL(CAST(r.remaining_quantity AS numeric) / r.avg_daily_quantity)
  END AS estimated_working_days_remaining,

  CASE
    WHEN r.remaining_quantity <= 0 THEN 'COMPLETE OR OVER PLAN - no forecast needed'
    WHEN COALESCE(r.days_in_window, 0) = 0 THEN 'NO RECENT PRODUCTION - cannot forecast'
    WHEN r.days_in_window < p.p_min_days_for_forecast
      THEN 'INSUFFICIENT HISTORY - ' || CAST(r.days_in_window AS varchar) || ' active day(s)'
    WHEN r.days_in_window < p.p_window_days
      THEN 'PARTIAL WINDOW - ' || CAST(r.days_in_window AS varchar)
           || ' of ' || CAST(p.p_window_days AS varchar) || ' active days'
    ELSE 'FULL WINDOW - ' || CAST(p.p_window_days AS varchar) || ' active days'
  END AS forecast_basis,

  r.last_approved_work_date
FROM rows r
CROSS JOIN params p
ORDER BY
  estimated_working_days_remaining DESC NULLS LAST,
  r.project_id,
  r.labor_code;
