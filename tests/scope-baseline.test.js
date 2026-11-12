/**
 * Sprint 24 gate 6 - scripts/validate_scope_baseline.py, run as the
 * Project Administrator would run it, against two fixtures.
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function check(id, label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${id} ${label}`); }
  else { fail++; console.log(`FAIL  ${id} ${label}\n      got=${a}\n      want=${e}`); }
}
const root = path.join(__dirname, '..');
const run = f => spawnSync('python3', ['scripts/validate_scope_baseline.py', f], { cwd: root, encoding: 'utf8' });

const bad = run('tests/fixtures/scope-baseline-sample.csv');
check('TEST-SCOPE-IMP-001', 'a file with errors exits non-zero', bad.status, 1);
check('TEST-SCOPE-IMP-002', 'a duplicate project/code/phase is an error', /appears twice/.test(bad.stdout), true);
check('TEST-SCOPE-IMP-003', 'an unknown project is an error', /PRJ-000009' is not in the project master/.test(bad.stdout), true);
check('TEST-SCOPE-IMP-004', 'a pay unit with no active rate is an error', /NOT-A-CODE has no ACTIVE rate/.test(bad.stdout), true);
check('TEST-SCOPE-IMP-005', 'a negative baseline is an error (D-010)', /BFO\.12\.I planned quantity '-5'/.test(bad.stdout), true);
check('TEST-SCOPE-IMP-006', 'finish before start is an error', /planned finish 2026-04-01 is before/.test(bad.stdout), true);
check('TEST-SCOPE-IMP-007', 'nothing is written when there are errors',
      fs.existsSync(path.join(root, 'tests/fixtures/scope-baseline-sample.import.csv')), false);

const good = run('tests/fixtures/scope-baseline-clean.csv');
const out = path.join(root, 'tests/fixtures/scope-baseline-clean.import.csv');
check('TEST-SCOPE-IMP-010', 'a clean file exits zero', good.status, 0);
check('TEST-SCOPE-IMP-011', 'an unmapped pay unit is a warning, not an error', /AFO has no APPROVED material mapping/.test(good.stdout), true);
const lines = fs.existsSync(out) ? fs.readFileSync(out, 'utf8').trim().split('\n') : [];
check('TEST-SCOPE-IMP-012', 'the import file has one line per scope row, as DRAFT', [lines.length, lines.slice(1).every(l => l.startsWith('DRAFT,'))], [4, true]);
check('TEST-SCOPE-IMP-013', 'a blank budget rate takes the contractor rate and its source', lines.some(l => /BM60\(1\)\(1\.25\) P,FT,25000\.0,3\.25,RATE-000051/.test(l)), true);
if (fs.existsSync(out)) fs.unlinkSync(out);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
