-- dim_structure  (Sprint 29)  key: structure_id
--   397b52cf-a4f0-4871-b8ea-1fdb592fe2ab  MC Structure - Development

SELECT
  s.structure_id,
  s.structure_type,
  s.project_id_snap                                  AS project_id,
  s.route, s.phase_wbs,
  s.ownership,
  s.size_model, s.traffic_rating,
  s.pole_height, s.pole_class, s.pole_material,
  s.closure_type, s.fiber_count,
  s.housed_in_structure_id,
  s._status                                          AS structure_status,
  CAST(s.installed_date AS date)                     AS installed_date,
  CAST(TO_CHAR(CAST(s.installed_date AS date), 'YYYYMMDD') AS integer) AS installed_date_key,
  s.active,
  s._latitude                                        AS latitude,
  s._longitude                                       AS longitude,
  s._record_id                                       AS fulcrum_record_id
FROM "397b52cf-a4f0-4871-b8ea-1fdb592fe2ab" s
ORDER BY s.structure_id;
