/**
 * Sprint 30 - "Re-exporting PRD-000123 must not create duplicate financial
 * activity." scripts/export_delta.py driven through a record's whole life:
 * approve, re-export, reopen, re-approve at a different quantity, reverse,
 * plus an adjustment and a void. Starts from the live export of 2026-11-12.
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
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'export-delta-'));
const state = path.join(tmp, 'state.json');
const live = JSON.parse(fs.readFileSync(path.join(root, 'tests/fixtures/export-live-2026-11-12.json'))).rows;

let n = 0;
function run(rows) {
  const f = path.join(tmp, `export-${++n}.json`);
  fs.writeFileSync(f, JSON.stringify({ rows }));
  const r = spawnSync('python3', ['scripts/export_delta.py', f, '--state', state], { cwd: root, encoding: 'utf8' });
  if (r.status !== 0) console.log(r.stdout, r.stderr);
  // "POST <key> <reason> qty <q> value <v> <id>" -> "<reason> qty <q> value <v> <id>"
  return r.stdout.split('\n').filter(l => l.startsWith('POST ')).map(l => l.replace(/\s+/g, ' ').split(' ').slice(2).join(' '));
}
const row = (base, over) => Object.assign({}, base, over);
const [rec143, recFB] = live;
const hash = s => require('crypto').createHash('md5').update(s).digest('hex');

check('TEST-EXP-001', 'the live export (nothing approved) posts nothing', run(live), []);

const fbApproved = row(recFB, { record_status: 'APPROVED', official_quantity: 500, official_value: 5000, export_hash: hash('fb-approved-500') });
check('TEST-EXP-002', 'an approval posts its value once', run([rec143, fbApproved]), ['NEW qty +500 value +5000.00 PRD-2026-FB71F938']);
check('TEST-EXP-003', 're-exporting the same state posts nothing (idempotent)', run([rec143, fbApproved]), []);
check('TEST-EXP-004', 'and a third time still nothing', run([rec143, fbApproved]), []);

const fbReopened = row(recFB, { record_status: 'REOPENED', official_quantity: 0, official_value: 0, export_hash: hash('fb-reopened') });
check('TEST-EXP-005', 'reopening takes the value back out', run([rec143, fbReopened]), ['TAKEN BACK qty -500 value -5000.00 PRD-2026-FB71F938']);

const fbReapproved = row(recFB, { record_status: 'APPROVED', official_quantity: 450, official_value: 4500, export_hash: hash('fb-approved-450') });
check('TEST-EXP-006', 're-approval at 450 posts 4500, not 5000 + 4500', run([rec143, fbReapproved]), ['NEW qty +450 value +4500.00 PRD-2026-FB71F938']);

const fbReversed = row(recFB, { record_status: 'REVERSED', official_quantity: 0, official_value: 0, export_hash: hash('fb-reversed') });
const adj = { production_id: 'PRD-2026-ADJ00001', project_id: 'PRJ-000001', contractor_id: 'CON-0001', labor_code: 'BM60(2)(1.25)DP',
              unit: 'FT', period: '2026-11', record_status: 'APPROVED', official_quantity: -50, official_value: -600, export_hash: hash('adj') };
const out = run([rec143, fbReversed, adj]);
check('TEST-EXP-007', 'a reversal and an adjustment each post once, on their own key', out.sort(),
      ['NEW qty -50 value -600.00 PRD-2026-ADJ00001', 'TAKEN BACK qty -450 value -4500.00 PRD-2026-FB71F938'].sort());

const s = JSON.parse(fs.readFileSync(state));
check('TEST-EXP-008', 'downstream value always equals the CURRENT Fulcrum value',
      [s['PRD-2026-FB71F938'].official_value, s['PRD-2026-ADJ00001'].official_value, s['PRD-2026-143C1840'].official_value], [0, -600, 0]);

// A status change that moves no money (SUBMITTED -> UNDER REVIEW) posts nothing.
const r143 = row(rec143, { record_status: 'UNDER REVIEW', export_hash: hash('143-review') });
check('TEST-EXP-009', 'a status change that moves no money posts nothing', run([r143, fbReversed, adj]), []);

// A record missing from an export is reported, never silently reversed.
const r = spawnSync('python3', ['scripts/export_delta.py', (() => { const f = path.join(tmp, 'partial.json'); fs.writeFileSync(f, JSON.stringify({ rows: [r143] })); return f; })(), '--state', state, '--dry-run'], { cwd: root, encoding: 'utf8' });
check('TEST-EXP-010', 'a record absent from the export is flagged, not reversed', [/MISSING PRD-2026-ADJ00001/.test(r.stdout), /0 posting/.test(r.stdout)], [true, true]);

check('TEST-EXP-011', 'posting keys are deterministic: production_id|export_hash', (() => {
  const f = path.join(tmp, 'k.json'); fs.writeFileSync(f, JSON.stringify({ rows: [fbApproved] }));
  const st = path.join(tmp, 'k-state.json');
  const o = path.join(tmp, 'k.csv');
  spawnSync('python3', ['scripts/export_delta.py', f, '--state', st, '--out', o], { cwd: root });
  return fs.readFileSync(o, 'utf8').split('\n')[1].split(',')[0];
})(), `PRD-2026-FB71F938|${hash('fb-approved-500')}`);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
