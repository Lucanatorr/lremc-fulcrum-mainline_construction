/**
 * MC Contractor Rate v1.1.0 - the rate master's Data Event, which production
 * copies its unit from. Runs against the authoritative source via harness.js.
 */
const { load } = require('./harness.js');

let pass = 0, fail = 0;
function check(id, label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${id} ${label}`); }
  else { fail++; console.log(`FAIL  ${id} ${label}\n      got=${a}\n      want=${e}`); }
}

const h = load('mc-contractor-rate-dev.js');
// What the runtime actually delivers: a ChoiceField as values only, no label.
const code = (v) => ({ choice_values: [v], other_values: [] });

function rate(extra) {
  return Object.assign({
    rate_id: 'RATE-000084',
    labor_code: code('BM60(2)(1.25)DP'),
    unit: code('FT'),
    labor_description: 'Labor to install two (2) 1.25" pipes by directional bore',
    unit_rate: '12',
    effective_date: '2026-01-01T00:00:00.000Z',
    expiration_date: null,
  }, extra || {});
}
function validate(extra) { h.reset(rate(extra)); h.fire('validate-record'); return h; }

// ------------------------------------------------- the defect v1.1.0 fixes
validate();
check('TEST-RATE-001', 'saving a rate keeps its unit (v1.0.0 cleared it)', h.get('unit'), code('FT'));
check('TEST-RATE-002', 'saving a rate keeps its labor description', h.get('labor_description'), rate().labor_description);
check('TEST-RATE-003', 'a clean rate saves', h.invalids, []);

h.reset(rate()); h.fire('change:labor_code');
check('TEST-RATE-004', 'changing the labor code does not clear the unit', h.get('unit'), code('FT'));

// A label, where a build does pass one, may fill a BLANK unit - never overwrite.
validate({ unit: null, labor_description: null,
           labor_code: { choice_values: ['BM60(2)(1.25)DP'], choice_labels: ['BM60(2)(1.25)DP (FT) Labor to install two'] } });
check('TEST-RATE-005', 'a label fills a blank unit', h.get('unit'), 'FT');
check('TEST-RATE-006', 'and a blank description', h.get('labor_description'), 'Labor to install two');
validate({ unit: code('EA'),
           labor_code: { choice_values: ['X'], choice_labels: ['X (FT) Something'] } });
check('TEST-RATE-007', 'a label never overwrites a stated unit', h.get('unit'), code('EA'));

// ---------------------------------------------------- existing rules still hold
validate({ effective_date: '2026-06-01', expiration_date: '2026-05-31' });
check('TEST-RATE-010', 'an expiry before the effective date is refused', h.invalids.some(m => /Expiration Date is before/.test(m)), true);
validate({ effective_date: '2026-06-01', expiration_date: '2026-06-01' });
check('TEST-RATE-011', 'a one-day rate (same effective and expiry date) is accepted', h.invalids, []);
validate({ unit_rate: '0' });
check('TEST-RATE-012', 'a zero rate is refused', h.invalids.some(m => /Unit Rate is zero/.test(m)), true);

// parseDate keeps the calendar date in every timezone the tests run under.
const pd = h.fn('parseDate')('2026-09-21T00:00:00.000Z');
check('TEST-RATE-013', 'parseDate returns the stored calendar date', [pd.getFullYear(), pd.getMonth() + 1, pd.getDate()], [2026, 9, 21]);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
