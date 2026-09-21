-- Project Closeout Readiness  (Sprint 22)
--
-- The eight things the brief requires be identified before a project is marked
-- CLOSED, one row per project per blocker.
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--   aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b  MC Project Scope Line - Development
--   458ae172-b7b4-43b5-8917-d7a792c9e81a  MC Change Order - Development
--   ee204906-adb3-431b-a1d9-d7427a4c842c  MC Material Transaction - Development
--   351bb1f1-9837-47c8-be5b-bb0727fe93a0  MC Project Closeout - Development
--
-- WHY THIS IS A REPORT AND NOT A CHECK ON THE CLOSEOUT RECORD
-- Every one of the eight needs OTHER records. The closeout record cannot see
-- them, for the same reason a production record cannot check for duplicates:
-- Fulcrum Data Events reach only the record in hand. So the closeout app
-- enforces what it CAN - that somebody states they ran this report, and that
-- closing with items outstanding is an attributed, reasoned override - and
-- this query supplies the findings.
--
-- A project with no rows here is ready to close. That is the whole reading.
--
-- SEVERITY, same three levels as everywhere else:
--   CRITICAL  money or scope would be wrong if the project closed now
--   WARNING   a real gap, but a business owner can reasonably accept it
--   INFO      worth seeing, not worth blocking

WITH params AS (
  SELECT
    CAST(NULL AS varchar)  AS p_project_id,
    CAST(NULL AS varchar)  AS p_severity,
    CAST(0.25 AS numeric)  AS p_material_variance   -- 25% over/under expected
),

projects AS (
  SELECT DISTINCT project_id_snapshot AS project_id
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
  WHERE project_id_snapshot IS NOT NULL AND _status <> 'VOID'
  UNION
  SELECT DISTINCT project_id_snap
  FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b"
  WHERE project_id_snap IS NOT NULL AND _status <> 'VOID'
),

approved_changes AS (
  SELECT co.project_id_snap AS project_id, line.line_labor_code AS labor_code,
         SUM(line.line_quantity_change) AS qty_change
  FROM "458ae172-b7b4-43b5-8917-d7a792c9e81a/quantity_changes" line
  JOIN "458ae172-b7b4-43b5-8917-d7a792c9e81a" co ON co._record_id = line._parent_id
  WHERE co._status = 'APPROVED'
  GROUP BY co.project_id_snap, line.line_labor_code
),

findings AS (

-- 1. UNAPPROVED PRODUCTION. Closing a project while production is still
--    pending freezes a scope figure that is about to move.
SELECT
  p.project_id_snapshot AS project_id,
  'Unapproved Production' AS blocker,
  'CRITICAL'              AS severity,
  COUNT(*)                AS item_count,
  ROUND(CAST(SUM(COALESCE(p.extended_value, 0)) AS numeric), 2) AS value_at_stake,
  CAST(COUNT(*) AS varchar) || ' record(s) still in DRAFT, SUBMITTED or UNDER '
    || 'REVIEW, carrying ' ||
    CAST(ROUND(CAST(SUM(COALESCE(p.extended_value, 0)) AS numeric), 2) AS varchar)
    || ' of production value that is not yet in earned value or billing.' AS detail,
  'qa-review-queue.sql' AS see_also
FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
WHERE p._status IN ('DRAFT', 'SUBMITTED', 'UNDER REVIEW')
GROUP BY p.project_id_snapshot

-- 2. FAILED QA RECORDS
UNION ALL SELECT
  p.project_id_snapshot, 'Failed QA Records', 'CRITICAL',
  COUNT(*), ROUND(CAST(SUM(COALESCE(p.extended_value, 0)) AS numeric), 2),
  CAST(COUNT(*) AS varchar) || ' record(s) carry a QA status of Fail. Work that '
    || 'failed inspection cannot be part of a closed project.',
  'qa-review-queue.sql'
FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
WHERE p.qa_status = 'Fail' AND p._status <> 'VOID'
GROUP BY p.project_id_snapshot

-- 3. OPEN CORRECTIONS
UNION ALL SELECT
  p.project_id_snapshot, 'Open Corrections', 'CRITICAL',
  COUNT(*), ROUND(CAST(SUM(COALESCE(p.extended_value, 0)) AS numeric), 2),
  CAST(COUNT(*) AS varchar) || ' record(s) sent back for correction and not yet '
    || 'resubmitted.',
  'qa-review-queue.sql'
FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
WHERE p._status = 'CORRECTION REQUIRED'
GROUP BY p.project_id_snapshot

-- 4. REMAINING PLANNED WORK. Authorized scope that was never built. Not
--    necessarily wrong - scope is often deliberately descoped at the end - but
--    it must be a decision, not a discovery after closing.
UNION ALL SELECT
  r.project_id, 'Remaining Planned Work', 'WARNING',
  COUNT(*), CAST(NULL AS numeric),
  CAST(COUNT(*) AS varchar) || ' pay unit(s) with authorized scope still '
    || 'unbuilt. Descope them through a change order, or explain the shortfall.',
  'remaining-work.sql'
FROM (
  SELECT s.project_id_snap AS project_id, s.labor_code,
         s.original_planned_quantity + COALESCE(ac.qty_change, 0)
           - COALESCE(prod.approved_quantity, 0) AS remaining
  FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b" s
  LEFT JOIN approved_changes ac
    ON ac.project_id = s.project_id_snap AND ac.labor_code = s.labor_code
  LEFT JOIN (
    SELECT project_id_snapshot AS project_id, labor_code,
           SUM(COALESCE(quantity, 0)) AS approved_quantity
    FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2"
    WHERE _status = 'APPROVED'
    GROUP BY project_id_snapshot, labor_code
  ) prod ON prod.project_id = s.project_id_snap AND prod.labor_code = s.labor_code
  WHERE s._status <> 'VOID'
) r
WHERE r.remaining > 0
GROUP BY r.project_id

-- 5. MATERIAL DISCREPANCIES
UNION ALL SELECT
  v.project_id, 'Material Discrepancies', 'WARNING',
  COUNT(*), CAST(NULL AS numeric),
  CAST(COUNT(*) AS varchar) || ' record(s) where installed material differs '
    || 'from the expected quantity by more than the tolerance. Reconcile before '
    || 'the material reconciliation milestone is ticked.',
  'material-variance.sql'
FROM (
  SELECT p.project_id_snapshot AS project_id, p._record_id
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
  CROSS JOIN params
  JOIN (
    SELECT t.production_id_snap, t.material_code_snap,
           SUM(CASE WHEN t.transaction_type = 'Installed'
                    THEN COALESCE(t.quantity, 0) ELSE 0 END) AS installed_quantity
    FROM "ee204906-adb3-431b-a1d9-d7427a4c842c" t
    WHERE t._status <> 'VOID'
    GROUP BY t.production_id_snap, t.material_code_snap
  ) im ON im.production_id_snap = p.production_id
      AND im.material_code_snap = p.conduit_material_code
  WHERE p._status <> 'VOID'
    AND p.conduit_material_quantity > 0
    AND ABS(im.installed_quantity - p.conduit_material_quantity)
        / p.conduit_material_quantity > p_material_variance
) v
GROUP BY v.project_id

-- 6. MISSING DOCUMENTATION. Approved production with no photograph. It never
--    blocked the save - that would lose field work - but it should not pass
--    silently into a closed project either.
UNION ALL SELECT
  p.project_id_snapshot, 'Missing Documentation', 'WARNING',
  COUNT(*), ROUND(CAST(SUM(COALESCE(p.extended_value, 0)) AS numeric), 2),
  CAST(COUNT(*) AS varchar) || ' APPROVED record(s) with no photographs, so '
    || 'they entered billing with no visual evidence.',
  'exception-dashboard.sql'
FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
WHERE p._status = 'APPROVED'
  AND (p.qa_photos_captions IS NULL OR p.qa_photos_captions = '')
GROUP BY p.project_id_snapshot

-- 7. UNRESOLVED CHANGE ORDERS. A pending change order means the authorized
--    scope this project is being measured against is not final.
UNION ALL SELECT
  co.project_id_snap, 'Unresolved Change Orders', 'CRITICAL',
  COUNT(*), CAST(NULL AS numeric),
  CAST(COUNT(*) AS varchar) || ' change order(s) neither approved nor rejected. '
    || 'Authorized scope is not final while one is open.',
  'project-scope-status.sql'
FROM "458ae172-b7b4-43b5-8917-d7a792c9e81a" co
WHERE co._status NOT IN ('APPROVED', 'REJECTED', 'VOID')
GROUP BY co.project_id_snap

-- 8. MISSING TEST RESULTS. Splicing with no OTDR or light-meter result. The
--    Testing Complete milestone should not be tickable over these.
UNION ALL SELECT
  p.project_id_snapshot, 'Missing Test Results', 'WARNING',
  COUNT(*), CAST(NULL AS numeric),
  CAST(COUNT(*) AS varchar) || ' splicing record(s) with no test result '
    || 'recorded, so the fiber has no evidence of having been tested.',
  'qa-review-queue.sql'
FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
WHERE p._status <> 'VOID'
  AND p.work_category = 'Splicing'
  AND (p.splice_test_result IS NULL
       OR p.splice_test_result = ''
       OR p.splice_test_result = 'Not Tested')
GROUP BY p.project_id_snapshot
)

SELECT
  pr.project_id,
  c.closeout_id,
  c._status                AS closeout_status,
  f.severity,
  f.blocker,
  f.item_count,
  f.value_at_stake,
  f.detail,
  f.see_also
FROM projects pr
JOIN findings f ON f.project_id = pr.project_id
CROSS JOIN params
LEFT JOIN "351bb1f1-9837-47c8-be5b-bb0727fe93a0" c
  ON c.project_id_snap = pr.project_id AND c._status <> 'VOID'
WHERE (p_project_id IS NULL OR pr.project_id = p_project_id)
  AND (p_severity   IS NULL OR f.severity    = p_severity)
ORDER BY
  pr.project_id,
  CASE f.severity WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END,
  f.value_at_stake DESC NULLS LAST,
  f.blocker;
