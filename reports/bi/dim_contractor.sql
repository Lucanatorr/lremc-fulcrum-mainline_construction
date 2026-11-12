-- dim_contractor  (Sprint 29)  key: contractor_id
--   d8a368b5-1e19-4f5f-8cf9-ff8fbdd03ab4  MC Contractor Master - Development
-- Contact details are deliberately not exported: an analytics model does not
-- need phone numbers or email addresses, and every copy is one more to protect.

SELECT
  c.contractor_id,
  c.contractor_name,
  c._status                                          AS contractor_status,
  c.contract_number,
  CAST(c.contract_effective_date AS date)            AS contract_effective_date,
  CAST(c.contract_expiration_date AS date)           AS contract_expiration_date,
  c.active,
  c._record_id                                       AS fulcrum_record_id
FROM "d8a368b5-1e19-4f5f-8cf9-ff8fbdd03ab4" c
ORDER BY c.contractor_id;
