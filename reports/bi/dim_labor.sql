-- dim_labor  (Sprint 29)  key: labor_code
--   a5529dd0-54fa-4b8d-b595-d0218df0ee97  MC Contractor Rate - Development
--   38e3d7fd-ca78-4016-8018-ec955446c13f  MC Labor-Material Mapping - Development
--
-- One row per pay unit. The UNIT is a dimension attribute so every visual can
-- slice by it: quantities are only ever summed within one unit.
-- work_type is a reporting grouping of the code family, NOT the category used
-- for installed footage - that comes from each record's work_category (D-007).
-- Rates are NOT carried here: a pay unit has a different price per contractor
-- and per date. Use dim_rate, or the snapshot on fact_production.

WITH codes AS (
  SELECT labor_code,
         MAX(unit)               AS unit,
         MAX(labor_description)  AS labor_description,
         COUNT(*)                AS rate_records,
         COUNT(CASE WHEN COALESCE(active, 'yes') = 'yes' AND _status = 'ACTIVE' THEN 1 END) AS active_rates
  FROM "a5529dd0-54fa-4b8d-b595-d0218df0ee97"
  GROUP BY labor_code
),
mapped AS (
  SELECT labor_code,
         COUNT(CASE WHEN _status = 'APPROVED' THEN 1 END) AS approved_mappings,
         COUNT(*)                                          AS mappings
  FROM "38e3d7fd-ca78-4016-8018-ec955446c13f"
  WHERE _status NOT IN ('VOID', 'REJECTED', 'SUPERSEDED')
  GROUP BY labor_code
)
SELECT
  c.labor_code,
  c.labor_description,
  c.unit,
  CASE WHEN c.unit IN ('HR', 'EVENT') THEN 'TIME AND MATERIALS' ELSE 'PHYSICAL' END AS production_class,
  CASE WHEN c.labor_code LIKE 'BM60%' OR c.labor_code LIKE 'BMHD%' OR c.labor_code LIKE 'BM7%' THEN 'Underground'
       WHEN c.labor_code LIKE 'AFO%' THEN 'Aerial'
       WHEN c.labor_code LIKE 'BFO%' THEN 'Fiber Placement'
       WHEN c.labor_code LIKE 'HO-1%' OR c.labor_code LIKE '%AFOx' OR c.labor_code LIKE 'HBFOx%' THEN 'Splicing and Testing'
       WHEN c.labor_code LIKE 'BMHR%' OR c.labor_code = 'FLAG' THEN 'Time and Materials'
       WHEN c.labor_code LIKE 'BHF%' OR c.labor_code LIKE 'BDO%' OR c.labor_code LIKE '(X%' THEN 'Structures'
       ELSE 'Other' END                                                        AS work_type_group,
  c.rate_records,
  c.active_rates,
  COALESCE(m.mappings, 0)                                                      AS material_mappings,
  COALESCE(m.approved_mappings, 0)                                             AS approved_material_mappings
FROM codes c
LEFT JOIN mapped m ON m.labor_code = c.labor_code
ORDER BY c.labor_code;
