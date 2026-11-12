-- Backup export: projects  (Sprint 31)
--
--   5ce243d4-9ec1-4fbd-8659-7be9f632b55c  MC Project Master - Development
--
-- Every column of every row, deleted-proof copy for the backup folder.
-- Save the result as projects.json (Query API) or projects.csv (Query UI) next to
-- manifest.json from backup-manifest.sql, run in the same sitting, and check
-- the folder with scripts/backup_verify.py. SELECT * on purpose: a field added
-- later is backed up without editing this file.
-- NOT A PLATFORM BACKUP: photos, signatures, record history and app
-- configuration are not in it (docs/sprint-31-backup-recovery.md section 1).
-- See reports/_conventions.md for the shared rules.

SELECT *
FROM "5ce243d4-9ec1-4fbd-8659-7be9f632b55c"
ORDER BY _record_id COLLATE "C";
