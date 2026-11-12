-- Backup export: segments  (Sprint 31)
--
--   7da87588-940a-4b9e-915d-5ec25d5c0ebc  MC Segment - Development
--
-- Every column of every row, deleted-proof copy for the backup folder.
-- Save the result as segments.json (Query API) or segments.csv (Query UI) next to
-- manifest.json from backup-manifest.sql, run in the same sitting, and check
-- the folder with scripts/backup_verify.py. SELECT * on purpose: a field added
-- later is backed up without editing this file.
-- NOT A PLATFORM BACKUP: photos, signatures, record history and app
-- configuration are not in it (docs/sprint-31-backup-recovery.md section 1).
-- See reports/_conventions.md for the shared rules.

SELECT *
FROM "7da87588-940a-4b9e-915d-5ec25d5c0ebc"
ORDER BY _record_id COLLATE "C";
