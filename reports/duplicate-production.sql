-- Possible Duplicate Production  (Sprint 12 QA flag)
--
-- See reports/_conventions.md for the shared rules.
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- WHY THIS CANNOT BE A DEVICE CHECK
-- Detecting a duplicate means scanning other records. Data Events reach other
-- records only through REQUEST, which is online-only, so the check would vanish
-- exactly when a crew is out of service - the same reasoning that put
-- sequential-overlap detection in a report.
--
-- A DUPLICATE IS NOT A SINGLE CONDITION
-- Two records can legitimately share a day, a crew and a pay unit: a bore crew
-- doing 300 FT on one road crossing and 400 FT on another is two real
-- transactions. So this grades candidates by how much they agree, rather than
-- declaring any repeat a duplicate. Over-flagging teaches reviewers to dismiss
-- the report, which costs more than the duplicates would.
--
-- Rejected and void records are excluded: a rejected record already had its
-- answer, and a resubmitted correction would otherwise pair with the original
-- forever.

WITH base AS (
  SELECT
    _record_id,
    production_id,
    work_date,
    project_id_snapshot    AS project_id,
    contractor_id_snapshot AS contractor_id,
    crew,
    labor_code,
    unit,
    quantity,
    extended_value,
    segment_id,
    from_location,
    to_location,
    reel_id,
    starting_sequential,
    ending_sequential,
    _status                AS record_status,
    _created_at
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
  WHERE _status NOT IN ('VOID', 'REJECTED')
),
pairs AS (
  SELECT
    a.production_id AS production_a,
    b.production_id AS production_b,
    a.record_status AS status_a,
    b.record_status AS status_b,
    a.work_date,
    a.project_id,
    a.contractor_id,
    a.crew,
    a.labor_code,
    a.unit,
    a.quantity  AS quantity_a,
    b.quantity  AS quantity_b,
    ROUND(a.extended_value, 2) AS value_a,
    ROUND(b.extended_value, 2) AS value_b,
    a.segment_id,
    a.reel_id,
    a.starting_sequential AS start_a,
    b.starting_sequential AS start_b,
    a._created_at AS created_a,
    b._created_at AS created_b,

    -- Signals. Each is a fact about how far the two records agree.
    CASE WHEN a.quantity = b.quantity THEN 1 ELSE 0 END           AS same_quantity,
    CASE WHEN a.segment_id IS NOT NULL
              AND a.segment_id = b.segment_id THEN 1 ELSE 0 END   AS same_segment,
    CASE WHEN a.starting_sequential IS NOT NULL
              AND a.starting_sequential = b.starting_sequential
              AND a.ending_sequential   = b.ending_sequential
         THEN 1 ELSE 0 END                                        AS same_sequentials,
    CASE WHEN a.crew IS NOT NULL AND a.crew = b.crew THEN 1 ELSE 0 END AS same_crew,
    -- Two records entered within five minutes of each other is the signature of
    -- a double-tap on save, or of one person entering the same paperwork twice.
    CASE WHEN ABS(CAST(a._created_at AS bigint) - CAST(b._created_at AS bigint)) < 300
         THEN 1 ELSE 0 END                                        AS entered_together
  FROM base a
  JOIN base b
    ON  a.project_id    = b.project_id
    AND a.contractor_id = b.contractor_id
    AND a.work_date     = b.work_date
    AND a.labor_code    = b.labor_code
    AND a._record_id    < b._record_id        -- each pair once, never self-matched
)
SELECT
  production_a,
  production_b,
  status_a,
  status_b,
  work_date,
  project_id,
  contractor_id,
  crew,
  labor_code,
  unit,
  quantity_a,
  quantity_b,
  value_a,
  value_b,
  segment_id,
  reel_id,
  same_quantity,
  same_segment,
  same_sequentials,
  same_crew,
  entered_together,
  (same_quantity + same_segment + same_sequentials + same_crew + entered_together)
    AS agreement_score,

  CASE
    -- Identical sequentials on one reel is not a coincidence: the same physical
    -- cable cannot be placed twice.
    WHEN same_sequentials = 1
      THEN 'NEAR CERTAIN'
    -- Same day, pay unit, quantity and segment leaves nothing that differs.
    WHEN same_quantity = 1 AND same_segment = 1
      THEN 'NEAR CERTAIN'
    WHEN same_quantity = 1 AND entered_together = 1
      THEN 'LIKELY'
    WHEN same_quantity = 1 AND same_crew = 1
      THEN 'POSSIBLE'
    WHEN same_segment = 1
      THEN 'POSSIBLE'
    ELSE 'SAME DAY AND PAY UNIT ONLY'
  END AS duplicate_likelihood,

  CASE
    WHEN same_sequentials = 1                            THEN 'CRITICAL'
    WHEN same_quantity = 1 AND same_segment = 1          THEN 'CRITICAL'
    WHEN same_quantity = 1 AND entered_together = 1      THEN 'WARNING'
    WHEN same_quantity = 1 OR same_segment = 1           THEN 'WARNING'
    ELSE 'INFO'
  END AS severity,

  CASE
    WHEN same_sequentials = 1
      THEN 'Both records claim the same sequential range on reel '
           || COALESCE(reel_id, '(none)') || '. The same cable cannot be placed twice.'
    WHEN same_quantity = 1 AND same_segment = 1
      THEN 'Same day, pay unit, quantity and segment. Nothing distinguishes these '
           || 'two records; one of them is almost certainly a re-entry.'
    WHEN same_quantity = 1 AND entered_together = 1
      THEN 'Same quantity, entered within five minutes of each other - the '
           || 'signature of a double save.'
    ELSE 'Same day, contractor and pay unit. Legitimate when the crew worked '
         || 'more than one location; check the from/to structures.'
  END AS note
FROM pairs
ORDER BY severity, agreement_score DESC, work_date DESC;
