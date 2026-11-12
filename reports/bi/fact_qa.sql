-- fact_qa  (Sprint 29)  grain: one production record with its QA outcome.
--   key: production_id
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- QA/QC lives on the production record, so this is the QA view of the same
-- grain as fact_production, carrying QA and correction attributes only. Join
-- on production_id; never add its rows to production totals.

SELECT
  p.production_id,
  p.project_id_snapshot                                                AS project_id,
  p.contractor_id_snapshot                                             AS contractor_id,
  p.contractor_id_snapshot || '|' || UPPER(TRIM(COALESCE(p.crew, '(none)'))) AS crew_key,
  p.labor_code,
  CAST(TO_CHAR(CAST(p.work_date AS date), 'YYYYMMDD') AS integer)      AS work_date_key,
  p._status                                                            AS record_status,
  COALESCE(p.qa_status, 'Not Reviewed')                                AS qa_status,
  CASE WHEN p.qa_status IN ('Pass', 'Conditional Pass', 'Fail') THEN 1 ELSE 0 END AS qa_recorded,
  CASE WHEN p.qa_status = 'Fail' THEN 1 ELSE 0 END                     AS qa_failed,
  CASE WHEN p.qa_status IN ('Fail', 'Conditional Pass') AND COALESCE(p.correction_completed, 'no') <> 'yes' THEN 1 ELSE 0 END AS deficiency_open,
  p.qa_owner,
  CAST(TO_CHAR(CAST(p.qa_due_date AS date), 'YYYYMMDD') AS integer)    AS qa_due_date_key,
  CASE WHEN p.qa_status IN ('Fail', 'Conditional Pass') AND COALESCE(p.correction_completed, 'no') <> 'yes'
            AND p.qa_due_date IS NOT NULL AND CAST(p.qa_due_date AS date) < CURRENT_DATE
       THEN CURRENT_DATE - CAST(p.qa_due_date AS date) END             AS days_overdue,
  p.correction_detail,
  CASE WHEN p._status = 'CORRECTION REQUIRED' THEN 1 ELSE 0 END        AS in_correction,
  CASE WHEN p.correction_completed = 'yes' THEN 1 ELSE 0 END           AS correction_completed,
  CAST(TO_CHAR(CAST(p.correction_completed_date AS date), 'YYYYMMDD') AS integer) AS correction_completed_date_key,
  p.exception_severity,
  CASE WHEN p.qa_photos IS NULL OR CARDINALITY(p.qa_photos) = 0 THEN 0 ELSE CARDINALITY(p.qa_photos) END AS photo_count,
  p.splice_test_type,
  p.splice_test_result,
  p.loss_value_db
FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
WHERE p._status <> 'VOID'
ORDER BY p.production_id;
