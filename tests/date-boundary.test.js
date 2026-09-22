/**
 * Date-boundary and timezone conformance.
 *
 * WHY THIS SUITE EXISTS
 * The master prompt (Sprint 23, "Filter and Date-Boundary Testing") requires
 * January 1, December 31, first/last day of month, first/last reporting day of
 * the week, leap day and records near midnight to be tested, and requires the
 * organizational timezone to be confirmed. None of that existed.
 *
 * Writing it found a live defect. Fulcrum stores a date-only field as UTC
 * midnight - the real record PRD-2026-143C1840 carries
 * work_date = 2026-09-21T00:00:00.000Z - and parseDate() read it back with the
 * LOCAL getters, which return the previous day anywhere west of UTC. Measured
 * in America/New_York before the fix:
 *
 *   2026-09-21T00:00:00Z -> Sunday 2026-09-20, week 2026-W38  (truly Mon, W39)
 *   2026-01-01T00:00:00Z -> year 2025, month 2025-12          (truly 2026-01)
 *
 * A Monday derived as Sunday is dropped by every report filtering
 * `work_day_of_week NOT IN ('Saturday','Sunday')` - productivity.sql and
 * forecast-completion.sql both do - so a full day of production left the
 * numbers silently. A 1 January record booked into the prior financial year.
 * The duplicate fingerprint shifted with it, so the same work saved in two
 * timezones produced two fingerprints and stopped matching itself.
 *
 * Every assertion below therefore runs under FOUR timezones, including one
 * ahead of UTC. A suite that only ever ran in UTC is how this survived.
 *
 * Run: node tests/date-boundary.test.js      (re-execs itself per timezone)
 */

const assert = require('assert');
const path = require('path');
const { execFileSync } = require('child_process');

const ZONES = ['UTC', 'America/New_York', 'America/Anchorage', 'Pacific/Auckland'];

// Re-exec once per zone so every case is proven in each, then aggregate.
if (!process.env.MC_TZ_CHILD) {
  let failed = 0;
  for (const tz of ZONES) {
    process.stdout.write(`\n--- TZ=${tz}\n`);
    try {
      process.stdout.write(execFileSync(process.execPath, [__filename], {
        env: { ...process.env, TZ: tz, MC_TZ_CHILD: '1' }, encoding: 'utf8',
      }));
    } catch (e) {
      process.stdout.write(e.stdout || '');
      failed++;
    }
  }
  console.log(failed ? `\n${failed} timezone(s) FAILED` : '\nall timezones passed');
  process.exit(failed ? 1 : 0);
}

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

const app = load('mainline-construction-dev.js');

// Derive the five reporting fields from a stored work_date.
function derive(workDate) {
  app.reset({ work_date: workDate, quantity: 1 }).fire('validate-record');
  return {
    year:  app.get('work_year'),
    month: app.get('work_month'),
    week:  app.get('work_week'),
    dow:   app.get('work_day_of_week'),
    period: app.get('reporting_period'),
  };
}

// ---- 1. the exact live record ---------------------------------------------
check('TEST-TZ-001', 'the live record derives Monday in every zone',
      derive('2026-09-21T00:00:00.000Z').dow, 'Monday');
check('TEST-TZ-002', 'the live record derives 2026-W39',
      derive('2026-09-21T00:00:00.000Z').week, '2026-W39');

// ---- 2. year boundaries ----------------------------------------------------
// 1 Jan must never book into the previous year: that is a financial period error.
const jan1 = derive('2026-01-01T00:00:00.000Z');
check('TEST-BOUNDARY-001', 'January 1 stays in its own year',  jan1.year,  '2026');
check('TEST-BOUNDARY-002', 'January 1 stays in its own month', jan1.month, '2026-01');
check('TEST-BOUNDARY-003', 'January 1 2026 is a Thursday',     jan1.dow,   'Thursday');

const dec31 = derive('2026-12-31T00:00:00.000Z');
check('TEST-BOUNDARY-004', 'December 31 stays in its own year',  dec31.year,  '2026');
check('TEST-BOUNDARY-005', 'December 31 stays in its own month', dec31.month, '2026-12');

// ---- 3. ISO week boundaries ------------------------------------------------
// ISO-8601: the week belongs to the year containing its Thursday, so a January
// date can legitimately carry the PREVIOUS year's week label. That is correct
// and is exactly why work_year and work_week are separate fields.
check('TEST-BOUNDARY-006', '2026-01-01 (Thu) is week 2026-W01',
      derive('2026-01-01T00:00:00.000Z').week, '2026-W01');
check('TEST-BOUNDARY-007', '2027-01-01 (Fri) carries week 2026-W53',
      derive('2027-01-01T00:00:00.000Z').week, '2026-W53');
check('TEST-BOUNDARY-008', '2027-01-01 still reports calendar year 2027',
      derive('2027-01-01T00:00:00.000Z').year, '2027');
check('TEST-BOUNDARY-009', '2025-12-29 (Mon) is already week 2026-W01',
      derive('2025-12-29T00:00:00.000Z').week, '2026-W01');

// ---- 4. leap day -----------------------------------------------------------
const leap = derive('2028-02-29T00:00:00.000Z');
check('TEST-BOUNDARY-010', 'leap day resolves',            leap.month, '2028-02');
check('TEST-BOUNDARY-011', 'leap day 2028 is a Tuesday',   leap.dow,   'Tuesday');
check('TEST-BOUNDARY-012', 'non-leap 2026-03-01 is Sunday',
      derive('2026-03-01T00:00:00.000Z').dow, 'Sunday');

// ---- 5. the Mon-Fri working week ------------------------------------------
// These drive productivity.sql and forecast-completion.sql, which EXCLUDE
// Saturday and Sunday. A day named wrongly here silently removes production.
const WEEK = {
  '2026-09-21': 'Monday',    '2026-09-22': 'Tuesday',
  '2026-09-23': 'Wednesday', '2026-09-24': 'Thursday',
  '2026-09-25': 'Friday',    '2026-09-26': 'Saturday',
  '2026-09-27': 'Sunday',
};
for (const [date, day] of Object.entries(WEEK)) {
  check(`TEST-BOUNDARY-DOW-${date}`, `${date} is ${day}`,
        derive(date + 'T00:00:00.000Z').dow, day);
}

// ---- 6. month boundaries ---------------------------------------------------
for (const [d, m] of [['2026-02-01', '2026-02'], ['2026-02-28', '2026-02'],
                      ['2026-04-30', '2026-04'], ['2026-05-01', '2026-05']]) {
  check(`TEST-BOUNDARY-MONTH-${d}`, `${d} reports ${m}`,
        derive(d + 'T00:00:00.000Z').month, m);
}

// ---- 7. reporting_period tracks the month ---------------------------------
check('TEST-BOUNDARY-013', 'reporting period equals the work month',
      derive('2026-01-01T00:00:00.000Z').period, '2026-01');

// ---- 8. a date carrying a real time still resolves to its calendar day -----
// Fulcrum normally stores midnight, but a record edited through the API can
// carry a time. It must not tip into the next or previous day.
check('TEST-BOUNDARY-014', 'late-evening UTC stays on its own day',
      derive('2026-09-21T23:59:00.000Z').dow, 'Monday');
check('TEST-BOUNDARY-015', 'early-morning UTC stays on its own day',
      derive('2026-09-21T00:01:00.000Z').dow, 'Monday');

// ---- 9. the fingerprint must not move with the timezone -------------------
// Two crews on two devices in two zones recording the same work must produce
// the same fingerprint, or duplicate detection stops detecting.
function fingerprint(workDate) {
  app.reset({
    work_date: workDate,
    project_id_snapshot: 'PRJ-000001',
    contractor_id_snapshot: 'CON-0001',
    labor_code: { choice_values: ['BFO.48.I'], other_values: [] },
    unit: { choice_values: ['FT'], other_values: [] },
    cable_id: 'CAB-1',
    starting_sequential: 1000,
    ending_sequential: 4200,
    quantity: 3200,
  }).fire('validate-record');
  return app.get('fingerprint_strict');
}
const fp = fingerprint('2026-09-21T00:00:00.000Z');
check('TEST-BOUNDARY-016', 'the fingerprint carries the true work date',
      typeof fp === 'string' && fp.indexOf('2026-09-21') !== -1, true);

// ---- 10. a blank work date derives nothing rather than guessing -----------
app.reset({ quantity: 1 }).fire('validate-record');
check('TEST-BOUNDARY-017', 'a blank work date derives no week',
      app.get('work_week') || null, null);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
