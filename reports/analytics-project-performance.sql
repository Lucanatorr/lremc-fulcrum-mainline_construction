-- Project Performance  (Sprint 28)
--
-- One row per project x pay unit: authorized, completed and remaining scope in
-- the pay unit's OWN unit (feet stay feet, splices stay splices), with current
-- pace, trend and a forecast. analytics-executive-summary.sql is the same
-- project in value; this is the same project in quantities.
-- See reports/_conventions.md for the shared rules, and the definitions block
-- in analytics-executive-summary.sql.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--   aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b  MC Project Scope Line - Development
--   458ae172-b7b4-43b5-8917-d7a792c9e81a  MC Change Order - Development
--
-- Pay units with production but no baselined scope appear too, with
-- scope_status UNPLANNED: work nobody authorized is the row a PM most needs.

WITH params AS (
  SELECT CAST(NULL AS varchar) AS p_project_id
),
scope AS (
  SELECT s.project_id_snap AS project_id, s.labor_code, MAX(s.unit) AS unit,
         SUM(COALESCE(s.original_planned_quantity, 0)) AS planned_qty,
         MAX(COALESCE(s.budget_rate, 0))               AS budget_rate
  FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b" s
  WHERE s._status IN ('BASELINED', 'CLOSED') AND COALESCE(s.active, 'yes') <> 'no'
  GROUP BY s.project_id_snap, s.labor_code
),
co AS (
  SELECT c.project_id_snap AS project_id, l.line_labor_code AS labor_code, SUM(l.line_quantity_change) AS qty_change
  FROM "458ae172-b7b4-43b5-8917-d7a792c9e81a/quantity_changes" l
  JOIN "458ae172-b7b4-43b5-8917-d7a792c9e81a" c ON c._record_id = l._parent_id
  WHERE c._status = 'APPROVED'
  GROUP BY c.project_id_snap, l.line_labor_code
),
prod AS (
  SELECT project_id_snapshot AS project_id, labor_code, MAX(unit) AS unit,
         SUM(CASE WHEN _status = 'APPROVED' THEN COALESCE(quantity, 0) ELSE 0 END) AS approved_qty,
         SUM(CASE WHEN _status IN ('DRAFT','SUBMITTED','UNDER REVIEW','CORRECTION REQUIRED','REOPENED')
                  THEN COALESCE(quantity, 0) ELSE 0 END)                            AS pending_qty,
         SUM(CASE WHEN _status = 'APPROVED' AND work_date > CURRENT_DATE - 7
                  THEN COALESCE(quantity, 0) ELSE 0 END)                            AS qty_last_7d,
         SUM(CASE WHEN _status = 'APPROVED' AND work_date <= CURRENT_DATE - 7 AND work_date > CURRENT_DATE - 14
                  THEN COALESCE(quantity, 0) ELSE 0 END)                            AS qty_prior_7d,
         MAX(CASE WHEN _status = 'APPROVED' THEN work_date END)                      AS last_approved_work_date
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
  WHERE _status NOT IN ('VOID', 'REVERSED')
  GROUP BY project_id_snapshot, labor_code
),
active_days AS (
  SELECT project_id_snapshot AS project_id, labor_code, work_date, SUM(COALESCE(quantity, 0)) AS day_qty,
         ROW_NUMBER() OVER (PARTITION BY project_id_snapshot, labor_code ORDER BY work_date DESC) AS recency
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
  WHERE _status = 'APPROVED' AND work_day_of_week NOT IN ('Saturday', 'Sunday')
  GROUP BY project_id_snapshot, labor_code, work_date
  HAVING SUM(COALESCE(quantity, 0)) > 0
),
pace AS (
  SELECT project_id, labor_code, COUNT(*) AS active_days, AVG(day_qty) AS avg_daily_qty
  FROM active_days WHERE recency <= 10
  GROUP BY project_id, labor_code
),
keys AS (
  SELECT project_id, labor_code FROM scope
  UNION
  SELECT project_id, labor_code FROM prod
),
rows AS (
  SELECT
    k.project_id, k.labor_code,
    COALESCE(s.unit, p.unit)                                    AS unit,
    s.project_id IS NOT NULL                                    AS in_scope,
    COALESCE(s.planned_qty, 0)                                  AS original_qty,
    COALESCE(co.qty_change, 0)                                  AS change_order_qty,
    COALESCE(s.planned_qty, 0) + COALESCE(co.qty_change, 0)     AS authorized_qty,
    COALESCE(p.approved_qty, 0)                                 AS completed_qty,
    COALESCE(p.pending_qty, 0)                                  AS pending_qty,
    COALESCE(p.qty_last_7d, 0)                                  AS qty_last_7d,
    COALESCE(p.qty_prior_7d, 0)                                 AS qty_prior_7d,
    p.last_approved_work_date,
    s.budget_rate,
    pc.active_days,
    pc.avg_daily_qty
  FROM keys k
  LEFT JOIN scope s ON s.project_id = k.project_id AND s.labor_code = k.labor_code
  LEFT JOIN co      ON co.project_id = k.project_id AND co.labor_code = k.labor_code
  LEFT JOIN prod p  ON p.project_id = k.project_id AND p.labor_code = k.labor_code
  LEFT JOIN pace pc ON pc.project_id = k.project_id AND pc.labor_code = k.labor_code
)
SELECT
  r.project_id,
  r.labor_code,
  r.unit,
  r.original_qty,
  r.change_order_qty,
  r.authorized_qty,
  r.completed_qty,
  r.authorized_qty - r.completed_qty                                       AS remaining_qty,
  CASE WHEN r.authorized_qty <= 0 THEN NULL
       ELSE ROUND(CAST(r.completed_qty / r.authorized_qty * 100 AS numeric), 1) END AS pct_complete,
  r.pending_qty,
  r.qty_last_7d,
  r.qty_prior_7d,
  r.qty_last_7d - r.qty_prior_7d                                           AS velocity_change_7d,
  ROUND(CAST(r.avg_daily_qty AS numeric), 2)                               AS avg_daily_qty,
  r.active_days                                                            AS forecast_active_days,
  CASE WHEN NOT r.in_scope OR r.authorized_qty - r.completed_qty <= 0 THEN NULL
       WHEN COALESCE(r.active_days, 0) < 3 OR COALESCE(r.avg_daily_qty, 0) <= 0 THEN NULL
       ELSE CEIL(CAST((r.authorized_qty - r.completed_qty) / r.avg_daily_qty AS numeric)) END AS forecast_working_days,
  ROUND(CAST(r.budget_rate * (r.authorized_qty - r.completed_qty) AS numeric), 2) AS remaining_value_at_budget,
  r.last_approved_work_date,
  CASE WHEN NOT r.in_scope THEN 'UNPLANNED'
       WHEN r.completed_qty > r.authorized_qty THEN 'OVER PLAN'
       WHEN r.authorized_qty <= 0 THEN 'NO AUTHORIZED SCOPE'
       WHEN r.completed_qty = 0 THEN 'NOT STARTED'
       WHEN r.completed_qty >= r.authorized_qty THEN 'COMPLETE'
       ELSE 'IN PROGRESS' END                                              AS scope_status
FROM rows r
CROSS JOIN params
WHERE (p_project_id IS NULL OR r.project_id = p_project_id)
ORDER BY r.project_id,
         CASE WHEN NOT r.in_scope THEN 0 WHEN r.completed_qty > r.authorized_qty THEN 1 ELSE 2 END,
         r.labor_code;
