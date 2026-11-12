-- Backup export: reels  (Sprint 31)
--
--   728477da-5f36-48cb-b3ab-cbc8c38d077f  MC Fiber Reel - Development
--
-- Every column of every row, deleted-proof copy for the backup folder.
-- Save the result as reels.json (Query API) or reels.csv (Query UI) next to
-- manifest.json from backup-manifest.sql, run in the same sitting, and check
-- the folder with scripts/backup_verify.py. SELECT * on purpose: a field added
-- later is backed up without editing this file.
-- NOT A PLATFORM BACKUP: photos, signatures, record history and app
-- configuration are not in it (docs/sprint-31-backup-recovery.md section 1).
-- See reports/_conventions.md for the shared rules.

SELECT *
FROM "728477da-5f36-48cb-b3ab-cbc8c38d077f"
ORDER BY _record_id COLLATE "C";
