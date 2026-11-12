-- Backup export: closeouts  (Sprint 31)
--
--   351bb1f1-9837-47c8-be5b-bb0727fe93a0  MC Project Closeout - Development
--
-- Every column of every row, deleted-proof copy for the backup folder.
-- Save the result as closeouts.json (Query API) or closeouts.csv (Query UI) next to
-- manifest.json from backup-manifest.sql, run in the same sitting, and check
-- the folder with scripts/backup_verify.py. SELECT * on purpose: a field added
-- later is backed up without editing this file.
-- NOT A PLATFORM BACKUP: photos, signatures, record history and app
-- configuration are not in it (docs/sprint-31-backup-recovery.md section 1).
-- See reports/_conventions.md for the shared rules.

SELECT *
FROM "351bb1f1-9837-47c8-be5b-bb0727fe93a0"
ORDER BY _record_id COLLATE "C";
