/**
 * Sprint 22 - project closeout workflow.
 * Runs against the shipped Data Events via tests/harness.js.
 */
const { load } = require('./harness.js');

let pass = 0, fail = 0;
function check(id, label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${id} ${label}`); }
  else { fail++; console.log(`FAIL  ${id} ${label}\n      got=${a}\n      want=${e}`); }
}

const h = load('mc-project-closeout-dev.js');

const MILESTONES = [
  'construction_complete', 'fiber_placement_complete', 'splicing_complete',
  'testing_complete', 'restoration_complete', 'qa_complete',
  'as_builts_complete', 'material_reconciliation_complete',
  'contractor_production_approved', 'final_billing_complete',
  'closeout_documents_received',
];
const allDone = () => {
  const o = {};
  for (const m of MILESTONES) o[m] = 'yes';
  return o;
};

check('TEST-CLO-000', 'the brief lists eleven milestones plus the status',
      MILESTONES.length, 11);

// ------------------------------------------------- milestone date stamping
h.reset({});
h.set({ construction_complete: 'yes' });
h.fire('change:construction_complete');
check('TEST-CLO-001', 'ticking a milestone stamps its date',
      typeof h.get('construction_complete_date') === 'string', true);

const stamped = h.get('construction_complete_date');
h.fire('change:construction_complete');
check('TEST-CLO-002', 'and re-firing does not move the date already set',
      h.get('construction_complete_date'), stamped);

h.set({ construction_complete: 'no' });
h.fire('change:construction_complete');
check('TEST-CLO-003', 'un-ticking clears the date, so the record cannot claim both',
      h.get('construction_complete_date'), null);

// Every milestone must have a working handler, not just the first.
for (const m of MILESTONES) {
  check(`TEST-CLO-CH-${m}`, `${m} has a change handler`,
        h.handlerCount(`change:${m}`), 1);
}

// ---------------------------------------------------- closing: the gates
// 1. Readiness review is required before closing at all.
h.reset(allDone()).setStatus('CLOSED');
h.fire('validate-record');
check('TEST-CLO-010', 'closing without the readiness review is blocked',
      h.invalids.length, 1);
check('TEST-CLO-011', 'and the message says which report to run',
      /closeout-readiness\.sql/.test(h.invalids[0] || ''), true);

// 2. With the review done and every milestone ticked, it closes.
h.reset(Object.assign(allDone(), { readiness_reviewed: 'yes' })).setStatus('CLOSED');
h.fire('validate-record');
check('TEST-CLO-012', 'a complete, reviewed project closes', h.invalids, []);

// 3. Outstanding milestones block, and the message names them.
const partial = allDone();
delete partial.final_billing_complete;
delete partial.as_builts_complete;
h.reset(Object.assign(partial, { readiness_reviewed: 'yes' })).setStatus('CLOSED');
h.fire('validate-record');
check('TEST-CLO-013', 'outstanding milestones block the close', h.invalids.length, 1);
check('TEST-CLO-014', 'and the message names them',
      /As-Builts Complete/.test(h.invalids[0]) && /Final Billing Complete/.test(h.invalids[0]), true);
check('TEST-CLO-015', 'and counts them', /2 milestone\(s\) outstanding/.test(h.invalids[0]), true);

// 4. The override is what the brief asks for: allowed, but reasoned.
const partial2 = allDone();
delete partial2.final_billing_complete;
h.reset(Object.assign(partial2, {
  readiness_reviewed: 'yes', closeout_override: 'yes',
  override_reason: 'Final billing deferred to Q1 at the customer request.',
})).setStatus('CLOSED');
h.fire('validate-record');
check('TEST-CLO-016', 'an override with a reason closes over outstanding milestones',
      h.invalids, []);

const partial3 = allDone();
delete partial3.final_billing_complete;
h.reset(Object.assign(partial3, { readiness_reviewed: 'yes', closeout_override: 'yes' }))
 .setStatus('CLOSED');
h.fire('validate-record');
check('TEST-CLO-017', 'an override with NO reason is blocked', h.invalids.length, 1);
check('TEST-CLO-018', 'and the message says why a reason matters',
      /silent close/.test(h.invalids[0] || ''), true);

// A reasonless override is rejected even when nothing else is wrong - the
// override is a claim about judgement, and an unexplained one is worthless.
h.reset(Object.assign(allDone(), { readiness_reviewed: 'yes', closeout_override: 'yes' }))
 .setStatus('OPEN');
h.fire('validate-record');
check('TEST-CLO-019', 'a reasonless override is rejected even before closing',
      h.invalids.length, 1);

// 5. Known blockers recorded at review time must be overridden, not ignored.
h.reset(Object.assign(allDone(), {
  readiness_reviewed: 'yes',
  open_blockers_noted: '3 unapproved production records',
})).setStatus('CLOSED');
h.fire('validate-record');
check('TEST-CLO-020', 'noted blockers block a close that is not an override',
      h.invalids.length, 1);
check('TEST-CLO-021', 'and the message quotes them back',
      /3 unapproved production records/.test(h.invalids[0] || ''), true);

h.reset(Object.assign(allDone(), {
  readiness_reviewed: 'yes',
  open_blockers_noted: '3 unapproved production records',
  closeout_override: 'yes',
  override_reason: 'Accepted by the project owner; the three records are void.',
})).setStatus('CLOSED');
h.fire('validate-record');
check('TEST-CLO-022', 'and an override clears them', h.invalids, []);

// ------------------------------------------------- nothing blocks non-close
for (const st of ['OPEN', 'IN CLOSEOUT', 'READY TO CLOSE']) {
  h.reset({}).setStatus(st);
  h.fire('validate-record');
  check(`TEST-CLO-OPEN-${st.replace(/ /g, '-')}`,
        `an empty record in ${st} is not blocked`, h.invalids, []);
}

// ------------------------------------------------------- status stamping
h.reset(Object.assign(allDone(), { readiness_reviewed: 'yes' })).setStatus('CLOSED');
h.fire('change-status');
check('TEST-CLO-030', 'closing stamps who closed it', h.get('closed_by'), 'Test User');
check('TEST-CLO-031', 'and when', typeof h.get('closed_date') === 'string', true);

h.setStatus('REOPENED');
h.fire('change-status');
check('TEST-CLO-032', 'reopening clears the closed-by stamp', h.get('closed_by'), null);
check('TEST-CLO-033', 'and the closed date, so no report reads a reopened project as closed',
      h.get('closed_date'), null);
check('TEST-CLO-034', 'a reopen requires a reason', h.field('reopen_reason').required, true);

// ------------------------------------------------------- the closeout ID
h.reset({ __record_id: 'abc-1234-def-56789012' });
h.fire('validate-record');
const id1 = h.get('closeout_id');
check('TEST-CLO-040', 'a closeout ID is assigned', /^CLO-\d{4}-56789012$/.test(id1), true);
h.fire('validate-record');
check('TEST-CLO-041', 'and never regenerated', h.get('closeout_id'), id1);

// -------------------------------------------- readiness review attribution
h.reset({});
h.set({ readiness_reviewed: 'yes' });
h.fire('change:readiness_reviewed');
check('TEST-CLO-050', 'the readiness review records who did it',
      h.get('readiness_reviewed_by'), 'Test User');
h.set({ readiness_reviewed: 'no' });
h.fire('change:readiness_reviewed');
check('TEST-CLO-051', 'and clears it when unset', h.get('readiness_reviewed_by'), null);

// --------------------------------------------- runtime-global safety (S19)
const bare = load('mc-project-closeout-dev.js',
                  { omitGlobals: ['USEREMAIL', 'USERFULLNAME', 'RECORDID', 'STATUS'] });
for (const ev of ['load-record', 'edit-record', 'validate-record', 'change-status']) {
  let threw = false;
  try { bare.reset({}).fire(ev); } catch (e) { threw = true; }
  check(`TEST-CLO-RT-${ev}`, `${ev} survives every platform accessor missing`, threw, false);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
