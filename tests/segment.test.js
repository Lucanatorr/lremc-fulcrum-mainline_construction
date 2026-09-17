/**
 * Sprint 14 - segment identity and direction normalization.
 * Runs against the authoritative Data Events source via tests/harness.js.
 */
const { load } = require('./harness.js');

let pass = 0, fail = 0;
function check(id, label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${id} ${label}`); }
  else { fail++; console.log(`FAIL  ${id} ${label}\n      got=${a}\n      want=${e}`); }
}

const seg = load('mc-segment-dev.js');

function segmentFor(from, to, extra) {
  seg.reset(Object.assign({
    from_structure_id: from,
    to_structure_id: to,
    segment_type: 'Underground Conduit',
  }, extra || {}));
  seg.fire('validate-record');
  return {
    id: seg.get('segment_id'),
    invalids: seg.invalids.slice(),
    flags: seg.get('exception_flags') || '',
    severity: seg.get('exception_severity'),
  };
}

// ------------------------------------------- the requirement, stated directly
// "Ensure reversing From/To does not accidentally create uncontrolled duplicate
// segment identities."
const forward = segmentFor('HH-001', 'HH-002');
const reverse = segmentFor('HH-002', 'HH-001');
check('TEST-SEGID-001', 'the brief\'s example derives as expected', forward.id, 'HH-001_HH-002');
check('TEST-SEGID-002', 'reversing From/To gives the SAME identity', reverse.id, forward.id);

// Case and whitespace must not fork the identity either.
check('TEST-SEGID-003', 'lower case normalizes', segmentFor('hh-001', 'hh-002').id, forward.id);
check('TEST-SEGID-004', 'padding normalizes', segmentFor(' HH-001 ', ' HH-002').id, forward.id);
check('TEST-SEGID-005', 'mixed case and reversal together still normalize',
      segmentFor(' hh-002 ', 'HH-001').id, forward.id);

// Genuinely different paths stay different.
check('TEST-SEGID-010', 'a different endpoint is a different segment',
      segmentFor('HH-001', 'HH-003').id, 'HH-001_HH-003');
check('TEST-SEGID-011', 'sorting is lexical and stable',
      segmentFor('PL-050', 'HH-002').id, 'HH-002_PL-050');

// A missing endpoint derives nothing rather than half an identity.
check('TEST-SEGID-020', 'a blank To derives no segment', segmentFor('HH-001', null).id, null);
check('TEST-SEGID-021', 'a blank From derives no segment', segmentFor(null, 'HH-002').id, null);
check('TEST-SEGID-022', 'and that is flagged CRITICAL',
      segmentFor('HH-001', null).severity, 'CRITICAL');

// ------------------------------------------------- a segment to itself is not one
const selfLoop = segmentFor('HH-001', 'HH-001');
check('TEST-SEGID-030', 'a segment from a structure to itself is rejected',
      selfLoop.invalids.length > 0, true);
check('TEST-SEGID-031', 'the message names the structure',
      /Both endpoints are HH-001/.test(selfLoop.invalids[0] || ''), true);
check('TEST-SEGID-032', 'case does not evade the self-loop check',
      segmentFor('hh-001', 'HH-001').invalids.length > 0, true);

// ---------------------------------------------------------- endpoint sanity
const aerialBetweenHoles = segmentFor('HH-001', 'HH-002', {
  segment_type: 'Aerial Strand',
  from_structure_type: 'Handhole', to_structure_type: 'Handhole',
});
check('TEST-SEGCHK-001', 'aerial strand between two handholes warns',
      /normally runs pole to pole/.test(aerialBetweenHoles.flags), true);
const aerialPoleToPole = segmentFor('PL-001', 'PL-002', {
  segment_type: 'Aerial Strand',
  from_structure_type: 'Pole', to_structure_type: 'Pole',
});
check('TEST-SEGCHK-002', 'aerial strand pole to pole does not warn',
      /normally runs pole to pole/.test(aerialPoleToPole.flags), false);
check('TEST-SEGCHK-003', 'underground between two poles is INFO, not a warning',
      /riser to riser/.test(segmentFor('PL-001', 'PL-002', {
        segment_type: 'Underground Conduit',
        from_structure_type: 'Pole', to_structure_type: 'Pole',
      }).flags), true);

// Length variance and scope checks.
check('TEST-SEGCHK-010', 'a big as-built variance warns',
      /differs from design by/.test(segmentFor('HH-001', 'HH-002', {
        design_length: '400', as_built_length: '700',
      }).flags), true);
check('TEST-SEGCHK-011', 'a small variance does not',
      /differs from design by/.test(segmentFor('HH-001', 'HH-002', {
        design_length: '400', as_built_length: '420',
      }).flags), false);
check('TEST-SEGCHK-012', 'a zero design length cannot divide by zero',
      segmentFor('HH-001', 'HH-002', {
        design_length: '0', as_built_length: '500',
      }).invalids.length, 0);
check('TEST-SEGCHK-013', 'an out-of-scope conduit diameter warns',
      /outside the 1.25 \/ 2 \/ 4/.test(segmentFor('HH-001', 'HH-002', {
        segment_type: 'Underground Conduit', conduit_diameter: '0.75',
      }).flags), true);
check('TEST-SEGCHK-014', 'an in-scope diameter does not',
      /outside the 1.25/.test(segmentFor('HH-001', 'HH-002', {
        segment_type: 'Underground Conduit', conduit_diameter: '2',
      }).flags), false);

// A complete segment with no as-built length has nothing to check against.
seg.reset({ from_structure_id: 'HH-001', to_structure_id: 'HH-002',
            segment_type: 'Underground Conduit' });
seg.setStatus('COMPLETE');
seg.fire('validate-record');
check('TEST-SEGCHK-020', 'complete with no as-built length warns',
      /no as-built length recorded/.test(seg.get('exception_flags') || ''), true);

// ------------------------- the two apps must agree on a segment's identity
// The production app derives segment_id from free-text From/To; the segment app
// derives it from linked structure IDs. If the two normalizers ever diverge, a
// production record and its segment would disagree about the same path.
const prod = load('mainline-construction-dev.js');
const prodPair = prod.fn('normalizedPair');
const segPair = seg.fn('normalizedPair');
const CASES = [
  ['HH-001', 'HH-002'], ['HH-002', 'HH-001'], ['hh-1', 'HH-2'],
  [' PL-050 ', 'HH-002'], ['A', 'B'], ['B', 'A'], ['Z-9', 'Z-10'],
  ['', 'HH-2'], ['HH-1', ''], [null, null],
];
const disagree = CASES.filter(([a, b]) =>
  JSON.stringify(prodPair(a, b)) !== JSON.stringify(segPair(a, b)));
check('TEST-SEGID-040', 'production and segment apps normalize identically',
      disagree, []);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
