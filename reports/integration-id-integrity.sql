-- Integration ID Integrity  (Sprint 30)
--
-- "Expose stable IDs." An external system can only be idempotent if every
-- record it receives carries an ID that is present, unique and never changes.
-- This checks the first two, live, for every app's business ID. (The third -
-- never changes - is enforced in the apps: the Production ID is set once,
-- structure IDs lock, rates and mappings are versioned rather than edited.)
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--   5ce243d4-9ec1-4fbd-8659-7be9f632b55c  MC Project Master - Development
--   d8a368b5-1e19-4f5f-8cf9-ff8fbdd03ab4  MC Contractor Master - Development
--   a5529dd0-54fa-4b8d-b595-d0218df0ee97  MC Contractor Rate - Development
--   658143d1-edbd-430b-81bb-1b0bb1092729  MC Material Master - Development
--   38e3d7fd-ca78-4016-8018-ec955446c13f  MC Labor-Material Mapping - Development
--   ee204906-adb3-431b-a1d9-d7427a4c842c  MC Material Transaction - Development
--   aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b  MC Project Scope Line - Development
--   458ae172-b7b4-43b5-8917-d7a792c9e81a  MC Change Order - Development
--   397b52cf-a4f0-4871-b8ea-1fdb592fe2ab  MC Structure - Development
--   728477da-5f36-48cb-b3ab-cbc8c38d077f  MC Fiber Reel - Development
--
-- One row per app: records, records with a blank ID, IDs used more than once.
-- PASS needs both counts at zero.

WITH ids AS (
  SELECT 'Production' AS app, 'production_id' AS id_field, production_id AS id FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" WHERE _status <> 'VOID'
  UNION ALL SELECT 'Project', 'project_id', project_id FROM "5ce243d4-9ec1-4fbd-8659-7be9f632b55c"
  UNION ALL SELECT 'Contractor', 'contractor_id', contractor_id FROM "d8a368b5-1e19-4f5f-8cf9-ff8fbdd03ab4"
  UNION ALL SELECT 'Contractor Rate', 'rate_id', rate_id FROM "a5529dd0-54fa-4b8d-b595-d0218df0ee97"
  UNION ALL SELECT 'Material', 'material_code', material_code FROM "658143d1-edbd-430b-81bb-1b0bb1092729"
  UNION ALL SELECT 'Labor-Material Mapping', 'mapping_id', mapping_id FROM "38e3d7fd-ca78-4016-8018-ec955446c13f"
  UNION ALL SELECT 'Material Transaction', 'transaction_id', transaction_id FROM "ee204906-adb3-431b-a1d9-d7427a4c842c" WHERE _status <> 'VOID'
  UNION ALL SELECT 'Scope Line', 'scope_line_id', scope_line_id FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b"
  UNION ALL SELECT 'Change Order', 'change_order_number', change_order_number FROM "458ae172-b7b4-43b5-8917-d7a792c9e81a"
  UNION ALL SELECT 'Structure', 'structure_id', structure_id FROM "397b52cf-a4f0-4871-b8ea-1fdb592fe2ab"
  UNION ALL SELECT 'Fiber Reel', 'reel_id', reel_id FROM "728477da-5f36-48cb-b3ab-cbc8c38d077f"
),
dups AS (
  SELECT app, id, COUNT(*) AS n FROM ids WHERE id IS NOT NULL AND id <> '' GROUP BY app, id HAVING COUNT(*) > 1
)
SELECT
  i.app,
  i.id_field,
  COUNT(*)                                                       AS records,
  COUNT(CASE WHEN i.id IS NULL OR i.id = '' THEN 1 END)          AS blank_ids,
  (SELECT COUNT(*) FROM dups d WHERE d.app = i.app)              AS duplicated_ids,
  CASE WHEN COUNT(CASE WHEN i.id IS NULL OR i.id = '' THEN 1 END) = 0
        AND (SELECT COUNT(*) FROM dups d WHERE d.app = i.app) = 0
       THEN 'PASS' ELSE 'FIX BEFORE INTEGRATING' END             AS result
FROM ids i
GROUP BY i.app, i.id_field
ORDER BY i.app;
