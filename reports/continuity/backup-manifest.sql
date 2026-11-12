-- Backup Manifest  (Sprint 31)
--
-- One row per Development table: how many rows it holds, the latest server
-- change, and an MD5 FINGERPRINT of every row's identity and version. Run it
-- in the SAME sitting as the backup exports (reports/continuity/backup-*.sql),
-- save the result as manifest.json beside them, then
--     python3 scripts/backup_verify.py <backup folder> [--previous <older folder>]
-- proves each export is complete (same count, same fingerprint) and lists
-- every row that has DISAPPEARED since the previous backup. A deleted record
-- cannot be recovered from the app, so the deletion report is the point.
-- See reports/_conventions.md for the shared rules.
--
-- fingerprint = MD5 of  id:version  for every row, joined with "," in byte
-- order (COLLATE "C", so Python's sorted() gives the same order). id is
-- _record_id for a record, _child_record_id for a repeatable row. Any edit
-- bumps _version, so any edit, insert or delete changes the fingerprint.
--
-- THIS IS NOT A PLATFORM BACKUP. It and the exports are this project's copy
-- of its own data; they do not replace whatever Fulcrum retains, and they
-- cannot restore photos, signatures, record history or app configuration.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2                       Mainline Construction
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2/actual_material_used  Mainline Construction: actual materials (repeatable)
--   5ce243d4-9ec1-4fbd-8659-7be9f632b55c                       MC Project Master
--   d8a368b5-1e19-4f5f-8cf9-ff8fbdd03ab4                       MC Contractor Master
--   a5529dd0-54fa-4b8d-b595-d0218df0ee97                       MC Contractor Rate
--   658143d1-edbd-430b-81bb-1b0bb1092729                       MC Material Master
--   38e3d7fd-ca78-4016-8018-ec955446c13f                       MC Labor-Material Mapping
--   aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b                       MC Project Scope Line
--   458ae172-b7b4-43b5-8917-d7a792c9e81a                       MC Change Order
--   458ae172-b7b4-43b5-8917-d7a792c9e81a/quantity_changes      MC Change Order: quantity changes (repeatable)
--   ee204906-adb3-431b-a1d9-d7427a4c842c                       MC Material Transaction
--   728477da-5f36-48cb-b3ab-cbc8c38d077f                       MC Fiber Reel
--   397b52cf-a4f0-4871-b8ea-1fdb592fe2ab                       MC Structure
--   7da87588-940a-4b9e-915d-5ec25d5c0ebc                       MC Segment
--   351bb1f1-9837-47c8-be5b-bb0727fe93a0                       MC Project Closeout

SELECT 'production' AS dataset, '06c36c8e-4a88-4cf3-a691-9a792f8374d2' AS source_table, COUNT(*) AS row_count,
       MAX(_server_updated_at) AS last_server_update,
       MD5(COALESCE(STRING_AGG(_record_id || ':' || CAST(_version AS varchar), ',' ORDER BY _record_id COLLATE "C"), '')) AS fingerprint
FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
UNION ALL
SELECT 'production_materials' AS dataset, '06c36c8e-4a88-4cf3-a691-9a792f8374d2/actual_material_used' AS source_table, COUNT(*) AS row_count,
       MAX(_server_updated_at) AS last_server_update,
       MD5(COALESCE(STRING_AGG(_child_record_id || ':' || CAST(_version AS varchar), ',' ORDER BY _child_record_id COLLATE "C"), '')) AS fingerprint
FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2/actual_material_used"
UNION ALL
SELECT 'projects' AS dataset, '5ce243d4-9ec1-4fbd-8659-7be9f632b55c' AS source_table, COUNT(*) AS row_count,
       MAX(_server_updated_at) AS last_server_update,
       MD5(COALESCE(STRING_AGG(_record_id || ':' || CAST(_version AS varchar), ',' ORDER BY _record_id COLLATE "C"), '')) AS fingerprint
FROM "5ce243d4-9ec1-4fbd-8659-7be9f632b55c"
UNION ALL
SELECT 'contractors' AS dataset, 'd8a368b5-1e19-4f5f-8cf9-ff8fbdd03ab4' AS source_table, COUNT(*) AS row_count,
       MAX(_server_updated_at) AS last_server_update,
       MD5(COALESCE(STRING_AGG(_record_id || ':' || CAST(_version AS varchar), ',' ORDER BY _record_id COLLATE "C"), '')) AS fingerprint
FROM "d8a368b5-1e19-4f5f-8cf9-ff8fbdd03ab4"
UNION ALL
SELECT 'rates' AS dataset, 'a5529dd0-54fa-4b8d-b595-d0218df0ee97' AS source_table, COUNT(*) AS row_count,
       MAX(_server_updated_at) AS last_server_update,
       MD5(COALESCE(STRING_AGG(_record_id || ':' || CAST(_version AS varchar), ',' ORDER BY _record_id COLLATE "C"), '')) AS fingerprint
FROM "a5529dd0-54fa-4b8d-b595-d0218df0ee97"
UNION ALL
SELECT 'materials' AS dataset, '658143d1-edbd-430b-81bb-1b0bb1092729' AS source_table, COUNT(*) AS row_count,
       MAX(_server_updated_at) AS last_server_update,
       MD5(COALESCE(STRING_AGG(_record_id || ':' || CAST(_version AS varchar), ',' ORDER BY _record_id COLLATE "C"), '')) AS fingerprint
FROM "658143d1-edbd-430b-81bb-1b0bb1092729"
UNION ALL
SELECT 'mappings' AS dataset, '38e3d7fd-ca78-4016-8018-ec955446c13f' AS source_table, COUNT(*) AS row_count,
       MAX(_server_updated_at) AS last_server_update,
       MD5(COALESCE(STRING_AGG(_record_id || ':' || CAST(_version AS varchar), ',' ORDER BY _record_id COLLATE "C"), '')) AS fingerprint
FROM "38e3d7fd-ca78-4016-8018-ec955446c13f"
UNION ALL
SELECT 'scope_lines' AS dataset, 'aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b' AS source_table, COUNT(*) AS row_count,
       MAX(_server_updated_at) AS last_server_update,
       MD5(COALESCE(STRING_AGG(_record_id || ':' || CAST(_version AS varchar), ',' ORDER BY _record_id COLLATE "C"), '')) AS fingerprint
FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b"
UNION ALL
SELECT 'change_orders' AS dataset, '458ae172-b7b4-43b5-8917-d7a792c9e81a' AS source_table, COUNT(*) AS row_count,
       MAX(_server_updated_at) AS last_server_update,
       MD5(COALESCE(STRING_AGG(_record_id || ':' || CAST(_version AS varchar), ',' ORDER BY _record_id COLLATE "C"), '')) AS fingerprint
FROM "458ae172-b7b4-43b5-8917-d7a792c9e81a"
UNION ALL
SELECT 'change_order_lines' AS dataset, '458ae172-b7b4-43b5-8917-d7a792c9e81a/quantity_changes' AS source_table, COUNT(*) AS row_count,
       MAX(_server_updated_at) AS last_server_update,
       MD5(COALESCE(STRING_AGG(_child_record_id || ':' || CAST(_version AS varchar), ',' ORDER BY _child_record_id COLLATE "C"), '')) AS fingerprint
FROM "458ae172-b7b4-43b5-8917-d7a792c9e81a/quantity_changes"
UNION ALL
SELECT 'material_transactions' AS dataset, 'ee204906-adb3-431b-a1d9-d7427a4c842c' AS source_table, COUNT(*) AS row_count,
       MAX(_server_updated_at) AS last_server_update,
       MD5(COALESCE(STRING_AGG(_record_id || ':' || CAST(_version AS varchar), ',' ORDER BY _record_id COLLATE "C"), '')) AS fingerprint
FROM "ee204906-adb3-431b-a1d9-d7427a4c842c"
UNION ALL
SELECT 'reels' AS dataset, '728477da-5f36-48cb-b3ab-cbc8c38d077f' AS source_table, COUNT(*) AS row_count,
       MAX(_server_updated_at) AS last_server_update,
       MD5(COALESCE(STRING_AGG(_record_id || ':' || CAST(_version AS varchar), ',' ORDER BY _record_id COLLATE "C"), '')) AS fingerprint
FROM "728477da-5f36-48cb-b3ab-cbc8c38d077f"
UNION ALL
SELECT 'structures' AS dataset, '397b52cf-a4f0-4871-b8ea-1fdb592fe2ab' AS source_table, COUNT(*) AS row_count,
       MAX(_server_updated_at) AS last_server_update,
       MD5(COALESCE(STRING_AGG(_record_id || ':' || CAST(_version AS varchar), ',' ORDER BY _record_id COLLATE "C"), '')) AS fingerprint
FROM "397b52cf-a4f0-4871-b8ea-1fdb592fe2ab"
UNION ALL
SELECT 'segments' AS dataset, '7da87588-940a-4b9e-915d-5ec25d5c0ebc' AS source_table, COUNT(*) AS row_count,
       MAX(_server_updated_at) AS last_server_update,
       MD5(COALESCE(STRING_AGG(_record_id || ':' || CAST(_version AS varchar), ',' ORDER BY _record_id COLLATE "C"), '')) AS fingerprint
FROM "7da87588-940a-4b9e-915d-5ec25d5c0ebc"
UNION ALL
SELECT 'closeouts' AS dataset, '351bb1f1-9837-47c8-be5b-bb0727fe93a0' AS source_table, COUNT(*) AS row_count,
       MAX(_server_updated_at) AS last_server_update,
       MD5(COALESCE(STRING_AGG(_record_id || ':' || CAST(_version AS varchar), ',' ORDER BY _record_id COLLATE "C"), '')) AS fingerprint
FROM "351bb1f1-9837-47c8-be5b-bb0727fe93a0"
ORDER BY dataset;
