/**
 * Sprint 13 - production fingerprints and the persistent production ID.
 * Runs against the authoritative Data Events source via tests/harness.js.
 */
const { load } = require('./harness.js');

let pass = 0, fail = 0;
function check(id, label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${id} ${label}`); }
  else { fail++; console.log(`FAIL  ${id} ${label}\n      got=${a}\n      want=${e}`); }
}

const h = load('mainline-construction-dev.js');

function fingerprint(rec) {
  h.reset(Object.assign({
    project_id_snapshot: 'PRJ-000001',
    contractor_id_snapshot: 'CON-0001',
    work_date: '2026-09-15',
    labor_code: 'BFO.48.I',
  }, rec));
  h.fire('validate-record');
  return {
    strict: h.get('fingerprint_strict'),
    segment: h.get('fingerprint_segment'),
    strength: h.get('fingerprint_strength'),
  };
}

// ------------------------------------------------ the same pull, either way
// A crew pulling from HH-2 back to HH-1, or recording the sequential range
// backwards, is describing the same physical cable. Both must fingerprint
// identically or the duplicate check is defeated by the direction of travel.
const forward = fingerprint({
  cable_id: 'C-100', starting_sequential: '1000', ending_sequential: '5000',
  from_location: 'HH-1', to_location: 'HH-2',
});
const reversedSeq = fingerprint({
  cable_id: 'C-100', starting_sequential: '5000', ending_sequential: '1000',
  from_location: 'HH-1', to_location: 'HH-2',
});
const reversedStructures = fingerprint({
  cable_id: 'C-100', starting_sequential: '1000', ending_sequential: '5000',
  from_location: 'HH-2', to_location: 'HH-1',
});

check('TEST-FP-001', 'a reversed sequential range fingerprints the same',
      reversedSeq.strict, forward.strict);
check('TEST-FP-002', 'reversed structures fingerprint the same segment',
      reversedStructures.segment, forward.segment);
check('TEST-FP-003', 'reversed structures also fingerprint the same strictly',
      reversedStructures.strict, forward.strict);

// ------------------------------------------- and genuinely different work does not
const differentCable = fingerprint({
  cable_id: 'C-200', starting_sequential: '1000', ending_sequential: '5000',
  from_location: 'HH-1', to_location: 'HH-2',
});
check('TEST-FP-010', 'a different cable is a different fingerprint',
      differentCable.strict === forward.strict, false);

const differentRange = fingerprint({
  cable_id: 'C-100', starting_sequential: '5000', ending_sequential: '9000',
  from_location: 'HH-1', to_location: 'HH-2',
});
check('TEST-FP-011', 'a different range is a different fingerprint',
      differentRange.strict === forward.strict, false);

const differentDay = fingerprint({
  work_date: '2026-09-16', cable_id: 'C-100',
  starting_sequential: '1000', ending_sequential: '5000',
});
check('TEST-FP-012', 'a different day is a different fingerprint',
      differentDay.strict === forward.strict, false);

const differentContractor = fingerprint({
  contractor_id_snapshot: 'CON-0002', cable_id: 'C-100',
  starting_sequential: '1000', ending_sequential: '5000',
});
check('TEST-FP-013', 'a different contractor is a different fingerprint',
      differentContractor.strict === forward.strict, false);

const differentCode = fingerprint({
  labor_code: 'BFO.144.I', cable_id: 'C-100',
  starting_sequential: '1000', ending_sequential: '5000',
});
check('TEST-FP-014', 'a different pay unit is a different fingerprint',
      differentCode.strict === forward.strict, false);

const differentSegment = fingerprint({
  from_location: 'HH-3', to_location: 'HH-4',
});
const baseSegment = fingerprint({ from_location: 'HH-1', to_location: 'HH-2' });
check('TEST-FP-015', 'a different segment is a different segment fingerprint',
      differentSegment.segment === baseSegment.segment, false);

// -------------------------- a blank component must not collide with another
// Two records each missing a DIFFERENT field would produce the same string if
// blanks were empty, and would look like duplicates of each other.
const noCable = fingerprint({ starting_sequential: '1000', ending_sequential: '5000' });
const noRange = fingerprint({ cable_id: 'C-100' });
check('TEST-FP-020', 'a missing cable and a missing range do not collide',
      noCable.strict === noRange.strict, false);
check('TEST-FP-021', 'an absent component is marked, not empty',
      /~/.test(noCable.strict), true);
check('TEST-FP-022', 'a half-recorded range contributes nothing',
      fingerprint({ cable_id: 'C-100', starting_sequential: '1000' }).strict,
      noRange.strict);

// A time on the work date must not split one day's work into two fingerprints.
check('TEST-FP-023', 'the work date is used as a day, not a timestamp',
      fingerprint({
        work_date: '2026-09-15T14:30:00', cable_id: 'C-100',
        starting_sequential: '1000', ending_sequential: '5000',
        from_location: 'HH-1', to_location: 'HH-2',
      }).strict, forward.strict);

// Case and spacing must not create a second identity.
check('TEST-FP-024', 'case and spacing are normalized',
      fingerprint({ cable_id: ' c-100 ', starting_sequential: '1000',
                    ending_sequential: '5000', from_location: 'hh-1',
                    to_location: ' HH-2' }).strict, forward.strict);

// The delimiter must not be forgeable from field content.
check('TEST-FP-025', 'a pipe inside a value cannot fake a delimiter',
      /\|\|/.test(fingerprint({ cable_id: 'A|B' }).strict), false);

// ------------------------------------------------------------- strength
check('TEST-FP-030', 'a fully recorded record scores 6', forward.strength, 6);
check('TEST-FP-031', 'project, contractor, day and code alone score 4',
      fingerprint({}).strength, 4);
check('TEST-FP-032', 'a record with only a project and a day is weak',
      fingerprint({ contractor_id_snapshot: null, labor_code: null }).strength, 2);

// A weak record must be flagged, not silently left unchecked.
h.reset({
  project_id_snapshot: 'PRJ-000001', work_date: '2026-09-15',
  quantity: '100', rate_source_id: 'R1', contractor_rate: '3',
  qa_photos: 'p.jpg', from_location: 'A', to_location: 'B',
});
h.fire('validate-record');
check('TEST-FP-033', 'a record too sparse to fingerprint is flagged',
      /cannot be reliably duplicate-checked/.test(h.get('exception_flags') || ''), true);

h.reset({
  project_id_snapshot: 'PRJ-000001', contractor_id_snapshot: 'CON-0001',
  work_date: '2026-09-15', labor_code: 'BFO.48.I', cable_id: 'C-100',
  starting_sequential: '1000', ending_sequential: '5000',
  quantity: '4000', unit: 'FT', rate_source_id: 'R1', contractor_rate: '3',
  rate_labor_code_snap: 'BFO.48.I', rate_contractor_id_snap: 'CON-0001',
  rate_effective_date: '2026-01-01', qa_photos: 'p.jpg',
  from_location: 'HH-1', to_location: 'HH-2', qa_status: 'Pass',
});
h.fire('validate-record');
check('TEST-FP-034', 'a well-recorded record is not flagged as unverifiable',
      /cannot be reliably duplicate-checked/.test(h.get('exception_flags') || ''), false);

// ---------------------------------------------- the persistent production ID
h.reset({ work_date: '2026-09-15', __record_id: 'abc-1234-def-56789012' });
h.fire('validate-record');
const firstId = h.get('production_id');
check('TEST-PID-001', 'an ID is assigned', typeof firstId === 'string' && firstId.length > 0, true);
check('TEST-PID-002', 'it carries the work year', /^PRD-2026-/.test(firstId), true);
check('TEST-PID-003', 'it derives from the platform record ID',
      firstId, 'PRD-2026-56789012');

// The brief: "Do not generate a new identifier every time a record is edited."
h.fire('validate-record');
h.fire('validate-record');
check('TEST-PID-010', 'repeated saves do not regenerate it', h.get('production_id'), firstId);

h.set({ work_date: '2027-01-01', quantity: '999' });
h.fire('validate-record');
check('TEST-PID-011', 'editing the work date does not regenerate it',
      h.get('production_id'), firstId);

// Two records, two record IDs, two production IDs.
h.reset({ work_date: '2026-09-15', __record_id: 'zzz-9999-aaa-11112222' });
h.fire('validate-record');
check('TEST-PID-012', 'a different record gets a different ID',
      h.get('production_id'), 'PRD-2026-11112222');

// With no platform record ID yet, the fallback must still be unique per device:
// a bare timestamp would let two devices saving in the same millisecond collide.
h.reset({ work_date: '2026-09-15', __email: 'jsmith@lremc.com' });
h.fire('validate-record');
const fallbackA = h.get('production_id');
h.reset({ work_date: '2026-09-15', __email: 'bjones@lremc.com' });
h.fire('validate-record');
const fallbackB = h.get('production_id');
check('TEST-PID-020', 'the fallback includes a device marker',
      /^PRD-2026-JSM/.test(fallbackA), true);
check('TEST-PID-021', 'two devices cannot collide on the fallback',
      fallbackA === fallbackB, false);
check('TEST-PID-022', 'the fallback is not random per save', (() => {
  h.reset({ work_date: '2026-09-15', __email: 'jsmith@lremc.com' });
  h.fire('validate-record');
  const once = h.get('production_id');
  h.fire('validate-record');
  return h.get('production_id') === once;
})(), true);

// ----------------------------------------------- the header must not lie
// Both the v6 and v7 header edits once silently no-opped because the search
// string did not match, leaving a file that behaved as v7 while its header
// claimed v5. The behaviour tests all passed throughout, so only this catches it.
const fs = require('fs');
const path = require('path');
const src = fs.readFileSync(
  path.join(__dirname, '..', 'fulcrum', 'data-events', 'mainline-construction-dev.js'), 'utf8');
const declared = (/Data Events - (v\d+\.\d+\.\d+)/.exec(src) || [])[1];
check('TEST-VER-001', 'the script declares a version', typeof declared, 'string');
check('TEST-VER-002', 'the header declares v7.0.0', declared, 'v7.0.0');
check('TEST-VER-003', 'v7 behaviour is actually present',
      /function buildFingerprints/.test(src), true);
check('TEST-VER-004', 'v6 behaviour is actually present',
      /function enforceApprovalGate/.test(src), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
