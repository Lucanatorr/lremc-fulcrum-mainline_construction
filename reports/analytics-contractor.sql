-- Contractor Analytics  (Sprint 28)
--
-- One row per contractor: value, quality and speed side by side. Quantities
-- appear only per unit (ft_*, each_*, splice_*), never summed across units.
-- See reports/_conventions.md for the shared rules, and the definitions block
-- in analytics-executive-summary.sql.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--   d8a368b5-1e19-4f5f-8cf9-ff8fbdd03ab4  MC Contractor Master - Development
--
-- QUALITY MEASURES, and what they can and cannot see:
--   rejection_rate   REJECTED records / records that reached review
--   correction_rate  records that were sent back and corrected / records that
--                    reached review. A record's history is not queryable, so a
--                    correction is known only while correction_completed is set
--                    - a correction cycle CLEARS it on a second send-back. This
--                    is a floor, not an exact count.
--   qa_fail_rate     QA Fail / records with a QA outcome recorded
--   exceptions_per_100  records currently carrying a WARNING or CRITICAL

WITH params AS (
  SELECT CAST(NULL AS varchar) AS p_project_id, CAST(90 AS integer) AS p_window_days
),
p AS (
  SELECT x.*
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" x CROSS JOIN params
  WHERE x._status NOT IN ('VOID', 'REVERSED')
    AND x.work_date > CURRENT_DATE - p_window_days
    AND (p_project_id IS NULL OR x.project_id_snapshot = p_project_id)
),
agg AS (
  SELECT
    contractor_id_snapshot                                                           AS contractor_id,
    MAX(contractor_name_snapshot)                                                    AS contractor_name,
    COUNT(*)                                                                         AS records,
    COUNT(DISTINCT project_id_snapshot)                                              AS projects,
    COUNT(DISTINCT crew)                                                             AS crews,
    SUM(CASE WHEN _status = 'APPROVED' THEN COALESCE(extended_value, 0) ELSE 0 END)  AS approved_value,
    SUM(CASE WHEN _status IN ('DRAFT','SUBMITTED','UNDER REVIEW','CORRECTION REQUIRED','REOPENED')
             THEN COALESCE(extended_value, 0) ELSE 0 END)                            AS pending_value,
    SUM(CASE WHEN _status = 'REJECTED' THEN COALESCE(extended_value, 0) ELSE 0 END)  AS rejected_value,
    SUM(CASE WHEN _status = 'APPROVED' AND unit IN ('HR','EVENT')
             THEN COALESCE(extended_value, 0) ELSE 0 END)                            AS approved_tm_value,
    SUM(CASE WHEN _status = 'APPROVED' AND unit = 'FT' THEN COALESCE(quantity, 0) ELSE 0 END)     AS approved_ft,
    SUM(CASE WHEN _status = 'APPROVED' AND unit = 'EA' THEN COALESCE(quantity, 0) ELSE 0 END)     AS approved_each,
    SUM(CASE WHEN _status = 'APPROVED' AND unit = 'SPLICE' THEN COALESCE(quantity, 0) ELSE 0 END) AS approved_splices,
    COUNT(CASE WHEN _status IN ('UNDER REVIEW','APPROVED','REJECTED','CORRECTION REQUIRED','REOPENED') THEN 1 END) AS reviewed,
    COUNT(CASE WHEN _status = 'REJECTED' THEN 1 END)                                 AS rejected,
    COUNT(CASE WHEN correction_completed = 'yes' OR _status = 'CORRECTION REQUIRED' THEN 1 END) AS corrected,
    COUNT(CASE WHEN qa_status IN ('Pass', 'Conditional Pass', 'Fail') THEN 1 END)    AS qa_recorded,
    COUNT(CASE WHEN qa_status = 'Fail' THEN 1 END)                                   AS qa_failed,
    COUNT(CASE WHEN exception_severity IN ('WARNING', 'CRITICAL') THEN 1 END)        AS with_exceptions,
    COUNT(CASE WHEN rate_contractor_id_snap IS NOT NULL AND rate_contractor_id_snap <> contractor_id_snapshot THEN 1 END) AS wrong_contractor_rate,
    AVG(CASE WHEN _status = 'APPROVED' AND submitted_date IS NOT NULL AND approved_date IS NOT NULL
             THEN CAST(approved_date AS date) - CAST(submitted_date AS date) END)    AS avg_turnaround_days,
    AVG(CASE WHEN submitted_date IS NOT NULL
             THEN CAST(submitted_date AS date) - CAST(work_date AS date) END)        AS avg_days_to_submit,
    MAX(work_date)                                                                   AS last_work_date
  FROM p
  GROUP BY contractor_id_snapshot
)
SELECT
  a.contractor_id,
  COALESCE(a.contractor_name, c.contractor_name)                                      AS contractor_name,
  c._status                                                                           AS contractor_status,
  a.records, a.projects, a.crews,
  ROUND(CAST(a.approved_value AS numeric), 2)                                         AS approved_value,
  ROUND(CAST(a.pending_value AS numeric), 2)                                          AS pending_value,
  ROUND(CAST(a.rejected_value AS numeric), 2)                                         AS rejected_value,
  ROUND(CAST(a.approved_tm_value AS numeric), 2)                                      AS approved_time_and_materials_value,
  a.approved_ft, a.approved_each, a.approved_splices,
  CASE WHEN a.reviewed = 0 THEN NULL ELSE ROUND(CAST(a.rejected * 100.0 / a.reviewed AS numeric), 1) END  AS rejection_rate_pct,
  CASE WHEN a.reviewed = 0 THEN NULL ELSE ROUND(CAST(a.corrected * 100.0 / a.reviewed AS numeric), 1) END AS correction_rate_pct_floor,
  CASE WHEN a.qa_recorded = 0 THEN NULL ELSE ROUND(CAST(a.qa_failed * 100.0 / a.qa_recorded AS numeric), 1) END AS qa_fail_rate_pct,
  ROUND(CAST(a.with_exceptions * 100.0 / a.records AS numeric), 1)                    AS exceptions_per_100_records,
  a.wrong_contractor_rate,
  ROUND(CAST(a.avg_days_to_submit AS numeric), 1)                                     AS avg_days_work_to_submit,
  ROUND(CAST(a.avg_turnaround_days AS numeric), 1)                                    AS avg_days_submit_to_approve,
  a.last_work_date
FROM agg a
LEFT JOIN "d8a368b5-1e19-4f5f-8cf9-ff8fbdd03ab4" c ON c.contractor_id = a.contractor_id
ORDER BY a.approved_value DESC, a.contractor_id;
