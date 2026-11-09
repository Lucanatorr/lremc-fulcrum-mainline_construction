-- Voided, Reversed and Adjusted Production  (OI-07, D-018)
--
-- Answers "what came OUT of the official numbers this period, and what was
-- corrected?" Official totals exclude VOID and REVERSED production; this report
-- is where that excluded value stays visible, as destructive-change condition
-- 13 requires ("voids/reversals remain auditable but are excluded from
-- official totals").
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- EVENT DATES. A reversal carries its own stamp (reversed_date). A void does
-- not - the app has no voided-date field - so a VOID is dated by the record's
-- last update (_updated_at), which is when the status last changed unless the
-- record was edited afterwards. Adjustments are dated by their work date.
--
-- Quantities are shown per line and never summed across labor codes
-- (convention 2). Totals are value only.

WITH params AS (
  SELECT
    CAST(NULL AS varchar) AS p_project_id,     -- e.g. 'PRJ-0001'
    CAST(NULL AS varchar) AS p_contractor_id,  -- e.g. 'CON-0001'
    CAST(NULL AS date)    AS p_date_from,      -- event date, inclusive
    CAST(NULL AS date)    AS p_date_to
),
events AS (
  SELECT
    CASE
      WHEN p._status = 'REVERSED' THEN 'REVERSED'
      WHEN p._status = 'VOID'     THEN 'VOID'
      ELSE 'ADJUSTMENT'
    END                                         AS event_type,
    CAST(CASE
      WHEN p._status = 'REVERSED' THEN COALESCE(p.reversed_date, p._updated_at)
      WHEN p._status = 'VOID'     THEN p._updated_at
      ELSE p.work_date
    END AS date)                                AS event_date,
    p.production_id,
    p.project_id_snapshot                       AS project_id,
    p.contractor_id_snapshot                    AS contractor_id,
    p.work_date,
    p.labor_code,
    p.quantity,
    p.unit,
    p.contractor_rate,
    COALESCE(p.extended_value, 0)               AS extended_value,
    -- Reversed production keeps its approval stamp: this column is what shows
    -- the value had been approved before it was taken back out.
    CAST(p.approved_date AS date)               AS was_approved_on,
    p.reversed_by,
    COALESCE(p.reversal_reason, p.adjustment_reason) AS reason,
    p.adjusts_production_id,
    p._status                                   AS record_status
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
  CROSS JOIN params
  WHERE (p._status IN ('VOID', 'REVERSED')
         OR COALESCE(p.production_type, 'Original') = 'Adjustment')
    AND (p_project_id    IS NULL OR p.project_id_snapshot    = p_project_id)
    AND (p_contractor_id IS NULL OR p.contractor_id_snapshot = p_contractor_id)
),
filtered AS (
  SELECT e.*
  FROM events e
  CROSS JOIN params
  WHERE (p_date_from IS NULL OR e.event_date >= p_date_from)
    AND (p_date_to   IS NULL OR e.event_date <= p_date_to)
)
SELECT
  'DETAIL'                AS row_type,
  event_type,
  event_date,
  production_id,
  adjusts_production_id,
  project_id,
  contractor_id,
  work_date,
  labor_code,
  quantity,
  unit,
  contractor_rate,
  extended_value,
  was_approved_on,
  reason,
  record_status,
  -- Only an APPROVED adjustment moves official totals; a pending one is shown
  -- so it can be chased, not counted.
  CASE
    WHEN event_type = 'ADJUSTMENT' AND record_status = 'APPROVED' THEN 'IN OFFICIAL TOTALS'
    WHEN event_type = 'ADJUSTMENT' THEN 'PENDING - NOT YET COUNTED'
    ELSE 'EXCLUDED FROM OFFICIAL TOTALS'
  END                     AS effect
FROM filtered

UNION ALL

SELECT
  'TOTAL'                 AS row_type,
  event_type,
  NULL, NULL, NULL,
  project_id,
  NULL, NULL, NULL, NULL, NULL, NULL,
  ROUND(CAST(SUM(extended_value) AS numeric), 2),
  NULL, NULL, NULL,
  CAST(COUNT(*) AS varchar) || ' records'
FROM filtered
GROUP BY event_type, project_id

ORDER BY project_id, event_type, row_type, event_date;
