-- dim_project  (Sprint 29)  key: project_id
--   5ce243d4-9ec1-4fbd-8659-7be9f632b55c  MC Project Master - Development
-- Plan quantities are carried as attributes for display. Progress is never
-- computed from them here: fact_scope and fact_production carry the numbers.

SELECT
  m.project_id,
  m.project_name,
  m._status                                         AS project_status,
  m.customer, m.market, m.state, m.county,
  m.project_manager, m.construction_manager,
  CAST(m.start_date AS date)                        AS start_date,
  CAST(TO_CHAR(CAST(m.start_date AS date), 'YYYYMMDD') AS integer) AS start_date_key,
  CAST(m.required_completion_date AS date)          AS required_completion_date,
  CAST(TO_CHAR(CAST(m.required_completion_date AS date), 'YYYYMMDD') AS integer) AS required_completion_date_key,
  m.route_miles,
  m.planned_fiber_footage, m.planned_underground_footage, m.planned_aerial_footage, m.planned_splices,
  CASE WHEN m.project_name LIKE 'MCP-TEST%' THEN 1 ELSE 0 END AS is_test_project,
  m._record_id                                      AS fulcrum_record_id
FROM "5ce243d4-9ec1-4fbd-8659-7be9f632b55c" m
ORDER BY m.project_id;
