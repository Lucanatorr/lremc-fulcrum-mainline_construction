-- Audit History Fingerprint  (Sprint 27)
--
-- The brief: "Periodically verify that historical quantities, rates, values,
-- statuses, relationships, and material quantities have not unexpectedly
-- changed." See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--   ee204906-adb3-431b-a1d9-d7427a4c842c  MC Material Transaction - Development
--
-- One row per ledger x project x contractor x period x unit, carrying totals
-- and an MD5 FINGERPRINT of every record in it. The fingerprint covers, per
-- record: identity, status, labor code, quantity, unit, rate, rate source,
-- value, project, contractor, segment, reel, sequentials, conduit material
-- quantity, and who/when approved. Change any one of those on any record in a
-- past period and that period's fingerprint changes.
--
-- HOW IT IS USED (monthly, docs/sprint-27-audit-operations.md):
--   1. Run this report; save the result (JSON from the Query API, or CSV from
--      the Fulcrum Query UI) as data/audit-snapshots/<date>-history.json|csv.
--   2. python3 scripts/audit_history_check.py <previous> <current>
--   3. Every CHANGED row in a CLOSED period must be explained by a REVERSED
--      record or an Adjustment in voided-reversed.sql. Anything else is the
--      "unexpected change" the brief asks about.
--
-- WHICH RECORDS ARE HISTORY. Production: APPROVED and REVERSED - official
-- production and the evidence of what was taken back out. Pending work is not
-- history yet. Material: every ledger row except DRAFT, VOID included, so
-- voiding a posted transaction shows as a change.
-- Units are kept apart: quantities are only summed within one unit.

WITH prod AS (
  SELECT
    'PRODUCTION'                                   AS ledger,
    COALESCE(project_id_snapshot, '~')             AS project_id,
    COALESCE(contractor_id_snapshot, '~')          AS contractor_id,
    COALESCE(work_month, '~')                      AS period,
    COALESCE(unit, '~')                            AS unit,
    production_id                                  AS item_id,
    quantity,
    extended_value                                 AS value,
    production_id
      || '|' || _status
      || '|' || COALESCE(labor_code, '~')
      || '|' || COALESCE(CAST(quantity AS varchar), '~')
      || '|' || COALESCE(unit, '~')
      || '|' || COALESCE(CAST(contractor_rate AS varchar), '~')
      || '|' || COALESCE(rate_source_id, '~')
      || '|' || COALESCE(CAST(extended_value AS varchar), '~')
      || '|' || COALESCE(project_id_snapshot, '~')
      || '|' || COALESCE(contractor_id_snapshot, '~')
      || '|' || COALESCE(segment_id, '~')
      || '|' || COALESCE(reel_id, '~')
      || '|' || COALESCE(CAST(starting_sequential AS varchar), '~')
      || '|' || COALESCE(CAST(ending_sequential AS varchar), '~')
      || '|' || COALESCE(CAST(conduit_material_quantity AS varchar), '~')
      || '|' || COALESCE(approved_by, '~')
      || '|' || COALESCE(CAST(approved_date AS varchar), '~')       AS signature
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
  WHERE _status IN ('APPROVED', 'REVERSED')
),
mat AS (
  SELECT
    'MATERIAL'                                     AS ledger,
    COALESCE(project_id_snap, '~')                 AS project_id,
    COALESCE(contractor_id_snap, '~')              AS contractor_id,
    COALESCE(TO_CHAR(CAST(transaction_date AS date), 'YYYY-MM'), '~') AS period,
    COALESCE(material_unit_snap, '~')              AS unit,
    COALESCE(transaction_id, CAST(_record_id AS varchar)) AS item_id,
    quantity,
    CAST(NULL AS numeric)                          AS value,
    COALESCE(transaction_id, CAST(_record_id AS varchar))
      || '|' || _status
      || '|' || COALESCE(transaction_type, '~')
      || '|' || COALESCE(material_code_snap, '~')
      || '|' || COALESCE(CAST(quantity AS varchar), '~')
      || '|' || COALESCE(production_id_snap, '~')
      || '|' || COALESCE(CAST(transaction_date AS varchar), '~')    AS signature
  FROM "ee204906-adb3-431b-a1d9-d7427a4c842c"
  WHERE _status <> 'DRAFT'
),
allrows AS (
  SELECT ledger, project_id, contractor_id, period, unit, item_id, quantity, value, signature FROM prod
  UNION ALL
  SELECT ledger, project_id, contractor_id, period, unit, item_id, quantity, value, signature FROM mat
)
SELECT
  ledger,
  project_id,
  contractor_id,
  period,
  unit,
  COUNT(*)                                                   AS records,
  ROUND(CAST(SUM(COALESCE(quantity, 0)) AS numeric), 2)      AS total_quantity,
  ROUND(CAST(SUM(COALESCE(value, 0)) AS numeric), 2)         AS total_value,
  MD5(STRING_AGG(signature, ',' ORDER BY item_id))           AS fingerprint
FROM allrows
GROUP BY ledger, project_id, contractor_id, period, unit
ORDER BY ledger, project_id, contractor_id, period, unit;
