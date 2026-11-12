-- fact_production  (Sprint 29)  grain: one production record.  key: production_id
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- THE AUTHORITATIVE NUMBERS LIVE IN FULCRUM. Quantity, the rate the record was
-- priced at (snapshot), extended value, sequential footage, conduit material
-- quantity and approval status are exported AS STORED. Power BI aggregates
-- them; it never multiplies quantity by a rate, and never re-derives status.
--
-- Every non-VOID record is exported, so pending work stays visible, and the
-- official/pending split is decided HERE, once, by the same rules as every
-- Fulcrum report:
--   official_value / official_quantity  APPROVED only (D-002)
--   pending_value  / pending_quantity   DRAFT, SUBMITTED, UNDER REVIEW,
--                                       CORRECTION REQUIRED, REOPENED
--   REVERSED and REJECTED rows carry 0 in both; they are kept for analysis
--   of what was taken back or refused.
-- Sum official_quantity only within one unit (slice by unit or labor_code).

SELECT
  p.production_id,
  p._record_id                                                          AS fulcrum_record_id,
  CAST(TO_CHAR(CAST(p.work_date AS date), 'YYYYMMDD') AS integer)       AS work_date_key,
  CAST(p.work_date AS date)                                             AS work_date,
  p.work_week, p.reporting_period,
  p.project_id_snapshot                                                 AS project_id,
  p.contractor_id_snapshot                                              AS contractor_id,
  p.contractor_id_snapshot || '|' || UPPER(TRIM(COALESCE(p.crew, '(none)'))) AS crew_key,
  p.labor_code,
  p.unit,
  p.work_category,
  p.construction_method,
  COALESCE(p.production_type, 'Original')                               AS production_type,
  p.adjusts_production_id,
  p._status                                                             AS record_status,
  CASE WHEN p._status = 'APPROVED' THEN 1 ELSE 0 END                    AS is_official,
  CASE WHEN p._status IN ('DRAFT','SUBMITTED','UNDER REVIEW','CORRECTION REQUIRED','REOPENED') THEN 1 ELSE 0 END AS is_pending,
  CASE WHEN p.unit IN ('HR','EVENT') THEN 0 ELSE 1 END                  AS is_physical,
  p.quantity,
  p.contractor_rate                                                     AS rate_applied,
  p.rate_source_id                                                      AS rate_id,
  p.extended_value,
  CASE WHEN p._status = 'APPROVED' THEN p.quantity ELSE 0 END           AS official_quantity,
  CASE WHEN p._status = 'APPROVED' THEN p.extended_value ELSE 0 END     AS official_value,
  CASE WHEN p._status IN ('DRAFT','SUBMITTED','UNDER REVIEW','CORRECTION REQUIRED','REOPENED')
       THEN p.quantity ELSE 0 END                                       AS pending_quantity,
  CASE WHEN p._status IN ('DRAFT','SUBMITTED','UNDER REVIEW','CORRECTION REQUIRED','REOPENED')
       THEN p.extended_value ELSE 0 END                                 AS pending_value,
  p.segment_id,
  p.from_structure_id_snap                                              AS from_structure_id,
  p.to_structure_id_snap                                                AS to_structure_id,
  p.span_id, p.pole_id,
  p.reel_id, p.cable_id,
  p.starting_sequential, p.ending_sequential,
  p.sequential_footage, p.slack_footage, p.other_added_footage, p.total_installed_footage,
  p.pull_count, p.conduit_diameter,
  p.conduit_material_code,
  p.conduit_material_quantity,
  p.splice_band_derived,
  p.qa_status,
  p.exception_severity,
  CAST(TO_CHAR(CAST(p.submitted_date AS date), 'YYYYMMDD') AS integer)  AS submitted_date_key,
  CAST(TO_CHAR(CAST(p.approved_date AS date), 'YYYYMMDD') AS integer)   AS approved_date_key,
  p.calc_version,
  p._version                                                            AS record_version,
  p._updated_at                                                         AS last_changed_at
FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
WHERE p._status <> 'VOID'
ORDER BY p.production_id;
