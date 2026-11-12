-- Integration Export: Production  (Sprint 30)
--
-- The one feed any downstream financial system (ERP/accounting, invoice
-- matching, Smartsheet) should take production from. See
-- docs/sprint-30-integration-readiness.md section 3 for the contract.
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- STATE, NOT EVENTS. Fulcrum keeps only the LATEST approval stamp on a record:
-- approved, reopened and re-approved looks like one approval. An event feed
-- would post the first approval and the second and double the money. So
-- every record is exported as its CURRENT financial state, keyed by
-- production_id, with export_hash over the fields that move money. The
-- consumer posts only the DIFFERENCE from the last state it saw
-- (scripts/export_delta.py is the reference), so re-exporting the same record
-- any number of times posts nothing new.
--
-- VOID is INCLUDED (official value 0), so a record voided after it was
-- exported reverses cleanly instead of silently keeping its money downstream.
-- An Adjustment is its own production_id: it posts its own (often negative)
-- amount, and never edits the original's.

SELECT
  p.production_id                                                       AS idempotency_key,
  p.production_id,
  p._record_id                                                          AS fulcrum_record_id,
  p._version                                                            AS record_version,
  p.project_id_snapshot                                                 AS project_id,
  p.contractor_id_snapshot                                              AS contractor_id,
  p.labor_code,
  p.unit,
  CAST(p.work_date AS date)                                             AS work_date,
  p.work_month                                                          AS period,
  p._status                                                             AS record_status,
  COALESCE(p.production_type, 'Original')                               AS production_type,
  p.adjusts_production_id,
  CASE WHEN p._status = 'APPROVED' THEN 1 ELSE 0 END                    AS is_official,
  p.quantity,
  p.contractor_rate                                                     AS rate_applied,
  p.rate_source_id                                                      AS rate_id,
  p.extended_value,
  CASE WHEN p._status = 'APPROVED' THEN COALESCE(p.quantity, 0) ELSE 0 END       AS official_quantity,
  CASE WHEN p._status = 'APPROVED' THEN COALESCE(p.extended_value, 0) ELSE 0 END AS official_value,
  p.approved_by,
  p.approved_date,
  MD5(p.production_id
      || '|' || p._status
      || '|' || COALESCE(p.project_id_snapshot, '~')
      || '|' || COALESCE(p.contractor_id_snapshot, '~')
      || '|' || COALESCE(p.labor_code, '~')
      || '|' || COALESCE(p.work_month, '~')
      || '|' || CAST(CASE WHEN p._status = 'APPROVED' THEN COALESCE(p.quantity, 0) ELSE 0 END AS varchar)
      || '|' || COALESCE(CAST(p.contractor_rate AS varchar), '~')
      || '|' || CAST(CASE WHEN p._status = 'APPROVED' THEN COALESCE(p.extended_value, 0) ELSE 0 END AS varchar)
  )                                                                     AS export_hash,
  p._updated_at                                                         AS last_changed_at
FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
ORDER BY p.production_id;
