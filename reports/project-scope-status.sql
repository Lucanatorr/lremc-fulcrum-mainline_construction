-- Project Scope Status Report  (Sprint 9)
--
-- Planned vs approved production, per Project + Labor Code, with the current
-- authorized scope after approved change orders.
--
-- WHY THIS IS A REPORT AND NOT FIELDS ON THE SCOPE LINE
-- Completed, Remaining and Percent Complete are aggregates over every
-- production record for a project and pay unit. A device cannot compute them:
-- Data Events reach other records only through REQUEST, which is online-only.
-- Storing them on the scope line would therefore mean writing a number that is
-- stale the moment the next production record syncs, and the brief is explicit
-- that the underlying quantities stay authoritative and status is never the
-- measurement. So the baseline lives on the record and the arithmetic lives
-- here, where it always runs against current data.
--
-- TABLES. Fulcrum's Query API names tables by form ID, and the record status
-- column is _status (not status).
--   aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b  MC Project Scope Line - Development
--   458ae172-b7b4-43b5-8917-d7a792c9e81a  MC Change Order - Development
--   .../quantity_changes                   its repeatable lines
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- RULES THIS ENCODES
--   Completed counts APPROVED production only (test 23.19). Pending is
--     reported in its own column, never folded into completed.
--   Only APPROVED change orders move the authorized scope (test 23.21).
--     Draft, Submitted, Rejected and Cancelled are excluded here, which is the
--     single place that exclusion is enforced.
--   Remaining is NOT clamped at zero (test 23.20). 10,000 planned against
--     10,500 approved reports -500 and OVER PLAN, because the overage is the
--     thing somebody needs to see.
--   Percent complete guards division by zero (Step 0.11): a zero authorized
--     quantity reports NULL, not an error and not a fake 0%.
--   The baseline is reported alongside the authorized figure, so
--     Original + Approved Changes = Current Authorized is checkable by eye.

WITH scope AS (
  SELECT
    _record_id,
    scope_line_id,
    project_id_snap,
    project_name_snap,
    labor_code,
    unit,
    phase_wbs,
    original_planned_quantity,
    budget_rate
  FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b"
  WHERE _status IN ('BASELINED', 'CLOSED')      -- a DRAFT line is not yet scope
    AND COALESCE(active, 'yes') <> 'no'
),

-- Approved change order lines only. The join to the parent is what enforces
-- it: a line's own table carries no status, so the parent's must be tested.
approved_changes AS (
  SELECT
    co.project_id_snap,
    line.line_labor_code AS labor_code,
    SUM(line.line_quantity_change) AS approved_quantity_change,
    SUM(line.line_quantity_change * COALESCE(line.line_rate, 0)) AS approved_value_change,
    COUNT(DISTINCT co._record_id) AS approved_change_orders
  FROM "458ae172-b7b4-43b5-8917-d7a792c9e81a/quantity_changes" line
  JOIN "458ae172-b7b4-43b5-8917-d7a792c9e81a" co
    ON co._record_id = line._parent_id
  WHERE co._status = 'APPROVED'
  GROUP BY co.project_id_snap, line.line_labor_code
),

-- Pending changes are surfaced separately so a reviewer can see what would
-- happen if they were approved, without that affecting any authorized figure.
pending_changes AS (
  SELECT
    co.project_id_snap,
    line.line_labor_code AS labor_code,
    SUM(line.line_quantity_change) AS pending_quantity_change,
    COUNT(DISTINCT co._record_id) AS pending_change_orders
  FROM "458ae172-b7b4-43b5-8917-d7a792c9e81a/quantity_changes" line
  JOIN "458ae172-b7b4-43b5-8917-d7a792c9e81a" co
    ON co._record_id = line._parent_id
  WHERE co._status IN ('DRAFT', 'SUBMITTED')
  GROUP BY co.project_id_snap, line.line_labor_code
),

production AS (
  SELECT
    project_id_snapshot AS project_id_snap,
    labor_code,
    SUM(CASE WHEN _status = 'APPROVED' THEN COALESCE(quantity, 0) ELSE 0 END)
      AS approved_quantity,
    SUM(CASE WHEN _status = 'APPROVED' THEN COALESCE(extended_value, 0) ELSE 0 END)
      AS approved_value,
    SUM(CASE WHEN _status IN ('SUBMITTED', 'UNDER REVIEW') THEN COALESCE(quantity, 0) ELSE 0 END)
      AS pending_quantity,
    SUM(CASE WHEN _status IN ('SUBMITTED', 'UNDER REVIEW') THEN COALESCE(extended_value, 0) ELSE 0 END)
      AS pending_value,
    MIN(CASE WHEN _status = 'APPROVED' THEN work_date END) AS first_approved_work_date,
    MAX(CASE WHEN _status = 'APPROVED' THEN work_date END) AS last_approved_work_date
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
  WHERE _status <> 'VOID'
  GROUP BY project_id_snapshot, labor_code
),

joined AS (
  SELECT
    s.scope_line_id,
    s.project_id_snap,
    s.project_name_snap,
    s.labor_code,
    s.unit,
    s.phase_wbs,
    s.original_planned_quantity,
    s.budget_rate,
    COALESCE(ac.approved_quantity_change, 0) AS approved_quantity_change,
    COALESCE(ac.approved_change_orders, 0)   AS approved_change_orders,
    COALESCE(pc.pending_quantity_change, 0)  AS pending_quantity_change,
    COALESCE(pc.pending_change_orders, 0)    AS pending_change_orders,
    s.original_planned_quantity + COALESCE(ac.approved_quantity_change, 0)
      AS authorized_quantity,
    COALESCE(p.approved_quantity, 0) AS completed_quantity,
    COALESCE(p.approved_value, 0)    AS completed_value,
    COALESCE(p.pending_quantity, 0)  AS pending_production_quantity,
    COALESCE(p.pending_value, 0)     AS pending_production_value,
    p.first_approved_work_date,
    p.last_approved_work_date
  FROM scope s
  LEFT JOIN approved_changes ac
    ON  ac.project_id_snap = s.project_id_snap
    AND ac.labor_code      = s.labor_code
  LEFT JOIN pending_changes pc
    ON  pc.project_id_snap = s.project_id_snap
    AND pc.labor_code      = s.labor_code
  LEFT JOIN production p
    ON  p.project_id_snap = s.project_id_snap
    AND p.labor_code      = s.labor_code
)

SELECT
  project_id_snap                                   AS project_id,
  project_name_snap                                 AS project_name,
  phase_wbs,
  labor_code,
  unit,

  -- Baseline is always shown next to the authorized figure, so the
  -- Original + Approved Changes = Current Authorized identity is visible.
  original_planned_quantity                         AS original_planned_qty,
  approved_quantity_change,
  approved_change_orders,
  authorized_quantity                               AS authorized_qty,

  completed_quantity                                AS completed_qty,
  -- Not clamped. A negative remaining IS the finding (test 23.20).
  authorized_quantity - completed_quantity          AS remaining_qty,

  CASE
    WHEN authorized_quantity = 0 THEN NULL          -- never divide by zero
    ELSE ROUND(CAST(completed_quantity / authorized_quantity * 100 AS numeric), 2)
  END                                               AS percent_complete,

  CASE
    WHEN completed_quantity > authorized_quantity
      THEN completed_quantity - authorized_quantity
    ELSE 0
  END                                               AS over_plan_qty,

  budget_rate,
  ROUND(CAST(original_planned_quantity * COALESCE(budget_rate, 0) AS numeric), 2) AS original_budget_value,
  ROUND(CAST(authorized_quantity * COALESCE(budget_rate, 0) AS numeric), 2)       AS authorized_value,
  ROUND(CAST(completed_value AS numeric), 2)                                      AS completed_value,
  ROUND(CAST(authorized_quantity * COALESCE(budget_rate, 0) - completed_value AS numeric), 2)
                                                                 AS remaining_value,

  -- Approved and pending are never mixed (test 23.19).
  pending_production_quantity                       AS pending_qty,
  ROUND(CAST(pending_production_value AS numeric), 2)                AS pending_value,
  pending_quantity_change                           AS pending_co_qty_change,
  pending_change_orders,

  -- Derived for scanning only. The quantities above stay authoritative.
  CASE
    WHEN completed_quantity > authorized_quantity            THEN 'OVER PLAN'
    WHEN authorized_quantity = 0                             THEN 'NO AUTHORIZED SCOPE'
    WHEN completed_quantity = 0                              THEN 'NOT STARTED'
    WHEN completed_quantity >= authorized_quantity            THEN 'COMPLETE'
    ELSE 'IN PROGRESS'
  END                                               AS scope_status,

  first_approved_work_date,
  last_approved_work_date
FROM joined
ORDER BY project_id_snap, labor_code;
