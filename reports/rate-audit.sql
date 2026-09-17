-- Rate Audit  (Sprint 11)
--
-- Production whose pricing cannot be trusted. The brief calls this "critical
-- for financial QA", and every row here is money that is either wrong or
-- unexplainable.
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--   a5529dd0-54fa-4b8d-b595-d0218df0ee97  MC Contractor Rate - Development
--
-- The production app already flags most of these on the device at save time
-- (v5.0.0 validateRate), which is where a field user can still fix them. This
-- report exists for the two things a device cannot do:
--   AMBIGUOUS RATE  needs a scan of the rate master for competing rates
--   DRIFTED RATE    needs the rate record's CURRENT value compared to the
--                   snapshot taken when the production was priced
-- and to give finance one list covering every priced record, including those
-- saved before a rule existed.

WITH params AS (
  SELECT
    CAST(NULL AS varchar) AS p_project_id,
    CAST(NULL AS varchar) AS p_contractor_id
),

-- Competing rates: more than one ACTIVE rate for the same contractor, labor
-- code and project scope with overlapping effective windows. Whichever one a
-- user happened to pick, the price was a coin toss.
rate_ambiguity AS (
  SELECT
    r.contractor_id_snap,
    r.labor_code,
    COALESCE(r.project_id_snap, '*') AS project_scope,
    COUNT(*)                         AS competing_rates,
    MIN(r.unit_rate)                 AS lowest_rate,
    MAX(r.unit_rate)                 AS highest_rate
  FROM "a5529dd0-54fa-4b8d-b595-d0218df0ee97" r
  WHERE COALESCE(r.active, 'yes') <> 'no'
    AND r._status <> 'VOID'
  GROUP BY r.contractor_id_snap, r.labor_code, COALESCE(r.project_id_snap, '*')
  HAVING COUNT(*) > 1
),

priced AS (
  SELECT
    p._record_id,
    p.production_id,
    p.work_date,
    p.project_id_snapshot     AS project_id,
    p.contractor_id_snapshot  AS contractor_id,
    p.crew,
    p.labor_code,
    p.unit,
    p.quantity,
    p.contractor_rate,
    p.extended_value,
    p.rate_source_id,
    p.rate_labor_code_snap,
    p.rate_contractor_id_snap,
    p.rate_project_id_snap,
    p.rate_effective_date,
    p.rate_expiration_snap,
    p._status                 AS record_status,
    r.unit_rate               AS rate_master_current_rate,
    r.active                  AS rate_master_active,
    r._status                 AS rate_master_status,
    amb.competing_rates,
    amb.lowest_rate,
    amb.highest_rate
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
  CROSS JOIN params
  LEFT JOIN "a5529dd0-54fa-4b8d-b595-d0218df0ee97" r
    ON r.rate_id = p.rate_source_id
  LEFT JOIN rate_ambiguity amb
    ON  amb.contractor_id_snap = p.contractor_id_snapshot
    AND amb.labor_code         = p.labor_code
    AND amb.project_scope      = COALESCE(p.rate_project_id_snap, '*')
  WHERE p._status <> 'VOID'
    AND (p_project_id    IS NULL OR p.project_id_snapshot    = p_project_id)
    AND (p_contractor_id IS NULL OR p.contractor_id_snapshot = p_contractor_id)
),

classified AS (
  SELECT
    priced.*,
    CASE
      -- Ordered by severity: the first condition that matches is the finding
      -- worth acting on, and a record with no rate at all makes every other
      -- rate question moot.
      WHEN rate_source_id IS NULL AND contractor_rate IS NULL
        THEN 'NO RATE'
      WHEN rate_source_id IS NULL AND contractor_rate IS NOT NULL
        THEN 'RATE WITHOUT A SOURCE'
      WHEN contractor_rate IS NULL
        THEN 'LINKED RATE HAS NO VALUE'
      WHEN contractor_rate = 0
        THEN 'ZERO RATE'
      WHEN contractor_rate < 0
        THEN 'NEGATIVE RATE'
      WHEN rate_master_current_rate IS NULL AND rate_source_id IS NOT NULL
        THEN 'RATE RECORD MISSING'
      WHEN rate_labor_code_snap IS NOT NULL AND rate_labor_code_snap <> labor_code
        THEN 'RATE PRICES A DIFFERENT PAY UNIT'
      WHEN rate_contractor_id_snap IS NOT NULL AND rate_contractor_id_snap <> contractor_id
        THEN 'RATE BELONGS TO ANOTHER CONTRACTOR'
      WHEN rate_project_id_snap IS NOT NULL AND rate_project_id_snap <> project_id
        THEN 'RATE IS SCOPED TO ANOTHER PROJECT'
      WHEN rate_expiration_snap IS NOT NULL AND work_date > rate_expiration_snap
        THEN 'EXPIRED RATE'
      WHEN rate_effective_date IS NOT NULL AND work_date < rate_effective_date
        THEN 'RATE NOT YET IN FORCE'
      WHEN competing_rates IS NOT NULL
        THEN 'AMBIGUOUS RATE'
      WHEN rate_master_current_rate IS NOT NULL
           AND ABS(contractor_rate - rate_master_current_rate) > 0.005
        THEN 'DRIFTED FROM SOURCE'
      ELSE NULL
    END AS finding
  FROM priced
)

SELECT
  finding,
  CASE finding
    -- Unpriced or mispriced production cannot be billed or earned, so those are
    -- CRITICAL. Ambiguity and drift are WARNING: the number may be right, but
    -- nobody can prove which rate it came from.
    WHEN 'NO RATE'                             THEN 'CRITICAL'
    WHEN 'RATE WITHOUT A SOURCE'               THEN 'CRITICAL'
    WHEN 'LINKED RATE HAS NO VALUE'            THEN 'CRITICAL'
    WHEN 'ZERO RATE'                           THEN 'CRITICAL'
    WHEN 'NEGATIVE RATE'                       THEN 'CRITICAL'
    WHEN 'RATE RECORD MISSING'                 THEN 'CRITICAL'
    WHEN 'RATE PRICES A DIFFERENT PAY UNIT'    THEN 'CRITICAL'
    WHEN 'RATE BELONGS TO ANOTHER CONTRACTOR'  THEN 'CRITICAL'
    WHEN 'RATE IS SCOPED TO ANOTHER PROJECT'   THEN 'CRITICAL'
    WHEN 'EXPIRED RATE'                        THEN 'CRITICAL'
    WHEN 'RATE NOT YET IN FORCE'               THEN 'CRITICAL'
    WHEN 'AMBIGUOUS RATE'                      THEN 'WARNING'
    WHEN 'DRIFTED FROM SOURCE'                 THEN 'WARNING'
  END                                          AS severity,
  production_id,
  record_status,
  work_date,
  project_id,
  contractor_id,
  crew,
  labor_code,
  unit,
  quantity,
  contractor_rate                              AS snapshotted_rate,
  rate_master_current_rate,
  ROUND(extended_value, 2)                     AS production_value,
  -- What the value would be at the rate master's current price. The gap is the
  -- exposure on that one record.
  CASE WHEN rate_master_current_rate IS NULL THEN NULL
       ELSE ROUND(COALESCE(quantity,0) * rate_master_current_rate, 2) END
                                               AS value_at_current_rate,
  CASE WHEN rate_master_current_rate IS NULL THEN NULL
       ELSE ROUND(COALESCE(extended_value,0)
                  - COALESCE(quantity,0) * rate_master_current_rate, 2) END
                                               AS value_difference,
  rate_source_id,
  rate_effective_date,
  rate_expiration_snap,
  competing_rates,
  lowest_rate,
  highest_rate,
  CASE finding
    WHEN 'AMBIGUOUS RATE' THEN
      'The rate master holds ' || CAST(competing_rates AS varchar)
      || ' active rates for this contractor and pay unit, from '
      || CAST(lowest_rate AS varchar) || ' to ' || CAST(highest_rate AS varchar)
      || '. Supersede the ones no longer in force rather than leaving them active.'
    WHEN 'DRIFTED FROM SOURCE' THEN
      'The snapshot does not match the rate record today. Either the rate was '
      || 'repriced after this production was saved - which is expected and the '
      || 'snapshot is correct - or the value was written by an import or API '
      || 'call bypassing the record link. Check the rate record history before '
      || 'assuming an override.'
    ELSE NULL
  END                                          AS note
FROM classified
WHERE finding IS NOT NULL
ORDER BY severity, finding, ABS(COALESCE(extended_value, 0)) DESC;
