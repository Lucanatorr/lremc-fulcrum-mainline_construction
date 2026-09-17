-- Remaining Work Report  (Sprint 15)
--
-- "This is a critical management report." Per project and labor code: what was
-- planned, what is approved, what is pending, what is left, and what it is
-- worth.
-- See reports/_conventions.md for the shared rules.
--
--   aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b  MC Project Scope Line - Development
--   458ae172-b7b4-43b5-8917-d7a792c9e81a  MC Change Order - Development
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- This is the same arithmetic as project-scope-status.sql, presented for a
-- manager rather than an auditor: fewer columns, a sort that puts the work that
-- needs attention at the top, and the four states the brief asks to be easy to
-- spot as one column.
--
-- Remaining quantity is NOT clamped at zero. An over-run reads negative,
-- because the overage is the thing a manager needs to see.

WITH params AS (
  SELECT
    CAST(NULL AS varchar) AS p_project_id,
    CAST(NULL AS varchar) AS p_scope_status   -- 'OVER PLAN', 'NOT STARTED', ...
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
production AS (
  SELECT
    project_id_snapshot AS project_id,
    labor_code,
    SUM(CASE WHEN _status = 'APPROVED' THEN COALESCE(quantity, 0) ELSE 0 END)
      AS approved_quantity,
    SUM(CASE WHEN _status IN ('DRAFT','SUBMITTED','UNDER REVIEW','CORRECTION REQUIRED')
             THEN COALESCE(quantity, 0) ELSE 0 END)
      AS pending_quantity,
    MAX(CASE WHEN _status = 'APPROVED' THEN work_date END) AS last_approved_work_date
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
  WHERE _status <> 'VOID'
  GROUP BY project_id_snapshot, labor_code
),
rows AS (
  SELECT
    s.project_id_snap                          AS project_id,
    s.project_name_snap                        AS project_name,
    s.phase_wbs,
    s.labor_code,
    s.unit,
    COALESCE(s.budget_rate, 0)                 AS budget_rate,
    s.original_planned_quantity                AS original_planned_quantity,
    COALESCE(ac.approved_quantity_change, 0)   AS approved_quantity_change,
    s.original_planned_quantity + COALESCE(ac.approved_quantity_change, 0)
                                               AS planned_quantity,
    COALESCE(p.approved_quantity, 0)           AS approved_quantity,
    COALESCE(p.pending_quantity, 0)            AS pending_quantity,
    p.last_approved_work_date
  FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b" s
  CROSS JOIN params
  LEFT JOIN approved_changes ac
    ON ac.project_id_snap = s.project_id_snap AND ac.labor_code = s.labor_code
  LEFT JOIN production p
    ON p.project_id = s.project_id_snap AND p.labor_code = s.labor_code
  WHERE s._status IN ('BASELINED', 'CLOSED')
    AND COALESCE(s.active, 'yes') <> 'no'
    AND (p_project_id IS NULL OR s.project_id_snap = p_project_id)
),
scored AS (
  SELECT
    r.*,
    r.planned_quantity - r.approved_quantity AS remaining_quantity,
    CASE
      WHEN r.approved_quantity > r.planned_quantity  THEN 'OVER PLAN'
      WHEN r.planned_quantity = 0                    THEN 'NO AUTHORIZED SCOPE'
      WHEN r.approved_quantity = 0                   THEN 'NOT STARTED'
      WHEN r.approved_quantity >= r.planned_quantity THEN 'COMPLETE'
      ELSE 'IN PROGRESS'
    END AS scope_status
  FROM rows r
)
SELECT
  project_id,
  project_name,
  phase_wbs,
  labor_code,
  -- The brief asks for Description. The pay-unit description lives on the rate
  -- master; the choice label carries it too, but a scope line does not snapshot
  -- it. Taken from production where any exists, so the column is populated
  -- wherever work has been done, and null on a line nobody has touched yet.
  (SELECT MAX(labor_description)
     FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" d
    WHERE d.labor_code = scored.labor_code)   AS description,
  unit,

  planned_quantity,
  original_planned_quantity,
  approved_quantity_change,
  approved_quantity                            AS approved_completed_quantity,
  pending_quantity,
  remaining_quantity,

  CASE WHEN planned_quantity = 0 THEN NULL     -- guarded
       ELSE ROUND(CAST(approved_quantity / planned_quantity * 100 AS numeric), 2) END
                                               AS percent_complete,

  budget_rate,
  ROUND(CAST(planned_quantity * budget_rate AS numeric), 2)    AS planned_value,
  ROUND(CAST(approved_quantity * budget_rate AS numeric), 2)   AS completed_value,
  ROUND(CAST(remaining_quantity * budget_rate AS numeric), 2)  AS remaining_value,
  ROUND(CAST(pending_quantity * budget_rate AS numeric), 2)    AS pending_value,

  scope_status,
  last_approved_work_date
FROM scored
CROSS JOIN params
WHERE (p_scope_status IS NULL OR scope_status = p_scope_status)
-- Over-runs first, then the biggest remaining value: what a manager opens this
-- report to find, rather than alphabetical order by pay unit.
ORDER BY
  CASE scope_status
    WHEN 'OVER PLAN'            THEN 1
    WHEN 'NO AUTHORIZED SCOPE'  THEN 2
    WHEN 'IN PROGRESS'          THEN 3
    WHEN 'NOT STARTED'          THEN 4
    ELSE 5
  END,
  ABS(remaining_quantity * budget_rate) DESC;
