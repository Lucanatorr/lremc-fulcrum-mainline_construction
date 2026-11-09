/**
 * OI-03 / D-018 - reopening, reversing and adjusting approved production,
 * plus the calc_version stamp (OI-08 / D-019) and QA ownership (OI-10).
 * Runs against the authoritative Data Events source via tests/harness.js.
 */
const { load } = require('./harness.js');

let pass = 0, fail = 0;
function check(id, label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${id} ${label}`); }
  else { fail++; console.log(`FAIL  ${id} ${label}\n      got=${a}\n      want=${e}`); }
}

// Clean, approvable production - the same baseline approval-workflow uses.
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
const flags = () => String(h.get('exception_flags') || '');

function validate(status, extra) {
  h.reset(cleanRecord(extra));
  h.setStatus(status);
  h.fire('validate-record');
  return h;
}

// ------------------------------------------------------------------- REOPENED
// Reopening approved production drops the approval stamp: every report reads
// that stamp to decide production counts, so a reopened record must not.
h.reset(cleanRecord({ approved_by: 'Reviewer', approved_date: '2026-09-16T12:00:00Z' }));
h.setStatus('REOPENED');
h.fire('change-status');
check('TEST-LIFE-001', 'reopening clears the approval stamp', [h.get('approved_by'), h.get('approved_date')], [null, null]);
check('TEST-LIFE-002', 'reopening stamps who reopened it', h.get('reopened_by'), 'Test User');
check('TEST-LIFE-003', 'reopening stamps when', !!h.get('reopened_date'), true);
check('TEST-LIFE-004', 'a reopen reason is required', h.field('reopen_reason').required, true);
check('TEST-LIFE-005', 'a reopened record is editable again', h.field('quantity').readonly, false);

validate('REOPENED', { reopen_reason: null });
check('TEST-LIFE-006', 'reopening with no reason is refused', h.invalids.some(m => /reopened/.test(m)), true);
validate('REOPENED', { reopen_reason: 'Quantity transposed on the paperwork' });
check('TEST-LIFE-007', 'reopening with a reason saves', h.invalids.length, 0);

// The approval gate still applies on the way back to APPROVED.
validate('APPROVED', { reopen_reason: 'x', qa_status: 'Not Reviewed' });
check('TEST-LIFE-008', 're-approval still passes through the QA gate', h.invalids.length > 0, true);

// ------------------------------------------------------------------- REVERSED
h.reset(cleanRecord({ approved_by: 'Reviewer', approved_date: '2026-09-16T12:00:00Z' }));
h.setStatus('REVERSED');
h.fire('change-status');
check('TEST-LIFE-010', 'reversing KEEPS the approval stamp as evidence', h.get('approved_date'), '2026-09-16T12:00:00Z');
check('TEST-LIFE-011', 'reversing stamps who reversed it', h.get('reversed_by'), 'Test User');
check('TEST-LIFE-012', 'reversing stamps when', !!h.get('reversed_date'), true);
check('TEST-LIFE-013', 'a reversal reason is required', h.field('reversal_reason').required, true);
check('TEST-LIFE-014', 'a reversed record is locked', [h.field('quantity').readonly, h.field('labor_code').readonly, h.field('rate_link').readonly], [true, true, true]);

validate('REVERSED', { approved_date: null, reversal_reason: 'Duplicate entry' });
check('TEST-LIFE-015', 'never-approved production cannot be reversed', h.invalids.some(m => /use VOID instead/.test(m)), true);
validate('REVERSED', { approved_date: '2026-09-16T12:00:00Z', reversal_reason: null });
check('TEST-LIFE-016', 'reversing with no reason is refused', h.invalids.some(m => /reversed/.test(m)), true);
validate('REVERSED', { approved_date: '2026-09-16T12:00:00Z', reversal_reason: 'Billed twice' });
check('TEST-LIFE-017', 'a reasoned reversal of approved production saves', h.invalids.length, 0);

// A reopened record lost its stamp, so it is no longer approved production and
// cannot be reversed - it must be re-approved or voided.
h.reset(cleanRecord({ approved_date: '2026-09-16T12:00:00Z' }));
h.setStatus('REOPENED'); h.fire('change-status');
h.set({ reversal_reason: 'x' }); h.setStatus('REVERSED'); h.fire('validate-record');
check('TEST-LIFE-018', 'a reopened (unapproved) record cannot then be reversed', h.invalids.some(m => /use VOID instead/.test(m)), true);

// ----------------------------------------------------------------- ADJUSTMENT
validate('DRAFT', { quantity: '-120' });
check('TEST-LIFE-020', 'a negative quantity on an original record is CRITICAL', /\[CRITICAL\] Negative quantity/.test(flags()), true);

check('TEST-LIFE-019', 'a negative quantity on an original record is refused outright', h.invalids.some(m => /negative quantity is not production/.test(m)), true);
validate('DRAFT', { quantity: '-120', production_type: 'Adjustment', adjusts_production_id: 'PRD-2026-ABCD1234', adjustment_reason: 'Over-measured' });
check('TEST-LIFE-021', 'a negative quantity is valid on an Adjustment', /Negative quantity/.test(flags()), false);
check('TEST-LIFE-022', 'a complete adjustment raises no CRITICAL', h.get('exception_severity') === 'CRITICAL', false);
check('TEST-LIFE-028', 'and a negative adjustment saves', h.invalids, []);

validate('DRAFT', { quantity: '-120', production_type: 'Adjustment', adjusts_production_id: null, adjustment_reason: 'x' });
check('TEST-LIFE-023', 'an adjustment must name the original', /no original Production ID/.test(flags()), true);
validate('DRAFT', { quantity: '-120', production_type: 'Adjustment', adjusts_production_id: 'PRD-1', adjustment_reason: null });
check('TEST-LIFE-024', 'an adjustment must give a reason', /Adjustment with no reason/.test(flags()), true);
validate('DRAFT', { production_type: 'Adjustment', production_id: 'PRD-2026-SELF0001', adjusts_production_id: 'prd-2026-self0001', adjustment_reason: 'x' });
check('TEST-LIFE-025', 'an adjustment cannot adjust itself (case-insensitive)', /cannot adjust itself/.test(flags()), true);

validate('APPROVED', { quantity: '-120', production_type: 'Adjustment', adjusts_production_id: null, adjustment_reason: null });
check('TEST-LIFE-026', 'an incomplete adjustment cannot be approved', h.invalids.some(m => /CRITICAL exception/.test(m)), true);

h.reset(cleanRecord({ production_type: 'Adjustment' }));
h.fire('change:production_type');
check('TEST-LIFE-027', 'choosing Adjustment makes reference and reason required',
      [h.field('adjusts_production_id').required, h.field('adjustment_reason').required], [true, true]);

// --------------------------------------------------------- calc_version (D-019)
validate('DRAFT', { calc_version: 'DE-7.3.0' });
check('TEST-LIFE-030', 'calc_version records the version that last calculated the record', h.get('calc_version'), 'DE-7.6.0');

// ------------------------------------------------------- QA ownership (OI-10)
validate('DRAFT', { qa_status: 'Fail', qa_owner: null, qa_due_date: null });
check('TEST-LIFE-040', 'a failed QA with no owner is flagged', /no owner assigned/.test(flags()), true);
check('TEST-LIFE-041', 'a failed QA with no due date is flagged', /no due date/.test(flags()), true);
validate('DRAFT', { qa_status: 'Fail', qa_owner: 'R. Locklear', qa_due_date: '2020-01-01', correction_completed: 'no' });
check('TEST-LIFE-042', 'an overdue, uncorrected deficiency is flagged', /past its due date/.test(flags()), true);
validate('DRAFT', { qa_status: 'Fail', qa_owner: 'R. Locklear', qa_due_date: '2020-01-01', correction_completed: 'yes' });
check('TEST-LIFE-043', 'a corrected deficiency is not overdue', /past its due date/.test(flags()), false);
validate('DRAFT', { qa_status: 'Pass', qa_owner: null, qa_due_date: null });
check('TEST-LIFE-044', 'a passing record needs no QA owner', /no owner assigned|no due date/.test(flags()), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
