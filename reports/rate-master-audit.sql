-- Rate Master Audit  (OI-09, D-020; Sprint 27 monthly rate review)
--
-- Problems in the RATE MASTER itself, before any production uses them.
-- reports/rate-audit.sql audits production that was priced; this audits the
-- prices. One row per rate per finding.
-- See reports/_conventions.md for the shared rules.
--
--   a5529dd0-54fa-4b8d-b595-d0218df0ee97  MC Contractor Rate - Development
--
-- WHY UNIT AND DESCRIPTION ARE HERE: production COPIES both from the rate it
-- selects (r010 -> m024, r009 -> m022). A blank one on a rate becomes a blank
-- one on every production record priced from it.

WITH params AS (
  SELECT CAST(NULL AS varchar) AS p_contractor_id    -- e.g. 'CON-0001'
),
rates AS (
  SELECT
    r.rate_id,
    r.contractor_id_snap AS contractor_id,
    r.project_id_snap    AS project_id,
    r.labor_code,
    r.unit,
    r.labor_description,
    r.unit_rate,
    r.currency,
    r.contract_reference,
    CAST(r.effective_date  AS date) AS effective_date,
    CAST(r.expiration_date AS date) AS expiration_date,
    r.active
  FROM "a5529dd0-54fa-4b8d-b595-d0218df0ee97" r
  CROSS JOIN params
  WHERE r._status <> 'VOID'
    AND (p_contractor_id IS NULL OR r.contractor_id_snap = p_contractor_id)
),
findings AS (
  SELECT rate_id, 'CRITICAL' AS severity, 'Rate has no unit' AS finding,
         'Every production record priced from this rate would copy a blank unit and drop out of physical totals.' AS detail
  FROM rates WHERE unit IS NULL OR unit = ''
  UNION ALL
  SELECT rate_id, 'WARNING', 'Rate has no labor description',
         'Production copies the description from the rate; it would arrive blank.'
  FROM rates WHERE labor_description IS NULL OR labor_description = ''
  UNION ALL
  SELECT rate_id, 'WARNING', 'Rate has no contract reference',
         'A dispute about this price cannot be traced to the executed contract or amendment (OI-09).'
  FROM rates WHERE contract_reference IS NULL OR contract_reference = ''
  UNION ALL
  -- The field was added 2026-11-09; rates imported before then are blank until
  -- next edited. Every rate in the system is USD (D-020), so this is a
  -- completeness note, not a pricing risk.
  SELECT rate_id, 'INFO', 'Rate has no currency stated',
         'Predates the Currency field (2026-11-09). Treated as USD.'
  FROM rates WHERE currency IS NULL OR currency = ''
  UNION ALL
  SELECT rate_id, 'WARNING', 'Expired rate still marked active',
         'Expired ' || CAST(expiration_date AS varchar) || ' but Active = yes, so it can still be selected for new production.'
  FROM rates WHERE expiration_date < CURRENT_DATE AND COALESCE(active, 'yes') = 'yes'
)
SELECT
  f.severity,
  f.finding,
  f.detail,
  r.rate_id,
  r.contractor_id,
  COALESCE(r.project_id, '(all projects)') AS project_scope,
  r.labor_code,
  r.unit,
  r.unit_rate,
  r.effective_date,
  r.expiration_date,
  r.active
FROM findings f
JOIN rates r ON r.rate_id = f.rate_id
ORDER BY
  CASE f.severity WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END,
  f.finding, r.rate_id;
