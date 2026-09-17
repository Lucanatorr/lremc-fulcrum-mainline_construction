-- QA Review Queue  (Sprint 12)
--
-- One reviewer-facing list: what is waiting, what is blocking it, and what can
-- actually be approved right now.
-- See reports/_conventions.md for the shared rules.
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--   aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b  MC Project Scope Line - Development
--   458ae172-b7b4-43b5-8917-d7a792c9e81a  MC Change Order - Development
--
-- The device already flags what it can see on one record (v6.0.0
-- buildExceptions) and refuses to approve a CRITICAL one. This report adds the
-- flags that need other records - over-plan production being the one Sprint 12
-- names - and turns the whole thing into a work queue ordered by what is
-- blocking money.
--
-- The other cross-record QA flags have their own reports because each needs
-- real detail to act on: sequential-overlap.sql, duplicate-production.sql,
-- material-variance.sql. This queue counts them per record rather than
-- restating them.

WITH params AS (
  SELECT
    CAST(NULL AS varchar) AS p_project_id,
    CAST(NULL AS varchar) AS p_contractor_id,
    CAST(NULL AS varchar) AS p_reviewer
),

-- Authorized scope per project + pay unit, so over-plan production can be
-- attributed to the record that crossed the line.
authorized AS (
  SELECT
    s.project_id_snap AS project_id,
    s.labor_code,
    COALESCE(s.original_planned_quantity, 0)
      + COALESCE(ac.approved_quantity_change, 0) AS authorized_quantity
  FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b" s
  LEFT JOIN (
    SELECT co.project_id_snap, line.line_labor_code AS labor_code,
           SUM(line.line_quantity_change) AS approved_quantity_change
    FROM "458ae172-b7b4-43b5-8917-d7a792c9e81a/quantity_changes" line
    JOIN "458ae172-b7b4-43b5-8917-d7a792c9e81a" co
      ON co._record_id = line._parent_id
    WHERE co._status = 'APPROVED'
    GROUP BY co.project_id_snap, line.line_labor_code
  ) ac
    ON ac.project_id_snap = s.project_id_snap AND ac.labor_code = s.labor_code
  WHERE s._status IN ('BASELINED', 'CLOSED')
),

-- Approved production so far, per project + pay unit. A pending record pushes a
-- line over plan only when added to what is already approved.
approved_so_far AS (
  SELECT
    project_id_snapshot AS project_id,
    labor_code,
    SUM(CASE WHEN _status = 'APPROVED' THEN COALESCE(quantity, 0) ELSE 0 END)
      AS approved_quantity
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
  WHERE _status <> 'VOID'
  GROUP BY project_id_snapshot, labor_code
),

overlaps AS (
  SELECT reel_id, LEAST(starting_sequential, ending_sequential) AS lo,
         GREATEST(starting_sequential, ending_sequential) AS hi, _record_id
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
  WHERE _status <> 'VOID'
    AND reel_id IS NOT NULL
    AND starting_sequential IS NOT NULL
    AND ending_sequential   IS NOT NULL
),
overlap_counts AS (
  SELECT a._record_id, COUNT(*) AS overlapping_records
  FROM overlaps a
  JOIN overlaps b
    ON  a.reel_id = b.reel_id
    AND a._record_id <> b._record_id
    -- Strictly more than a touching boundary: adjacency is legitimate, reels
    -- are consumed continuously (ruling 2026-09-16).
    AND LEAST(a.hi, b.hi) - GREATEST(a.lo, b.lo) > 0
  GROUP BY a._record_id
),

queue AS (
  SELECT
    p._record_id,
    p.production_id,
    p._status              AS record_status,
    p.qa_status,
    p.work_date,
    p.project_id_snapshot  AS project_id,
    p.contractor_id_snapshot AS contractor_id,
    p.crew,
    p.inspector,
    p.reviewed_by,
    p.reviewed_date,
    p.work_category,
    p.labor_code,
    p.unit,
    p.quantity,
    ROUND(COALESCE(p.extended_value, 0), 2) AS production_value,
    p.exception_severity,
    p.exception_flags,
    p.correction_detail,
    p.correction_completed,
    p.qa_notes,
    p.rate_source_id,
    p._server_updated_at,
    COALESCE(oc.overlapping_records, 0) AS overlapping_records,
    au.authorized_quantity,
    asf.approved_quantity AS already_approved_quantity,
    -- Would approving THIS record put the pay unit over its authorized scope?
    CASE
      WHEN au.authorized_quantity IS NULL THEN NULL
      WHEN COALESCE(asf.approved_quantity, 0) + COALESCE(p.quantity, 0)
           > au.authorized_quantity
      THEN ROUND(COALESCE(asf.approved_quantity, 0) + COALESCE(p.quantity, 0)
                 - au.authorized_quantity, 2)
      ELSE 0
    END AS would_exceed_plan_by
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
  CROSS JOIN params
  LEFT JOIN overlap_counts oc ON oc._record_id = p._record_id
  LEFT JOIN authorized au
    ON au.project_id = p.project_id_snapshot AND au.labor_code = p.labor_code
  LEFT JOIN approved_so_far asf
    ON asf.project_id = p.project_id_snapshot AND asf.labor_code = p.labor_code
  WHERE p._status IN ('DRAFT', 'SUBMITTED', 'UNDER REVIEW', 'CORRECTION REQUIRED')
    AND (p_project_id    IS NULL OR p.project_id_snapshot    = p_project_id)
    AND (p_contractor_id IS NULL OR p.contractor_id_snapshot = p_contractor_id)
    AND (p_reviewer      IS NULL OR p.reviewed_by            = p_reviewer)
)

SELECT
  production_id,
  record_status,
  qa_status,
  work_date,
  project_id,
  contractor_id,
  crew,
  inspector,
  reviewed_by,
  work_category,
  labor_code,
  unit,
  quantity,
  production_value,
  exception_severity,
  exception_flags,
  correction_detail,
  correction_completed,
  qa_notes,
  overlapping_records,
  authorized_quantity,
  already_approved_quantity,
  would_exceed_plan_by,

  -- What stands between this record and an approval. The device gate blocks a
  -- CRITICAL and an unreviewed or failed QA outcome; the rest a reviewer judges.
  CASE
    WHEN exception_severity = 'CRITICAL'
      THEN 'BLOCKED - critical exception'
    WHEN qa_status = 'Fail'
      THEN 'BLOCKED - QA failed'
    WHEN qa_status IS NULL OR qa_status = 'Not Reviewed'
      THEN 'NEEDS QA REVIEW'
    WHEN record_status = 'CORRECTION REQUIRED' AND COALESCE(correction_completed, 'no') <> 'yes'
      THEN 'AWAITING CORRECTION'
    WHEN record_status = 'CORRECTION REQUIRED'
      THEN 'CORRECTION DONE - RESUBMIT'
    WHEN overlapping_records > 0
      THEN 'REVIEW - sequential overlap'
    WHEN COALESCE(would_exceed_plan_by, 0) > 0
      THEN 'REVIEW - would exceed authorized scope'
    WHEN exception_severity = 'WARNING'
      THEN 'REVIEW - warnings present'
    ELSE 'READY TO APPROVE'
  END AS queue_state,

  -- Ordering priority. Value-weighted within each band, because a blocked
  -- 5,000 FT record holds up more money than a blocked handhole.
  CASE
    WHEN exception_severity = 'CRITICAL'                       THEN 1
    WHEN qa_status = 'Fail'                                    THEN 2
    WHEN overlapping_records > 0                               THEN 3
    WHEN COALESCE(would_exceed_plan_by, 0) > 0                 THEN 4
    WHEN qa_status IS NULL OR qa_status = 'Not Reviewed'        THEN 5
    WHEN exception_severity = 'WARNING'                        THEN 6
    ELSE 7
  END AS priority,

  CASE WHEN COALESCE(would_exceed_plan_by, 0) > 0
       THEN 'Approving this would put ' || labor_code || ' over its authorized '
            || 'scope by ' || CAST(would_exceed_plan_by AS varchar) || ' '
            || COALESCE(unit, '') || '. That may be correct - it is what a '
            || 'change order is for - but it should be a decision, not a side effect.'
       WHEN authorized_quantity IS NULL
       THEN 'No baselined scope line for this project and pay unit. See '
            || 'unplanned-production.sql.'
       ELSE NULL END AS scope_note,

  _server_updated_at AS last_synced
FROM queue
ORDER BY priority, production_value DESC, work_date;
