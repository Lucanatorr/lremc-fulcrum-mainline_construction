-- Backup export: rates  (Sprint 31)
--
--   a5529dd0-54fa-4b8d-b595-d0218df0ee97  MC Contractor Rate - Development
--
-- Every column of every row, deleted-proof copy for the backup folder.
-- Save the result as rates.json (Query API) or rates.csv (Query UI) next to
-- manifest.json from backup-manifest.sql, run in the same sitting, and check
-- the folder with scripts/backup_verify.py. SELECT * on purpose: a field added
-- later is backed up without editing this file.
-- NOT A PLATFORM BACKUP: photos, signatures, record history and app
-- configuration are not in it (docs/sprint-31-backup-recovery.md section 1).
-- See reports/_conventions.md for the shared rules.

SELECT *
FROM "a5529dd0-54fa-4b8d-b595-d0218df0ee97"
ORDER BY _record_id COLLATE "C";
