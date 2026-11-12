-- dim_material  (Sprint 29)  key: material_code
--   658143d1-edbd-430b-81bb-1b0bb1092729  MC Material Master - Development

SELECT
  m.material_code,
  m.description,
  m.category,
  m.unit,
  m.manufacturer,
  m.part_number,
  m.pack_size,
  m.conduit_diameter,
  m.pull_count,
  m.standard_cost,
  m._status                 AS material_status,
  m.active,
  m._record_id              AS fulcrum_record_id
FROM "658143d1-edbd-430b-81bb-1b0bb1092729" m
ORDER BY m.material_code;
