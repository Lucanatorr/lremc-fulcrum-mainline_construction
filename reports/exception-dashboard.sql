-- Exception Dashboard  (Sprint 21)
--
-- Every record needing attention, in one place, one row per finding.
-- See reports/_conventions.md for the shared rules.
--
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--   a5529dd0-54fa-4b8d-b595-d0218df0ee97  MC Contractor Rate - Development
--   aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b  MC Project Scope Line - Development
--   458ae172-b7b4-43b5-8917-d7a792c9e81a  MC Change Order - Development
--   ee204906-adb3-431b-a1d9-d7427a4c842c  MC Material Transaction - Development
--   38e3d7fd-ca78-4016-8018-ec955446c13f  MC Labor-Material Mapping - Development
--   728477da-5f36-48cb-b3ab-cbc8c38d077f  MC Fiber Reel - Development
--
-- ALL SEVENTEEN EXCEPTION TYPES THE BRIEF NAMES
--   Missing Rate, Zero Rate, Missing Labor Code, Missing Project,
--   Missing Contractor, Missing Material Mapping, Production Over Plan,
--   Potential Duplicate, Sequential Overlap, Sequential Outside Reel Range,
--   QA Failure, Correction Required, Material Variance,
--   Expired Contractor Rate, Pending Approval, Old Pending Production,
--   Missing Required Photos.
--
-- SEVERITY DOES NOT REPLACE THE DESCRIPTION
-- The brief is explicit about this, and it is the reason every row carries
-- BOTH a severity and a `detail` sentence naming the actual figures. "CRITICAL"
-- tells a manager how fast to move; it does not tell them what is wrong, which
-- record it is, or how much money is involved. A dashboard that collapses to a
-- severity count is a dashboard nobody can act on.
--
-- SEVERITY IS VALUE-AWARE WHERE THE BRIEF SAYS IT SHOULD BE
-- The brief's own example: "Missing optional photo = WARNING. Missing
-- contractor rate on a $50,000 production transaction = CRITICAL." So an
-- unpriced record is CRITICAL regardless, and several other findings escalate
-- once the value at risk crosses p_material_value_threshold.
--
-- RELATIONSHIP TO THE DEDICATED REPORTS
-- This is the management view: what, where, how bad, how much. The specialist
-- reports remain the place to diagnose -- sequential-overlap.sql classifies an
-- overlap, duplicate-production.sql scores a near-duplicate,
-- material-variance.sql shows the per-code arithmetic. Each finding below
-- names its companion report in `see_also`.
--
-- The overlap predicate here is character-for-character the one in
-- sequential-overlap.sql. tests/reporting.test.js asserts they stay identical,
-- so the two reports cannot drift into disagreeing about what an overlap is.

WITH params AS (
  SELECT
    CAST(NULL AS varchar)  AS p_project_id,
    CAST(NULL AS varchar)  AS p_contractor_id,
    CAST(NULL AS varchar)  AS p_severity,
    CAST(NULL AS date)     AS p_date_from,
    CAST(NULL AS date)     AS p_date_to,
    CAST(14 AS integer)    AS p_pending_days,        -- "old" pending production
    CAST(10000 AS numeric) AS p_high_value,          -- escalates several findings
    CAST(0.25 AS numeric)  AS p_material_variance    -- 25% over/under expected
),

live AS (
  SELECT
    p._record_id, p.production_id, p._status AS record_status, p.work_date,
    p.project_id_snapshot AS project_id, p.contractor_id_snapshot AS contractor_id,
    p.crew, p.labor_code, p.unit, p.quantity, p.contractor_rate, p.extended_value,
    p.rate_source_id, p.rate_expiration_snap, p.qa_status, p.qa_photos,
    p.correction_detail, p.reel_id, p.cable_id,
    p.starting_sequential, p.ending_sequential,
    LEAST(p.starting_sequential, p.ending_sequential)    AS seq_lo,
    GREATEST(p.starting_sequential, p.ending_sequential) AS seq_hi,
    p.conduit_material_code, p.conduit_material_quantity,
    p.fingerprint_strict, p.fingerprint_strength,
    p.segment_id, p._created_at, p._server_updated_at, p._created_by_id
  FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
  CROSS JOIN params
  WHERE p._status <> 'VOID'
    AND (p_project_id    IS NULL OR p.project_id_snapshot    = p_project_id)
    AND (p_contractor_id IS NULL OR p.contractor_id_snapshot = p_contractor_id)
    AND (p_date_from     IS NULL OR p.work_date >= p_date_from)
    AND (p_date_to       IS NULL OR p.work_date <= p_date_to)
),

-- ------------------------------------------------------------- supporting
authorized AS (
  SELECT s.project_id_snap AS project_id, s.labor_code,
         s.original_planned_quantity + COALESCE(ac.qty_change, 0) AS authorized_quantity
  FROM "aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b" s
  LEFT JOIN (
    SELECT co.project_id_snap, line.line_labor_code AS labor_code,
           SUM(line.line_quantity_change) AS qty_change
    FROM "458ae172-b7b4-43b5-8917-d7a792c9e81a/quantity_changes" line
    JOIN "458ae172-b7b4-43b5-8917-d7a792c9e81a" co ON co._record_id = line._parent_id
    WHERE co._status = 'APPROVED'
    GROUP BY co.project_id_snap, line.line_labor_code
  ) ac ON ac.project_id_snap = s.project_id_snap AND ac.labor_code = s.labor_code
  WHERE s._status <> 'VOID'
),
approved_to_date AS (
  SELECT project_id, labor_code, SUM(COALESCE(quantity, 0)) AS approved_quantity
  FROM live WHERE record_status = 'APPROVED'
  GROUP BY project_id, labor_code
),
fingerprint_groups AS (
  SELECT fingerprint_strict, COUNT(*) AS n
  FROM live
  WHERE fingerprint_strict IS NOT NULL AND fingerprint_strength >= 4
    AND record_status <> 'REJECTED'
  GROUP BY fingerprint_strict
  HAVING COUNT(*) > 1
),
reels AS (
  SELECT r.reel_id,
         LEAST(r.beginning_sequential, r.ending_sequential)    AS reel_lo,
         GREATEST(r.beginning_sequential, r.ending_sequential) AS reel_hi
  FROM "728477da-5f36-48cb-b3ab-cbc8c38d077f" r
  WHERE r._status <> 'VOID'
),
installed_material AS (
  SELECT t.production_id_snap, t.material_code_snap,
         SUM(CASE WHEN t.transaction_type = 'Installed'
                  THEN COALESCE(t.quantity, 0) ELSE 0 END) AS installed_quantity
  FROM "ee204906-adb3-431b-a1d9-d7427a4c842c" t
  WHERE t._status <> 'VOID'
  GROUP BY t.production_id_snap, t.material_code_snap
),
-- The mapping master's own column is material_code; the header of
-- data/import/labor-material-mapping-proposed.csv is the authority on its shape.
mapping AS (
  SELECT DISTINCT mm.material_code
  FROM "38e3d7fd-ca78-4016-8018-ec955446c13f" mm
  WHERE mm._status <> 'VOID'
    AND COALESCE(mm.active, 'yes') <> 'no'
),

-- ================================================================ findings
f AS (

-- 1. MISSING RATE -- the brief's own CRITICAL example.
SELECT l._record_id, 'Missing Rate' AS exception_type, 'CRITICAL' AS severity,
  'No contractor rate is linked, so this production cannot be priced. '
  || COALESCE(ROUND(CAST(l.quantity AS numeric), 2)::varchar, '?') || ' '
  || COALESCE(l.unit, '') || ' of ' || COALESCE(l.labor_code, '(no labor code)')
  || ' is unbilled.' AS detail,
  'rate-audit.sql' AS see_also, CAST(NULL AS numeric) AS value_at_risk
FROM live l WHERE l.rate_source_id IS NULL

-- 2. ZERO RATE
UNION ALL SELECT l._record_id, 'Zero Rate', 'CRITICAL',
  'A rate is linked but prices the work at 0.00, so the record contributes '
  || 'nothing to earned value or billing.',
  'rate-audit.sql', CAST(0 AS numeric)
FROM live l WHERE l.rate_source_id IS NOT NULL AND COALESCE(l.contractor_rate, 0) = 0

-- 3. MISSING LABOR CODE
UNION ALL SELECT l._record_id, 'Missing Labor Code', 'CRITICAL',
  'No labor code, so this production cannot be priced, scoped or reported.',
  'qa-review-queue.sql', ROUND(CAST(COALESCE(l.extended_value, 0) AS numeric), 2)
FROM live l WHERE l.labor_code IS NULL OR l.labor_code = ''

-- 4. MISSING PROJECT. The field is required in the app, so a blank one means
--    the record arrived by import or API and bypassed the form entirely.
UNION ALL SELECT l._record_id, 'Missing Project', 'CRITICAL',
  'No project, so this production belongs to no scope, no budget and no '
  || 'remaining-work figure. A required field is blank, so this record did '
  || 'not come through the app.',
  'unplanned-production.sql', ROUND(CAST(COALESCE(l.extended_value, 0) AS numeric), 2)
FROM live l WHERE l.project_id IS NULL OR l.project_id = ''

-- 5. MISSING CONTRACTOR
UNION ALL SELECT l._record_id, 'Missing Contractor', 'CRITICAL',
  'No contractor, so this production cannot be attributed or paid, and no '
  || 'rate can be validated against it.',
  'contractor-financial.sql', ROUND(CAST(COALESCE(l.extended_value, 0) AS numeric), 2)
FROM live l WHERE l.contractor_id IS NULL OR l.contractor_id = ''

-- 6. MISSING MATERIAL MAPPING. The app derived a conduit material code but no
--    mapping record resolves it to a stock part number, so nothing can be
--    ordered or reconciled against it.
UNION ALL SELECT l._record_id, 'Missing Material Mapping', 'WARNING',
  'Derived material code ' || l.conduit_material_code
  || ' has no record in the Labor-Material Mapping master, so it resolves to '
  || 'no stock part number.',
  'material-variance.sql', CAST(NULL AS numeric)
FROM live l
LEFT JOIN mapping mp ON mp.material_code = l.conduit_material_code
WHERE l.conduit_material_code IS NOT NULL AND mp.material_code IS NULL

-- 7. PRODUCTION OVER PLAN
UNION ALL SELECT l._record_id, 'Production Over Plan',
  CASE WHEN a.authorized_quantity IS NULL OR a.authorized_quantity = 0 THEN 'CRITICAL'
       WHEN atd.approved_quantity > a.authorized_quantity * 1.1 THEN 'CRITICAL'
       ELSE 'WARNING' END,
  'Approved ' || ROUND(CAST(atd.approved_quantity AS numeric), 2)::varchar
  || ' against an authorized ' || ROUND(CAST(a.authorized_quantity AS numeric), 2)::varchar
  || ' ' || COALESCE(l.unit, '') || ' for ' || l.labor_code
  || '. Raise a change order or stop the work.',
  'project-scope-status.sql', CAST(NULL AS numeric)
FROM live l
JOIN authorized a      ON a.project_id = l.project_id AND a.labor_code = l.labor_code
JOIN approved_to_date atd ON atd.project_id = l.project_id AND atd.labor_code = l.labor_code
-- Anchored to the LATEST approved record of the over-plan pay unit. Over plan
-- is a condition of the project + labor code, not of any one record, so
-- emitting it against every approved record in the group would bury the other
-- sixteen exception types under hundreds of identical CRITICALs.
JOIN (
  SELECT project_id, labor_code, MAX(work_date) AS last_date
  FROM live WHERE record_status = 'APPROVED'
  GROUP BY project_id, labor_code
) latest
  ON  latest.project_id = l.project_id
  AND latest.labor_code = l.labor_code
  AND latest.last_date  = l.work_date
WHERE l.record_status = 'APPROVED'
  AND atd.approved_quantity > a.authorized_quantity

-- 8. POTENTIAL DUPLICATE -- fingerprint collision, the cheap linear check.
UNION ALL SELECT l._record_id, 'Potential Duplicate', 'CRITICAL',
  'Shares an identical production fingerprint with '
  || (fg.n - 1)::varchar || ' other record(s): same project, contractor, day, '
  || 'pay unit, cable and sequential range. The same cable cannot be placed twice.',
  'duplicate-production.sql', ROUND(CAST(COALESCE(l.extended_value, 0) AS numeric), 2)
FROM live l
JOIN fingerprint_groups fg ON fg.fingerprint_strict = l.fingerprint_strict

-- 9. SEQUENTIAL OVERLAP. Predicate identical to sequential-overlap.sql;
--    an intersection of more than one sequential, on the same reel.
UNION ALL SELECT l._record_id, 'Sequential Overlap',
  CASE WHEN LEAST(l.seq_hi, o.seq_hi) - GREATEST(l.seq_lo, o.seq_lo) = 0
       THEN 'INFO' ELSE 'WARNING' END,
  'Sequential range ' || l.seq_lo::varchar || '-' || l.seq_hi::varchar
  || ' on reel ' || l.reel_id || ' intersects '
  || o.production_id || ' (' || o.seq_lo::varchar || '-' || o.seq_hi::varchar || ').',
  'sequential-overlap.sql', CAST(NULL AS numeric)
FROM live l
JOIN live o
  ON  l.reel_id = o.reel_id
  AND l._record_id < o._record_id
WHERE l.seq_lo <= o.seq_hi
  AND l.seq_hi >= o.seq_lo
  AND l.reel_id IS NOT NULL

-- 10. SEQUENTIAL OUTSIDE REEL RANGE, re-tested against the reel's CURRENT
--     printed range, which the device-side check cannot do.
UNION ALL SELECT l._record_id, 'Sequential Outside Reel Range', 'WARNING',
  'Range ' || l.seq_lo::varchar || '-' || l.seq_hi::varchar
  || ' falls outside the printed range of reel ' || l.reel_id
  || ' (' || r.reel_lo::varchar || '-' || r.reel_hi::varchar || ').',
  'reel-integrity.sql', CAST(NULL AS numeric)
FROM live l
JOIN reels r ON r.reel_id = l.reel_id
WHERE l.seq_lo IS NOT NULL AND r.reel_lo IS NOT NULL
  AND (l.seq_lo < r.reel_lo OR l.seq_hi > r.reel_hi)

-- 11. QA FAILURE
UNION ALL SELECT l._record_id, 'QA Failure', 'CRITICAL',
  'QA status is Fail. This work cannot be approved into earned value or '
  || 'billing until it is corrected or the QA result is revised.',
  'qa-review-queue.sql', ROUND(CAST(COALESCE(l.extended_value, 0) AS numeric), 2)
FROM live l WHERE l.qa_status = 'Fail'

-- 12. CORRECTION REQUIRED
UNION ALL SELECT l._record_id, 'Correction Required',
  CASE WHEN l.correction_detail IS NULL THEN 'CRITICAL' ELSE 'WARNING' END,
  CASE WHEN l.correction_detail IS NULL
       THEN 'Sent back for correction with no detail recorded, so the crew has '
            || 'nothing to act on.'
       ELSE 'Sent back for correction: ' || l.correction_detail END,
  'qa-review-queue.sql', CAST(NULL AS numeric)
FROM live l WHERE l.record_status = 'CORRECTION REQUIRED'

-- 13. MATERIAL VARIANCE
UNION ALL SELECT l._record_id, 'Material Variance',
  CASE WHEN COALESCE(l.extended_value, 0) >= p.p_high_value THEN 'CRITICAL' ELSE 'WARNING' END,
  'Installed ' || ROUND(CAST(im.installed_quantity AS numeric), 2)::varchar
  || ' of ' || l.conduit_material_code || ' against an expected '
  || ROUND(CAST(l.conduit_material_quantity AS numeric), 2)::varchar || '.',
  'material-variance.sql', ROUND(CAST(COALESCE(l.extended_value, 0) AS numeric), 2)
FROM live l
CROSS JOIN params p
JOIN installed_material im
  ON im.production_id_snap = l.production_id
 AND im.material_code_snap = l.conduit_material_code
WHERE l.conduit_material_quantity > 0
  AND ABS(im.installed_quantity - l.conduit_material_quantity)
      / l.conduit_material_quantity > p.p_material_variance

-- 14. EXPIRED CONTRACTOR RATE
UNION ALL SELECT l._record_id, 'Expired Contractor Rate', 'CRITICAL',
  'The linked rate expired on ' || l.rate_expiration_snap::varchar
  || ', before this work was performed on ' || l.work_date::varchar
  || '. The record is priced at a rate that was not in force.',
  'rate-audit.sql', ROUND(CAST(COALESCE(l.extended_value, 0) AS numeric), 2)
FROM live l
WHERE l.rate_expiration_snap IS NOT NULL AND l.work_date > l.rate_expiration_snap

-- 15. PENDING APPROVAL. INFO: this is the normal state of new work, not a
--     fault. It is listed because the brief asks for it and because a pile of
--     it is a workload signal.
UNION ALL SELECT l._record_id, 'Pending Approval', 'INFO',
  'Awaiting review in status ' || l.record_status || '.',
  'qa-review-queue.sql', ROUND(CAST(COALESCE(l.extended_value, 0) AS numeric), 2)
FROM live l
CROSS JOIN params p
WHERE l.record_status IN ('DRAFT', 'SUBMITTED', 'UNDER REVIEW')
  AND l.work_date > CURRENT_DATE - p.p_pending_days

-- 16. OLD PENDING PRODUCTION. The same records, past the threshold, where
--     value has been sitting unrecognised long enough to matter.
UNION ALL SELECT l._record_id, 'Old Pending Production',
  CASE WHEN COALESCE(l.extended_value, 0) >= p.p_high_value THEN 'CRITICAL' ELSE 'WARNING' END,
  'Still in status ' || l.record_status || ' '
  || (CURRENT_DATE - l.work_date)::varchar || ' days after the work date. '
  || 'Unapproved production is not in earned value, billing or remaining scope.',
  'qa-review-queue.sql', ROUND(CAST(COALESCE(l.extended_value, 0) AS numeric), 2)
FROM live l
CROSS JOIN params p
WHERE l.record_status IN ('DRAFT', 'SUBMITTED', 'UNDER REVIEW', 'CORRECTION REQUIRED')
  AND l.work_date <= CURRENT_DATE - p.p_pending_days

-- 17. MISSING REQUIRED PHOTOS. The brief's own WARNING example. A missing
--     photo never blocks a save -- that would lose field work -- but approving
--     production with no evidence is a decision somebody should make knowingly.
UNION ALL SELECT l._record_id, 'Missing Required Photos',
  CASE WHEN l.record_status = 'APPROVED' THEN 'WARNING' ELSE 'INFO' END,
  'No photographs attached'
  || CASE WHEN l.record_status = 'APPROVED'
          THEN ', and the record is already APPROVED, so it entered billing '
               || 'with no visual evidence.'
          ELSE '.' END,
  'qa-review-queue.sql', ROUND(CAST(COALESCE(l.extended_value, 0) AS numeric), 2)
FROM live l
-- qa_photos is a PhotoField, which Query exposes as text[], not text.
-- "no photographs" is an empty array, not an empty string; comparing it to
-- '' raises "malformed array literal" and the whole report fails.
WHERE l.qa_photos IS NULL OR CARDINALITY(l.qa_photos) = 0
)

SELECT
  f.severity,
  f.exception_type,
  f.detail,
  f.see_also,
  l.production_id,
  l.record_status,
  l.work_date,
  l.project_id,
  l.contractor_id,
  l.crew,
  l.labor_code,
  l.unit,
  ROUND(CAST(COALESCE(l.quantity, 0) AS numeric), 2)       AS quantity,
  ROUND(CAST(COALESCE(l.extended_value, 0) AS numeric), 2) AS extended_value,
  f.value_at_risk,
  cb.name  AS created_by_name,
  cb.email AS created_by_email,
  l._record_id
FROM f
JOIN live l ON l._record_id = f._record_id
LEFT JOIN memberships cb ON cb.user_id = l._created_by_id
CROSS JOIN params pr
WHERE (pr.p_severity IS NULL OR f.severity = pr.p_severity)
ORDER BY
  CASE f.severity WHEN 'CRITICAL' THEN 0 WHEN 'WARNING' THEN 1 ELSE 2 END,
  f.value_at_risk DESC NULLS LAST,
  l.work_date DESC,
  f.exception_type;
