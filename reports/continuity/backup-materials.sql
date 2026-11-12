-- Backup export: materials  (Sprint 31)
--
--   658143d1-edbd-430b-81bb-1b0bb1092729  MC Material Master - Development
--
-- Every column of every row, deleted-proof copy for the backup folder.
-- Save the result as materials.json (Query API) or materials.csv (Query UI) next to
-- manifest.json from backup-manifest.sql, run in the same sitting, and check
-- the folder with scripts/backup_verify.py. SELECT * on purpose: a field added
-- later is backed up without editing this file.
-- NOT A PLATFORM BACKUP: photos, signatures, record history and app
-- configuration are not in it (docs/sprint-31-backup-recovery.md section 1).
-- See reports/_conventions.md for the shared rules.

SELECT *
FROM "658143d1-edbd-430b-81bb-1b0bb1092729"
ORDER BY _record_id COLLATE "C";
