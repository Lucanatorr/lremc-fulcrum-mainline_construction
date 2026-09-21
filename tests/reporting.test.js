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
  'forecast-completion.sql',
  'material-variance.sql',
  'production-daily.sql',
  'production-dashboard.sql',
  'production-monthly.sql',
  'production-trend.sql',
  'production-weekly.sql',
  'productivity.sql',
  'project-financial.sql',
  'project-scope-status.sql',
  'project-summary.sql',
  'qa-review-queue.sql',
  'rate-audit.sql',
  'reel-balance.sql',
  'reel-integrity.sql',
  'remaining-work.sql',
  'segment-integrity.sql',
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

// ------------------------------- ROUND(double, int) does not exist in Postgres
// The Query API runs Postgres, where round() takes either one double or a
// numeric plus a scale. Every Fulcrum numeric column comes back as double, so
// an uncast ROUND(x, 2) is not a rounding bug - the query does not run at all.
for (const f of files) {
  const body = stripComments(sql[f]);
  const uncast = [];
  const re = /\bROUND\s*\(\s*(?!CAST\b)/gi;
  let m;
  while ((m = re.exec(body))) {
    // Only 2-argument calls are affected; look ahead for a scale argument.
    if (/,\s*\d\s*\)/.test(body.slice(m.index, m.index + 400))) uncast.push(m.index);
  }
  check(`TEST-ROUND-${f}`, `${f} casts to numeric before rounding`, uncast, []);
}
// A timestamp cannot be cast to bigint either.
for (const f of files) {
  check(`TEST-TS-${f}`, `${f} does not cast a timestamp to bigint`,
        /CAST\([^)]*_(created|updated)_at[^)]*AS\s+bigint\)/i.test(sql[f]), false);
}

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
      /- COALESCE\(pr\.approved_production_value, 0\)[^;]*?AS remaining_contract_value/.test(fin), true);

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
// Sprint 13 replaced the scored-only approach with derived fingerprints. The
// heuristic survives for records with no fingerprint, so both must be present.
const dup = sql['duplicate-production.sql'];
check('TEST-QA-001', 'the strict fingerprint is matched by GROUP BY, not heuristics',
      /GROUP BY fingerprint_strict\s*\n?\s*HAVING COUNT\(\*\) > 1/.test(dup), true);
check('TEST-QA-001b', 'the segment fingerprint is matched too',
      /GROUP BY fingerprint_segment\s*\n?\s*HAVING COUNT\(\*\) > 1/.test(dup), true);
check('TEST-QA-002', 'a strict fingerprint collision is CRITICAL',
      /'STRICT FINGERPRINT MATCH'\s*\n?\s*AS finding,\s*\n?\s*'CRITICAL'/.test(dup), true);
check('TEST-QA-002b', 'sparse records are excluded from fingerprint matching',
      /fingerprint_strength, 0\) >= 5/.test(dup), true);
check('TEST-QA-002c', 'and reported separately rather than silently unchecked',
      /'TOO SPARSE TO CHECK'/.test(dup), true);
check('TEST-QA-002d', 'the heuristic survives for records with no fingerprint',
      /HEURISTIC MATCH - NO FINGERPRINT/.test(dup) && /agreement_score/.test(dup), true);
check('TEST-QA-002e', 'the likely overstatement is quantified',
      /value_at_risk/.test(dup), true);
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

// --------------------------------------- Sprint 14: structure and segment
const seg = sql['segment-integrity.sql'];
check('TEST-SEG-001', 'duplicate structure IDs are CRITICAL',
      /'DUPLICATE STRUCTURE ID'\s*\n?\s*AS finding,\s*\n?\s*'CRITICAL'/.test(seg), true);
check('TEST-SEG-002', 'duplicate segments are found by the normalized ID',
      /GROUP BY segment_id, segment_type\s*\n?\s*HAVING COUNT\(\*\) > 1/.test(seg), true);
check('TEST-SEG-003', 'different types on one path are not a duplicate',
      /segment_type/.test(seg), true);
check('TEST-SEG-004', 'orphaned segment endpoints are found',
      /SEGMENT ENDPOINT NOT IN MASTER/.test(seg), true);
check('TEST-SEG-005', 'production on an undefined segment is surfaced',
      /PRODUCTION ON UNDEFINED SEGMENT/.test(seg), true);
check('TEST-SEG-006', 'abandoned segments are excluded from duplicate checks',
      /_status <> 'ABANDONED'/.test(seg), true);

// ------------------------------------------- Sprint 15: management reports
const summary = sql['project-summary.sql'];
for (const [id, col] of [
  ['TEST-SUM-001', 'project_status'],
  ['TEST-SUM-002', 'required_completion_date'],
  ['TEST-SUM-003', 'original_contract_value'],
  ['TEST-SUM-004', 'approved_change_orders_value'],
  ['TEST-SUM-005', 'current_contract_value'],
  ['TEST-SUM-006', 'approved_production_value'],
  ['TEST-SUM-007', 'remaining_contract_value'],
  ['TEST-SUM-008', 'physical_percent_complete'],
  ['TEST-SUM-009', 'financial_percent_complete'],
  ['TEST-SUM-010', 'planned_fiber_footage'],
  ['TEST-SUM-011', 'installed_fiber_footage'],
  ['TEST-SUM-012', 'remaining_fiber_footage'],
  ['TEST-SUM-013', 'planned_underground_footage'],
  ['TEST-SUM-014', 'completed_underground_footage'],
  ['TEST-SUM-015', 'remaining_underground_footage'],
  ['TEST-SUM-016', 'splices_complete'],
  ['TEST-SUM-017', 'open_qa_issues'],
  ['TEST-SUM-018', 'pending_production_value'],
]) {
  check(id, `the project summary reports ${col}`, summary.includes(col), true);
}
check('TEST-SUM-020', 'planned footages come from the project master',
      /m\.planned_fiber_footage/.test(summary), true);
check('TEST-SUM-021', 'installed footages come from work category, not code prefixes',
      /work_category = 'Fiber Placement'/.test(summary), true);
check('TEST-SUM-022', 'each physical figure is fenced to one unit of measure',
      /work_category = 'Fiber Placement'\s*\n?\s*AND p\.unit = 'FT'/.test(summary), true);
check('TEST-SUM-023', 'splices are counted in SPLICE units',
      /unit = 'SPLICE'/.test(summary), true);
check('TEST-SUM-024', 'open QA issues include approved records still carrying criticals',
      /critical_exceptions/.test(summary), true);

const dash = sql['production-dashboard.sql'];
for (const [id, col] of [
  ['TEST-DASH-001', 'today_approved_value'],
  ['TEST-DASH-002', 'week_approved_value'],
  ['TEST-DASH-003', 'month_approved_value'],
  ['TEST-DASH-004', 'ptd_approved_value'],
]) {
  check(id, `the dashboard reports ${col}`, dash.includes(col), true);
}
check('TEST-DASH-010', 'all four breakdown levels come from one GROUPING SETS pass',
      /GROUP BY GROUPING SETS/.test(dash)
        && /\(project_id, contractor_id, work_category, labor_code\)/.test(dash), true);
check('TEST-DASH-011', 'quantity appears only at single-labor-code level',
      /CASE WHEN GROUPING\(labor_code\) = 0\s*\n?\s*THEN SUM\(CASE WHEN is_today/.test(dash), true);
check('TEST-DASH-012', 'the dashboard can be run as at a past date',
      /p_as_at/.test(dash), true);

const rem = sql['remaining-work.sql'];
for (const [id, col] of [
  ['TEST-REM-001', 'planned_quantity'],
  ['TEST-REM-002', 'approved_completed_quantity'],
  ['TEST-REM-003', 'pending_quantity'],
  ['TEST-REM-004', 'remaining_quantity'],
  ['TEST-REM-005', 'percent_complete'],
  ['TEST-REM-006', 'budget_rate'],
  ['TEST-REM-007', 'remaining_value'],
  ['TEST-REM-008', 'scope_status'],
]) {
  check(id, `the remaining-work report reports ${col}`, rem.includes(col), true);
}
check('TEST-REM-010', 'all four scope states are derivable',
      ["'NOT STARTED'", "'IN PROGRESS'", "'COMPLETE'", "'OVER PLAN'"]
        .every((v) => rem.includes(v)), true);
check('TEST-REM-011', 'remaining quantity is a plain subtraction, unclamped',
      /r\.planned_quantity - r\.approved_quantity AS remaining_quantity/.test(rem), true);
check('TEST-REM-012', 'over-runs sort to the top',
      /WHEN 'OVER PLAN'\s*THEN 1/.test(rem), true);
check('TEST-REM-013', 'the baseline is shown next to the authorized figure',
      /original_planned_quantity/.test(rem), true);

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


// =========================================================== Sprints 16-18
// ------------------------------------------- Sprint 16: productivity rates
{
  const body = stripComments(sql['productivity.sql']);
  // Convention 2 in its sharpest form: a productivity report is exactly where
  // somebody would be tempted to add feet to each to splices and call it
  // "units produced". Every physical SUM here must be fenced to one unit.
  const sums = body.match(/SUM\([^)]*quantity[^)]*\)/g) || [];
  const unfenced = sums.filter((x) => !/unit\s*=\s*'/.test(x));
  check('TEST-PROD-001', 'every physical quantity sum is fenced to one unit', unfenced, []);
  check('TEST-PROD-002', 'value is aggregated across pay units',
        /SUM\(extended_value\)/.test(body), true);
  check('TEST-PROD-003', 'rates divide by ACTIVE days, not elapsed days',
        /NULLIF\(physical_active_days, 0\)/.test(body), true);
  check('TEST-PROD-004', 'value uses its own denominator',
        /NULLIF\(value_active_days, 0\)/.test(body), true);
  check('TEST-PROD-005', 'weekend work is excluded from a per-working-day rate',
        /work_day_of_week NOT IN \('Saturday', 'Sunday'\)/.test(body), true);
  check('TEST-PROD-006', 'approved only', /_status = 'APPROVED'/.test(body), true);
  check('TEST-PROD-007', 'T&M is excluded from physical production',
        /NOT IN \('HR', 'EVENT'\)/.test(body), true);
  check('TEST-PROD-008', 'all three dimensions the brief names are reported',
        ['CREW', 'CONTRACTOR', 'CONSTRUCTION METHOD'].every((d) => body.includes(`'${d}'`)), true);
  check('TEST-PROD-009', 'a thin sample is labelled rather than presented as a rate',
        /sample_strength/.test(body), true);
}

// --------------------------------------- Sprint 16: estimated completion
{
  const body = stripComments(sql['forecast-completion.sql']);
  check('TEST-FCST-001', 'the recent window is configurable',
        /p_window_days/.test(body), true);
  check('TEST-FCST-002', 'the window is ranked by recency',
        /ROW_NUMBER\(\) OVER/.test(body) && /ORDER BY work_date DESC/.test(body), true);
  // The brief: avoid zero-production days. HAVING is what enforces "active".
  check('TEST-FCST-003', 'zero-production days are excluded from the window',
        /HAVING SUM\(COALESCE\(p\.quantity, 0\)\) > 0/.test(body), true);
  check('TEST-FCST-004', 'division by a zero rate is guarded',
        /avg_daily_quantity, 0\) <= 0 THEN NULL/.test(body), true);
  check('TEST-FCST-005', 'too little history yields NULL, not a number',
        /p_min_days_for_forecast THEN NULL/.test(body), true);
  check('TEST-FCST-006', 'every row states what the forecast rests on',
        /forecast_basis/.test(body), true);
  check('TEST-FCST-007', 'it forecasts per pay unit, never per project',
        /GROUP BY p\.project_id_snapshot, p\.labor_code, p\.work_date/.test(body), true);
  check('TEST-FCST-008', 'weekends are excluded from working days',
        /work_day_of_week NOT IN \('Saturday', 'Sunday'\)/.test(body), true);
}

// ------------------------------------------ Sprint 17: reel balance
{
  const body = stripComments(sql['reel-balance.sql']);
  // The brief's central warning: slack is already inside the consumed
  // sequential range, so subtracting it again understates every reel.
  const remaining = (body.match(/original_reel_footage, 0\)\s*\n?\s*-[\s\S]{0,160}?AS remaining_estimated_footage/) || [''])[0];
  check('TEST-REEL-001', 'remaining footage subtracts consumed and waste',
        /printed_sequential_consumed/.test(remaining) && /waste_recorded/.test(remaining), true);
  check('TEST-REEL-002', 'remaining footage does NOT subtract slack again',
        /slack/i.test(remaining), false);
  for (const c of ['printed_sequential_consumed', 'physical_installed_footage',
                   'slack_installed', 'waste_recorded', 'remaining_estimated_footage']) {
    check(`TEST-REEL-SEP-${c}`, `${c} is reported as its own column`,
          new RegExp(`AS ${c}\\b`).test(body), true);
  }
  check('TEST-REEL-003', 'the handling difference is exposed',
        /handling_difference/.test(body), true);
  check('TEST-REEL-004', 'pending consumption is separate from approved',
        /pending_sequential_consumed/.test(body), true);
  check('TEST-REEL-005', 'an over-consumed reel is called out',
        /OVER-CONSUMED/.test(body), true);
}

// ------------------------------------------ Sprint 17: reel integrity
{
  const body = stripComments(sql['reel-integrity.sql']);
  for (const f of ['IMPOSSIBLE SEQUENTIAL', 'OUTSIDE REEL RANGE',
                   'UNKNOWN REEL', 'NO REEL LINKED', 'REEL OVER-CONSUMED']) {
    check(`TEST-RINT-${f.replace(/ /g, '-')}`, `${f} is detected`, body.includes(`'${f}'`), true);
  }
  check('TEST-RINT-001', 'severities match the app three-level model',
        ['CRITICAL', 'WARNING', 'INFO'].every((x) => body.includes(`'${x}'`)), true);
  // Overlap and duplicate range belong to sequential-overlap.sql. Two
  // implementations of the same check is how two reports come to disagree.
  check('TEST-RINT-002', 'overlap detection is not duplicated here',
        /PARTIAL OVERLAP|EXACT DUPLICATE/.test(body), false);
  check('TEST-RINT-003', 'and the header says where overlap lives',
        /sequential-overlap\.sql/.test(sql['reel-integrity.sql']), true);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
