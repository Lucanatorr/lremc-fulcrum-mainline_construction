/**
 * Sprint 27 - scripts/audit_history_check.py, the "has history unexpectedly
 * changed?" comparison, against fixtures built to cover each kind of change.
 */
const { spawnSync } = require('child_process');
const path = require('path');

let pass = 0, fail = 0;
function check(id, label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${id} ${label}`); }
  else { fail++; console.log(`FAIL  ${id} ${label}\n      got=${a}\n      want=${e}`); }
}
const root = path.join(__dirname, '..');
const run = (...a) => spawnSync('python3', ['scripts/audit_history_check.py', ...a], { cwd: root, encoding: 'utf8' });
const lines = r => r.stdout.split('\n').filter(l => /^(CLOSED|open)\s/.test(l)).map(l => l.split(/\s+/).slice(0, 3).join(' '));

const r = run('tests/fixtures/history-2026-10-31.json', 'tests/fixtures/history-2026-11-30.json', '--open-from', '2026-11');
check('TEST-HIST-001', 'a change in a closed period fails the review', r.status, 1);
check('TEST-HIST-002', 'each kind of difference is classified, by period',
      lines(r), ['CLOSED REMOVED PRODUCTION/PRJ-000001/CON-0001/2026-08/EA',
                 'CLOSED CHANGED PRODUCTION/PRJ-000001/CON-0001/2026-10/FT',
                 'open ADDED PRODUCTION/PRJ-000001/CON-0001/2026-11/FT']);
check('TEST-HIST-003', 'an unchanged fingerprint is not reported', /2026-09/.test(r.stdout), false);
check('TEST-HIST-004', 'the value delta is shown', /value \+800\.00/.test(r.stdout), true);

const o = run('tests/fixtures/history-2026-10-31.json', 'tests/fixtures/history-2026-11-30.json', '--open-from', '2026-08');
check('TEST-HIST-005', 'differences only in open periods pass', o.status, 0);

const c = run('tests/fixtures/history-2026-10-31.json', 'tests/fixtures/history-2026-11-30.csv', '--open-from', '2026-11');
check('TEST-HIST-006', 'a CSV export from the Query UI compares the same as JSON', lines(c), lines(r));

const s = run('data/audit-snapshots/2026-11-12-history.json', 'data/audit-snapshots/2026-11-12-history.json');
check('TEST-HIST-007', 'the committed first snapshot loads and compares clean', s.status, 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
