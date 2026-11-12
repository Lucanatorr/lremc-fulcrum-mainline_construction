-- Backup export: contractors  (Sprint 31)
--
--   d8a368b5-1e19-4f5f-8cf9-ff8fbdd03ab4  MC Contractor Master - Development
--
-- Every column of every row, deleted-proof copy for the backup folder.
-- Save the result as contractors.json (Query API) or contractors.csv (Query UI) next to
-- manifest.json from backup-manifest.sql, run in the same sitting, and check
-- the folder with scripts/backup_verify.py. SELECT * on purpose: a field added
-- later is backed up without editing this file.
-- NOT A PLATFORM BACKUP: photos, signatures, record history and app
-- configuration are not in it (docs/sprint-31-backup-recovery.md section 1).
-- See reports/_conventions.md for the shared rules.

SELECT *
FROM "d8a368b5-1e19-4f5f-8cf9-ff8fbdd03ab4"
ORDER BY _record_id COLLATE "C";
