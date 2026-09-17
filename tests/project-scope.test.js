/**
 * Sprint 9 - project scope, authorized scope and change orders.
 *
 * The arithmetic ships as SQL (reports/project-scope-status.sql), which cannot
 * be executed here. So the rules are modelled once in JS, exercised against the
 * brief's own test cases 23.18 - 23.21, and then a second block asserts that
 * the shipped SQL still contains each guard the model relies on. That is the
 * same tactic used for the m117 expression: if the SQL and the model drift, a
 * test fails rather than a number quietly going wrong.
 */
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function check(id, label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${id} ${label}`); }
  else { fail++; console.log(`FAIL  ${id} ${label}\n      got=${a}\n      want=${e}`); }
}

// ---------------------------------------------------------------- the model
// Mirrors reports/project-scope-status.sql.

const APPROVED_CO = ['APPROVED'];
const PENDING_CO  = ['DRAFT', 'SUBMITTED'];
const APPROVED_PRODUCTION = ['APPROVED'];
const PENDING_PRODUCTION  = ['SUBMITTED', 'UNDER REVIEW'];

function scopeStatus(completed, authorized) {
  if (completed > authorized)  return 'OVER PLAN';
  if (authorized === 0)        return 'NO AUTHORIZED SCOPE';
  if (completed === 0)         return 'NOT STARTED';
  if (completed >= authorized) return 'COMPLETE';
  return 'IN PROGRESS';
}

function scopeRow(opts) {
  const baseline = opts.originalPlanned;
  const rate = opts.budgetRate == null ? 0 : opts.budgetRate;
  const changeOrders = opts.changeOrders || [];
  const production = opts.production || [];

  const sum = (rows, states, field) => rows
    .filter((r) => states.indexOf(r.status) !== -1)
    .reduce((t, r) => t + (r[field] || 0), 0);

  const approvedChange = sum(changeOrders, APPROVED_CO, 'quantityChange');
  const pendingChange  = sum(changeOrders, PENDING_CO, 'quantityChange');
  const authorized     = baseline + approvedChange;

  const completed = sum(production, APPROVED_PRODUCTION, 'quantity');
  const pending   = sum(production, PENDING_PRODUCTION, 'quantity');
  const completedValue = sum(production, APPROVED_PRODUCTION, 'value');

  return {
    originalPlanned: baseline,          // never overwritten (23.21)
    approvedChange,
    pendingChange,                      // visible, but not in authorized
    authorized,
    completed,                          // APPROVED production only (23.19)
    pending,                            // reported separately (23.19)
    remaining: authorized - completed,  // never clamped (23.20)
    percentComplete: authorized === 0
      ? null                            // guarded, not an error or a fake 0
      : Math.round((completed / authorized) * 10000) / 100,
    overPlan: completed > authorized ? completed - authorized : 0,
    authorizedValue: Math.round(authorized * rate * 100) / 100,
    completedValue: Math.round(completedValue * 100) / 100,
    remainingValue: Math.round((authorized * rate - completedValue) * 100) / 100,
    status: scopeStatus(completed, authorized),
  };
}

// ------------------------------------------------ 23.18 project scope testing
// 10,000 FT planned, 2,500 FT approved -> 2,500 completed, 7,500 remaining, 25%
let r = scopeRow({
  originalPlanned: 10000, budgetRate: 10,
  production: [{ status: 'APPROVED', quantity: 2500, value: 25000 }],
});
check('TEST-SCOPE-001', 'completed is the approved quantity', r.completed, 2500);
check('TEST-SCOPE-002', 'remaining is planned minus completed', r.remaining, 7500);
check('TEST-SCOPE-003', 'percent complete is 25', r.percentComplete, 25);
check('TEST-SCOPE-004', 'status is IN PROGRESS', r.status, 'IN PROGRESS');
check('TEST-SCOPE-005', 'authorized value', r.authorizedValue, 100000);
check('TEST-SCOPE-006', 'remaining value', r.remainingValue, 75000);

// ------------------------------------------------- 23.19 pending production
// Pending must NOT inflate completed, and must be visible on its own.
r = scopeRow({
  originalPlanned: 10000, budgetRate: 10,
  production: [
    { status: 'APPROVED', quantity: 2500, value: 25000 },
    { status: 'SUBMITTED', quantity: 1000, value: 10000 },
  ],
});
check('TEST-SCOPE-010', 'pending does not move completed', r.completed, 2500);
check('TEST-SCOPE-011', 'pending is reported separately', r.pending, 1000);
check('TEST-SCOPE-012', 'remaining ignores pending', r.remaining, 7500);
check('TEST-SCOPE-013', 'percent complete ignores pending', r.percentComplete, 25);
// Under review is pending too - it has not been approved by anybody yet.
r = scopeRow({
  originalPlanned: 10000,
  production: [{ status: 'UNDER REVIEW', quantity: 900 }],
});
check('TEST-SCOPE-014', 'under review counts as pending', r.pending, 900);
check('TEST-SCOPE-015', 'under review is not completed', r.completed, 0);
check('TEST-SCOPE-016', 'nothing approved yet is NOT STARTED', r.status, 'NOT STARTED');
// Rejected and void production counts as neither.
r = scopeRow({
  originalPlanned: 10000,
  production: [{ status: 'REJECTED', quantity: 500 }, { status: 'VOID', quantity: 700 }],
});
check('TEST-SCOPE-017', 'rejected production is not completed', r.completed, 0);
check('TEST-SCOPE-018', 'rejected production is not pending either', r.pending, 0);

// ------------------------------------------------------- 23.20 over-plan test
// 10,000 planned, 10,500 approved -> remaining -500, OVER PLAN, NOT clamped.
r = scopeRow({
  originalPlanned: 10000, budgetRate: 10,
  production: [{ status: 'APPROVED', quantity: 10500, value: 105000 }],
});
check('TEST-SCOPE-020', 'remaining goes negative', r.remaining, -500);
check('TEST-SCOPE-021', 'remaining is not clamped to zero', r.remaining < 0, true);
check('TEST-SCOPE-022', 'status is OVER PLAN', r.status, 'OVER PLAN');
check('TEST-SCOPE-023', 'the overage is quantified', r.overPlan, 500);
check('TEST-SCOPE-024', 'percent complete exceeds 100', r.percentComplete, 105);
check('TEST-SCOPE-025', 'remaining value goes negative too', r.remainingValue, -5000);

// Exactly on plan is COMPLETE, not OVER PLAN.
r = scopeRow({
  originalPlanned: 10000,
  production: [{ status: 'APPROVED', quantity: 10000 }],
});
check('TEST-SCOPE-026', 'exactly on plan is COMPLETE', r.status, 'COMPLETE');
check('TEST-SCOPE-027', 'exactly on plan has no overage', r.overPlan, 0);
check('TEST-SCOPE-028', 'exactly on plan is 100 percent', r.percentComplete, 100);

// ---------------------------------------------------- 23.21 change order test
// Original 10,000 + approved CO +2,000 -> authorized 12,000.
r = scopeRow({
  originalPlanned: 10000, budgetRate: 10,
  changeOrders: [{ status: 'APPROVED', quantityChange: 2000 }],
  production: [{ status: 'APPROVED', quantity: 2500, value: 25000 }],
});
check('TEST-CO-001', 'approved change moves authorized scope', r.authorized, 12000);
check('TEST-CO-002', 'the baseline is untouched', r.originalPlanned, 10000);
check('TEST-CO-003', 'remaining uses the authorized figure', r.remaining, 9500);
check('TEST-CO-004', 'authorized value follows', r.authorizedValue, 120000);
check('TEST-CO-005', 'original + approved = authorized',
      r.originalPlanned + r.approvedChange, r.authorized);

// A pending change order must NOT move the authorized scope.
r = scopeRow({
  originalPlanned: 10000,
  changeOrders: [{ status: 'SUBMITTED', quantityChange: 2000 }],
});
check('TEST-CO-010', 'submitted change does not move authorized', r.authorized, 10000);
check('TEST-CO-011', 'but it is visible', r.pendingChange, 2000);
r = scopeRow({
  originalPlanned: 10000,
  changeOrders: [{ status: 'DRAFT', quantityChange: 5000 }],
});
check('TEST-CO-012', 'draft change does not move authorized', r.authorized, 10000);
check('TEST-CO-013', 'draft change is visible as pending', r.pendingChange, 5000);

// Rejected and cancelled are excluded from BOTH authorized and pending: they
// are dead, and showing them as "coming soon" would mislead.
r = scopeRow({
  originalPlanned: 10000,
  changeOrders: [
    { status: 'REJECTED', quantityChange: 2000 },
    { status: 'CANCELLED', quantityChange: 3000 },
  ],
});
check('TEST-CO-014', 'rejected change is excluded', r.authorized, 10000);
check('TEST-CO-015', 'cancelled change is excluded', r.approvedChange, 0);
check('TEST-CO-016', 'neither shows as pending', r.pendingChange, 0);

// Approving it afterwards moves the scope, and the baseline still reads 10,000.
r = scopeRow({
  originalPlanned: 10000,
  changeOrders: [{ status: 'APPROVED', quantityChange: 2000 }],
});
check('TEST-CO-017', 'once approved the scope updates', r.authorized, 12000);
check('TEST-CO-018', 'the original baseline remains available', r.originalPlanned, 10000);

// A descope is a negative change order, never an edit to the baseline.
r = scopeRow({
  originalPlanned: 10000, budgetRate: 10,
  changeOrders: [{ status: 'APPROVED', quantityChange: -2500 }],
  production: [{ status: 'APPROVED', quantity: 7500, value: 75000 }],
});
check('TEST-CO-020', 'a descope reduces authorized scope', r.authorized, 7500);
check('TEST-CO-021', 'the baseline still shows the original', r.originalPlanned, 10000);
check('TEST-CO-022', 'a descoped line can read COMPLETE', r.status, 'COMPLETE');

// Several approved orders accumulate; mixed statuses do not interfere.
r = scopeRow({
  originalPlanned: 10000,
  changeOrders: [
    { status: 'APPROVED', quantityChange: 2000 },
    { status: 'APPROVED', quantityChange: -500 },
    { status: 'SUBMITTED', quantityChange: 9999 },
    { status: 'REJECTED', quantityChange: 8888 },
  ],
});
check('TEST-CO-030', 'approved orders accumulate', r.approvedChange, 1500);
check('TEST-CO-031', 'authorized reflects only the approved ones', r.authorized, 11500);
check('TEST-CO-032', 'pending is reported but separate', r.pendingChange, 9999);

// A descope that removes all of the scope must not blow up percent complete.
r = scopeRow({
  originalPlanned: 10000,
  changeOrders: [{ status: 'APPROVED', quantityChange: -10000 }],
});
check('TEST-CO-033', 'fully descoped authorized is zero', r.authorized, 0);
check('TEST-CO-034', 'percent complete is null, not a division error',
      r.percentComplete, null);
check('TEST-CO-035', 'status says there is no authorized scope',
      r.status, 'NO AUTHORIZED SCOPE');

// ------------------------------------------------- division by zero (0.11)
r = scopeRow({ originalPlanned: 0 });
check('TEST-SCOPE-040', 'zero planned gives null percent, not NaN',
      r.percentComplete, null);
r = scopeRow({
  originalPlanned: 0,
  production: [{ status: 'APPROVED', quantity: 300 }],
});
check('TEST-SCOPE-041', 'production against zero scope is OVER PLAN', r.status, 'OVER PLAN');
check('TEST-SCOPE-042', 'and the whole quantity is the overage', r.overPlan, 300);
check('TEST-SCOPE-043', 'percent complete stays null rather than infinite',
      r.percentComplete, null);

// ----------------------------------------- the shipped SQL keeps these rules
// The model above is only trustworthy while the SQL agrees with it.
const sql = fs.readFileSync(
  path.join(__dirname, '..', 'reports', 'project-scope-status.sql'), 'utf8');

check('TEST-SQL-001', 'only APPROVED change orders are counted',
      /co\._status\s*=\s*'APPROVED'/.test(sql), true);
check('TEST-SQL-002', 'pending change orders are read separately',
      /co\._status\s+IN\s*\('DRAFT',\s*'SUBMITTED'\)/.test(sql), true);
check('TEST-SQL-003', 'completed counts APPROVED production only',
      /WHEN _status = 'APPROVED' THEN COALESCE\(quantity, 0\)/.test(sql), true);
check('TEST-SQL-004', 'pending production is summed into its own column',
      /WHEN _status IN \('SUBMITTED', 'UNDER REVIEW'\)/.test(sql), true);
check('TEST-SQL-005', 'percent complete guards division by zero',
      /WHEN authorized_quantity = 0 THEN NULL/.test(sql), true);
check('TEST-SQL-006', 'remaining is a plain subtraction, never clamped',
      /authorized_quantity - completed_quantity\s+AS remaining_qty/.test(sql), true);
check('TEST-SQL-007', 'remaining_qty is not wrapped in GREATEST',
      /GREATEST\([^)]*remaining/i.test(sql), false);
check('TEST-SQL-008', 'authorized is baseline plus approved change',
      /original_planned_quantity \+ COALESCE\(ac\.approved_quantity_change, 0\)/.test(sql), true);
check('TEST-SQL-009', 'the baseline is reported alongside the authorized figure',
      /original_planned_quantity\s+AS original_planned_qty/.test(sql), true);
check('TEST-SQL-010', 'OVER PLAN is derived', /'OVER PLAN'/.test(sql), true);
check('TEST-SQL-011', 'draft scope lines are excluded from scope',
      /_status IN \('BASELINED', 'CLOSED'\)/.test(sql), true);
// The Query API names tables by form ID and exposes status as _status. Getting
// either wrong makes a report that simply does not run.
check('TEST-SQL-012', 'no table is referenced by form name',
      /FROM "MC |FROM "Mainline /.test(sql), false);
check('TEST-SQL-013', 'status is read as _status everywhere',
      /[^_]\bstatus\s*(=|IN|<>)/.test(sql.replace(/--.*$/gm, '')), false);

const unplanned = fs.readFileSync(
  path.join(__dirname, '..', 'reports', 'unplanned-production.sql'), 'utf8');
check('TEST-SQL-020', 'unplanned production is found by an anti-join',
      /WHERE s\.labor_code IS NULL/.test(unplanned), true);
check('TEST-SQL-021', 'unplanned production with value booked is CRITICAL',
      /p\.value > 0 THEN 'CRITICAL'/.test(unplanned), true);

const overlap = fs.readFileSync(
  path.join(__dirname, '..', 'reports', 'sequential-overlap.sql'), 'utf8');
check('TEST-SQL-030', 'the overlap report was corrected to _status',
      /AND _status <> 'VOID'/.test(overlap), true);
check('TEST-SQL-031', 'the overlap report no longer names a table by form name',
      /FROM "Mainline Construction - Development"/.test(overlap), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
