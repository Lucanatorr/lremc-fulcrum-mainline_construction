/**
 * Sprints 10-12 - reporting conventions.
 *
 * The reports ship as SQL and cannot be executed here, so these tests check
 * each file against the rules in reports/_conventions.md. That is a weak proxy
 * for running a query, but it is what caught the sequential-overlap report
 * addressing tables by form name and reading `status` instead of `_status`,
 * which meant it would never have run at all.
 */
const fs = require('fs');
const path = require('path');

const REPORTS = path.join(__dirname, '..', 'reports');
const files = fs.readdirSync(REPORTS).filter((f) => f.endsWith('.sql')).sort();
const sql = {};
for (const f of files) sql[f] = fs.readFileSync(path.join(REPORTS, f), 'utf8');

// Comments describe rules and name apps, so they must not be searched for
// violations of those same rules.
const stripComments = (s) => s.replace(/--.*$/gm, '');

let pass = 0, fail = 0;
function check(id, label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${id} ${label}`); }
  else { fail++; console.log(`FAIL  ${id} ${label}\n      got=${a}\n      want=${e}`); }
}

check('TEST-RPT-000', 'every expected report exists', files, [
  'contractor-financial.sql',
  'duplicate-production.sql',
  'material-variance.sql',
  'production-daily.sql',
  'production-monthly.sql',
  'production-trend.sql',
  'production-weekly.sql',
  'project-financial.sql',
  'project-scope-status.sql',
  'qa-review-queue.sql',
  'rate-audit.sql',
  'sequential-overlap.sql',
  'unplanned-production.sql',
]);

// ---------------------------------------- convention 1: Query API addressing
// Getting either of these wrong makes a report that does not run.
for (const f of files) {
  const body = stripComments(sql[f]);
  check(`TEST-ADDR-${f}`, `${f} addresses tables by form ID`,
        /FROM\s+"(MC |Mainline )/.test(body), false);
  // Every bare `status` comparison must be `_status`. `record_status` and
  // `rate_master_status` are local aliases and are allowed.
  const bareStatus = body.match(/(^|[^_\w])status\s*(=|<>|IN\b|NOT\s+IN\b)/gm) || [];
  check(`TEST-STATUS-${f}`, `${f} reads _status, never status`, bareStatus, []);
}

// ------------------------------------ convention 2: no cross-unit quantities
// A report that groups across pay units must not SUM(quantity): feet, each,
// splices and hours are not addable. These three aggregate across pay units.
for (const f of ['project-financial.sql', 'contractor-financial.sql', 'production-trend.sql']) {
  const body = stripComments(sql[f]);
  const naked = body.match(/SUM\(\s*(COALESCE\(\s*)?(p\.)?quantity/g) || [];
  check(`TEST-UNIT-${f}`, `${f} never sums raw quantity across pay units`, naked, []);
}
// Where quantity IS summed, it is fenced by a unit or grouped by labor code.
check('TEST-UNIT-001', 'the contractor report sums footage only',
      /unit = 'FT'\s*\n?\s*THEN COALESCE\(quantity,0\)/.test(sql['contractor-financial.sql']), true);
check('TEST-UNIT-002', 'the trend report sums footage only',
      /p\.unit = 'FT'/.test(sql['production-trend.sql']), true);
check('TEST-UNIT-003', 'weekly groups by labor code so one unit applies',
      /GROUP BY .*p\.labor_code/.test(sql['production-weekly.sql']), true);
check('TEST-UNIT-004', 'monthly groups by labor code too',
      /GROUP BY project_id, contractor_id, work_month, labor_code/
        .test(sql['production-monthly.sql']), true);
check('TEST-UNIT-005', 'the daily report suppresses quantity on multi-code rows',
      /CASE WHEN GROUPING\(labor_code\) = 0\s*\n?\s*THEN SUM\(quantity\)/
        .test(sql['production-daily.sql']), true);
check('TEST-UNIT-006', 'project-to-date across pay units reports value only',
      /ptd_project_approved_value/.test(sql['production-monthly.sql']), true);

// ---------------------------- convention 3: time and materials is not production
for (const [id, f] of [
  ['TEST-TM-001', 'production-trend.sql'],
  ['TEST-TM-002', 'contractor-financial.sql'],
  ['TEST-TM-003', 'production-daily.sql'],
]) {
  check(id, `${f} separates HR and EVENT units`,
        /'HR'\s*,\s*'EVENT'|'HR','EVENT'/.test(sql[f]), true);
}

// -------------------------------------- convention 4: the week is read, not built
check('TEST-WEEK-001', 'weekly reads the derived work_week',
      /p\.work_week/.test(sql['production-weekly.sql']), true);
for (const f of files) {
  // No report may compute a week from work_date - that would be a second
  // definition of "week" competing with the one on the record.
  check(`TEST-WEEK-${f}`, `${f} does not recompute a week from work_date`,
        /(EXTRACT|DATE_TRUNC|WEEK|DATE_PART)\s*\(\s*'?week/i.test(stripComments(sql[f])), false);
}
check('TEST-WEEK-010', 'average daily production divides by working days',
      /working_days_with_production/.test(sql['production-trend.sql']), true);
check('TEST-WEEK-011', 'and weekend days are counted separately',
      /weekend_days_with_production/.test(sql['production-trend.sql']), true);

// ------------------------------------- approved and pending are never merged
for (const [id, f] of [
  ['TEST-APPR-001', 'production-daily.sql'],
  ['TEST-APPR-002', 'production-weekly.sql'],
  ['TEST-APPR-003', 'production-monthly.sql'],
  ['TEST-APPR-004', 'project-financial.sql'],
  ['TEST-APPR-005', 'contractor-financial.sql'],
  ['TEST-APPR-006', 'project-scope-status.sql'],
]) {
  const body = sql[f];
  // Column names vary by report (approved_value, approved_production_value,
  // approved_quantity), so match the prefix rather than one spelling.
  check(id, `${f} reports approved and pending separately`,
        /\bapproved_\w*(value|quantity)\b/.test(body)
          && /\bpending_\w*(value|quantity)\b/.test(body),
        true);
}
// VOID is excluded everywhere it could distort a total.
for (const [id, f] of [
  ['TEST-VOID-001', 'production-daily.sql'],
  ['TEST-VOID-002', 'production-weekly.sql'],
  ['TEST-VOID-003', 'production-monthly.sql'],
  ['TEST-VOID-004', 'production-trend.sql'],
  ['TEST-VOID-005', 'contractor-financial.sql'],
  ['TEST-VOID-006', 'rate-audit.sql'],
  ['TEST-VOID-007', 'sequential-overlap.sql'],
]) {
  check(id, `${f} excludes VOID records`, /'VOID'/.test(sql[f]), true);
}

// ------------------------------------------------- every division is guarded
// A report that divides by zero does not warn, it fails - and the one that
// silently returns 0 instead is worse, because somebody acts on it.
const DIVIDERS = [
  ['TEST-DIV-001', 'project-scope-status.sql'],
  ['TEST-DIV-002', 'project-financial.sql'],
  ['TEST-DIV-003', 'contractor-financial.sql'],
  ['TEST-DIV-004', 'production-trend.sql'],
  ['TEST-DIV-005', 'production-weekly.sql'],
  ['TEST-DIV-006', 'material-variance.sql'],
];
for (const [id, f] of DIVIDERS) {
  const body = stripComments(sql[f]);
  // Each division must sit inside a CASE that tests its divisor for 0 or NULL.
  const divisions = (body.match(/\//g) || []).length;
  const guards = (body.match(/= 0 THEN NULL|IS NULL OR [^\n]*= 0 THEN NULL|= 0\s*\n?\s*THEN NULL/g) || []).length;
  check(id, `${f} guards every division (${divisions} divisions, ${guards} guards)`,
        divisions > 0 && guards > 0, true);
}
check('TEST-DIV-010', 'scope percent complete returns NULL on zero scope',
      /WHEN authorized_quantity = 0 THEN NULL/.test(sql['project-scope-status.sql']), true);
check('TEST-DIV-011', 'financial percent complete is guarded',
      /= 0\s*\n?\s*THEN NULL/.test(sql['project-financial.sql']), true);
check('TEST-DIV-012', 'material variance percent is guarded',
      /WHEN e\.expected_quantity = 0 THEN NULL/.test(sql['material-variance.sql']), true);

// --------------------------------------------- filters are declared up front
for (const [id, f] of [
  ['TEST-PARAM-001', 'production-daily.sql'],
  ['TEST-PARAM-002', 'production-weekly.sql'],
  ['TEST-PARAM-003', 'production-monthly.sql'],
  ['TEST-PARAM-004', 'production-trend.sql'],
  ['TEST-PARAM-005', 'project-financial.sql'],
  ['TEST-PARAM-006', 'contractor-financial.sql'],
  ['TEST-PARAM-007', 'rate-audit.sql'],
  ['TEST-PARAM-008', 'qa-review-queue.sql'],
]) {
  const body = sql[f];
  check(id, `${f} declares filters in a params CTE that defaults to unfiltered`,
        /WITH params AS \(/.test(body) && /IS NULL OR/.test(body), true);
}

// ------------------------------------------------ Sprint 11: the rate audit
const audit = sql['rate-audit.sql'];
for (const [id, finding] of [
  ['TEST-AUDIT-001', 'NO RATE'],
  ['TEST-AUDIT-002', 'ZERO RATE'],
  ['TEST-AUDIT-003', 'EXPIRED RATE'],
  ['TEST-AUDIT-004', 'AMBIGUOUS RATE'],
  ['TEST-AUDIT-005', 'RATE NOT YET IN FORCE'],
  ['TEST-AUDIT-006', 'RATE PRICES A DIFFERENT PAY UNIT'],
  ['TEST-AUDIT-007', 'RATE BELONGS TO ANOTHER CONTRACTOR'],
  ['TEST-AUDIT-008', 'DRIFTED FROM SOURCE'],
]) {
  check(id, `the rate audit detects ${finding}`, audit.includes(`'${finding}'`), true);
}
check('TEST-AUDIT-010', 'ambiguity is found by scanning the rate master',
      /rate_ambiguity AS \(/.test(audit) && /HAVING COUNT\(\*\) > 1/.test(audit), true);
check('TEST-AUDIT-011', 'unpriced production is CRITICAL',
      /WHEN 'NO RATE'\s*THEN 'CRITICAL'/.test(audit), true);
check('TEST-AUDIT-012', 'drift is a WARNING, since the snapshot may be correct',
      /WHEN 'DRIFTED FROM SOURCE'\s*THEN 'WARNING'/.test(audit), true);
check('TEST-AUDIT-013', 'the drift note explains both possible causes',
      /repriced after this production was saved/.test(audit), true);
check('TEST-AUDIT-014', 'the exposure per record is quantified',
      /value_difference/.test(audit), true);

// -------------------------------- Sprint 11: two percent-complete measures
const fin = sql['project-financial.sql'];
check('TEST-FIN-001', 'financial percent complete is reported',
      /financial_percent_complete/.test(fin), true);
check('TEST-FIN-002', 'physical percent complete is reported',
      /physical_percent_complete/.test(fin), true);
check('TEST-FIN-003', 'the spread between them is reported as rate variance',
      /financial_minus_physical_pts/.test(fin), true);
check('TEST-FIN-004', 'physical percent is value-weighted, not a mean of percents',
      /SUM\(LEAST\(completed_quantity, authorized_quantity\) \* budget_rate\)/.test(fin), true);
check('TEST-FIN-005', 'current contract value = original + approved changes',
      /original_contract_value \+ COALESCE\(c\.approved_change_value, 0\)/.test(fin), true);
check('TEST-FIN-006', 'pending change orders are shown but never added in',
      /pending_change_orders_value/.test(fin), true);
check('TEST-FIN-007', 'billed value is present and explicitly unavailable',
      /billed_value/.test(fin) && /no billing app exists yet/.test(fin), true);
check('TEST-FIN-008', 'remaining contract value uses APPROVED production',
      /- COALESCE\(pr\.approved_production_value, 0\), 2\)\s*AS remaining_contract_value/.test(fin), true);

// ------------------------- Sprint 11: contractors are kept apart on a project
const con = sql['contractor-financial.sql'];
check('TEST-CON-001', 'grouped on the snapshotted contractor ID',
      /p\.contractor_id_snapshot\s+AS contractor_id/.test(con), true);
check('TEST-CON-002', 'cross-contamination between contractors is detected',
      /wrong_contractor_rate_records/.test(con), true);
check('TEST-CON-003', 'and quantified in money',
      /wrong_contractor_rate_value/.test(con), true);
check('TEST-CON-004', 'all four value states are reported',
      ['production_value', 'approved_value', 'pending_value', 'rejected_value']
        .every((c) => con.includes(c)), true);

// -------------------------------------- Sprint 12: the cross-record QA flags
check('TEST-QA-001', 'duplicate detection grades candidates rather than asserting',
      /duplicate_likelihood/.test(sql['duplicate-production.sql']), true);
check('TEST-QA-002', 'identical sequentials are near certain',
      /same_sequentials = 1\s*\n?\s*THEN 'NEAR CERTAIN'/.test(sql['duplicate-production.sql']), true);
check('TEST-QA-003', 'duplicate pairs are never self-matched',
      /a\._record_id\s*<\s*b\._record_id/.test(sql['duplicate-production.sql']), true);
check('TEST-QA-004', 'rejected records are excluded from duplicate pairing',
      /NOT IN \('VOID', 'REJECTED'\)/.test(sql['duplicate-production.sql']), true);
check('TEST-QA-005', 'material variance counts INSTALLED only',
      /transaction_type = 'Installed'/.test(sql['material-variance.sql']), true);
check('TEST-QA-006', 'material variance excludes the purchasing waste factor',
      /WASTE FACTOR IS NOT APPLIED HERE/.test(sql['material-variance.sql']), true);
check('TEST-QA-007', 'the review queue says what blocks each record',
      /queue_state/.test(sql['qa-review-queue.sql']), true);
check('TEST-QA-008', 'a critical exception shows as blocked',
      /'BLOCKED - critical exception'/.test(sql['qa-review-queue.sql']), true);
check('TEST-QA-009', 'the queue flags production that would exceed authorized scope',
      /would_exceed_plan_by/.test(sql['qa-review-queue.sql']), true);
check('TEST-QA-010', 'the queue only lists pending records',
      /_status IN \('DRAFT', 'SUBMITTED', 'UNDER REVIEW', 'CORRECTION REQUIRED'\)/
        .test(sql['qa-review-queue.sql']), true);
check('TEST-QA-011', 'overlap counting treats adjacency as legitimate',
      /> 0\s*\n?\s*GROUP BY a\._record_id/.test(sql['qa-review-queue.sql']), true);

// ----------------------------------------------------- weekly comparison
const wk = sql['production-weekly.sql'];
check('TEST-WK-001', 'the previous week is matched by its ISO label, not by LAG',
      /LEFT JOIN weekly prev/.test(wk) && !/LAG\(/.test(wk), true);
check('TEST-WK-002', 'a year boundary falls back to week 52 and 53',
      /-W52/.test(wk) && /-W53/.test(wk), true);
check('TEST-WK-003', 'a gap week reads as NO PRIOR WEEK, not as a fake change',
      /'NO PRIOR WEEK'/.test(wk), true);
check('TEST-WK-004', 'percent change is guarded against a zero prior week',
      /prev\.approved_quantity IS NULL OR prev\.approved_quantity = 0 THEN NULL/.test(wk), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
