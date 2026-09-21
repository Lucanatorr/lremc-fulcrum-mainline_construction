-- Production Audit Trail  (Sprint 20)
--
-- One row per production record answering, on its own, every question the
-- brief requires a financial production record to answer.
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--   a5529dd0-54fa-4b8d-b595-d0218df0ee97  MC Contractor Rate - Development
--   ee204906-adb3-431b-a1d9-d7427a4c842c  MC Material Transaction - Development
--   728477da-5f36-48cb-b3ab-cbc8c38d077f  MC Fiber Reel - Development
--
-- THE THIRTEEN QUESTIONS, AND THE COLUMN THAT ANSWERS EACH
--
--   Who entered this?             created_by_name / created_by_email / inspector
--   When was it entered?          entered_at / synced_at
--   What project was it for?      project_id / project_name
--   Which contractor performed?   contractor_id / contractor_name / crew
--   What labor code was used?     labor_code / labor_description
--   What quantity was claimed?    quantity / unit
--   What rate was applied?        rate_applied
--   Where did that rate originate? rate_source_id, rate_effective_date,
--                                 rate_expiration, rate_scope, and the
--                                 rate_master_* columns showing what that
--                                 master record says TODAY
--   What was the calculated value? extended_value
--   Who approved it?              approved_by / approved_by_user
--   When was it approved?         approved_date
--   Was it subsequently changed?  record_version, last_changed_at,
--                                 last_changed_by, changed_after_approval
--   What material was associated?  material_rows, material_codes,
--                                 material_installed_quantity, and the
--                                 conduit figures derived on the record
--   What physical location/segment? segment_id, from/to, structures, station,
--                                 reel and sequential range, GPS
--
-- WHY THE RATE IS SHOWN TWICE
-- rate_applied is the snapshot physically copied onto this transaction when
-- the rate was selected. rate_master_current_rate is what that same master
-- record says now. They are allowed to differ -- that is the snapshot doing
-- its job, not an error. rate_drift makes the difference explicit, because
-- "why does this record price differently from the rate sheet?" is the single
-- most common audit question and the answer is almost always "the rate sheet
-- changed afterwards, and history was not rewritten."
--
-- WHY created_by COMES FROM memberships
-- Convention 5: the platform stamps _created_by_id on every record and it
-- joins to memberships for a name and address that are always current. The app
-- stores no copy. `inspector` is shown alongside as the display value a field
-- user sees, but _created_by_id is the authority.
--
-- NO STATUS FILTER BY DEFAULT. An audit trail that hid voided or rejected
-- records would be useless for the cases most likely to be audited. Every row
-- carries record_status; filter in the params CTE if you want a subset.

WITH params AS (
  SELECT
    CAST(NULL AS varchar) AS p_production_id,
    CAST(NULL AS varchar) AS p_project_id,
    CAST(NULL AS varchar) AS p_contractor_id,
    CAST(NULL AS varchar) AS p_record_status,
    CAST(NULL AS date)    AS p_date_from,
    CAST(NULL AS date)    AS p_date_to
),

material AS (
  SELECT
    t.production_id_snap,
    COUNT(*)                                   AS material_rows,
    STRING_AGG(DISTINCT t.material_code_snap, ', ') AS material_codes,
    SUM(CASE WHEN t.transaction_type = 'Installed'
             THEN COALESCE(t.quantity, 0) ELSE 0 END) AS material_installed_quantity
  FROM "ee204906-adb3-431b-a1d9-d7427a4c842c" t
  WHERE t._status <> 'VOID'
  GROUP BY t.production_id_snap
),

-- What the crew reported on the record itself, which is a different claim from
-- the ledger and is worth showing next to it.
reported_material AS (
  SELECT
    r._parent_id,
    COUNT(*) AS reported_material_rows,
    STRING_AGG(r.actual_material, ', ') AS reported_materials
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2/actual_material_used" r
  GROUP BY r._parent_id
)

SELECT
  -- ---------------------------------------------------------- identity
  p.production_id,
  p._record_id,
  p._status                                    AS record_status,
  p.work_date,
  p.reporting_period,
  p.work_week,

  -- ------------------------------------------- who entered it, and when
  cb.name                                      AS created_by_name,
  cb.email                                     AS created_by_email,
  cb.role_name                                 AS created_by_role,
  p.inspector,
  p._created_at                                AS entered_at,
  p._server_created_at                         AS synced_at,

  -- ------------------------------------------------- what work, for whom
  p.project_id_snapshot                        AS project_id,
  p.project_name_snapshot                      AS project_name,
  p.contractor_id_snapshot                     AS contractor_id,
  p.contractor_name_snapshot                   AS contractor_name,
  p.crew,
  p.work_category,
  p.construction_method,
  p.labor_code,
  p.labor_description,
  ROUND(CAST(COALESCE(p.quantity, 0) AS numeric), 2) AS quantity,
  p.unit,

  -- ------------------------------------------------ the pricing snapshot
  ROUND(CAST(COALESCE(p.contractor_rate, 0) AS numeric), 2) AS rate_applied,
  p.rate_source_id,
  p.rate_effective_date,
  p.rate_expiration_snap                       AS rate_expiration,
  p.rate_labor_code_snap                       AS rate_labor_code,
  CASE
    WHEN p.rate_project_id_snap IS NOT NULL
      THEN 'PROJECT-SPECIFIC: ' || p.rate_project_id_snap
    ELSE 'ALL PROJECTS'
  END                                          AS rate_scope,
  ROUND(CAST(COALESCE(p.extended_value, 0) AS numeric), 2) AS extended_value,

  -- What the master says today. Difference is expected, not wrong.
  ROUND(CAST(rm.unit_rate AS numeric), 2)      AS rate_master_current_rate,
  rm._status                                   AS rate_master_status,
  ROUND(CAST(COALESCE(p.contractor_rate, 0) - COALESCE(rm.unit_rate, p.contractor_rate) AS numeric), 2)
                                               AS rate_drift,
  CASE
    WHEN p.rate_source_id IS NULL THEN 'NO RATE LINKED'
    WHEN rm.rate_id IS NULL       THEN 'RATE RECORD NO LONGER EXISTS - snapshot is the only evidence'
    WHEN COALESCE(rm.unit_rate, 0) <> COALESCE(p.contractor_rate, 0)
      THEN 'MASTER REPRICED SINCE - this record kept its original rate'
    ELSE 'MATCHES MASTER'
  END                                          AS rate_provenance,

  -- ------------------------------------------------------ the approval
  p.submitted_by,
  p.submitted_date,
  p.reviewed_by,
  p.reviewed_date,
  p.qa_status,
  p.approved_by,
  p.approved_date,
  ub.name                                      AS last_changed_by,

  -- --------------------------------- was it subsequently changed, and when
  -- _version counts edits. The question that matters for a financial record
  -- is not whether it was ever edited, but whether it was edited AFTER
  -- somebody approved it - that is the change nobody re-reviewed.
  p._version                                   AS record_version,
  p._updated_at                                AS last_changed_at,
  CASE
    WHEN p.approved_date IS NULL THEN 'NOT APPROVED'
    WHEN p._updated_at > p.approved_date THEN 'CHANGED AFTER APPROVAL'
    ELSE 'UNCHANGED SINCE APPROVAL'
  END                                          AS changed_after_approval,
  CASE WHEN p._version > 1 THEN p._version - 1 ELSE 0 END AS edits_after_creation,

  -- ------------------------------------------------------- the material
  COALESCE(m.material_rows, 0)                 AS material_ledger_rows,
  m.material_codes                             AS material_ledger_codes,
  ROUND(CAST(COALESCE(m.material_installed_quantity, 0) AS numeric), 2)
                                               AS material_installed_quantity,
  COALESCE(rmat.reported_material_rows, 0)     AS crew_reported_material_rows,
  rmat.reported_materials                      AS crew_reported_materials,
  p.conduit_material_code,
  ROUND(CAST(p.conduit_material_quantity AS numeric), 2) AS conduit_expected_quantity,

  -- --------------------------------------- where the work physically was
  p.segment_id,
  p.from_location,
  p.to_location,
  p.from_structure_id_snap,
  p.to_structure_id_snap,
  p.from_station,
  p.to_station,
  p.span_id,
  p.pole_id,
  p.reel_id,
  p.cable_id,
  p.starting_sequential,
  p.ending_sequential,
  ROUND(CAST(p.sequential_footage AS numeric), 2) AS sequential_footage,
  p.gps_latitude,
  p.gps_longitude,
  p.gps_accuracy_m,

  -- ------------------------------------------------------ the evidence
  p.qa_photos_captions,
  p.attachments_captions,
  p.signature_timestamp,
  p.exception_severity,
  p.exception_flags,
  p.fingerprint_strict,
  p.fingerprint_strength

FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
CROSS JOIN params
LEFT JOIN memberships cb ON cb.user_id = p._created_by_id
LEFT JOIN memberships ub ON ub.user_id = p._updated_by_id
-- rate_source_id holds the rate master's OWN rate_id, copied down by the
-- RecordLink, not the platform record UUID. rate-audit.sql joins the same way.
LEFT JOIN "a5529dd0-54fa-4b8d-b595-d0218df0ee97" rm
  ON rm.rate_id = p.rate_source_id
LEFT JOIN material m       ON m.production_id_snap = p.production_id
LEFT JOIN reported_material rmat ON rmat._parent_id = p._record_id
WHERE (p_production_id  IS NULL OR p.production_id          = p_production_id)
  AND (p_project_id     IS NULL OR p.project_id_snapshot    = p_project_id)
  AND (p_contractor_id  IS NULL OR p.contractor_id_snapshot = p_contractor_id)
  AND (p_record_status  IS NULL OR p._status                = p_record_status)
  AND (p_date_from      IS NULL OR p.work_date >= p_date_from)
  AND (p_date_to        IS NULL OR p.work_date <= p_date_to)
ORDER BY p.work_date DESC, p.production_id;
