-- Segment and Structure Integrity  (Sprints 13/14)
--
-- The cross-record checks the structure and segment masters cannot do on a
-- device: duplicate identities, orphaned references and unbuilt segments.
-- See reports/_conventions.md for the shared rules.
--
--   397b52cf-a4f0-4871-b8ea-1fdb592fe2ab  MC Structure - Development
--   7da87588-940a-4b9e-915d-5ec25d5c0ebc  MC Segment - Development
--   06c36c8e-4a88-4cf3-a691-9a792f8374d2  Mainline Construction - Development
--
-- Direction normalization on the segment master is what makes the duplicate
-- check a plain GROUP BY: HH-001 -> HH-002 and HH-002 -> HH-001 already carry
-- the same derived segment_id, so a second record for one physical path shows
-- up as a count, not as a heuristic guess.

-- 1. Two structures claiming one ID. The master normalizes case and whitespace
--    on save, so a collision here is a genuine second record, not a typo.
SELECT
  'DUPLICATE STRUCTURE ID'          AS finding,
  'CRITICAL'                        AS severity,
  structure_id                      AS subject,
  CAST(COUNT(*) AS varchar) || ' structure records share this ID. Every segment '
    || 'and production record that references it resolves ambiguously.'
                                    AS detail
FROM "397b52cf-a4f0-4871-b8ea-1fdb592fe2ab"
WHERE structure_id IS NOT NULL
GROUP BY structure_id
HAVING COUNT(*) > 1

UNION ALL

-- 2. Two segment records for one physical path AND one type. Different types on
--    the same path are legitimate: the conduit and the fiber inside it.
SELECT
  'DUPLICATE SEGMENT'               AS finding,
  'CRITICAL'                        AS severity,
  segment_id || ' / ' || segment_type AS subject,
  CAST(COUNT(*) AS varchar) || ' segment records for the same path and type. '
    || 'Every quantity keyed on segment double-counts.'
                                    AS detail
FROM "7da87588-940a-4b9e-915d-5ec25d5c0ebc"
WHERE segment_id IS NOT NULL
  AND _status <> 'ABANDONED'
GROUP BY segment_id, segment_type
HAVING COUNT(*) > 1

UNION ALL

-- 3. A segment endpoint that is not in the structure master. The RecordLink
--    should prevent it, but an imported segment can carry a stale snapshot.
SELECT
  'SEGMENT ENDPOINT NOT IN MASTER'  AS finding,
  'WARNING'                         AS severity,
  g.segment_id                      AS subject,
  'Endpoint ' || COALESCE(g.from_structure_id, '(blank)')
    || ' or ' || COALESCE(g.to_structure_id, '(blank)')
    || ' has no active structure record.'
                                    AS detail
FROM "7da87588-940a-4b9e-915d-5ec25d5c0ebc" g
WHERE g._status <> 'ABANDONED'
  AND (
    NOT EXISTS (
      SELECT 1 FROM "397b52cf-a4f0-4871-b8ea-1fdb592fe2ab" s
      WHERE s.structure_id = g.from_structure_id
    )
    OR NOT EXISTS (
      SELECT 1 FROM "397b52cf-a4f0-4871-b8ea-1fdb592fe2ab" s
      WHERE s.structure_id = g.to_structure_id
    )
  )

UNION ALL

-- 4. Production booked against a segment identity no segment record describes.
--    Not an error in itself - crews work ahead of the as-built - but it is how
--    a path ends up with production and no design length to check it against.
SELECT
  'PRODUCTION ON UNDEFINED SEGMENT' AS finding,
  'WARNING'                         AS severity,
  p.segment_id                      AS subject,
  CAST(COUNT(*) AS varchar) || ' production records on this path, but no segment '
    || 'record exists for it. Nothing to compare the as-built length against.'
                                    AS detail
FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
WHERE p._status NOT IN ('VOID', 'REJECTED')
  AND p.segment_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "7da87588-940a-4b9e-915d-5ec25d5c0ebc" g
    WHERE g.segment_id = p.segment_id
  )
GROUP BY p.segment_id

UNION ALL

-- 5. A segment marked complete that no production ever touched. Either the
--    status is wrong or the production was booked against the wrong path.
SELECT
  'SEGMENT COMPLETE WITH NO PRODUCTION' AS finding,
  'WARNING'                             AS severity,
  g.segment_id || ' / ' || g.segment_type AS subject,
  'Marked complete, but no production record references this path.'
                                        AS detail
FROM "7da87588-940a-4b9e-915d-5ec25d5c0ebc" g
WHERE g._status = 'COMPLETE'
  AND NOT EXISTS (
    SELECT 1 FROM "06c36c8e-4a88-4cf3-a691-9a792f8374d2" p
    WHERE p.segment_id = g.segment_id
      AND p._status NOT IN ('VOID', 'REJECTED')
  )

UNION ALL

-- 6. A splice closure or slack coil naming a housing structure that does not
--    exist. The closure is then unfindable in the field.
SELECT
  'HOUSING STRUCTURE NOT IN MASTER' AS finding,
  'WARNING'                         AS severity,
  s.structure_id                    AS subject,
  'Recorded as housed in ' || s.housed_in_structure_id
    || ', which has no structure record.'
                                    AS detail
FROM "397b52cf-a4f0-4871-b8ea-1fdb592fe2ab" s
WHERE s.housed_in_structure_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "397b52cf-a4f0-4871-b8ea-1fdb592fe2ab" h
    WHERE h.structure_id = s.housed_in_structure_id
  )

ORDER BY severity, finding, subject;
