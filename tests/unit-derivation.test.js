/**
 * The unit must survive a save.
 *
 * WHY THIS SUITE EXISTS
 * On 2026-09-22 the first real production record entered through the web
 * editor came back from Query like this:
 *
 *   production_id  PRD-2026-143C1840
 *   labor_code     BM60(2)(1.25)DP
 *   contractor_rate 12      extended_value 6000   rate_source_id RATE-000084
 *   unit           null          <-- and the labour code's unit is FT
 *
 * The pricing snapshot was perfect. The unit was gone. applyLaborMetadata()
 * parsed the unit out of the choice LABEL:
 *
 *   "BM60(2)(1.25)DP (FT) Labor to install two (2) 1.25\" conduit bor"
 *
 * but the Data Events runtime hands a ChoiceField over as
 * { choice_values, other_values } and exposes NO label, so choiceLabel() fell
 * through to the VALUE, "BM60(2)(1.25)DP". No "(FT)" in it, regex missed, and
 * the !m branch then SETVALUE('unit', null) - it did not merely fail to
 * derive, it actively erased. Every editor-saved record lost its unit, for
 * every labor code. The 146 imported rate records kept theirs only because
 * API writes do not run data events.
 *
 * Why it matters beyond a blank column: the financial model splits
 * time-and-materials out of physical production on the unit ("HR and EVENT
 * must NOT be aggregated into physical production totals"). In SQL,
 * `unit NOT IN ('HR','EVENT')` over a NULL is NULL, not TRUE - so a
 * unit-less record silently vanishes from physical value instead of being
 * counted or flagged.
 *
 * The unit now arrives as a physical copy from the selected rate
 * (rate_link record_defaults r010 -> m024), like labor_description already
 * did. These tests assert the script never clears or overwrites that copy.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { load } = require('./harness');

let pass = 0, fail = 0;
function check(id, name, actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    console.log(`PASS  ${id} ${name}`);
    pass++;
  } catch (e) {
    console.log(`FAIL  ${id} ${name}\n      expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    fail++;
  }
}

const SCRIPT = 'mainline-construction-dev.js';
const app = load(SCRIPT);

// ---- 1. the exact live regression ----------------------------------------
// A ChoiceField as the runtime really presents it: values only, no labels.
const LIVE = {
  work_date: '2026-09-21',
  labor_code: { choice_values: ['BM60(2)(1.25)DP'], other_values: [] },
  unit: { choice_values: ['FT'], other_values: [] },   // copied by rate_link
  quantity: 500,
  contractor_rate: 12,
};

app.reset(LIVE).fire('validate-record');
check(
  'TEST-UNIT-001',
  'the rate-supplied unit survives validate-record',
  app.get('unit'),
  { choice_values: ['FT'], other_values: [] }
);
check(
  'TEST-UNIT-002',
  'nothing writes to unit when it is already set',
  app.writes.filter((w) => w[0] === 'unit'),
  []
);

// The bug, stated as the thing that must never happen again.
check(
  'TEST-UNIT-003',
  'unit is never SET TO NULL by any handler',
  app.writes.filter((w) => w[0] === 'unit' && (w[1] === null || w[1] === '')),
  []
);

// ---- 2. a label-less choice value must not erase anything ----------------
// This is precisely the input that produced the live failure.
app.reset({
  work_date: '2026-09-21',
  labor_code: { choice_values: ['BM60(2)(1.25)DP'], other_values: [] },
  unit: { choice_values: ['FT'], other_values: [] },
  quantity: 500,
}).fire('change', 'labor_code');
check(
  'TEST-UNIT-004',
  'changing the labor code does not clear a snapshotted unit',
  app.get('unit'),
  { choice_values: ['FT'], other_values: [] }
);

// ---- 3. every unit in the choice list round-trips ------------------------
for (const u of ['FT', 'EA', 'SPLICE', 'SF', 'HR', 'EVENT']) {
  const a = load(SCRIPT);
  a.reset({
    work_date: '2026-09-21',
    labor_code: { choice_values: ['SOMECODE'], other_values: [] },
    unit: { choice_values: [u], other_values: [] },
    quantity: 1,
  }).fire('validate-record');
  check(`TEST-UNIT-RT-${u}`, `${u} survives a save`, a.get('unit'),
        { choice_values: [u], other_values: [] });
}

// ---- 4. a blank unit stays blank rather than being invented --------------
// No rate selected, so nothing authoritative to copy. Guessing would be worse
// than leaving it blank for the exception report to catch.
const blank = load(SCRIPT);
blank.reset({
  work_date: '2026-09-21',
  labor_code: { choice_values: ['BM60(2)(1.25)DP'], other_values: [] },
  quantity: 500,
}).fire('validate-record');
check(
  'TEST-UNIT-005',
  'a value-only labor code invents no unit',
  blank.get('unit') || null,
  null
);

// ---- 5. the fallback still works when a label IS present ----------------
// Some web-editor builds do pass choice_labels. When one does, an otherwise
// blank unit may be filled from it - but only when blank.
const labelled = load(SCRIPT);
labelled.reset({
  work_date: '2026-09-21',
  labor_code: {
    choice_values: ['BFO.48.I'],
    choice_labels: ['BFO.48.I (FT) Install a buried fiber optic cable'],
    other_values: [],
  },
  quantity: 100,
}).fire('validate-record');
check(
  'TEST-UNIT-006',
  'a real label still fills a blank unit',
  labelled.get('unit'),
  'FT'
);

// A present label must NOT override a snapshot that disagrees with it.
const conflict = load(SCRIPT);
conflict.reset({
  work_date: '2026-09-21',
  labor_code: {
    choice_values: ['BFO.48.I'],
    choice_labels: ['BFO.48.I (FT) Install a buried fiber optic cable'],
    other_values: [],
  },
  unit: { choice_values: ['EA'], other_values: [] },
  quantity: 100,
}).fire('validate-record');
check(
  'TEST-UNIT-007',
  'the rate snapshot beats the label when they disagree',
  conflict.get('unit'),
  { choice_values: ['EA'], other_values: [] }
);

// ---- 6. the source itself must never null the unit ----------------------
const src = fs.readFileSync(
  path.join(__dirname, '..', 'fulcrum', 'data-events', SCRIPT), 'utf8');
check(
  'TEST-UNIT-008',
  "no SETVALUE('unit', null) anywhere in the shipped source",
  /SETVALUE\(\s*'unit'\s*,\s*null\s*\)/.test(src),
  false
);
check(
  'TEST-UNIT-009',
  "no setIfChanged('unit', ..., null) anywhere in the shipped source",
  /setIfChanged\(\s*'unit'\s*,[^;]*,\s*null\s*\)/.test(src),
  false
);

// ---- 7. the schema must actually carry the unit across ------------------
const els = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'fulcrum', 'schemas',
            'mainline-construction-dev.elements.json'), 'utf8'));
let rateLink = null;
(function walk(e) {
  for (const x of e) {
    if (x.data_name === 'rate_link') rateLink = x;
    if (x.elements) walk(x.elements);
  }
})(els);
check('TEST-UNIT-010', 'rate_link exists', !!rateLink, true);
check(
  'TEST-UNIT-011',
  'rate_link copies the rate unit r010 into production unit m024',
  (rateLink.record_defaults || []).some(
    (d) => d.destination_field_key === 'm024' && d.source_field_key === 'r010'),
  true
);
check(
  'TEST-UNIT-012',
  'rate_link still copies the description r009 into m022',
  (rateLink.record_defaults || []).some(
    (d) => d.destination_field_key === 'm022' && d.source_field_key === 'r009'),
  true
);

// ---- 8. the reports must not lose a unit-less record from physical value --
// `NULL NOT IN (...)` is NULL, so an un-guarded NOT IN drops the row out of
// physical production entirely. The plain IN form fails safe and is fine.
const reportsDir = path.join(__dirname, '..', 'reports');
const unguarded = [];
for (const f of fs.readdirSync(reportsDir).filter((f) => f.endsWith('.sql'))) {
  const sql = fs.readFileSync(path.join(reportsDir, f), 'utf8');
  for (const line of sql.split('\n')) {
    if (/^\s*--/.test(line)) continue;
    if (/\bunit\s+NOT\s+IN\s*\(/i.test(line) && !/COALESCE\(\s*[\w.]*unit/i.test(line)) {
      unguarded.push(`${f}: ${line.trim()}`);
    }
  }
}
check('TEST-UNIT-013', 'every "unit NOT IN" in the reports is NULL-guarded', unguarded, []);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
