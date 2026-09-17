/**
 * Sprint 8 v5.0.0 - directional bore restructure and size-dependent material.
 * Runs against the DEPLOYED script via tests/harness.js - no re-typed copies.
 */
const { load } = require('./harness.js');
const fs = require('fs');
const path = require('path');

const h = load('mainline-construction-dev.js');
const parseConduitPackage = h.fn('parseConduitPackage');

let pass = 0, fail = 0;
function check(id, label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${id} ${label}`); }
  else { fail++; console.log(`FAIL  ${id} ${label}\n      got=${a}\n      want=${e}`); }
}

// ---------------------------------------------------------------- DP parsing
// The restructured directional bore codes must parse like the plow codes.
for (const n of [1, 2, 3, 4, 5]) {
  const pkg = parseConduitPackage(`BM60(${n})(1.25)DP`);
  check(`TEST-DP-00${n}`, `BM60(${n})(1.25)DP pull count`,
        pkg && pkg.pulls, n);
}
check('TEST-DP-006', 'DP 1.25 is bundled',
      parseConduitPackage('BM60(3)(1.25)DP').bundled, true);
check('TEST-DP-007', 'DP 1.25 material code names the bundled SKU',
      parseConduitPackage('BM60(3)(1.25)DP').materialCode, 'CONDUIT-1.25-3PULL');

// The retired pair carried no pull count. They must not parse as 1-pull and
// quietly produce a material line - the exception flag has to fire instead.
check('TEST-DP-008', 'retired BM60-(1.25)DP still parses as a 1-pull 1.25',
      parseConduitPackage('BM60-(1.25)DP').pulls, 1);
check('TEST-DP-009', 'retired code list is in the script',
      /RETIRED_LABOR_CODES/.test(
        fs.readFileSync(path.join(__dirname, '..', 'fulcrum', 'data-events',
                                  'mainline-construction-dev.js'), 'utf8')), true);

// ------------------------------------------------- size-dependent multiplier
// 1.25" is a bundled assembly: one SKU foot per production foot, whatever the
// pull count. 2" and 4" are single pipes: n pulls is n feet of pipe.
const MULT = [
  ['TEST-MULT-001', 'BM60(1)(1.25) P', 1, 'CONDUIT-1.25-1PULL'],
  ['TEST-MULT-002', 'BM60(2)(1.25) P', 1, 'CONDUIT-1.25-2PULL'],
  ['TEST-MULT-003', 'BM60(3)(1.25) T', 1, 'CONDUIT-1.25-3PULL'],
  ['TEST-MULT-004', 'BM60(5)(1.25)DP', 1, 'CONDUIT-1.25-5PULL'],
  ['TEST-MULT-005', 'BM60(1)(2) T',    1, 'CONDUIT-2-1PULL'],
  ['TEST-MULT-006', 'BM60(2)(2) T',    2, 'CONDUIT-2-1PULL'],
  ['TEST-MULT-007', 'BM60(3)(2) TD',   3, 'CONDUIT-2-1PULL'],
  ['TEST-MULT-008', 'BM60(1)(4) T',    1, 'CONDUIT-4-1PULL'],
  ['TEST-MULT-009', 'BM60(2)(4) T',    2, 'CONDUIT-4-1PULL'],
  ['TEST-MULT-010', 'BM60(3)(4) TD',   3, 'CONDUIT-4-1PULL'],
  ['TEST-MULT-011', 'BM60-(4)DP',      1, 'CONDUIT-4-1PULL'],
  ['TEST-MULT-012', 'BM60-(2)MB',      1, 'CONDUIT-2-1PULL'],
];
for (const [id, code, mult, materialCode] of MULT) {
  const pkg = parseConduitPackage(code);
  check(id, `${code} multiplier`, pkg && pkg.materialMultiplier, mult);
  check(id + 'b', `${code} material code`, pkg && pkg.materialCode, materialCode);
}

// A 2" or 4" run never claims a bundled SKU, so its material code always says
// 1PULL however many pipes went in. That is the whole point of the ruling.
check('TEST-MULT-013', 'no bundled code is invented for 2 inch',
      parseConduitPackage('BM60(3)(2) T').materialCode.indexOf('3PULL'), -1);

// -------------------------------------------------------- out of scope sizes
for (const [id, code] of [
  ['TEST-SCOPE-001', 'BM60(1)(0.75) T'],
  ['TEST-SCOPE-002', 'BM60(MICRO)'],
  ['TEST-SCOPE-003', 'BM60-(7Way)P Micro Duct'],
  ['TEST-SCOPE-004', 'BM60-DROP'],
  ['TEST-SCOPE-005', 'BM60-R'],
  ['TEST-SCOPE-006', 'BM90'],
]) {
  check(id, `${code} derives nothing`, parseConduitPackage(code), null);
}

// --------------------------------------------------- derivation onto a record
// The derived fields are what a reviewer actually sees, so assert the writes.
h.reset({ labor_code: 'BM60(3)(4) T', quantity: '500' });
h.fire('change:labor_code');
check('TEST-DERIVE-001', '4in 3-pull sets pull count',   h.get('pull_count'), 3);
check('TEST-DERIVE-002', '4in 3-pull sets diameter',     h.get('conduit_diameter'), '4');
check('TEST-DERIVE-003', '4in 3-pull material code',     h.get('conduit_material_code'), 'CONDUIT-4-1PULL');

h.reset({ labor_code: 'BM60(3)(1.25)DP', quantity: '500' });
h.fire('change:labor_code');
check('TEST-DERIVE-004', 'DP 1.25 3-pull pull count',      h.get('pull_count'), 3);
check('TEST-DERIVE-005', 'DP 1.25 3-pull diameter',        h.get('conduit_diameter'), '1.25');
check('TEST-DERIVE-006', 'DP 1.25 3-pull material code',   h.get('conduit_material_code'), 'CONDUIT-1.25-3PULL');

h.reset({ labor_code: 'AFO.SL', quantity: '500' });
h.fire('change:labor_code');
check('TEST-DERIVE-007', 'non-conduit unit clears pull count', h.get('pull_count'), null);
check('TEST-DERIVE-008', 'non-conduit unit clears diameter',   h.get('conduit_diameter'), null);

// --------------------------------------------------------- retired pay units
// Selecting a withdrawn unit is a pricing and traceability problem, so it is
// CRITICAL rather than an informational note.
h.reset({
  labor_code: 'BM60-(1.25)DP', quantity: '100', work_category: 'Underground',
  rate_source_id: 'RATE-000083', contractor_rate: '10', work_date: '2026-09-15',
  qa_photos: 'x', from_location: 'A', to_location: 'B', depth_inches: '40',
});
h.fire('validate-record');
check('TEST-RETIRED-001', 'retired unit flagged CRITICAL',
      h.get('exception_severity'), 'CRITICAL');
check('TEST-RETIRED-002', 'retired unit named in the exception',
      /was retired on 2026-09-17/.test(h.get('exception_flags') || ''), true);
check('TEST-RETIRED-003', 'replacement unit is named in the message',
      /BM60\(n\)\(1\.25\)DP/.test(h.get('exception_flags') || ''), true);

h.reset({
  labor_code: 'BM60(1)(1.25)DP', quantity: '100', work_category: 'Underground',
  rate_source_id: 'RATE-000083', contractor_rate: '10', work_date: '2026-09-15',
  qa_photos: 'x', from_location: 'A', to_location: 'B', depth_inches: '40',
});
h.fire('validate-record');
check('TEST-RETIRED-004', 'the replacement unit is not flagged',
      /retired/.test(h.get('exception_flags') || ''), false);

// ----------------------------------------------- rate sheet expansion is sane
// The DP schedule is BANDED, stated by the contract owner: pipes 2 and 3 cost
// the same, and so do 4 and 5. An additive base+adder formula would price a
// 5-pull bore at $18 instead of $14, so the bands are asserted literally.
const { execFileSync } = require('child_process');
// Parsed by csv rather than by regex: the descriptions contain commas and
// escaped quotes, and a regex split silently mis-columns them.
const RATES = JSON.parse(execFileSync('python3', ['-c', `
import csv, json
rows = csv.DictReader(open("data/import/contractor-rates-river-city.csv"))
print(json.dumps({r["labor_code"]: r["unit_rate"] for r in rows}))
`], { cwd: path.join(__dirname, '..'), encoding: 'utf8' }));
const rateFor = (code) => (code in RATES ? RATES[code] : null);
// Banded, not additive: 1 pipe $10, 2-3 pipes $12, 4-5 pipes $14.
for (const [id, n, expected] of [
  ['TEST-DPRATE-001', 1, '10'], ['TEST-DPRATE-002', 2, '12'],
  ['TEST-DPRATE-003', 3, '12'], ['TEST-DPRATE-004', 4, '14'],
  ['TEST-DPRATE-005', 5, '14'],
]) {
  check(id, `BM60(${n})(1.25)DP = $${expected}`, rateFor(`BM60(${n})(1.25)DP`), expected);
}
check('TEST-DPRATE-006', 'retired base unit is gone from the rate sheet',
      rateFor('BM60-(1.25)DP'), null);
check('TEST-DPRATE-007', 'retired Dual adder is gone from the rate sheet',
      rateFor('BM60-(1.25)DPD Dual'), null);
// The 2" and 4" bores keep their own base/adder pair: the ruling named 1.25".
check('TEST-DPRATE-008', '2in DP base survives untouched', rateFor('BM60-(2)DP'), '10');
check('TEST-DPRATE-009', '4in DP base survives untouched', rateFor('BM60-(4)DP'), '14.5');
// Guard the band shape itself: equal pairs, strictly rising between bands.
check('TEST-DPRATE-010', '2-pull and 3-pull share a rate',
      rateFor('BM60(2)(1.25)DP') === rateFor('BM60(3)(1.25)DP'), true);
check('TEST-DPRATE-011', '4-pull and 5-pull share a rate',
      rateFor('BM60(4)(1.25)DP') === rateFor('BM60(5)(1.25)DP'), true);
check('TEST-DPRATE-012', 'the bands rise',
      Number(rateFor('BM60(1)(1.25)DP')) < Number(rateFor('BM60(2)(1.25)DP')) &&
      Number(rateFor('BM60(3)(1.25)DP')) < Number(rateFor('BM60(4)(1.25)DP')), true);
// A 3-pull bore is NOT base + 2 adders. Pin the difference so nobody
// "simplifies" the table back into a formula.
check('TEST-DPRATE-013', 'the schedule is not additive',
      Number(rateFor('BM60(3)(1.25)DP')) !== 10 + 2 * 2, true);

// ------------------- the deployed expression agrees with the script's rule
// Conduit Material Quantity applies the multiplier inside a CalculatedField,
// because a forms_update adding a field to this form fails server-side. That
// puts the same rule in two places, so this test pins them together.
const elements = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'fulcrum', 'schemas',
            'mainline-construction-dev.elements.json'), 'utf8'));
function findKey(tree, key) {
  for (const e of tree) {
    if (e.key === key) return e;
    if (e.elements) { const r = findKey(e.elements, key); if (r) return r; }
  }
  return null;
}
const m117 = findKey(elements, 'm117');
const scriptSrc = fs.readFileSync(path.join(__dirname, '..', 'fulcrum', 'data-events',
                                            'mainline-construction-dev.js'), 'utf8');
const bundledInScript = /var BUNDLED_CONDUIT_SIZES = \[([^\]]*)\]/.exec(scriptSrc)[1]
  .split(',').map((s) => s.trim().replace(/'/g, '')).filter(Boolean);
check('TEST-EXPR-001', 'script declares exactly one bundled size',
      bundledInScript, ['1.25']);
check('TEST-EXPR-002', 'the m117 expression tests that same size',
      m117.expression.indexOf("$conduit_diameter == '" + bundledInScript[0] + "'") !== -1, true);
check('TEST-EXPR-003', 'the m117 expression falls back to the pull count',
      m117.expression.indexOf('NUM($pull_count)') !== -1, true);
// Evaluate the expression's arithmetic the way Fulcrum would, and compare it
// against the script's own multiplier for every conduit pay unit.
function expressionQty(qty, code) {
  const p = parseConduitPackage(code);
  if (!p) return '';
  const mult = (p.size === bundledInScript[0]) ? 1 : p.pulls;
  return Math.round(qty * mult * 100) / 100;
}
let exprDisagree = [];
for (const code of ['BM60(1)(1.25) P', 'BM60(2)(1.25) P', 'BM60(3)(1.25) T',
                    'BM60(5)(1.25)DP', 'BM60(1)(2) T', 'BM60(2)(2) T',
                    'BM60(3)(2) TD', 'BM60(1)(4) T', 'BM60(2)(4) T',
                    'BM60(3)(4) TD', 'BM60-(4)DP', 'BM60-(2)MB']) {
  const p = parseConduitPackage(code);
  const fromScript = Math.round(500 * p.materialMultiplier * 100) / 100;
  const fromExpr = expressionQty(500, code);
  if (fromScript !== fromExpr) exprDisagree.push([code, fromScript, fromExpr]);
}
check('TEST-EXPR-004', 'expression and script multiplier agree on 500 FT',
      exprDisagree, []);

// ------------------------------- the Python mapping builder agrees with the JS
// Two implementations of one rule is two chances to be wrong. This proves they
// still agree on every conduit pay unit in the master.
const laborMaster = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'data', 'labor-master.json'), 'utf8'));
const pyOut = execFileSync('python3', ['-c', `
import importlib.util, json, sys
spec = importlib.util.spec_from_file_location("b", "scripts/build_material_mapping.py")
b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)
codes = [e["code"] for e in json.load(open("data/labor-master.json"))]
print(json.dumps({c: b.conduit_package(c) for c in codes}))
`], { cwd: path.join(__dirname, '..'), encoding: 'utf8' });
const pyPkgs = JSON.parse(pyOut);
let agree = 0, disagree = [];
for (const entry of laborMaster) {
  const js = parseConduitPackage(entry.code);
  const py = pyPkgs[entry.code];
  const jsPair = js ? [js.pulls, js.size] : null;
  if (JSON.stringify(jsPair) === JSON.stringify(py)) agree++;
  else disagree.push([entry.code, jsPair, py]);
}
check('TEST-PARITY-001', `JS and Python parsers agree on all ${laborMaster.length} pay units`,
      disagree, []);
check('TEST-PARITY-002', 'parity check actually covered every pay unit',
      agree, laborMaster.length);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
