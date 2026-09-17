-- Project Summary  (Sprint 15) — the primary management view
--
-- One row per project. Contract position, both percent-complete measures, the
-- headline physical quantities, and what is waiting on somebody.
-- See reports/_conventions.md for the shared rules.
--
--   5ce243d4-9ec1-4fbd-8659-7be9f632b55c  MC Project Master - Development
--   aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b  MC Project Scope Line - Development
--   458ae172-b7b4-43b5-8917-d7a792c9e81a  MC Change Order - Development
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- PLANNED FOOTAGES COME FROM THE PROJECT MASTER, NOT FROM THE PAY UNITS
-- The project master already carries planned_fiber_footage,
-- planned_underground_footage, planned_aerial_footage and planned_splices. Those
-- are the design intent, set once. Deriving them instead by classifying pay
-- units into families would mean inventing a mapping the contract does not
-- state, and would drift every time a pay unit was added.
--
-- INSTALLED FOOTAGES COME FROM WORK CATEGORY, which every production record
-- carries and which IS the family: Fiber Placement, Underground, Aerial,
-- Splicing. No guessing from labor-code prefixes.
--
-- Footage is summed only within one unit of measure (convention 2): the fiber
-- and underground figures filter on unit = 'FT', and splices on unit = 'SPLICE'.

WITH params AS (
  SELECT CAST(NULL AS varchar) AS p_project_id
),

contract AS (
  SELECT
    s.project_id_snap AS project_id,
    SUM(COALESCE(s.original_planned_quantity, 0) * COALESCE(s.budget_rate, 0))
      AS original_contract_value,
    SUM(COALESCE(s.original_planned_quantity, 0) * COALESCE(s.budget_rate, 0))
      AS baseline_value,
    COUNT(*) AS scope_lines
  FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b" s
  WHERE s._status IN ('BASELINED', 'CLOSED')
    AND COALESCE(s.active, 'yes') <> 'no'
  GROUP BY s.project_id_snap
),

changes AS (
  SELECT
    co.project_id_snap AS project_id,
    SUM(CASE WHEN co._status = 'APPROVED'
             THEN line.line_quantity_change * COALESCE(line.line_rate, 0) ELSE 0 END)
      AS approved_change_value,
    COUNT(DISTINCT CASE WHEN co._status = 'APPROVED' THEN co._record_id END)
      AS approved_change_orders,
    COUNT(DISTINCT CASE WHEN co._status IN ('DRAFT','SUBMITTED') THEN co._record_id END)
      AS pending_change_orders
  FROM "458ae172-b7b4-43b5-8917-d7a792c9e81a/quantity_changes" line
  JOIN "458ae172-b7b4-43b5-8917-d7a792c9e81a" co
    ON co._record_id = line._parent_id
  GROUP BY co.project_id_snap
),

-- Per scope line, for the value-weighted physical percent complete.
line_progress AS (
  SELECT
    s.project_id_snap AS project_id,
    COALESCE(s.budget_rate, 0) AS budget_rate,
    COALESCE(s.original_planned_quantity, 0) + COALESCE(ac.approved_quantity_change, 0)
      AS authorized_quantity,
    COALESCE(pr.approved_quantity, 0) AS completed_quantity
  FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b" s
  LEFT JOIN (
    SELECT co.project_id_snap, line.line_labor_code AS labor_code,
           SUM(line.line_quantity_change) AS approved_quantity_change
    FROM "458ae172-b7b4-43b5-8917-d7a792c9e81a/quantity_changes" line
    JOIN "458ae172-b7b4-43b5-8917-d7a792c9e81a" co
      ON co._record_id = line._parent_id
    WHERE co._status = 'APPROVED'
    GROUP BY co.project_id_snap, line.line_labor_code
  ) ac ON ac.project_id_snap = s.project_id_snap AND ac.labor_code = s.labor_code
  LEFT JOIN (
    SELECT project_id_snapshot AS project_id, labor_code,
           SUM(CASE WHEN _status = 'APPROVED' THEN COALESCE(quantity, 0) ELSE 0 END)
             AS approved_quantity
    FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
    WHERE _status <> 'VOID'
    GROUP BY project_id_snapshot, labor_code
  ) pr ON pr.project_id = s.project_id_snap AND pr.labor_code = s.labor_code
  WHERE s._status IN ('BASELINED', 'CLOSED')
    AND COALESCE(s.active, 'yes') <> 'no'
),
physical AS (
  SELECT
    project_id,
    SUM(LEAST(completed_quantity, authorized_quantity) * budget_rate)
      AS earned_budget_value,
    SUM(authorized_quantity * budget_rate) AS authorized_budget_value
  FROM line_progress
  GROUP BY project_id
),

production AS (
  SELECT
    p.project_id_snapshot AS project_id,
    -- Contractors on the project, as a count and as a list. A project with two
    -- contractors is a different management problem from one with a single one.
    COUNT(DISTINCT p.contractor_id_snapshot) AS contractors,
    MAX(p.contractor_name_snapshot)          AS a_contractor_name,

    SUM(CASE WHEN p._status = 'APPROVED' THEN COALESCE(p.extended_value,0) ELSE 0 END)
      AS approved_production_value,
    SUM(CASE WHEN p._status IN ('DRAFT','SUBMITTED','UNDER REVIEW','CORRECTION REQUIRED')
             THEN COALESCE(p.extended_value,0) ELSE 0 END)
      AS pending_production_value,

    -- Physical quantities, each fenced to one unit of measure.
    SUM(CASE WHEN p._status = 'APPROVED' AND p.work_category = 'Fiber Placement'
                  AND p.unit = 'FT' THEN COALESCE(p.quantity,0) ELSE 0 END)
      AS installed_fiber_footage,
    SUM(CASE WHEN p._status = 'APPROVED' AND p.work_category = 'Underground'
                  AND p.unit = 'FT' THEN COALESCE(p.quantity,0) ELSE 0 END)
      AS completed_underground_footage,
    SUM(CASE WHEN p._status = 'APPROVED' AND p.work_category = 'Aerial'
                  AND p.unit = 'FT' THEN COALESCE(p.quantity,0) ELSE 0 END)
      AS completed_aerial_footage,
    SUM(CASE WHEN p._status = 'APPROVED' AND p.work_category = 'Splicing'
                  AND p.unit = 'SPLICE' THEN COALESCE(p.quantity,0) ELSE 0 END)
      AS splices_complete,

    -- Open QA issues: anything unapproved, and anything approved that still
    -- carries a flag. The second half matters - a record can be approved with
    -- warnings, and those warnings do not stop being true.
    COUNT(CASE WHEN p._status IN ('DRAFT','SUBMITTED','UNDER REVIEW','CORRECTION REQUIRED')
               THEN 1 END)                     AS pending_records,
    COUNT(CASE WHEN p.exception_severity = 'CRITICAL' AND p._status <> 'VOID'
               THEN 1 END)                     AS critical_exceptions,
    COUNT(CASE WHEN p.exception_severity = 'WARNING' AND p._status <> 'VOID'
               THEN 1 END)                     AS warning_exceptions,
    COUNT(CASE WHEN p.qa_status = 'Fail' AND p._status <> 'VOID' THEN 1 END)
                                               AS qa_failures,
    COUNT(CASE WHEN p._status = 'CORRECTION REQUIRED' THEN 1 END)
                                               AS awaiting_correction,

    MIN(CASE WHEN p._status = 'APPROVED' THEN p.work_date END) AS first_production_date,
    MAX(CASE WHEN p._status = 'APPROVED' THEN p.work_date END) AS last_production_date
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
  WHERE p._status <> 'VOID'
  GROUP BY p.project_id_snapshot
)

SELECT
  m.project_id,
  m.project_name,
  m.status                                     AS project_status,
  COALESCE(CAST(pr.contractors AS varchar) || ' contractor(s): ' || pr.a_contractor_name,
           'no production yet')                AS contractor,
  m.customer,
  m.market,
  m.project_manager,
  m.construction_manager,
  m.start_date,
  m.required_completion_date,
  -- Days to the required completion. Negative means overdue, which is the
  -- number a manager wants on the same row as percent complete.
  CASE WHEN m.required_completion_date IS NULL THEN NULL
       ELSE CAST(m.required_completion_date AS date) - CURRENT_DATE END
                                               AS days_to_required_completion,

  ROUND(CAST(COALESCE(c.original_contract_value, 0) AS numeric), 2)
                                               AS original_contract_value,
  ROUND(CAST(COALESCE(ch.approved_change_value, 0) AS numeric), 2)
                                               AS approved_change_orders_value,
  COALESCE(ch.approved_change_orders, 0)       AS approved_change_orders,
  COALESCE(ch.pending_change_orders, 0)        AS pending_change_orders,
  ROUND(CAST(COALESCE(c.original_contract_value, 0)
             + COALESCE(ch.approved_change_value, 0) AS numeric), 2)
                                               AS current_contract_value,
  ROUND(CAST(COALESCE(pr.approved_production_value, 0) AS numeric), 2)
                                               AS approved_production_value,
  ROUND(CAST(COALESCE(c.original_contract_value, 0)
             + COALESCE(ch.approved_change_value, 0)
             - COALESCE(pr.approved_production_value, 0) AS numeric), 2)
                                               AS remaining_contract_value,
  ROUND(CAST(COALESCE(pr.pending_production_value, 0) AS numeric), 2)
                                               AS pending_production_value,

  CASE WHEN COALESCE(ph.authorized_budget_value, 0) = 0 THEN NULL
       ELSE ROUND(CAST(ph.earned_budget_value / ph.authorized_budget_value * 100
                       AS numeric), 2) END     AS physical_percent_complete,
  CASE WHEN (COALESCE(c.original_contract_value, 0)
             + COALESCE(ch.approved_change_value, 0)) = 0 THEN NULL
       ELSE ROUND(CAST(COALESCE(pr.approved_production_value, 0)
                       / (COALESCE(c.original_contract_value, 0)
                          + COALESCE(ch.approved_change_value, 0)) * 100
                       AS numeric), 2) END     AS financial_percent_complete,

  -- Planned from the project master; installed from production; remaining is
  -- the subtraction, unclamped so an over-run shows.
  m.planned_fiber_footage,
  COALESCE(pr.installed_fiber_footage, 0)      AS installed_fiber_footage,
  COALESCE(m.planned_fiber_footage, 0) - COALESCE(pr.installed_fiber_footage, 0)
                                               AS remaining_fiber_footage,

  m.planned_underground_footage,
  COALESCE(pr.completed_underground_footage, 0) AS completed_underground_footage,
  COALESCE(m.planned_underground_footage, 0)
    - COALESCE(pr.completed_underground_footage, 0)
                                               AS remaining_underground_footage,

  m.planned_aerial_footage,
  COALESCE(pr.completed_aerial_footage, 0)     AS completed_aerial_footage,
  COALESCE(m.planned_aerial_footage, 0) - COALESCE(pr.completed_aerial_footage, 0)
                                               AS remaining_aerial_footage,

  m.planned_splices,
  COALESCE(pr.splices_complete, 0)             AS splices_complete,
  COALESCE(m.planned_splices, 0) - COALESCE(pr.splices_complete, 0)
                                               AS remaining_splices,

  -- Open QA issues as one number a manager can act on, with the breakdown
  -- beside it so the number is never a mystery.
  COALESCE(pr.critical_exceptions, 0) + COALESCE(pr.qa_failures, 0)
    + COALESCE(pr.awaiting_correction, 0)      AS open_qa_issues,
  COALESCE(pr.critical_exceptions, 0)          AS critical_exceptions,
  COALESCE(pr.warning_exceptions, 0)           AS warning_exceptions,
  COALESCE(pr.qa_failures, 0)                  AS qa_failures,
  COALESCE(pr.awaiting_correction, 0)          AS awaiting_correction,
  COALESCE(pr.pending_records, 0)              AS pending_records,

  COALESCE(c.scope_lines, 0)                   AS scope_lines,
  pr.first_production_date,
  pr.last_production_date,

  CASE
    WHEN COALESCE(c.scope_lines, 0) = 0
      THEN 'NO BASELINE - scope not set'
    WHEN COALESCE(pr.critical_exceptions, 0) > 0
      THEN 'CRITICAL EXCEPTIONS OPEN'
    WHEN COALESCE(pr.approved_production_value, 0)
         > COALESCE(c.original_contract_value, 0) + COALESCE(ch.approved_change_value, 0)
      THEN 'OVER CONTRACT VALUE'
    WHEN m.required_completion_date IS NOT NULL
         AND CAST(m.required_completion_date AS date) < CURRENT_DATE
         AND COALESCE(ph.earned_budget_value, 0) < COALESCE(ph.authorized_budget_value, 0)
      THEN 'PAST REQUIRED COMPLETION'
    WHEN COALESCE(pr.pending_records, 0) > 0
      THEN 'PRODUCTION AWAITING REVIEW'
    ELSE 'OK'
  END                                          AS management_flag
FROM "5ce243d4-9ec1-4fbd-8659-7be9f632b55c" m
CROSS JOIN params
LEFT JOIN contract   c  ON c.project_id  = m.project_id
LEFT JOIN changes    ch ON ch.project_id = m.project_id
LEFT JOIN production pr ON pr.project_id = m.project_id
LEFT JOIN physical   ph ON ph.project_id = m.project_id
WHERE (p_project_id IS NULL OR m.project_id = p_project_id)
ORDER BY m.project_id;
