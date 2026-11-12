-- Backup export: production  (Sprint 31)
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- Every column of every row, deleted-proof copy for the backup folder.
-- Save the result as production.json (Query API) or production.csv (Query UI) next to
-- manifest.json from backup-manifest.sql, run in the same sitting, and check
-- the folder with scripts/backup_verify.py. SELECT * on purpose: a field added
-- later is backed up without editing this file.
-- NOT A PLATFORM BACKUP: photos, signatures, record history and app
-- configuration are not in it (docs/sprint-31-backup-recovery.md section 1).
-- See reports/_conventions.md for the shared rules.

SELECT *
FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
ORDER BY _record_id COLLATE "C";
