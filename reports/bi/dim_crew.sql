-- dim_crew  (Sprint 29)  key: crew_key = contractor_id|CREW
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- Crew is free text on the production record; there is no crew master. The
-- key is the contractor plus the crew name trimmed and upper-cased, so "Crew 3"
-- and "crew 3 " are one crew. Two contractors' "Crew 3" stay two crews.
-- If crew naming drifts in the field, a crew master is the fix, not Power BI.

SELECT
  contractor_id_snapshot || '|' || UPPER(TRIM(COALESCE(crew, '(none)')))   AS crew_key,
  contractor_id_snapshot                                                    AS contractor_id,
  UPPER(TRIM(COALESCE(crew, '(none)')))                                     AS crew,
  MIN(CAST(work_date AS date))                                              AS first_work_date,
  MAX(CAST(work_date AS date))                                              AS last_work_date,
  COUNT(*)                                                                  AS records
FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
WHERE _status <> 'VOID'
GROUP BY contractor_id_snapshot, UPPER(TRIM(COALESCE(crew, '(none)')))
ORDER BY crew_key;
