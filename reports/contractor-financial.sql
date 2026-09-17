-- Contractor Financial Report  (Sprint 11)
--
-- Production and value by contractor, and by contractor within a project.
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- WHY EVERY FIGURE IS KEYED ON THE SNAPSHOTTED CONTRACTOR ID
-- The brief: "Where multiple contractors work on the same project, keep
-- production and pricing properly separated." Each production record carries a
-- physical copy of its contractor ID and of the rate it was priced at, taken at
-- selection time. Grouping on those snapshots means a contractor's earned value
-- is computed from the rates that record was actually priced at - not from
-- whatever the rate master says today, and never from another contractor's
-- rates on the same project.
--
-- The rate-mismatch column below is the check that this held: a record whose
-- snapshotted rate belongs to a different contractor is a cross-contamination
-- between contractors on one project, which is the specific failure this
-- separation exists to prevent.

WITH params AS (
  SELECT
    CAST(NULL AS varchar) AS p_contractor_id,
    CAST(NULL AS varchar) AS p_project_id,
    CAST(NULL AS varchar) AS p_work_month
),
base AS (
  SELECT
    p.contractor_id_snapshot   AS contractor_id,
    p.contractor_name_snapshot AS contractor_name,
    p.project_id_snapshot      AS project_id,
    p.project_name_snapshot    AS project_name,
    p.work_month,
    p.labor_code,
    p.unit,
    p.quantity,
    p.extended_value,
    p.contractor_rate,
    p.rate_contractor_id_snap,
    p.rate_source_id,
    p.work_date,
    p._status AS record_status
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
  CROSS JOIN params
  WHERE p._status <> 'VOID'
    AND (p_contractor_id IS NULL OR p.contractor_id_snapshot = p_contractor_id)
    AND (p_project_id    IS NULL OR p.project_id_snapshot    = p_project_id)
    AND (p_work_month    IS NULL OR p.work_month             = p_work_month)
)

SELECT
  CASE
    WHEN GROUPING(project_id) = 0 THEN 'CONTRACTOR x PROJECT'
    ELSE 'CONTRACTOR TOTAL'
  END                                          AS row_type,
  contractor_id,
  MAX(contractor_name)                         AS contractor_name,
  project_id,
  MAX(project_name)                            AS project_name,

  -- Value splits by approval state. The brief asks for production, approved,
  -- pending and rejected value as four distinct figures, so none of them is a
  -- subset anyone has to infer.
  ROUND(CAST(SUM(COALESCE(extended_value, 0)) AS numeric), 2)   AS production_value,
  ROUND(CAST(SUM(CASE WHEN record_status = 'APPROVED'
                 THEN COALESCE(extended_value,0) ELSE 0 END) AS numeric), 2) AS approved_value,
  ROUND(CAST(SUM(CASE WHEN record_status IN ('DRAFT','SUBMITTED','UNDER REVIEW','CORRECTION REQUIRED')
                 THEN COALESCE(extended_value,0) ELSE 0 END) AS numeric), 2) AS pending_value,
  ROUND(CAST(SUM(CASE WHEN record_status = 'REJECTED'
                 THEN COALESCE(extended_value,0) ELSE 0 END) AS numeric), 2) AS rejected_value,

  -- Physical vs time-and-materials, because a contractor billing mostly hours
  -- is a different conversation from one billing mostly footage.
  ROUND(CAST(SUM(CASE WHEN record_status = 'APPROVED' AND unit NOT IN ('HR','EVENT')
                 THEN COALESCE(extended_value,0) ELSE 0 END) AS numeric), 2) AS approved_physical_value,
  ROUND(CAST(SUM(CASE WHEN record_status = 'APPROVED' AND unit IN ('HR','EVENT')
                 THEN COALESCE(extended_value,0) ELSE 0 END) AS numeric), 2) AS approved_tm_value,

  -- Footage is the one quantity that can be summed across pay units here,
  -- because every FT unit shares a unit of measure (convention 2).
  SUM(CASE WHEN record_status = 'APPROVED' AND unit = 'FT'
           THEN COALESCE(quantity,0) ELSE 0 END)               AS approved_footage,

  COUNT(*)                                     AS transactions,
  COUNT(CASE WHEN record_status = 'APPROVED' THEN 1 END)  AS approved_transactions,
  COUNT(CASE WHEN record_status = 'REJECTED' THEN 1 END)  AS rejected_transactions,
  COUNT(DISTINCT labor_code)                   AS pay_units_used,
  COUNT(DISTINCT project_id)                   AS projects,
  MIN(work_date)                               AS first_work_date,
  MAX(work_date)                               AS last_work_date,

  -- Rejection rate is a quality signal on the submitting contractor, by value
  -- rather than by count: one rejected 5,000 FT record matters more than ten
  -- rejected handholes.
  CASE WHEN SUM(COALESCE(extended_value,0)) = 0 THEN NULL
       ELSE ROUND(CAST(SUM(CASE WHEN record_status = 'REJECTED'
                           THEN COALESCE(extended_value,0) ELSE 0 END)
                  / SUM(COALESCE(extended_value,0)) * 100 AS numeric), 2) END
                                               AS rejected_value_pct,

  -- Cross-contamination check: the rate this record was priced at belongs to a
  -- different contractor. On a shared project that is the exact failure the
  -- snapshotting is there to prevent, so it is surfaced next to the money.
  COUNT(CASE WHEN rate_contractor_id_snap IS NOT NULL
                  AND rate_contractor_id_snap <> contractor_id THEN 1 END)
                                               AS wrong_contractor_rate_records,
  ROUND(CAST(SUM(CASE WHEN rate_contractor_id_snap IS NOT NULL
                      AND rate_contractor_id_snap <> contractor_id
                 THEN COALESCE(extended_value,0) ELSE 0 END) AS numeric), 2)
                                               AS wrong_contractor_rate_value,
  COUNT(CASE WHEN rate_source_id IS NULL THEN 1 END) AS unpriced_records
FROM base
GROUP BY GROUPING SETS (
  (contractor_id, project_id),
  (contractor_id)
)
ORDER BY contractor_id, GROUPING(project_id), project_id;
