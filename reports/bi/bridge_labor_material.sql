-- bridge_labor_material  (Sprint 29)  grain: one mapping.  key: mapping_id
--   38e3d7fd-ca78-4016-8018-ec955446c13f  MC Labor-Material Mapping - Development
--
-- The Mappings dataset: links dim_labor to dim_material for EXPECTED material.
-- Multiplier and waste factor stay separate (the waste factor is a purchasing
-- gross-up, never part of consumption). is_usable = APPROVED and active.
-- Expected conduit for a production record is already computed in Fulcrum as
-- fact_production.conduit_material_quantity; use that, not this bridge, for
-- conduit, so the multiplier is applied once.

SELECT
  g.mapping_id,
  g.labor_code,
  g.material_code,
  g.material_unit                                                     AS unit,
  g.calculation_type,
  g.multiplier,
  g.waste_factor,
  g.source,
  g.confidence,
  g._status                                                           AS mapping_status,
  CASE WHEN g._status = 'APPROVED' AND COALESCE(g.active, 'yes') <> 'no' THEN 1 ELSE 0 END AS is_usable,
  CAST(TO_CHAR(CAST(g.effective_date AS date), 'YYYYMMDD') AS integer)  AS effective_date_key,
  CAST(TO_CHAR(CAST(g.expiration_date AS date), 'YYYYMMDD') AS integer) AS expiration_date_key,
  g.supersedes_mapping_id
FROM "38e3d7fd-ca78-4016-8018-ec955446c13f" g
WHERE g._status <> 'VOID'
ORDER BY g.mapping_id;
