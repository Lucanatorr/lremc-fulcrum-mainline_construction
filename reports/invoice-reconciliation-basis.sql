-- Invoice Reconciliation Basis  (Sprint 30)
--
-- What Fulcrum says each contractor may bill, for scripts/reconcile_invoice.py
-- to match a contractor's invoice against. One row per non-VOID production
-- record, carrying every key an invoice line can be matched on: project,
-- contractor, labor code, period (work_month) and Production ID.
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- INCLUDES REVERSED ON PURPOSE: a contractor billing a reversed record must be
-- told it was reversed, not that it does not exist.
-- Unapproved rows are INCLUDED on purpose: "unapproved production billed" can
-- only be detected if the reconciliation can see the unapproved production.
-- The rate is the one SNAPSHOTTED on the record - the contractor is paid the
-- rate the work was priced at, and nothing here re-prices it.

WITH params AS (
  SELECT CAST(NULL AS varchar) AS p_contractor_id,
         CAST(NULL AS varchar) AS p_period            -- e.g. '2026-11'
)
SELECT
  p.production_id,
  p.project_id_snapshot                                  AS project_id,
  p.contractor_id_snapshot                               AS contractor_id,
  p.labor_code,
  p.unit,
  p.work_month                                           AS period,
  p._status                                              AS record_status,
  CASE WHEN p._status = 'APPROVED' THEN 1 ELSE 0 END     AS is_approved,
  p.quantity,
  p.contractor_rate                                      AS rate_applied,
  p.rate_source_id                                       AS rate_id,
  p.extended_value
FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
CROSS JOIN params
WHERE p._status <> 'VOID'
  AND (p_contractor_id IS NULL OR p.contractor_id_snapshot = p_contractor_id)
  AND (p_period IS NULL OR p.work_month = p_period)
ORDER BY p.contractor_id_snapshot, p.project_id_snapshot, p.work_month, p.labor_code, p.production_id;
