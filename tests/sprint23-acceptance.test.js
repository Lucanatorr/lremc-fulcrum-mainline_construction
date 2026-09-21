/**
 * Sprint 23 - acceptance testing, the part that can be executed here.
 *
 * WHAT THIS SUITE IS AND IS NOT
 * Sprint 23 specifies 113 test sections. A large part of it requires LIVE
 * RECORDS in a test project (23.1) - report validation, UAT, performance,
 * offline and sync behaviour, permissions, concurrency. No dev app contains a
 * single record and the MCP server exposes no record-creation tool, so those
 * sections are BLOCKED, not passed. docs/sprint-23-test-matrix.md states the
 * status of every one of the 113.
 *
 * This file executes the sections that turn on calculation and validation
 * logic, against the SHIPPED Data Events and the SHIPPED CalculatedField
 * expressions - not a re-typed copy of either. Where the brief states an
 * expected number, that exact number is asserted.
 *
 * The brief: "Do not simply confirm that Data Events execute without errors.
 * Validate that the resulting data is correct."
 */
const { load } = require('./harness.js');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function check(id, label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${id} ${label}`); }
  else { fail++; console.log(`FAIL  ${id} ${label}\n      got=${a}\n      want=${e}`); }
}

const h = load('mainline-construction-dev.js');
const elements = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'fulcrum', 'schemas',
            'mainline-construction-dev.elements.json'), 'utf8'));

function findKey(list, key) {
  for (const e of list) {
    if (e.key === key) return e;
    if (Array.isArray(e.elements)) {
      const r = findKey(e.elements, key);
      if (r) return r;
    }
  }
  return null;
}

// Fulcrum's expression primitives, so a shipped expression can be evaluated
// here exactly as the platform would evaluate it.
const NUM = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = parseFloat(String(v));
  return isNaN(n) || !isFinite(n) ? null : n;
};
const COALESCE = (...a) => { for (const x of a) if (x !== null && x !== undefined && x !== '') return x; return null; };
const ISBLANK = (v) => v === null || v === undefined || v === '';
const ABS = Math.abs;
const OR = (...a) => a.some(Boolean);
const IF = (c, t, f) => (c ? t : f);
const ROUND = (v, d) => {
  const n = Number(v);
  const m = Math.pow(10, d || 0);
  return Math.round(n * m) / m;
};

const FT_CODE = 'BFO.48.I (FT) Labor to install 48 count fiber optic cable';
const BASE = {
  project_id_snapshot: 'MCP-TEST-001', contractor_id_snapshot: 'CON-0001',
  work_date: '2026-09-15', labor_code: FT_CODE, work_category: 'Fiber Placement',
  rate_source_id: 'R1', contractor_rate: '3', rate_labor_code_snap: FT_CODE,
  rate_contractor_id_snap: 'CON-0001', rate_effective_date: '2026-01-01',
  qa_photos: 'p.jpg',
};
const run = (rec) => { h.reset(Object.assign({}, BASE, rec)); h.fire('validate-record'); return h; };

// ================================= 23.2 FIBER SEQUENTIAL TESTING ==========
// The brief's six tests, with its own numbers.
const seqFootage = findKey(elements, 'm038').expression;
function sequentialFootage(start, end) {
  const $starting_sequential = start, $ending_sequential = end;
  return eval(seqFootage
    .replace(/\$starting_sequential/g, 'start')
    .replace(/\$ending_sequential/g, 'end'));
}

check('TEST-23.2-1', 'increasing sequential 100000->101250 is 1,250 FT',
      sequentialFootage(100000, 101250), 1250);
check('TEST-23.2-2', 'decreasing sequential 101250->100000 is also 1,250 FT',
      sequentialFootage(101250, 100000), 1250);
check('TEST-23.2-3a', 'identical sequentials are 0 FT',
      sequentialFootage(100000, 100000), 0);
// "The system should additionally produce the appropriate validation warning."
run({ starting_sequential: '100000', ending_sequential: '100000', quantity: '1' });
check('TEST-23.2-3b', 'and 0 FT raises the warning the brief asks for',
      /identical - 0 FT/.test(h.get('exception_flags') || ''), true);

// Tests 4-6: a missing or invalid end must not produce NaN, undefined or
// Infinity. The brief names those three outcomes explicitly.
const BAD = [null, undefined, '', 'abc', 'NaN', {}, [], '1e400'];
for (const bad of BAD) {
  const v = sequentialFootage(100000, bad);
  const label = JSON.stringify(bad) === undefined ? 'undefined' : JSON.stringify(bad);
  check(`TEST-23.2-4-${label}`, `end=${label} yields no bogus number`,
        v === '' || v === null || (typeof v === 'number' && isFinite(v)), true);
}
for (const bad of BAD) {
  const v = sequentialFootage(bad, 101250);
  const label = JSON.stringify(bad) === undefined ? 'undefined' : JSON.stringify(bad);
  check(`TEST-23.2-5-${label}`, `start=${label} yields no bogus number`,
        v === '' || v === null || (typeof v === 'number' && isFinite(v)), true);
}

// ==================================== 23.3 SLACK FOOTAGE TESTING =========
// Sequential 1,250 + Slack 150 + Other 50 = 1,450 FT, and the components stay
// independently stored.
const totalInstalled = findKey(elements, 'm041').expression;
function totalInstalledFootage(seq, slack, other) {
  return eval(totalInstalled
    .replace(/\$sequential_footage/g, 'seq')
    .replace(/\$slack_footage/g, 'slack')
    .replace(/\$other_added_footage/g, 'other'));
}
check('TEST-23.3-1', '1250 + 150 + 50 = 1,450 FT',
      totalInstalledFootage(1250, 150, 50), 1450);

run({ starting_sequential: '100000', ending_sequential: '101250',
      slack_footage: '150', other_added_footage: '50' });
check('TEST-23.3-2', 'the sequential range is untouched by slack',
      [h.get('starting_sequential'), h.get('ending_sequential')], ['100000', '101250']);
check('TEST-23.3-3', 'slack remains independently stored', h.get('slack_footage'), '150');
check('TEST-23.3-4', 'other added footage remains independently stored',
      h.get('other_added_footage'), '50');
// Changing slack must not modify the sequential footage.
run({ starting_sequential: '100000', ending_sequential: '101250', slack_footage: '900' });
check('TEST-23.3-5', 'changing slack does not move the sequential footage',
      sequentialFootage(Number(h.get('starting_sequential')), Number(h.get('ending_sequential'))), 1250);

// ==================================== 23.13 EXTENDED VALUE TESTING =======
// Quantity 500 x $8.25 = $4,125.00, from the shipped m046 expression.
const extended = findKey(elements, 'm046').expression;
function extendedValue(qty, rate) {
  return eval(extended.replace(/\$quantity/g, 'qty').replace(/\$contractor_rate/g, 'rate'));
}
check('TEST-23.13-1', '500 x 8.25 = 4125.00', extendedValue(500, 8.25), 4125);
check('TEST-23.13-2', 'zero quantity is 0.00, not null', extendedValue(0, 8.25), 0);
check('TEST-23.13-3', 'a decimal quantity survives', extendedValue(123.45, 2), 246.9);
check('TEST-23.13-4', 'a large quantity does not overflow', extendedValue(1000000, 8.25), 8250000);
check('TEST-23.13-5', 'a blank quantity is 0, never NaN', extendedValue(null, 8.25), 0);
check('TEST-23.13-6', 'a blank rate is 0, never NaN', extendedValue(500, null), 0);
check('TEST-23.13-7', 'both blank is 0', extendedValue(null, null), 0);

// ===================================== 23.39 DECIMAL AND ROUNDING ========
// The brief's own example rate, $7.875. The adopted strategy: round ONCE, at
// the extended value, to 2 dp. Nothing rounds the rate or the quantity first.
check('TEST-23.39-1', '100 x 7.875 = 787.50', extendedValue(100, 7.875), 787.5);
check('TEST-23.39-2', '1 x 7.875 rounds once to 7.88', extendedValue(1, 7.875), 7.88);
check('TEST-23.39-3', '3 x 7.875 = 23.63 (23.625 rounded once)', extendedValue(3, 7.875), 23.63);
// Rounding the rate FIRST would give 3 x 7.88 = 23.64. One cent per record,
// and it compounds across a project - which is why the rate is never rounded.
check('TEST-23.39-4', 'and is NOT 23.64, i.e. the rate is not pre-rounded',
      extendedValue(3, 7.875) === 23.64, false);

// ========================================= 23.40 LARGE-VALUE TESTING =====
run({ starting_sequential: '0', ending_sequential: '1000000', quantity: '1000000' });
check('TEST-23.40-1', 'a 1,000,000 FT record still computes a quantity',
      h.get('quantity'), '1000000');
check('TEST-23.40-2', 'and trips the plausibility warning the brief asks for',
      /exceeds the 50,000 FT plausibility threshold/.test(h.get('exception_flags') || ''), true);
check('TEST-23.40-3', 'and produces no NaN or Infinity anywhere on the record',
      Object.values(h.record).some((v) =>
        typeof v === 'number' && !isFinite(v) || String(v) === 'NaN'), false);

// =================================== 23.59 ZERO AND NEGATIVE TESTING =====
run({ quantity: '0' });
check('TEST-23.59-1', 'zero quantity warns', /Quantity is zero/.test(h.get('exception_flags') || ''), true);
check('TEST-23.59-2', 'and does not block the save', h.invalids, []);

run({ quantity: '-500' });
check('TEST-23.59-3', 'a negative quantity is CRITICAL, not a warning',
      h.get('exception_severity'), 'CRITICAL');
check('TEST-23.59-4', 'and the message directs the user to an adjustment',
      /use an adjustment transaction/.test(h.get('exception_flags') || ''), true);
// The brief: "Do not allow a normal field user to accidentally enter -500 FT
// as ordinary construction production." A CRITICAL cannot be approved.
h.setStatus('APPROVED');
h.set({ qa_status: 'Pass' });
h.fire('validate-record');
check('TEST-23.59-5', 'and -500 FT can never reach APPROVED', h.invalids.length > 0, true);

// ======================================= 23.38 NULL AND BLANK TESTING ====
// Every Data Event, against nulls, blanks, zeros and missing links. The brief
// names the five outputs that must never appear.
const FORBIDDEN = /NaN|Infinity|undefined|\[object Object\]/;
const HOSTILE = [
  {}, { quantity: null }, { quantity: '' }, { quantity: 0 },
  { labor_code: null }, { labor_code: '' }, { unit: null },
  { work_date: null }, { work_date: '' }, { work_date: 'not-a-date' },
  { starting_sequential: '', ending_sequential: '' },
  { starting_sequential: 'abc', ending_sequential: 'def' },
  { rate_source_id: null, contractor_rate: null },
  { project_id_snapshot: null, contractor_id_snapshot: null },
  { reel_begin_snap: null, reel_end_snap: null, starting_sequential: '5' },
  { fiber_count_spliced: '', splice_quantity: '' },
  { conduit_diameter: null, pull_count: null },
  { work_category: null, qa_status: null, correction_detail: null },
];
let hostileFail = 0, threwOn = null;
for (let i = 0; i < HOSTILE.length; i++) {
  try {
    h.reset(HOSTILE[i]);
    h.fire('validate-record');
    h.fire('change:labor_code');
    h.fire('change:work_date');
    for (const [k, v] of Object.entries(h.record)) {
      if (FORBIDDEN.test(String(v))) { hostileFail++; threwOn = `${i}:${k}=${v}`; }
    }
  } catch (e) { hostileFail++; threwOn = `${i}: threw ${e.message}`; }
}
check('TEST-23.38-1', 'no hostile input yields NaN/Infinity/undefined/[object Object]',
      hostileFail === 0 ? 'clean' : threwOn, 'clean');
check('TEST-23.38-2', 'and none of the 18 hostile records threw', hostileFail, 0);

// ==================================== 23.27 UNIQUE IDENTIFIER TESTING ====
h.reset({ work_date: '2026-09-15', __record_id: 'aaaa-bbbb-cccc-11112222' });
h.fire('validate-record');
const pid = h.get('production_id');
check('TEST-23.27-1', 'a production ID is assigned', /^PRD-2026-11112222$/.test(pid), true);
for (let i = 0; i < 5; i++) h.fire('validate-record');
check('TEST-23.27-2', 'and is stable across repeated saves', h.get('production_id'), pid);
h.set({ quantity: '900', work_date: '2026-10-01' });
h.fire('validate-record');
check('TEST-23.27-3', 'and survives an edit to the work date', h.get('production_id'), pid);

// ===================================== 23.28 FROM/TO SEGMENT TESTING =====
const seg = (f, t) => { h.reset({ from_location: f, to_location: t }); h.fire('validate-record'); return h.get('segment_id'); };
check('TEST-23.28-1', 'HH-1 -> HH-2 and HH-2 -> HH-1 are one segment',
      seg('HH-1', 'HH-2'), seg('HH-2', 'HH-1'));
check('TEST-23.28-2', 'case and padding do not create a second segment',
      seg(' hh-1 ', 'HH-2'), seg('HH-1', 'HH-2'));
check('TEST-23.28-3', 'a different pair is a different segment',
      seg('HH-1', 'HH-3') === seg('HH-1', 'HH-2'), false);
check('TEST-23.28-4', 'one end missing derives no segment', seg('HH-1', null), null);

// ================================== 23.37 DATA EVENT RE-ENTRY TESTING ====
// Firing the same event repeatedly must converge, not drift. This is what
// setIfChanged exists for: a handler that writes unconditionally re-triggers
// itself forever.
h.reset(Object.assign({}, BASE, {
  starting_sequential: '100000', ending_sequential: '101250',
  from_location: 'HH-1', to_location: 'HH-2', quantity: '1250',
}));
h.fire('validate-record');
const snapshot1 = JSON.stringify(h.record);
for (let i = 0; i < 10; i++) h.fire('validate-record');
check('TEST-23.37-1', 'ten further validate-record passes change nothing',
      JSON.stringify(h.record), snapshot1);
const writesBefore = h.writes.length;
h.fire('validate-record');
check('TEST-23.37-2', 'and a settled record issues no further writes',
      h.writes.length, writesBefore);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
