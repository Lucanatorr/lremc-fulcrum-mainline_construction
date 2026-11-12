/**
 * Sprint 30 - invoice reconciliation. The brief: "Detect invoice quantity
 * above/below approval, wrong rate, unknown code, duplicate item, and
 * unapproved production billed." One fixture line per case.
 */
const { spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path');

let pass = 0, fail = 0;
function check(id, label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${id} ${label}`); }
  else { fail++; console.log(`FAIL  ${id} ${label}\n      got=${a}\n      want=${e}`); }
}
const root = path.join(__dirname, '..');
const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'recon-')), 'findings.csv');
const r = spawnSync('python3', ['scripts/reconcile_invoice.py', 'tests/fixtures/invoice-sample.csv', 'tests/fixtures/invoice-basis.json',
                                '--previous', 'tests/fixtures/invoice-previous.csv', '--out', out], { cwd: root, encoding: 'utf8' });
const rows = fs.readFileSync(out, 'utf8').trim().split('\n').slice(1).map(l => l.split(','));
const at = line => rows.filter(x => x[0] === String(line)).map(x => x[4]).sort();

check('TEST-INV-001', 'a clean line billed by Production ID matches', at(2), ['MATCH']);
check('TEST-INV-002', 'quantity above approval', at(3), ['QUANTITY ABOVE APPROVED']);
check('TEST-INV-003', 'the same Production ID twice on one invoice', at(4), ['DUPLICATE ITEM']);
check('TEST-INV-004', 'unapproved production billed by ID', at(5), ['UNAPPROVED PRODUCTION BILLED']);
check('TEST-INV-005', 'a Production ID that does not exist', at(6), ['PRODUCTION ID NOT FOUND']);
check('TEST-INV-006', "billing another contractor's record", at(7), ['KEY MISMATCH']);
check('TEST-INV-007', 'a lump line cannot re-bill a record already billed by ID', at(8), ['QUANTITY ABOVE APPROVED']);
check('TEST-INV-008', 'wrong rate on a lump line', at(9), ['WRONG RATE']);
check('TEST-INV-009', 'unapproved production billed as a lump line', at(10), ['UNAPPROVED PRODUCTION BILLED']);
check('TEST-INV-010', 'unknown pay unit (the BFO.96.I billing gap)', at(11), ['UNKNOWN CODE']);
check('TEST-INV-011', 'wrong rate on a line billed by ID', at(12), ['WRONG RATE']);
check('TEST-INV-012', 'a lump line equal to approved production matches', at(13), ['MATCH']);
check('TEST-INV-013', 'line arithmetic error is a warning', at(14), ['AMOUNT ARITHMETIC']);
check('TEST-INV-014', 'quantity below approval is a warning', at(15), ['QUANTITY BELOW APPROVED']);
check('TEST-INV-015', 'a Production ID already on an earlier invoice', at(16), ['DUPLICATE ITEM']);
check('TEST-INV-016', 'any CRITICAL fails the run, so a payment run can gate on it', r.status, 1);
check('TEST-INV-017', 'the rate compared is the one Fulcrum priced at, never re-derived',
      /rate_applied/.test(fs.readFileSync(path.join(root, 'scripts/reconcile_invoice.py'), 'utf8')) &&
      !/unit_rate'\]\s*\*|expected_rate/.test(fs.readFileSync(path.join(root, 'scripts/reconcile_invoice.py'), 'utf8')), true);

// A fully clean invoice passes.
const clean = path.join(path.dirname(out), 'clean.csv');
fs.writeFileSync(clean, fs.readFileSync(path.join(root, 'tests/fixtures/invoice-sample.csv'), 'utf8').split('\n').filter((l, i) => i === 0 || i === 1 || i === 12).join('\n') + '\n');
const c = spawnSync('python3', ['scripts/reconcile_invoice.py', clean, 'tests/fixtures/invoice-basis.json'], { cwd: root, encoding: 'utf8' });
check('TEST-INV-018', 'a clean invoice exits 0', c.status, 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
