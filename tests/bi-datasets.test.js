/**
 * Sprint 29 - the Power BI datasets in reports/bi/. Structure checks in the
 * style of reporting.test.js, plus the rules that make a star schema safe:
 * stable keys, one date-key format, and no second rate calculation.
 */
const fs = require('fs');
const path = require('path');
const { load } = require('./harness.js');

let pass = 0, fail = 0;
function check(id, label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${id} ${label}`); }
  else { fail++; console.log(`FAIL  ${id} ${label}\n      got=${a}\n      want=${e}`); }
}
const dir = path.join(__dirname, '..', 'reports', 'bi');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
const sql = Object.fromEntries(files.map(f => [f, fs.readFileSync(path.join(dir, f), 'utf8')]));
const body = f => sql[f].replace(/--[^\n]*/g, '');

// The star schema the brief asks for, plus the datasets it lists.
check('TEST-BI-000', 'every dataset in the model exists', files, [
  'bridge_labor_material.sql', 'dim_contractor.sql', 'dim_crew.sql', 'dim_date.sql', 'dim_labor.sql',
  'dim_material.sql', 'dim_project.sql', 'dim_rate.sql', 'dim_reel.sql', 'dim_segment.sql',
  'dim_structure.sql', 'fact_approval_event.sql', 'fact_change_order_line.sql',
  'fact_material_transaction.sql', 'fact_production.sql', 'fact_qa.sql', 'fact_scope.sql',
]);

for (const f of files) {
  const b = body(f);
  check(`TEST-BI-ADDR-${f}`, `${f} addresses tables by form ID`, /FROM\s+"(MC |Mainline )/.test(b), false);
  const bare = b.match(/(^|[^_\w])status\s*(=|<>|IN\b|NOT\s+IN\b)/gm) || [];
  check(`TEST-BI-STATUS-${f}`, `${f} reads _status, never status`, bare, []);
  check(`TEST-BI-HDR-${f}`, `${f} states its key or grain in the header`, /(key|grain):/.test(sql[f].split('\n')[0] + sql[f].split('\n')[1]), true);
  // One date-key format everywhere: integer YYYYMMDD, so every fact joins dim_date.
  const keys = b.match(/AS \w*date_key\b/g) || [];
  const tocharKeys = b.match(/CAST\(TO_CHAR\([^)]*\), 'YYYYMMDD'\) AS integer\)\s+AS \w*date_key/g) || [];
  const tocharKeysDim = b.match(/CAST\(TO_CHAR\(day, 'YYYYMMDD'\) AS integer\)\s+AS date_key/g) || [];
  check(`TEST-BI-DATEKEY-${f}`, `${f} builds every date key as YYYYMMDD integer`, keys.length, tocharKeys.length + tocharKeysDim.length);
}

// The brief: "Do not calculate contractor rates independently in both
// systems." No dataset multiplies a quantity by a rate; values are exported as
// Fulcrum stored them.
const repriced = files.filter(f => /quantity\s*\*\s*\w*rate|rate\w*\s*\*\s*\w*quantity/i.test(body(f)));
check('TEST-BI-001', 'no dataset re-prices production (quantity x rate)', repriced, []);
check('TEST-BI-002', 'official value is the stored extended_value of APPROVED records',
      /CASE WHEN p\._status = 'APPROVED' THEN p\.extended_value ELSE 0 END\s+AS official_value/.test(body('fact_production.sql')), true);
check('TEST-BI-003', 'the pending split uses the same five statuses as every Fulcrum report',
      (body('fact_production.sql').match(/IN \('DRAFT','SUBMITTED','UNDER REVIEW','CORRECTION REQUIRED','REOPENED'\)/g) || []).length, 3);
check('TEST-BI-004', 'VOID never reaches a production-grain fact',
      ['fact_production.sql', 'fact_qa.sql', 'fact_approval_event.sql', 'dim_crew.sql'].filter(f => !/_status <> 'VOID'/.test(body(f))), []);
check('TEST-BI-005', 'authorized scope = BASELINED/CLOSED only (D-010)',
      /_status IN \('BASELINED', 'CLOSED'\)/.test(body('fact_scope.sql')) && /co\._status = 'APPROVED' THEN 1 ELSE 0 END\s+AS is_authorized/.test(body('fact_change_order_line.sql')), true);
check('TEST-BI-006', 'every fact carries the keys its dimensions join on',
      ['fact_production.sql', 'fact_qa.sql', 'fact_material_transaction.sql']
        .filter(f => !['project_id', 'contractor_id', 'crew_key', 'labor_code'].every(k => new RegExp(`AS ${k}\\b|\\.${k}\\b|\\b${k},`).test(body(f)))), []);
check('TEST-BI-007', 'crew_key is built the same way in every dataset',
      files.filter(f => /crew_key/.test(body(f)))
           .filter(f => !/\|\| '\|' \|\| UPPER\(TRIM\(COALESCE\((p\.|t\.)?crew, '\(none\)'\)\)\)\s+AS crew_key/.test(body(f))), []);
check('TEST-BI-008', 'contractor contact details are not exported', /phone|email|contact_name/.test(body('dim_contractor.sql')), false);

// dim_date must name weeks exactly as the Data Event stamps work_week on each
// record, or a week slicer silently splits. Run the shipped isoWeek.
const h = load('mainline-construction-dev.js');
const iso = h.fn('isoWeek');
const wk = s => { const [y, m, d] = s.split('-').map(Number); const r = iso(new Date(y, m - 1, d)); return r.year + '-W' + String(r.week).padStart(2, '0'); };
check('TEST-BI-009', 'dim_date ISO weeks match the Data Event at the year boundary',
      ['2026-06-30', '2026-09-21', '2026-12-31', '2027-01-01'].map(wk),
      ['2026-W27', '2026-W39', '2026-W53', '2026-W53']);   // as returned live by dim_date's SQL, 2026-11-12
check('TEST-BI-010', 'dim_date uses the ISO year and week patterns', /TO_CHAR\(day, 'IYYY'\) \|\| '-W' \|\| TO_CHAR\(day, 'IW'\)\s+AS work_week/.test(body('dim_date.sql')), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
