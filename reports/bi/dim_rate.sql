-- dim_rate  (Sprint 29)  key: rate_id
--   a5529dd0-54fa-4b8d-b595-d0218df0ee97  MC Contractor Rate - Development
--
-- The rate master, every version. For REFERENCE and audit only.
-- Power BI must never price production from this table: each production
-- record carries the rate it was priced at (contractor_rate, rate_source_id)
-- and its extended_value. Re-pricing in Power BI would be the second,
-- independent rate calculation the brief forbids.

SELECT
  r.rate_id,
  r.contractor_id_snap                                  AS contractor_id,
  r.project_id_snap                                     AS project_id,
  CASE WHEN r.project_id_snap IS NULL THEN 'ALL PROJECTS' ELSE 'PROJECT' END AS rate_scope,
  r.labor_code,
  r.unit,
  r.unit_rate,
  r.currency,
  r.contract_reference,
  CAST(r.effective_date AS date)                        AS effective_date,
  CAST(TO_CHAR(CAST(r.effective_date AS date), 'YYYYMMDD') AS integer) AS effective_date_key,
  CAST(r.expiration_date AS date)                       AS expiration_date,
  CAST(TO_CHAR(CAST(r.expiration_date AS date), 'YYYYMMDD') AS integer) AS expiration_date_key,
  r.active,
  r._status                                             AS rate_status,
  r.supersedes_rate_id,
  r._record_id                                          AS fulcrum_record_id
FROM "a5529dd0-54fa-4b8d-b595-d0218df0ee97" r
ORDER BY r.rate_id;
