-- fact_approval_event  (Sprint 29)  grain: one workflow stamp on a record.
--   key: production_id + event
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- The Approvals dataset. Each production record carries its LATEST stamp of
-- each kind (submitted, reviewed, approved, reopened, reversed); this turns
-- them into rows, so turnaround and approval volume chart over time.
-- Limitation: Fulcrum keeps only the latest stamp of each kind on the record,
-- so a record approved, reopened and approved again shows one APPROVED event.
-- Full history is in Fulcrum's record versions, which the Query API does not
-- expose.

WITH p AS (
  SELECT * FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" WHERE _status <> 'VOID'
),
ev AS (
  SELECT production_id, 'SUBMITTED' AS event, submitted_date AS event_at, submitted_by AS event_by FROM p WHERE submitted_date IS NOT NULL
  UNION ALL SELECT production_id, 'REVIEWED', reviewed_date, reviewed_by FROM p WHERE reviewed_date IS NOT NULL
  UNION ALL SELECT production_id, 'APPROVED', approved_date, approved_by FROM p WHERE approved_date IS NOT NULL
  UNION ALL SELECT production_id, 'REOPENED', reopened_date, reopened_by FROM p WHERE reopened_date IS NOT NULL
  UNION ALL SELECT production_id, 'REVERSED', reversed_date, reversed_by FROM p WHERE reversed_date IS NOT NULL
)
SELECT
  ev.production_id || '|' || ev.event                                   AS approval_event_key,
  ev.production_id,
  ev.event,
  ev.event_at,
  CAST(TO_CHAR(CAST(ev.event_at AS date), 'YYYYMMDD') AS integer)       AS event_date_key,
  ev.event_by,
  p.project_id_snapshot                                                 AS project_id,
  p.contractor_id_snapshot                                              AS contractor_id,
  p._status                                                             AS current_status,
  CASE WHEN ev.event = 'APPROVED' AND p.submitted_date IS NOT NULL
       THEN CAST(ev.event_at AS date) - CAST(p.submitted_date AS date) END AS days_from_submission
FROM ev
JOIN p ON p.production_id = ev.production_id
ORDER BY ev.production_id, ev.event_at;
