/**
 * Sprint 12 - QA/QC and the approval gate.
 * Runs against the authoritative Data Events source via tests/harness.js.
 */
const { load } = require('./harness.js');

let pass = 0, fail = 0;
function check(id, label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${id} ${label}`); }
  else { fail++; console.log(`FAIL  ${id} ${label}\n      got=${a}\n      want=${e}`); }
}

// A record that is clean apart from whatever a test changes.
function cleanRecord(extra) {
  return Object.assign({
    labor_code: 'BM60(1)(1.25) P',
    quantity: '500',
    unit: 'FT',
    work_category: 'Underground',
    work_date: '2026-09-15',
    depth_inches: '40',
    rate_source_id: 'RATE-000051',
    contractor_rate: '3.25',
    rate_labor_code_snap: 'BM60(1)(1.25) P',
    contractor_id_snapshot: 'CON-0001',
    rate_contractor_id_snap: 'CON-0001',
    project_id_snapshot: 'PRJ-0001',
    rate_effective_date: '2026-01-01',
    qa_photos: 'photo.jpg',
    from_location: 'HH-1',
    to_location: 'HH-2',
    qa_status: 'Pass',
  }, extra || {});
}

const h = load('mainline-construction-dev.js');

function run(status, extra) {
  h.reset(cleanRecord(extra));
  h.setStatus(status);
  h.fire('validate-record');
  return h;
}

// ------------------------------------------------- the gate blocks CRITICAL
// An unpriced record cannot be approved: earned value, billing and remaining
// scope are all computed from approved production.
run('APPROVED', { rate_source_id: null, contractor_rate: null });
check('TEST-GATE-001', 'a critical exception blocks approval',
      h.invalids.length > 0, true);
check('TEST-GATE-002', 'the message names the critical exception',
      /CRITICAL exception and cannot be approved/.test(h.invalids[0] || ''), true);
check('TEST-GATE-003', 'the message offers CORRECTION REQUIRED as the route',
      /CORRECTION REQUIRED/.test(h.invalids[0] || ''), true);

// The same record in any pending state saves fine - a blocked save would lose
// the field work that produced it.
for (const [id, status] of [
  ['TEST-GATE-004', 'DRAFT'], ['TEST-GATE-005', 'SUBMITTED'],
  ['TEST-GATE-006', 'UNDER REVIEW'], ['TEST-GATE-007', 'CORRECTION REQUIRED'],
]) {
  run(status, {
    rate_source_id: null, contractor_rate: null,
    correction_detail: 'Rate',
  });
  check(id, `${status} still saves with a critical exception`, h.invalids.length, 0);
}

// ------------------------------------------- warnings never block anything
// The brief: do not reject solely because of a warning.
run('APPROVED', { qa_photos: null });                    // no photos -> WARNING
check('TEST-GATE-010', 'a missing photo is a warning, not a block',
      h.invalids.length, 0);
check('TEST-GATE-011', 'and the warning is still recorded',
      h.get('exception_severity'), 'WARNING');

run('APPROVED', { depth_inches: '30' });                 // shallow -> WARNING
check('TEST-GATE-012', 'below-minimum depth warns without blocking',
      h.invalids.length, 0);

run('APPROVED', { work_date: '2026-09-19', unit: 'HR' }); // Saturday + T&M -> INFO
check('TEST-GATE-013', 'INFO flags never block', h.invalids.length, 0);

// ---------------------------------------------------- QA outcome is required
run('APPROVED', { qa_status: 'Fail' });
check('TEST-GATE-020', 'failed QA blocks approval', h.invalids.length > 0, true);
check('TEST-GATE-021', 'the message explains the consequence',
      /earned value and billing/.test(h.invalids[0] || ''), true);

run('APPROVED', { qa_status: 'Not Reviewed' });
check('TEST-GATE-022', 'an unreviewed record cannot be approved',
      h.invalids.length > 0, true);
check('TEST-GATE-023', 'the message says why',
      /statement that someone looked/.test(h.invalids[0] || ''), true);

run('APPROVED', { qa_status: null });
check('TEST-GATE-024', 'a blank QA status is treated as unreviewed',
      h.invalids.length > 0, true);

run('APPROVED', { qa_status: 'Conditional Pass', correction_detail: 'Restoration' });
check('TEST-GATE-025', 'a conditional pass can be approved', h.invalids.length, 0);
run('APPROVED', { qa_status: 'Pass' });
check('TEST-GATE-026', 'a clean pass can be approved', h.invalids.length, 0);

// ------------------------------------------------------ correction tracking
run('CORRECTION REQUIRED', { correction_detail: null });
check('TEST-CORR-001', 'correction required with no detail is CRITICAL',
      h.get('exception_severity'), 'CRITICAL');
check('TEST-CORR-002', 'the flag says what is missing',
      /nothing states what to correct/.test(h.get('exception_flags') || ''), true);

run('CORRECTION REQUIRED', { correction_detail: 'Photos' });
check('TEST-CORR-003', 'with detail it is not critical',
      /nothing states what to correct/.test(h.get('exception_flags') || ''), false);

run('CORRECTION REQUIRED', {
  correction_detail: 'Photos', correction_completed: 'yes',
});
check('TEST-CORR-004', 'a completed correction prompts a resubmit',
      /resubmit this record for review/.test(h.get('exception_flags') || ''), true);

run('APPROVED', { qa_status: 'Conditional Pass', correction_detail: null });
check('TEST-CORR-005', 'a conditional pass with no condition warns',
      /no condition stated/.test(h.get('exception_flags') || ''), true);
check('TEST-CORR-006', 'but it does not block the approval', h.invalids.length, 0);

// Marking a correction complete stamps who and when; unmarking clears both.
h.reset(cleanRecord({ correction_completed: 'yes' }));
h.fire('change:correction_completed');
check('TEST-CORR-010', 'completing a correction stamps the date',
      h.get('correction_completed_date') !== null, true);
check('TEST-CORR-011', 'and who did it',
      h.get('correction_completed_by'), 'Test User');

h.reset(cleanRecord({
  correction_completed: 'no',
  correction_completed_date: '2026-09-01T00:00:00Z',
  correction_completed_by: 'Someone',
}));
h.fire('change:correction_completed');
check('TEST-CORR-012', 'un-completing clears the date',
      h.get('correction_completed_date'), null);
check('TEST-CORR-013', 'and clears who',
      h.get('correction_completed_by'), null);

// --------------------------------------------------- stamps on status change
h.reset(cleanRecord({}));
h.setStatus('APPROVED');
h.fire('change-status');
check('TEST-STAMP-001', 'approval stamps who', h.get('approved_by'), 'Test User');
check('TEST-STAMP-002', 'approval stamps when', h.get('approved_date') !== null, true);

// Sending an approved record back must strip the approval: that stamp is what
// every downstream report reads to decide the production counts.
h.setStatus('REJECTED');
h.fire('change-status');
check('TEST-STAMP-010', 'rejection clears the approver', h.get('approved_by'), null);
check('TEST-STAMP-011', 'rejection clears the approval date', h.get('approved_date'), null);
check('TEST-STAMP-012', 'rejection records the reviewer', h.get('reviewed_by'), 'Test User');

h.reset(cleanRecord({}));
h.setStatus('APPROVED');
h.fire('change-status');
h.setStatus('CORRECTION REQUIRED');
h.fire('change-status');
check('TEST-STAMP-020', 'correction required clears the approval',
      h.get('approved_date'), null);
check('TEST-STAMP-021', 'and resets the correction-completed flag',
      h.get('correction_completed'), null);
check('TEST-STAMP-022', 'and its date', h.get('correction_completed_date'), null);

// --------------------------------------------------------- new QA flags
run('SUBMITTED', { labor_code: null });
check('TEST-QAFLAG-001', 'a missing labor code is CRITICAL',
      /No labor code/.test(h.get('exception_flags') || ''), true);

run('SUBMITTED', {
  work_category: 'Fiber Placement',
  starting_sequential: null, ending_sequential: null,
});
check('TEST-QAFLAG-002', 'fiber placement with no sequentials warns',
      /no sequentials recorded/.test(h.get('exception_flags') || ''), true);
check('TEST-QAFLAG-003', 'and explains the consequence',
      /cannot be traced back to a reel/.test(h.get('exception_flags') || ''), true);

// A clean record carries no exception severity at all.
run('SUBMITTED', {});
check('TEST-QAFLAG-010', 'a clean record raises nothing',
      h.get('exception_severity'), null);
check('TEST-QAFLAG-011', 'and has no exception text',
      h.get('exception_flags'), null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
