-- dim_segment  (Sprint 29)  key: segment_id + segment_type
--   7da87588-940a-4b9e-915d-5ec25d5c0ebc  MC Segment - Development
-- segment_id is direction-normalized (HH-1_HH-2 = HH-2_HH-1), which is what
-- makes it joinable to fact_production.segment_id. One path can carry several
-- types, so the key is the pair; segment_key concatenates them.

SELECT
  g.segment_id || '|' || COALESCE(g.segment_type, '~') AS segment_key,
  g.segment_id,
  g.segment_type,
  g.from_structure_id, g.from_structure_type,
  g.to_structure_id,   g.to_structure_type,
  g.project_id_snap                                     AS project_id,
  g.route, g.phase_wbs, g.construction_method,
  g.design_length, g.as_built_length, g.length_variance,
  g.fiber_count, g.conduit_diameter, g.pull_count,
  g._status                                             AS segment_status,
  g._record_id                                          AS fulcrum_record_id
FROM "7da87588-940a-4b9e-915d-5ec25d5c0ebc" g
ORDER BY g.segment_id, g.segment_type;
