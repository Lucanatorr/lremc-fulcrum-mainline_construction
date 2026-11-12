-- Expected-Rate Audit  (Sprint 27)
--
-- The brief: "a rate-audit report showing contractor, project, labor code,
-- production date, rate used, expected rate, rate source, and difference."
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--   a5529dd0-54fa-4b8d-b595-d0218df0ee97  MC Contractor Rate - Development
--
-- HOW THIS DIFFERS FROM rate-audit.sql. rate-audit checks a record against
-- the rate it LINKED (is that rate still the same, is it ambiguous). This
-- report ignores the link and asks the independent question: which rate
-- SHOULD have priced this work? It looks the rate up from scratch, by
-- contractor + labor code + project, IN FORCE ON THE WORK DATE, and compares
-- it with the price the record was actually given. A record linked to the
-- wrong-but-valid rate passes rate-audit and fails here.
--
-- WHICH RATE IS EXPECTED
--   1. Same contractor and labor code.
--   2. In force on the work date: effective_date <= work_date, and no
--      expiration_date or expiration_date >= work_date. Active-now is NOT
--      required: a rate expired since the work was done was still the price.
--   3. Not DRAFT: a draft rate was never in force.
--   4. A rate scoped to THIS project beats an all-projects rate.
--   5. Two or more rates left at the best scope = AMBIGUOUS; no single
--      expected rate exists and the master needs cleaning.
--
-- Every non-VOID, non-REVERSED production record gets exactly one row.
-- `finding` is NULL-free: MATCH is a finding too, so the report is a complete
-- reconciliation, not an exception list. Filter on severity for exceptions.

WITH params AS (
  SELECT
    CAST(NULL AS varchar) AS p_project_id,
    CAST(NULL AS varchar) AS p_contractor_id,
    CAST(NULL AS date)    AS p_date_from,
    CAST(NULL AS date)    AS p_date_to,
    CAST(0.005 AS numeric) AS p_tolerance        -- half a cent
),
production AS (
  SELECT
    p._record_id,
    p.production_id,
    p._status                         AS record_status,
    CAST(p.work_date AS date)         AS work_date,
    p.project_id_snapshot             AS project_id,
    p.contractor_id_snapshot          AS contractor_id,
    p.labor_code,
    p.unit,
    p.quantity,
    p.contractor_rate                 AS rate_used,
    p.rate_source_id,
    p.extended_value
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
  CROSS JOIN params
  WHERE p._status NOT IN ('VOID', 'REVERSED')
    AND (p_project_id    IS NULL OR p.project_id_snapshot    = p_project_id)
    AND (p_contractor_id IS NULL OR p.contractor_id_snapshot = p_contractor_id)
    AND (p_date_from     IS NULL OR p.work_date >= p_date_from)
    AND (p_date_to       IS NULL OR p.work_date <= p_date_to)
),
candidates AS (
  SELECT
    pr._record_id,
    r.rate_id,
    r.unit_rate,
    CASE WHEN r.project_id_snap IS NOT NULL THEN 1 ELSE 2 END AS scope_rank,
    CASE WHEN r.project_id_snap IS NOT NULL THEN 'PROJECT ' || r.project_id_snap
         ELSE 'ALL PROJECTS' END                               AS rate_scope
  FROM production pr
  JOIN "a5529dd0-54fa-4b8d-b595-d0218df0ee97" r
    ON  r.contractor_id_snap = pr.contractor_id
    AND r.labor_code         = pr.labor_code
    AND (r.project_id_snap IS NULL OR r.project_id_snap = pr.project_id)
    AND CAST(r.effective_date AS date) <= pr.work_date
    AND (r.expiration_date IS NULL OR CAST(r.expiration_date AS date) >= pr.work_date)
  WHERE r._status <> 'DRAFT'
),
best AS (
  SELECT
    c.*,
    MIN(c.scope_rank) OVER (PARTITION BY c._record_id)        AS best_rank
  FROM candidates c
),
expected AS (
  SELECT
    _record_id,
    COUNT(*)            AS rates_at_best_scope,
    MAX(rate_id)        AS expected_rate_id,
    MAX(unit_rate)      AS expected_rate,
    MIN(unit_rate)      AS lowest_competing_rate,
    MAX(rate_scope)     AS expected_rate_scope
  FROM best
  WHERE scope_rank = best_rank
  GROUP BY _record_id
),
classified AS (
  SELECT
    pr.*,
    e.expected_rate_id,
    e.expected_rate,
    e.expected_rate_scope,
    e.rates_at_best_scope,
    e.lowest_competing_rate,
    CASE
      WHEN pr.rate_used IS NULL                         THEN 'NOT PRICED'
      WHEN e._record_id IS NULL                         THEN 'NO RATE IN FORCE'
      WHEN e.rates_at_best_scope > 1
           AND e.lowest_competing_rate <> e.expected_rate THEN 'AMBIGUOUS EXPECTED RATE'
      WHEN ABS(pr.rate_used - e.expected_rate) > (SELECT p_tolerance FROM params)
                                                        THEN 'RATE DIFFERS FROM EXPECTED'
      WHEN pr.rate_source_id IS DISTINCT FROM e.expected_rate_id
           AND e.rates_at_best_scope = 1               THEN 'PRICED FROM ANOTHER RATE RECORD'
      ELSE 'MATCH'
    END AS finding
  FROM production pr
  LEFT JOIN expected e ON e._record_id = pr._record_id
)
SELECT
  CASE finding
    WHEN 'NOT PRICED'                      THEN 'CRITICAL'
    WHEN 'NO RATE IN FORCE'                THEN 'CRITICAL'
    WHEN 'RATE DIFFERS FROM EXPECTED'      THEN 'CRITICAL'
    WHEN 'AMBIGUOUS EXPECTED RATE'         THEN 'WARNING'
    WHEN 'PRICED FROM ANOTHER RATE RECORD' THEN 'INFO'
    ELSE 'OK'
  END                                            AS severity,
  finding,
  contractor_id,
  project_id,
  labor_code,
  work_date                                      AS production_date,
  production_id,
  record_status,
  quantity,
  unit,
  ROUND(CAST(rate_used AS numeric), 2)           AS rate_used,
  rate_source_id                                 AS rate_source,
  ROUND(CAST(expected_rate AS numeric), 2)       AS expected_rate,
  expected_rate_id,
  expected_rate_scope,
  ROUND(CAST(rate_used - expected_rate AS numeric), 2)                         AS difference,
  ROUND(CAST(COALESCE(quantity, 0) * (rate_used - expected_rate) AS numeric), 2) AS value_difference,
  rates_at_best_scope
FROM classified
ORDER BY
  CASE finding WHEN 'MATCH' THEN 9 WHEN 'PRICED FROM ANOTHER RATE RECORD' THEN 5 ELSE 0 END,
  ABS(COALESCE(quantity, 0) * COALESCE(rate_used - expected_rate, 0)) DESC,
  production_date, production_id;
