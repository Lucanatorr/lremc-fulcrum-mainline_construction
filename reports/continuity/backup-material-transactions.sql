-- Backup export: material_transactions  (Sprint 31)
--
--   ee204906-adb3-431b-a1d9-d7427a4c842c  MC Material Transaction - Development
--
-- Every column of every row, deleted-proof copy for the backup folder.
-- Save the result as material_transactions.json (Query API) or material_transactions.csv (Query UI) next to
-- manifest.json from backup-manifest.sql, run in the same sitting, and check
-- the folder with scripts/backup_verify.py. SELECT * on purpose: a field added
-- later is backed up without editing this file.
-- NOT A PLATFORM BACKUP: photos, signatures, record history and app
-- configuration are not in it (docs/sprint-31-backup-recovery.md section 1).
-- See reports/_conventions.md for the shared rules.

SELECT *
FROM "ee204906-adb3-431b-a1d9-d7427a4c842c"
ORDER BY _record_id COLLATE "C";
