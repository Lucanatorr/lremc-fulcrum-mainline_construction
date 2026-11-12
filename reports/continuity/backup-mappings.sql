-- Backup export: mappings  (Sprint 31)
--
--   38e3d7fd-ca78-4016-8018-ec955446c13f  MC Labor-Material Mapping - Development
--
-- Every column of every row, deleted-proof copy for the backup folder.
-- Save the result as mappings.json (Query API) or mappings.csv (Query UI) next to
-- manifest.json from backup-manifest.sql, run in the same sitting, and check
-- the folder with scripts/backup_verify.py. SELECT * on purpose: a field added
-- later is backed up without editing this file.
-- NOT A PLATFORM BACKUP: photos, signatures, record history and app
-- configuration are not in it (docs/sprint-31-backup-recovery.md section 1).
-- See reports/_conventions.md for the shared rules.

SELECT *
FROM "38e3d7fd-ca78-4016-8018-ec955446c13f"
ORDER BY _record_id COLLATE "C";
