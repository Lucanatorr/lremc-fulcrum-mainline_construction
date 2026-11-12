-- fact_material_transaction  (Sprint 29)  grain: one ledger row.  key: transaction_id
--   ee204906-adb3-431b-a1d9-d7427a4c842c  MC Material Transaction - Development
--
-- The atomic material ledger. No balance is stored anywhere (D-012); Power BI
-- sums installed_quantity etc. per material_code, which is per unit by
-- definition. DRAFT rows are exported and flagged: whether an unposted entry
-- counts is open issue OI-21, so it is a filter, not a decision made here.

SELECT
  COALESCE(t.transaction_id, CAST(t._record_id AS varchar))            AS transaction_id,
  t._record_id                                                         AS fulcrum_record_id,
  CAST(TO_CHAR(CAST(t.transaction_date AS date), 'YYYYMMDD') AS integer) AS transaction_date_key,
  CAST(t.transaction_date AS date)                                     AS transaction_date,
  t.project_id_snap                                                    AS project_id,
  t.contractor_id_snap                                                 AS contractor_id,
  t.contractor_id_snap || '|' || UPPER(TRIM(COALESCE(t.crew, '(none)'))) AS crew_key,
  t.production_id_snap                                                 AS production_id,
  t.associated_labor_code_snap                                         AS labor_code,
  t.material_code_snap                                                 AS material_code,
  t.material_unit_snap                                                 AS unit,
  t.transaction_type,
  t._status                                                            AS ledger_status,
  CASE WHEN t._status = 'POSTED' THEN 1 ELSE 0 END                     AS is_posted,
  t.quantity,
  CASE WHEN t.transaction_type = 'Installed' THEN t.quantity ELSE 0 END             AS installed_quantity,
  CASE WHEN t.transaction_type = 'Issued' THEN t.quantity ELSE 0 END                AS issued_quantity,
  CASE WHEN t.transaction_type = 'Returned' THEN t.quantity ELSE 0 END              AS returned_quantity,
  CASE WHEN t.transaction_type IN ('Damaged', 'Lost') THEN t.quantity ELSE 0 END    AS damaged_or_lost_quantity,
  CASE WHEN t.transaction_type = 'Adjusted' THEN t.quantity ELSE 0 END              AS adjusted_quantity,
  t.location
FROM "ee204906-adb3-431b-a1d9-d7427a4c842c" t
WHERE t._status <> 'VOID'
ORDER BY transaction_id;
