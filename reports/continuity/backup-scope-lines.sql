-- Backup export: scope_lines  (Sprint 31)
--
--   aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b  MC Project Scope Line - Development
--
-- Every column of every row, deleted-proof copy for the backup folder.
-- Save the result as scope_lines.json (Query API) or scope_lines.csv (Query UI) next to
-- manifest.json from backup-manifest.sql, run in the same sitting, and check
-- the folder with scripts/backup_verify.py. SELECT * on purpose: a field added
-- later is backed up without editing this file.
-- NOT A PLATFORM BACKUP: photos, signatures, record history and app
-- configuration are not in it (docs/sprint-31-backup-recovery.md section 1).
-- See reports/_conventions.md for the shared rules.

SELECT *
FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b"
ORDER BY _record_id COLLATE "C";
