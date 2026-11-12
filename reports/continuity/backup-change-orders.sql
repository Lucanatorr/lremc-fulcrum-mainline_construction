-- Backup export: change_orders  (Sprint 31)
--
--   458ae172-b7b4-43b5-8917-d7a792c9e81a  MC Change Order - Development
--
-- Every column of every row, deleted-proof copy for the backup folder.
-- Save the result as change_orders.json (Query API) or change_orders.csv (Query UI) next to
-- manifest.json from backup-manifest.sql, run in the same sitting, and check
-- the folder with scripts/backup_verify.py. SELECT * on purpose: a field added
-- later is backed up without editing this file.
-- NOT A PLATFORM BACKUP: photos, signatures, record history and app
-- configuration are not in it (docs/sprint-31-backup-recovery.md section 1).
-- See reports/_conventions.md for the shared rules.

SELECT *
FROM "458ae172-b7b4-43b5-8917-d7a792c9e81a"
ORDER BY _record_id COLLATE "C";
