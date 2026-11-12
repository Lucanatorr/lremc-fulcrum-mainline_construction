/**
 * Sprint 31 - backup, recovery and business continuity.
 *
 *   scripts/backup_verify.py   an export is complete, and nothing was deleted
 *   scripts/known_good.py      the previous known-good Data Event is retained
 *   scripts/config_snapshot.py configuration drift
 *   scripts/mass_change.py     export, count, impact, sample, reconcile
 *   data/incident-register.csv the fields the brief names
 *
 * TEST-CONT-002 runs against the LIVE backup of 2026-11-12 (ids and versions
 * only, tests/fixtures/backup-live-2026-11-12): the Python fingerprint must
 * equal the one the Query API computed, or verification would prove nothing.
 */
const { spawnSync } = require('child_process');
const fs = require('fs'), os = require('os'), path = require('path'), crypto = require('crypto');

let pass = 0, fail = 0;
function check(id, label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${id} ${label}`); }
  else { fail++; console.log(`FAIL  ${id} ${label}\n      got=${a}\n      want=${e}`); }
}
const root = path.join(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'continuity-'));
const py = (args) => spawnSync('python3', args, { cwd: root, encoding: 'utf8' });
const live = path.join(root, 'tests/fixtures/backup-live-2026-11-12');
const md5 = s => crypto.createHash('md5').update(s).digest('hex');
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const copyDir = (from, to) => { fs.mkdirSync(to, { recursive: true }); for (const f of fs.readdirSync(from)) fs.copyFileSync(path.join(from, f), path.join(to, f)); };

// ---- exports and manifest -------------------------------------------------
const manifestSql = fs.readFileSync(path.join(root, 'reports/continuity/backup-manifest.sql'), 'utf8');
const exportsSql = fs.readdirSync(path.join(root, 'reports/continuity')).filter(f => /^backup-.*\.sql$/.test(f) && f !== 'backup-manifest.sql');
const datasetsInManifest = [...manifestSql.matchAll(/SELECT '([a-z_]+)' AS dataset, '([^']+)' AS source_table/g)].map(m => [m[1], m[2]]);
const baseline = JSON.parse(fs.readFileSync(path.join(root, 'fulcrum/baseline-2026-11-12.json')));
check('TEST-CONT-001', 'one export per manifest dataset; every Development form is backed up',
  [exportsSql.map(f => f.slice(7, -4).replace(/-/g, '_')).sort(), baseline.forms.every(f => datasetsInManifest.some(([, t]) => t === f.id))],
  [datasetsInManifest.map(d => d[0]).sort(), true]);
check('TEST-CONT-001b', 'each export reads its own table, every column, in byte order',
  exportsSql.every(f => { const s = fs.readFileSync(path.join(root, 'reports/continuity', f), 'utf8'); const ds = f.slice(7, -4).replace(/-/g, '_');
    const t = datasetsInManifest.find(d => d[0] === ds)[1]; return s.includes(`SELECT *\nFROM "${t}"`) && /COLLATE "C"/.test(s) && /NOT A PLATFORM BACKUP/.test(s); }), true);

let r = py(['scripts/backup_verify.py', live]);
check('TEST-CONT-002', 'the live 2026-11-12 backup verifies: Python fingerprint == Query API fingerprint, 15 datasets',
  [r.status, /15 dataset\(s\), 0 FAIL/.test(r.stdout), (r.stdout.match(/^OK +\w+ +OK /mg) || []).length], [0, true, 15]);

// Build a small backup to break on purpose.
const mk = (dir, prod, manifestRows) => { fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'production.json'), JSON.stringify({ rows: prod }));
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ rows: manifestRows })); };
const fpOf = rows => md5(rows.map(x => `${x._record_id}:${x._version}`).sort().join(','));
const rowsA = [{ _record_id: 'b-2', _version: 3 }, { _record_id: 'a-1', _version: 1 }, { _record_id: 'c-3', _version: 2 }];
const man = rows => [{ dataset: 'production', source_table: '06c36c8e-4a88-4cf3-a691-9a792f8374d2', row_count: rows.length, fingerprint: fpOf(rows) }];
mk(path.join(tmp, 'b1'), rowsA, man(rowsA));
check('TEST-CONT-003', 'a complete export passes', py(['scripts/backup_verify.py', path.join(tmp, 'b1')]).status, 0);

mk(path.join(tmp, 'b2'), rowsA.slice(0, 2), man(rowsA));
r = py(['scripts/backup_verify.py', path.join(tmp, 'b2')]);
check('TEST-CONT-004', 'a truncated export fails COUNT MISMATCH', [r.status, /COUNT MISMATCH/.test(r.stdout)], [1, true]);

mk(path.join(tmp, 'b3'), rowsA.map(x => x._record_id === 'a-1' ? { ...x, _version: 2 } : x), man(rowsA));
r = py(['scripts/backup_verify.py', path.join(tmp, 'b3')]);
check('TEST-CONT-005', 'a record edited between export and manifest fails FINGERPRINT', [r.status, /FINGERPRINT/.test(r.stdout)], [1, true]);

fs.mkdirSync(path.join(tmp, 'b4'));
fs.writeFileSync(path.join(tmp, 'b4', 'manifest.json'), JSON.stringify({ rows: man(rowsA) }));
r = py(['scripts/backup_verify.py', path.join(tmp, 'b4')]);
check('TEST-CONT-006', 'a dataset with no export file fails MISSING FILE', [r.status, /MISSING FILE/.test(r.stdout)], [1, true]);

const rowsB = [{ _record_id: 'a-1', _version: 2 }, { _record_id: 'c-3', _version: 2 }, { _record_id: 'd-4', _version: 1 }];
mk(path.join(tmp, 'b5'), rowsB, man(rowsB));
r = py(['scripts/backup_verify.py', path.join(tmp, 'b5'), '--previous', path.join(tmp, 'b1')]);
check('TEST-CONT-007', 'a record gone since the previous backup is DELETED (FAIL); edits and additions are counted, not failed',
  [r.status, /DELETED +b-2 \(version 3\)/.test(r.stdout), /1 changed, 1 added/.test(r.stdout)], [1, true, true]);

// CSV export from the Query UI works the same.
fs.mkdirSync(path.join(tmp, 'b6'));
fs.writeFileSync(path.join(tmp, 'b6', 'production.csv'), '_record_id,_version,quantity\n' + rowsA.map(x => `${x._record_id},${x._version},10`).join('\n') + '\n');
fs.writeFileSync(path.join(tmp, 'b6', 'manifest.csv'), 'dataset,source_table,row_count,last_server_update,fingerprint\n' + `production,x,3,,${fpOf(rowsA)}\n`);
check('TEST-CONT-008', 'CSV exports verify too', py(['scripts/backup_verify.py', path.join(tmp, 'b6')]).status, 0);

const evid = JSON.parse(fs.readFileSync(path.join(root, 'data/backup-manifests/2026-11-12.json')));
check('TEST-CONT-009', 'the evidence kept in the repository is the verified live manifest, with no record data',
  [evid.verified, evid.datasets.length, evid.datasets.find(d => d.dataset === 'rates').row_count, JSON.stringify(evid).includes('contractor_rate')],
  [true, 15, 146, false]);

// ---- known-good retention -------------------------------------------------
r = py(['scripts/known_good.py', 'check']);
check('TEST-CONT-010', 'every retained script matches its hash and the live baseline', [r.status, r.stdout.trim()], [0, '0 problem(s)']);

const reg = JSON.parse(fs.readFileSync(path.join(root, 'fulcrum/known-good/registry.json')));
const forms = Object.fromEntries(baseline.forms.map(f => [f.id, f]));
check('TEST-CONT-011', 'every app with a Data Event is registered, with the live version',
  [Object.keys(reg.apps).length, Object.values(reg.apps).every(e => forms[e.form_id].data_event_version === e.live.version)], [10, true]);

r = py(['scripts/known_good.py', 'rollback', 'mc-contractor-rate-dev']);
check('TEST-CONT-012', 'rolling the rate script back to v1.0.0 is refused, with the reason', [r.status, /REFUSED.*clears unit/.test(r.stderr), r.stdout], [1, true, '']);

r = py(['scripts/known_good.py', 'rollback', 'mainline-construction-dev']);
check('TEST-CONT-013', 'the Mainline rollback target is v7.6.0 byte for byte (commit 6b2a9a3, live 2026-11-09)',
  [r.status, sha(r.stdout), sha(spawnSync('git', ['show', '6b2a9a3:fulcrum/data-events/mainline-construction-dev.js'], { cwd: root }).stdout), /v7\.6\.0/.test(r.stdout.slice(0, 200))],
  [0, reg.apps['mainline-construction-dev'].rollback.sha256, reg.apps['mainline-construction-dev'].rollback.sha256, true]);

r = py(['scripts/known_good.py', 'rollback', 'mc-segment-dev']);
check('TEST-CONT-014', 'a first version has no rollback target: disable the handler', [r.status, /disable the handler/.test(r.stderr)], [1, true]);

// preflight and promote, on a copy of the registry
const kg = path.join(tmp, 'kg'); copyDir(path.join(root, 'fulcrum/known-good'), kg);
const mainId = reg.apps['mainline-construction-dev'].form_id;
const liveMain = fs.readFileSync(path.join(kg, 'mainline-construction-dev.js'), 'utf8');
fs.writeFileSync(path.join(tmp, 'fg-ok.json'), JSON.stringify({ form: { id: mainId, script: liveMain } }));
fs.writeFileSync(path.join(tmp, 'fg-edited.json'), JSON.stringify({ form: { id: mainId, script: liveMain + '\n// edited in the web editor' } }));
check('TEST-CONT-015', 'preflight passes when the live script is the registered known-good',
  py(['scripts/known_good.py', '--dir', kg, 'preflight', 'mainline-construction-dev', path.join(tmp, 'fg-ok.json')]).status, 0);
r = py(['scripts/known_good.py', '--dir', kg, 'preflight', 'mainline-construction-dev', path.join(tmp, 'fg-edited.json')]);
check('TEST-CONT-016', 'preflight STOPS when the live script was changed outside the release process', [r.status, /changed outside/.test(r.stdout)], [1, true]);

const v78 = liveMain.replace("CALC_VERSION = 'DE-7.7.0'", "CALC_VERSION = 'DE-7.8.0'");
fs.writeFileSync(path.join(tmp, 'fg-new.json'), JSON.stringify({ form: { id: mainId, script: v78 } }));
r = py(['scripts/known_good.py', '--dir', kg, 'promote', 'mainline-construction-dev', path.join(tmp, 'fg-new.json'), '--version', '7.8.0', '--commit', 'abc1234', '--date', '2026-12-01']);
const reg2 = JSON.parse(fs.readFileSync(path.join(kg, 'registry.json')));
const m2 = reg2.apps['mainline-construction-dev'];
check('TEST-CONT-017', 'promote: the old known-good (7.7.0) becomes the rollback, its exact bytes retained; the new live is 7.8.0',
  [r.status, m2.live.version, m2.rollback.version, m2.rollback.safe_to_redeploy, sha(fs.readFileSync(path.join(kg, 'mainline-construction-dev.rollback.js'))) === reg.apps['mainline-construction-dev'].live.sha256,
   sha(fs.readFileSync(path.join(kg, 'mainline-construction-dev.js'))) === m2.live.sha256],
  [0, '7.8.0', '7.7.0', true, true, true]);

// ---- configuration snapshot -----------------------------------------------
const cfg = path.join(tmp, 'cfg'); fs.mkdirSync(cfg);
const formA = { id: mainId, name: 'Mainline Construction - Development', updated_at: 'x', script: liveMain,
  elements: [{ key: 'a', type: 'Section', elements: [{ key: 'b', type: 'TextField' }] }], status_field: { choices: [{ value: 'DRAFT' }, { value: 'APPROVED' }] } };
fs.writeFileSync(path.join(cfg, mainId + '.json'), JSON.stringify({ form: formA }));
fs.writeFileSync(path.join(cfg, 'cl_1.json'), JSON.stringify({ choice_list: { id: 'cl1', name: 'MC Unit of Measure', choices: [{ label: 'FT', value: 'FT' }] } }));
const snapOut = path.join(tmp, 'snap.json');
r = py(['scripts/config_snapshot.py', cfg, '--date', '2026-12-01', '--out', snapOut]);
const snap = JSON.parse(fs.readFileSync(snapOut));
check('TEST-CONT-018', 'snapshot: version found by hash in the registry, nested elements counted, statuses kept',
  [r.status, snap.forms[0].data_event_version, snap.forms[0].element_count, snap.forms[0].statuses],
  [0, '7.7.0', 2, ['DRAFT', 'APPROVED']]);
check('TEST-CONT-019', 'compare against itself: SAME', py(['scripts/config_snapshot.py', cfg, '--compare', snapOut]).status, 0);
formA.script = liveMain + '\n// hotfix'; formA.elements[0].elements.push({ key: 'c', type: 'TextField' });
fs.writeFileSync(path.join(cfg, mainId + '.json'), JSON.stringify({ form: formA }));
r = py(['scripts/config_snapshot.py', cfg, '--compare', snapOut]);
check('TEST-CONT-020', 'compare after an unregistered script edit and an added field: DIFFERS, UNREGISTERED, 2 -> 3 elements',
  [r.status, /DIFFERS .*UNREGISTERED/.test(r.stdout), /2 -> 3 elements/.test(r.stdout)], [1, true, true]);

// ---- mass change -----------------------------------------------------------
const P = (id, status, qty, rate, extra = {}) => Object.assign({ _record_id: id, _version: 1, _status: status, production_id: 'PRD-' + id,
  project_id_snapshot: 'PRJ-000001', contractor_id_snapshot: 'CON-0001', labor_code: 'BM60(1)(1.25)DP', quantity: qty, contractor_rate: rate,
  extended_value: qty * rate, crew: 'test', exception_flags: '' }, extra);
const before = [P('r1', 'DRAFT', 100, 10), P('r2', 'SUBMITTED', 200, 10), P('r3', 'APPROVED', 300, 10), P('r4', 'DRAFT', 50, 10, { project_id_snapshot: 'PRJ-000002' })];
const exp = path.join(tmp, 'mc-before.json'); fs.writeFileSync(exp, JSON.stringify({ rows: before }));
const planF = path.join(tmp, 'plan.json');

r = py(['scripts/mass_change.py', 'plan', exp, '--where', 'project_id_snapshot=PRJ-000001', '--set', 'contractor_rate=12', '--out', planF]);
check('TEST-CONT-021', 'a set containing APPROVED production is BLOCKED (D-018: correct through the lifecycle)', [r.status, /BLOCKED/.test(r.stdout), /HISTORY +1 /.test(r.stdout)], [2, true, true]);

r = py(['scripts/mass_change.py', 'plan', exp, '--where', 'project_id_snapshot=PRJ-000001', '--where', 'crew=test', '--set', 'contractor_rate=12', '--allow-history', '--sample', '2', '--out', planF]);
let plan = JSON.parse(fs.readFileSync(planF));
check('TEST-CONT-022', 'plan: count by status, money impact per project/contractor, approved value shown separately',
  [r.status, plan.affected_count, plan.by_status, plan.impact[0].value_before, plan.impact[0].value_after_estimate, plan.impact[0].approved_value_before, plan.net_value_delta],
  [0, 3, { DRAFT: 1, SUBMITTED: 1, APPROVED: 1 }, 6000, 7200, 3000, 1200]);
check('TEST-CONT-023', 'the sample is deterministic and drawn from the affected set only',
  [plan.sample_ids.length, plan.sample_ids.every(i => ['r1', 'r2', 'r3'].includes(i)),
   JSON.parse((py(['scripts/mass_change.py', 'plan', exp, '--where', 'project_id_snapshot=PRJ-000001', '--set', 'contractor_rate=12', '--allow-history', '--sample', '2', '--out', planF + '2']), fs.readFileSync(planF + '2'))).sample_ids],
  [2, true, plan.sample_ids]);

r = py(['scripts/mass_change.py', 'plan', exp, '--where', 'project_id_snapshot=PRJ-000002', '--set', 'project_id_snapshot=PRJ-000003', '--out', planF + 'm']);
const pm = JSON.parse(fs.readFileSync(planF + 'm'));
check('TEST-CONT-024', 'moving records between projects shows the value leaving one bucket and arriving in another',
  pm.impact.map(i => [i.project_id, i.value_before, i.value_after_estimate]), [['PRJ-000002', 500, 0], ['PRJ-000003', 0, 500]]);

r = py(['scripts/mass_change.py', 'plan', exp, '--set', 'crew=A', '--out', planF + 'x']);
check('TEST-CONT-025', 'a change with no selection is refused ("everything" is not a plan)', [r.status !== 0, /not a plan/.test(r.stderr)], [true, true]);
r = py(['scripts/mass_change.py', 'plan', exp, '--where', 'crew=test', '--set', 'crew_name=A', '--out', planF + 'x']);
check('TEST-CONT-026', 'an unknown field is refused: use the actual field keys', [r.status !== 0, /actual field keys/.test(r.stderr)], [true, true]);

// reconcile: sample step, then full step
const applied = (ids, extra = {}) => before.map(x => ids.includes(x._record_id)
  ? Object.assign({}, x, { contractor_rate: 12, extended_value: x.quantity * 12, _version: 2 }, extra[x._record_id] || {}) : Object.assign({}, x));
plan = JSON.parse(fs.readFileSync(planF));
const write = (name, rows) => { const f = path.join(tmp, name); fs.writeFileSync(f, JSON.stringify({ rows })); return f; };
r = py(['scripts/mass_change.py', 'reconcile', planF, write('s.json', applied(plan.sample_ids)), '--sample-only', '--allow-field', 'extended_value']);
check('TEST-CONT-027', 'sample step: the sample shows exactly the change, every other record untouched', [r.status, /SAMPLE: 2 of 2/.test(r.stdout)], [0, true]);

r = py(['scripts/mass_change.py', 'reconcile', planF, write('s2.json', applied(['r1', 'r2', 'r3'])), '--sample-only', '--allow-field', 'extended_value']);
check('TEST-CONT-028', 'sample step: a record changed beyond the sample fails OUTSIDE THE SET', [r.status, /OUTSIDE THE SET CHANGED/.test(r.stdout)], [1, true]);

const resF = path.join(tmp, 'result.json');
r = py(['scripts/mass_change.py', 'reconcile', planF, write('f.json', applied(['r1', 'r2', 'r3'])), '--allow-field', 'extended_value', '--out', resF]);
check('TEST-CONT-029', 'full reconcile passes; derived value changes are reported as INFO; the result is written for the record',
  [r.status, /RECONCILE: 3 of 3/.test(r.stdout), (r.stdout.match(/DERIVED CHANGE/g) || []).length, JSON.parse(fs.readFileSync(resF)).fails], [0, true, 3, 0]);

r = py(['scripts/mass_change.py', 'reconcile', planF, write('f2.json', applied(['r1', 'r2', 'r3'])), '--out', resF]);
check('TEST-CONT-030', 'without --allow-field the recalculated value is an UNPLANNED FIELD CHANGE', [r.status, (r.stdout.match(/UNPLANNED FIELD CHANGE +extended_value/g) || []).length], [1, 3]);

r = py(['scripts/mass_change.py', 'reconcile', planF, write('f3.json', applied(['r1', 'r3'], { r3: { crew: 'B' } }).filter(x => x._record_id !== 'r4')), '--allow-field', 'extended_value']);
check('TEST-CONT-031', 'reconcile catches a target left unchanged, an unplanned edit and a deleted record',
  [r.status, /r2 +TARGET NOT CHANGED/.test(r.stdout), /r3 +UNPLANNED FIELD CHANGE +crew/.test(r.stdout), /r4 +RECORD GONE/.test(r.stdout)], [1, true, true, true]);

// ---- incident register ----------------------------------------------------
const csv = fs.readFileSync(path.join(root, 'data/incident-register.csv'), 'utf8');
function parseCsv(t) { const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (c !== '\r') f += c; }
  if (f || row.length) { row.push(f); rows.push(row); } return rows; }
const [hdr, ...inc] = parseCsv(csv);
const I = inc.map(x => Object.fromEntries(hdr.map((h, i) => [h, x[i]])));
check('TEST-CONT-032', 'the register carries every field the brief names',
  ['incident_id', 'date_detected', 'detected_by', 'description', 'projects', 'records', 'financial_impact', 'operational_impact', 'root_cause', 'correction', 'preventive_action', 'resolution_date'].every(h => hdr.includes(h)), true);
check('TEST-CONT-033', 'IDs are INC-nnnn, unique, every row complete',
  [I.every(x => /^INC-\d{4}$/.test(x.incident_id)), new Set(I.map(x => x.incident_id)).size === I.length, I.every(x => x.description && x.detected_by && x.financial_impact && x.preventive_action)], [true, true, true]);
check('TEST-CONT-034', 'dates are real dates; RESOLVED has a resolution date not before detection; OPEN/MITIGATED has none',
  I.filter(x => !(/^\d{4}-\d{2}-\d{2}$/.test(x.date_detected) && !isNaN(Date.parse(x.date_detected)) &&
    (/^RESOLVED/.test(x.status) ? (x.resolution_date >= x.date_detected && x.root_cause && x.correction) : (x.resolution_date === '' && /^(OPEN|MITIGATED)/.test(x.status))))).map(x => x.incident_id), []);
check('TEST-CONT-035', 'severity is one of CRITICAL/HIGH/MEDIUM/LOW', I.every(x => ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].includes(x.severity)), true);
check('TEST-CONT-036', 'no secret in the register: no webhook URL, no token-looking string',
  [/https?:\/\//.test(csv), /[A-Za-z0-9]{40,}/.test(csv)], [false, false]);

fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
