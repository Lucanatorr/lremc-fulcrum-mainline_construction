-- Project Financial Report  (Sprint 11)
--
-- One row per project: contract value, change orders, production value,
-- remaining value, and both percent-complete measures.
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--   aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b  MC Project Scope Line - Development
--   458ae172-b7b4-43b5-8917-d7a792c9e81a  MC Change Order - Development
--
-- TWO PERCENT-COMPLETE MEASURES, AND WHY THE PAIR MATTERS
--   Financial % = approved production value / current contract value
--                 what has been earned at the rates actually applied
--   Physical  % = earned value at BUDGET rates / authorized value at budget rates
--                 how much of the planned work is in the ground
--
-- They are computed from the same quantities but priced differently, so the
-- SPREAD between them is the rate variance: physical ahead of financial means
-- the work is being done below budget rate, financial ahead of physical means
-- above. A single blended "percent complete" hides exactly that.
--
-- Physical % is value-weighted on purpose. A plain average of per-line percents
-- would let a 40 EA handhole line count as much as an 80,000 FT fiber line.
--
-- BILLED VALUE: no billing app exists yet, so billed_value is NULL and
-- remaining_to_bill cannot be computed. The columns are present so the shape of
-- the report does not change when billing arrives - see Sprint 11 open items.

WITH params AS (
  SELECT CAST(NULL AS varchar) AS p_project_id
),

-- Original contract value = the sum of baselined scope lines at budget rates.
baseline AS (
  SELECT
    s.project_id_snap AS project_id,
    MAX(s.project_name_snap) AS project_name,
    SUM(COALESCE(s.original_planned_quantity, 0) * COALESCE(s.budget_rate, 0))
      AS original_contract_value,
    COUNT(*) AS scope_lines,
    COUNT(CASE WHEN s.budget_rate IS NULL OR s.budget_rate = 0 THEN 1 END)
      AS scope_lines_without_rate
  FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b" s
  CROSS JOIN params
  WHERE s._status IN ('BASELINED', 'CLOSED')
    AND COALESCE(s.active, 'yes') <> 'no'
    AND (p_project_id IS NULL OR s.project_id_snap = p_project_id)
  GROUP BY s.project_id_snap
),

-- Per scope line, so physical percent can be weighted by budget value.
line_progress AS (
  SELECT
    s.project_id_snap AS project_id,
    s.labor_code,
    COALESCE(s.budget_rate, 0) AS budget_rate,
    COALESCE(s.original_planned_quantity, 0)
      + COALESCE(ac.approved_quantity_change, 0) AS authorized_quantity,
    COALESCE(prod.approved_quantity, 0)          AS completed_quantity
  FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b" s
  CROSS JOIN params
  LEFT JOIN (
    SELECT co.project_id_snap, line.line_labor_code AS labor_code,
           SUM(line.line_quantity_change) AS approved_quantity_change
    FROM "458ae172-b7b4-43b5-8917-d7a792c9e81a/quantity_changes" line
    JOIN "458ae172-b7b4-43b5-8917-d7a792c9e81a" co
      ON co._record_id = line._parent_id
    WHERE co._status = 'APPROVED'
    GROUP BY co.project_id_snap, line.line_labor_code
  ) ac
    ON ac.project_id_snap = s.project_id_snap AND ac.labor_code = s.labor_code
  LEFT JOIN (
    SELECT project_id_snapshot AS project_id, labor_code,
           SUM(CASE WHEN _status = 'APPROVED' THEN COALESCE(quantity, 0) ELSE 0 END)
             AS approved_quantity
    FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
    WHERE _status <> 'VOID'
    GROUP BY project_id_snapshot, labor_code
  ) prod
    ON prod.project_id = s.project_id_snap AND prod.labor_code = s.labor_code
  WHERE s._status IN ('BASELINED', 'CLOSED')
    AND COALESCE(s.active, 'yes') <> 'no'
    AND (p_project_id IS NULL OR s.project_id_snap = p_project_id)
),

physical AS (
  SELECT
    project_id,
    -- Earned value at BUDGET rates. Capped per line at the authorized quantity
    -- so one over-run line cannot push a project past 100% physical while other
    -- lines are untouched; the uncapped overage is reported separately.
    SUM(LEAST(completed_quantity, authorized_quantity) * budget_rate)
      AS earned_budget_value,
    SUM(authorized_quantity * budget_rate) AS authorized_budget_value,
    SUM(GREATEST(completed_quantity - authorized_quantity, 0) * budget_rate)
      AS over_plan_budget_value,
    COUNT(CASE WHEN completed_quantity > authorized_quantity THEN 1 END)
      AS lines_over_plan
  FROM line_progress
  GROUP BY project_id
),

changes AS (
  SELECT
    co.project_id_snap AS project_id,
    SUM(CASE WHEN co._status = 'APPROVED'
             THEN line.line_quantity_change * COALESCE(line.line_rate, 0) ELSE 0 END)
      AS approved_change_value,
    SUM(CASE WHEN co._status IN ('DRAFT','SUBMITTED')
             THEN line.line_quantity_change * COALESCE(line.line_rate, 0) ELSE 0 END)
      AS pending_change_value,
    COUNT(DISTINCT CASE WHEN co._status = 'APPROVED' THEN co._record_id END)
      AS approved_change_orders,
    COUNT(DISTINCT CASE WHEN co._status IN ('DRAFT','SUBMITTED') THEN co._record_id END)
      AS pending_change_orders
  FROM "458ae172-b7b4-43b5-8917-d7a792c9e81a/quantity_changes" line
  JOIN "458ae172-b7b4-43b5-8917-d7a792c9e81a" co
    ON co._record_id = line._parent_id
  CROSS JOIN params
  WHERE (p_project_id IS NULL OR co.project_id_snap = p_project_id)
  GROUP BY co.project_id_snap
),

production AS (
  SELECT
    p.project_id_snapshot AS project_id,
    SUM(CASE WHEN p._status = 'APPROVED' THEN COALESCE(p.extended_value,0) ELSE 0 END)
      AS approved_production_value,
    SUM(CASE WHEN p._status IN ('DRAFT','SUBMITTED','UNDER REVIEW','CORRECTION REQUIRED')
             THEN COALESCE(p.extended_value,0) ELSE 0 END)
      AS pending_production_value,
    SUM(CASE WHEN p._status = 'REJECTED' THEN COALESCE(p.extended_value,0) ELSE 0 END)
      AS rejected_production_value,
    -- Production value to date = everything not void and not rejected, i.e.
    -- what has been recorded as done. Distinct from approved, on purpose.
    SUM(CASE WHEN p._status NOT IN ('VOID','REJECTED') THEN COALESCE(p.extended_value,0) ELSE 0 END)
      AS production_value_to_date,
    COUNT(CASE WHEN p._status = 'APPROVED' THEN 1 END) AS approved_transactions,
    COUNT(CASE WHEN p._status IN ('DRAFT','SUBMITTED','UNDER REVIEW','CORRECTION REQUIRED')
               THEN 1 END)                              AS pending_transactions,
    MAX(CASE WHEN p._status = 'APPROVED' THEN p.work_date END) AS last_approved_work_date
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
  CROSS JOIN params
  WHERE (p_project_id IS NULL OR p.project_id_snapshot = p_project_id)
  GROUP BY p.project_id_snapshot
)

SELECT
  b.project_id,
  b.project_name,

  ROUND(CAST(b.original_contract_value AS numeric), 2)                       AS original_contract_value,
  ROUND(CAST(COALESCE(c.approved_change_value, 0) AS numeric), 2)            AS approved_change_orders_value,
  COALESCE(c.approved_change_orders, 0)                     AS approved_change_orders,
  ROUND(CAST(b.original_contract_value + COALESCE(c.approved_change_value, 0) AS numeric), 2)
                                                            AS current_contract_value,
  -- Pending changes shown but never added in (Sprint 9 rule).
  ROUND(CAST(COALESCE(c.pending_change_value, 0) AS numeric), 2)             AS pending_change_orders_value,
  COALESCE(c.pending_change_orders, 0)                      AS pending_change_orders,

  ROUND(CAST(COALESCE(pr.production_value_to_date, 0) AS numeric), 2)        AS production_value_to_date,
  ROUND(CAST(COALESCE(pr.approved_production_value, 0) AS numeric), 2)       AS approved_production_value,
  ROUND(CAST(COALESCE(pr.pending_production_value, 0) AS numeric), 2)        AS pending_production_value,
  ROUND(CAST(COALESCE(pr.rejected_production_value, 0) AS numeric), 2)       AS rejected_production_value,

  CAST(NULL AS decimal(18,2))                               AS billed_value,
  CAST(NULL AS decimal(18,2))                               AS remaining_to_bill,

  ROUND(CAST(b.original_contract_value + COALESCE(c.approved_change_value, 0)
        - COALESCE(pr.approved_production_value, 0) AS numeric), 2)      AS remaining_contract_value,

  -- Both percentages guard division by zero and are NULL rather than 0 when
  -- there is nothing to divide by: 0% and "not measurable" are different.
  CASE WHEN (b.original_contract_value + COALESCE(c.approved_change_value, 0)) = 0
       THEN NULL
       ELSE ROUND(CAST(COALESCE(pr.approved_production_value, 0)
                  / (b.original_contract_value + COALESCE(c.approved_change_value, 0))
                  * 100 AS numeric), 2) END                              AS financial_percent_complete,

  CASE WHEN COALESCE(ph.authorized_budget_value, 0) = 0 THEN NULL
       ELSE ROUND(CAST(ph.earned_budget_value / ph.authorized_budget_value * 100 AS numeric), 2) END
                                                             AS physical_percent_complete,

  -- The spread is the rate variance, which is the point of keeping both.
  CASE WHEN COALESCE(ph.authorized_budget_value, 0) = 0
         OR (b.original_contract_value + COALESCE(c.approved_change_value, 0)) = 0
       THEN NULL
       ELSE ROUND(CAST(COALESCE(pr.approved_production_value, 0)
              / (b.original_contract_value + COALESCE(c.approved_change_value, 0)) * 100
              - ph.earned_budget_value / ph.authorized_budget_value * 100 AS numeric), 2) END                                         AS financial_minus_physical_pts,

  ROUND(CAST(COALESCE(ph.earned_budget_value, 0) AS numeric), 2)              AS earned_value_at_budget_rates,
  ROUND(CAST(COALESCE(ph.over_plan_budget_value, 0) AS numeric), 2)           AS over_plan_value_at_budget_rates,
  COALESCE(ph.lines_over_plan, 0)                            AS scope_lines_over_plan,

  b.scope_lines,
  b.scope_lines_without_rate,
  COALESCE(pr.approved_transactions, 0)                      AS approved_transactions,
  COALESCE(pr.pending_transactions, 0)                       AS pending_transactions,
  pr.last_approved_work_date,

  CASE
    WHEN b.scope_lines_without_rate > 0 THEN 'CONTRACT VALUE INCOMPLETE'
    WHEN COALESCE(pr.approved_production_value, 0)
         > b.original_contract_value + COALESCE(c.approved_change_value, 0)
      THEN 'OVER CONTRACT VALUE'
    WHEN COALESCE(pr.pending_production_value, 0) > 0 THEN 'PENDING REVIEW'
    ELSE 'OK'
  END                                                        AS financial_flag
FROM baseline b
LEFT JOIN changes    c  ON c.project_id  = b.project_id
LEFT JOIN production pr ON pr.project_id = b.project_id
LEFT JOIN physical   ph ON ph.project_id = b.project_id
ORDER BY b.project_id;
