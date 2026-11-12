-- fact_scope  (Sprint 29)  grain: one scope line.  key: scope_line_id
--   aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b  MC Project Scope Line - Development
--
-- The plan. is_authorized marks BASELINED and CLOSED lines; a DRAFT line is
-- not authorized scope and every Fulcrum report ignores it (D-010). Add
-- approved change-order deltas from fact_change_order_line for authorized
-- quantity.

SELECT
  COALESCE(s.scope_line_id, CAST(s._record_id AS varchar))            AS scope_line_id,
  s._record_id                                                         AS fulcrum_record_id,
  s.project_id_snap                                                    AS project_id,
  s.labor_code,
  s.unit,
  s.phase_wbs,
  s._status                                                            AS scope_status,
  CASE WHEN s._status IN ('BASELINED', 'CLOSED') AND COALESCE(s.active, 'yes') <> 'no' THEN 1 ELSE 0 END AS is_authorized,
  s.original_planned_quantity                                          AS planned_quantity,
  s.budget_rate,
  s.original_budget_value                                              AS planned_value,
  s.rate_source_id                                                     AS rate_id,
  CAST(TO_CHAR(CAST(s.planned_start AS date), 'YYYYMMDD') AS integer)  AS planned_start_key,
  CAST(TO_CHAR(CAST(s.planned_finish AS date), 'YYYYMMDD') AS integer) AS planned_finish_key,
  CAST(TO_CHAR(CAST(s.baseline_set_date AS date), 'YYYYMMDD') AS integer) AS baseline_date_key
FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b" s
ORDER BY s.project_id_snap, s.labor_code;
