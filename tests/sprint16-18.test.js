/**
 * Sprints 16-18 - forecasting, reel management and field user experience.
 *
 * Data Event behaviour runs against the shipped script via tests/harness.js.
 * Report rules are asserted in tests/reporting.test.js alongside the others.
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
const src = fs.readFileSync(
  path.join(__dirname, '..', 'fulcrum', 'data-events', 'mainline-construction-dev.js'), 'utf8');

// The labor code carries its unit in the CHOICE LABEL, and applyLaborMetadata
// parses it out on every validate-record. Setting `unit` directly does not
// work: applyLaborMetadata runs first and clears it when the label has no
// "(FT)" to read. So these fixtures use realistic labels, as the deployed
// choice list does.
const FT_CODE = 'BFO.48.I (FT) Labor to install 48 count fiber optic cable';
const EA_CODE = 'BHF-30T (EA) Labor to install a 30 inch handhole';

const FIBER = {
  project_id_snapshot: 'PRJ-000001', contractor_id_snapshot: 'CON-0001',
  work_date: '2026-09-15', labor_code: FT_CODE,
  work_category: 'Fiber Placement',
  rate_source_id: 'R1', contractor_rate: '3',
  rate_labor_code_snap: FT_CODE, rate_contractor_id_snap: 'CON-0001',
  rate_effective_date: '2026-01-01', qa_photos: 'p.jpg',
};

// ------------------------------------ Sprint 18: quantity from sequentials
h.reset(Object.assign({}, FIBER, { starting_sequential: '1000', ending_sequential: '4200' }));
h.fire('validate-record');
check('TEST-S18-001', 'quantity derives from a sequential range', h.get('quantity'), 3200);

h.reset(Object.assign({}, FIBER, {
  starting_sequential: '1000', ending_sequential: '4200',
  slack_footage: '150', other_added_footage: '50',
}));
h.fire('validate-record');
check('TEST-S18-002', 'slack and other added footage are included', h.get('quantity'), 3400);

// Direction must not matter, exactly as for sequential_footage and fingerprints.
h.reset(Object.assign({}, FIBER, { starting_sequential: '4200', ending_sequential: '1000' }));
h.fire('validate-record');
check('TEST-S18-003', 'a reversed range derives the same quantity', h.get('quantity'), 3200);

// The crew's own claim is the billed quantity and must survive untouched.
h.reset(Object.assign({}, FIBER, {
  starting_sequential: '1000', ending_sequential: '4200', quantity: '3000',
}));
h.fire('validate-record');
check('TEST-S18-004', 'a typed quantity is never overwritten', h.get('quantity'), '3000');

// Scope: only fiber placement billed in feet.
h.reset(Object.assign({}, FIBER, {
  work_category: 'Underground', starting_sequential: '1000', ending_sequential: '4200',
}));
h.fire('validate-record');
check('TEST-S18-005', 'underground does not derive a quantity', h.get('quantity'), null);

h.reset(Object.assign({}, FIBER, {
  labor_code: EA_CODE, rate_labor_code_snap: EA_CODE,
  starting_sequential: '1000', ending_sequential: '4200',
}));
h.fire('validate-record');
check('TEST-S18-006', 'a non-FT unit does not derive a quantity', h.get('quantity'), null);
check('TEST-S18-006b', 'and that fixture really did derive unit EA', h.get('unit'), 'EA');

h.reset(Object.assign({}, FIBER, { starting_sequential: '1000' }));
h.fire('validate-record');
check('TEST-S18-007', 'half a range derives nothing', h.get('quantity'), null);

h.reset(Object.assign({}, FIBER, { starting_sequential: '1000', ending_sequential: '1000' }));
h.fire('validate-record');
check('TEST-S18-008', 'a zero-length range derives nothing', h.get('quantity'), null);

// The change handlers are what make this save typing at entry time rather than
// only at save, so the crew sees the number before they leave the screen.
for (const f of ['starting_sequential', 'ending_sequential', 'slack_footage', 'other_added_footage']) {
  check(`TEST-S18-CH-${f}`, `a change to ${f} re-derives the quantity`,
        h.handlerCount(`change:${f}`) > 0, true);
}

// ---------------------------------------- Sprint 18: quantity cross-check
const gap = (rec) => {
  h.reset(Object.assign({}, FIBER, rec));
  h.fire('validate-record');
  return /differs from the installed/.test(h.get('exception_flags') || '');
};
check('TEST-S18-010', 'a quantity 6% below the footage warns',
      gap({ starting_sequential: '1000', ending_sequential: '4200', quantity: '3000' }), true);
check('TEST-S18-011', 'a quantity within 5% does not warn',
      gap({ starting_sequential: '1000', ending_sequential: '4200', quantity: '3100' }), false);
check('TEST-S18-012', 'an exact match does not warn',
      gap({ starting_sequential: '1000', ending_sequential: '4200', quantity: '3200' }), false);
check('TEST-S18-013', 'a derived quantity never warns against itself',
      gap({ starting_sequential: '1000', ending_sequential: '4200' }), false);
check('TEST-S18-014', 'the cross-check is a WARNING, not a block',
      (h.reset(Object.assign({}, FIBER, {
        starting_sequential: '1000', ending_sequential: '4200', quantity: '3000',
       })).fire('validate-record'), h.invalids), []);

// --------------------------- Sprint 18: the ruling that was NOT overridden
check('TEST-S18-020', 'work category is still not derived from a labor-code prefix',
      /SETVALUE\(\s*'work_category'/.test(src), false);
check('TEST-S18-021', 'and the script says why that was left alone',
      /NOT DONE, deliberately/.test(src), true);

// ------------------------------------------ Sprint 18: repeat-entry fields
const prod = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'fulcrum', 'schemas', 'mainline-construction-dev.elements.json'), 'utf8'));
const byKey = {};
(function walk(l) {
  for (const e of l) { byKey[e.key] = e; if (Array.isArray(e.elements)) walk(e.elements); }
})(prod);

for (const k of ['m079', 'm080', 'm015', 'm016', 'm019', 'm020']) {
  check(`TEST-S18-PREV-${k}`, `${k} carries forward to the next record`,
        byKey[k].default_previous_value, true);
}
// The one that must NOT: a stale date silently mis-files production into the
// wrong week, and nothing downstream would catch it.
check('TEST-S18-030', 'work date does NOT carry forward',
      byKey['m002'].default_previous_value === true, false);

// ------------------------------------------- Sprint 17: reel master shape
const reel = JSON.parse(fs.readFileSync(
  path.join(__dirname, '..', 'fulcrum', 'schemas', 'mc-fiber-reel-dev.elements.json'), 'utf8'));
const reelKeys = [];
const reelNames = [];
(function walk(l) {
  for (const e of l) {
    reelKeys.push(e.key); reelNames.push(e.data_name);
    if (Array.isArray(e.elements)) walk(e.elements);
  }
})(reel);

// Everything the brief asks to TRACK, that is genuinely a fact about the reel.
for (const n of ['reel_id', 'manufacturer', 'cable_type', 'fiber_count',
                 'beginning_sequential', 'ending_sequential', 'original_reel_footage',
                 'project_link', 'contractor_link', 'waste_recorded']) {
  check(`TEST-S17-HAS-${n}`, `the reel master tracks ${n}`, reelNames.includes(n), true);
}
// The three stored totals that nothing could populate.
for (const n of ['printed_sequential_consumed', 'slack_recorded', 'estimated_remaining_footage']) {
  check(`TEST-S17-GONE-${n}`, `${n} is no longer stored on the reel`, reelNames.includes(n), false);
}

const reelSrc = fs.readFileSync(
  path.join(__dirname, '..', 'fulcrum', 'data-events', 'mc-fiber-reel-dev.js'), 'utf8');
const reelH = load('mc-fiber-reel-dev.js');

reelH.reset({ beginning_sequential: '1000', ending_sequential: '13000', waste_recorded: '200' });
reelH.fire('validate-record');
check('TEST-S17-001', 'ordinary waste is accepted', reelH.invalids, []);

reelH.reset({ beginning_sequential: '1000', ending_sequential: '13000', waste_recorded: '15000' });
reelH.fire('validate-record');
check('TEST-S17-002', 'waste beyond the printed length is blocked', reelH.invalids.length, 1);
check('TEST-S17-003', 'and the message says slack is not waste',
      /Slack is not waste/.test(reelH.invalids[0] || ''), true);

reelH.reset({ beginning_sequential: '1000', ending_sequential: '1000' });
reelH.fire('validate-record');
check('TEST-S17-004', 'a zero-length reel is still blocked', reelH.invalids.length, 1);

reelH.reset({ beginning_sequential: '0', ending_sequential: '50000' });
reelH.fire('validate-record');
check('TEST-S17-005', 'an implausibly long reel is still blocked', reelH.invalids.length, 1);

check('TEST-S17-006', 'the reel script declares v2.0.0',
      /Data Events - v2\.0\.0/.test(reelSrc), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
