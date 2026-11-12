-- Backup export: structures  (Sprint 31)
--
--   397b52cf-a4f0-4871-b8ea-1fdb592fe2ab  MC Structure - Development
--
-- Every column of every row, deleted-proof copy for the backup folder.
-- Save the result as structures.json (Query API) or structures.csv (Query UI) next to
-- manifest.json from backup-manifest.sql, run in the same sitting, and check
-- the folder with scripts/backup_verify.py. SELECT * on purpose: a field added
-- later is backed up without editing this file.
-- NOT A PLATFORM BACKUP: photos, signatures, record history and app
-- configuration are not in it (docs/sprint-31-backup-recovery.md section 1).
-- See reports/_conventions.md for the shared rules.

SELECT *
FROM "397b52cf-a4f0-4871-b8ea-1fdb592fe2ab"
ORDER BY _record_id COLLATE "C";
