/**
 * Sprint 32 - the final handoff must stay maintainable without the original
 * conversation: every section present, every file it points to real, the
 * generated dictionaries current, and the registers well-formed.
 */
const { spawnSync } = require('child_process');
const fs = require('fs'), path = require('path');

let pass = 0, fail = 0;
function check(id, label, actual, expected) {
  const a = JSON.stringify(actual), e = JSON.stringify(expected);
  if (a === e) { pass++; console.log(`PASS  ${id} ${label}`); }
  else { fail++; console.log(`FAIL  ${id} ${label}\n      got=${a}\n      want=${e}`); }
}
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const py = args => spawnSync('python3', args, { cwd: root, encoding: 'utf8' });

// ---- the 36 sections, in the brief's order ----------------------------------
const SECTIONS = ['Executive Summary', 'Architecture', 'Fulcrum App Inventory', 'Field Dictionary', 'Field Key Dictionary',
  'Relationship Diagram', 'Labor Code Model', 'Contractor Rate Model', 'Material Model', 'Labor-to-Material Mapping Model',
  'Fiber Sequential Logic', 'Underground Workflow', 'Aerial Workflow', 'Splicing Workflow', 'QA/QC Workflow', 'Approval Workflow',
  'Scope Management', 'Change Order Management', 'Financial Calculations', 'Remaining Work Calculations', 'Data Event Documentation',
  'Reporting Architecture', 'Security Model', 'Offline Capability Matrix', 'Testing Results', 'Known Limitations',
  'Administrator Guide', 'Field User Guide', 'Project Manager Guide', 'Contract/Finance Guide', 'Support Procedures',
  'Backup/Recovery Procedures', 'Change-Control Procedures', 'Release History', 'Open Issues', 'Recommended Future Enhancements'];
const handoff = read('docs/HANDOFF.md');
const heads = [...handoff.matchAll(/^## (\d+)\. (.+)$/mg)].map(m => [Number(m[1]), m[2].trim()]);
check('TEST-HO-001', 'HANDOFF.md has the 36 sections, numbered and titled as the brief lists them',
  heads, SECTIONS.map((t, i) => [i + 1, t]));
const bodies = handoff.split(/^## \d+\. .+$/m).slice(1);
check('TEST-HO-002', 'no section is empty (each has at least 150 characters of content)',
  bodies.map((b, i) => [i + 1, b.replace(/\s+/g, ' ').trim().length >= 150]).filter(x => !x[1]).map(x => x[0]), []);

// ---- every path the handoff documents point to exists ---------------------
const DOCS = ['docs/HANDOFF.md', 'docs/final-inventory.md', 'docs/relationship-map.md', 'docs/sprint-31-backup-recovery.md',
  'docs/sprint-32-continuous-improvement.md', 'docs/release-history.md', 'CLAUDE.md'];
const missing = [];
for (const d of DOCS) {
  for (const m of read(d).matchAll(/`((?:docs|reports|scripts|data|fulcrum|tests)\/[A-Za-z0-9_.\/-]+|CLAUDE\.md|\.mcp\.json)`/g)) {
    let p = m[1].replace(/[.,:;]$/, '');
    if (/<|\*/.test(p)) continue;                                  // a pattern such as backup-<dataset>.sql
    if (!fs.existsSync(path.join(root, p))) missing.push(`${d}: ${p}`);
  }
}
check('TEST-HO-003', 'every file or folder named in the handoff documents exists', missing, []);

// ---- generated documents are current --------------------------------------
let r = py(['scripts/field_dictionary.py', '--check']);
check('TEST-HO-004', 'docs/field-dictionary.md is current with fulcrum/schemas', [r.status, /current \(387 fields\)/.test(r.stdout)], [0, true]);
r = py(['scripts/report_inventory.py', '--check']);
const reportCount = ['reports', 'reports/bi', 'reports/continuity'].reduce((n, d) => n + fs.readdirSync(path.join(root, d)).filter(f => f.endsWith('.sql')).length, 0);
check('TEST-HO-005', 'docs/report-inventory.md is current, and every report has an audience',
  [r.status, new RegExp(`current \\(${reportCount} reports\\)`).test(r.stdout), /NO AUDIENCE/.test(r.stdout)], [0, true, false]);
check('TEST-HO-006', 'the inventory and handoff state the real report count', [reportCount, /\*\*74 reports\*\*/.test(read('docs/final-inventory.md')), /74 read-only SQL reports/.test(handoff)], [74, true, true]);

// ---- final inventory ------------------------------------------------------
const inv = read('docs/final-inventory.md');
const baseline = JSON.parse(read('fulcrum/baseline-2026-11-12.json'));
check('TEST-HO-007', 'every Development app is in the final inventory, by full form ID',
  baseline.forms.filter(f => !inv.includes('`' + f.id + '`')).map(f => f.name), []);
const man = Object.fromEntries(JSON.parse(read('data/backup-manifests/2026-11-12.json')).datasets.map(d => [d.dataset, d.row_count]));
check('TEST-HO-008', 'record counts in the inventory are the live manifest\'s',
  [man.production, man.rates, man.materials, man.mappings, man.projects, man.contractors,
   /\| 2 \(DRAFT 1, SUBMITTED 1\)/.test(inv), /\| 146 \(ACTIVE\)/.test(inv), /\| 135 \(ACTIVE\)/.test(inv), /\| 125 \(APPROVED 58, NEEDS REVIEW 67\)/.test(inv)],
  [2, 146, 135, 125, 3, 3, true, true, true, true]);

// ---- relationship map -----------------------------------------------------
const rel = read('docs/relationship-map.md');
check('TEST-HO-009', 'the relationship map covers the seven chains the brief names',
  ['Project → Project Scope → Production', 'Production → Contractor, Labor Code, Rate, Structure/Segment, Fiber Reel',
   'Labor Code → Labor-Material Mapping → Material', 'Production → Material Transactions', 'Project → Change Orders',
   'Production → QA / Approval', 'Production → Reporting / Financials'].filter(c => !rel.includes(c)), []);
// Every [key] cited in the map is a real element key with the data_name it is cited beside.
const keys = {};
for (const f of fs.readdirSync(path.join(root, 'fulcrum/schemas')).filter(f => f.endsWith('.elements.json'))) {
  (function walk(els) { for (const e of els) { if (e.key) keys[e.key] = e.data_name; walk(e.elements || []); } })(JSON.parse(read('fulcrum/schemas/' + f)));
}
// A citation is a field name (backticked, or a snake_case name in the diagram) followed by [key].
const cited = [...rel.matchAll(/(?:`([a-z_]+)`|\b([a-z]+_[a-z_]+)) \[([a-z]\d{3})\]/g)].map(m => [m[1] || m[2], m[3]]);
check('TEST-HO-010', 'every field key cited in the relationship map exists and names that field',
  [cited.length > 15, cited.filter(([dn, k]) => keys[k] !== dn).map(x => x.join('='))], [true, []]);

// ---- enhancement backlog --------------------------------------------------
function parseCsv(t) { const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < t.length; i++) { const c = t[i];
    if (q) { if (c === '"' && t[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; } else if (c !== '\r') f += c; }
  if (f || row.length) { row.push(f); rows.push(row); } return rows; }
const [bh, ...brows] = parseCsv(read('data/enhancement-backlog.csv'));
const B = brows.map(x => Object.fromEntries(bh.map((h, i) => [h, x[i]])));
const CLASSES = ['BUG FIX', 'DATA CORRECTION', 'CONFIGURATION CHANGE', 'BUSINESS RULE CHANGE', 'NEW FEATURE', 'REPORT ENHANCEMENT', 'INTEGRATION'];
check('TEST-HO-011', 'the backlog carries every field the brief names',
  ['request_id', 'description', 'requester', 'business_problem', 'users_affected', 'priority', 'benefit', 'complexity', 'risk', 'dependencies', 'decision', 'target_sprint'].filter(h => !bh.includes(h)), []);
check('TEST-HO-012', 'every request has a unique ENH-nnn ID, a valid class and priority, and no blank field',
  B.filter(x => !(/^ENH-\d{3}$/.test(x.request_id) && CLASSES.includes(x.change_class) && /^P[123]$/.test(x.priority) && bh.every(h => (x[h] || '').trim()))).map(x => x.request_id)
    .concat(new Set(B.map(x => x.request_id)).size === B.length ? [] : ['duplicate id']), []);
check('TEST-HO-013', 'all seven change classes are in use', CLASSES.filter(c => !B.some(x => x.change_class === c)), []);

// ---- release history ------------------------------------------------------
const rh = read('docs/release-history.md');
const rel_ = [...rh.matchAll(/^## (\d+)\.(\d+)\.(\d+) \(/mg)].map(m => [+m[1], +m[2], +m[3]]);
const desc = rel_.every((v, i) => i === 0 || (v[0] * 1e6 + v[1] * 1e3 + v[2]) < (rel_[i - 1][0] * 1e6 + rel_[i - 1][1] * 1e3 + rel_[i - 1][2]));
check('TEST-HO-014', 'releases are semantic versions, newest first, all pre-1.0 (nothing is in production)',
  [rel_.length >= 8, desc, rel_.every(v => v[0] === 0)], [true, true, true]);
const relBodies = rh.split(/^## \d+\.\d+\.\d+ .*$/m).slice(1);
check('TEST-HO-015', 'each release records features, changes, fixes, data/Data Event changes, known issues and user action',
  relBodies.map((b, i) => ['Features', 'Changes', 'Fixes', 'Data / Data Event changes', 'Known issues', 'User action'].every(l => b.includes(`| ${l} |`))).filter(x => !x).length, 0);
check('TEST-HO-016', 'the latest release is the version the handoff states', [rel_[0].join('.'), handoff.includes('**Version ' + rel_[0].join('.'))], ['0.10.0', true]);
const reg = JSON.parse(read('fulcrum/known-good/registry.json'));
check('TEST-HO-017', 'the release history names the live Mainline version from the registry',
  rh.includes('Mainline 7.6.0 → 7.7.0') && reg.apps['mainline-construction-dev'].live.version === '7.7.0', true);

// ---- operating model ------------------------------------------------------
const claude = read('CLAUDE.md');
const rules = [...claude.matchAll(/^(\d+)\. /mg)].map(m => +m[1]);
check('TEST-HO-018', 'CLAUDE.md carries the fifteen operating rules, numbered 1-15', rules, Array.from({ length: 15 }, (_, i) => i + 1));
const s32 = read('docs/sprint-32-continuous-improvement.md');
const s5 = s32.slice(s32.indexOf('## 5. AI/MCP operating model'), s32.indexOf('## 6.'));
check('TEST-HO-019', 'Sprint 32 section 5 maps all fifteen rules to practice', [...s5.matchAll(/^\| (\d+) \|/mg)].map(m => +m[1]), Array.from({ length: 15 }, (_, i) => i + 1));
check('TEST-HO-020', 'CLAUDE.md keeps the hard constraints: production read-only, writes via forms_update only, no secrets',
  [/148545bf-b869-454e-a2b9-44a9860f23de/.test(claude) && /read-only/.test(claude), /mcp__fulcrum-app__app-mcp_fulcrum_forms_update/.test(claude), /Never commit a secret/.test(claude)], [true, true, true]);

// ---- scorecard ------------------------------------------------------------
const dq = read('reports/data-quality-scorecard.sql');
check('TEST-HO-021', 'the scorecard has DQ-01..DQ-10, covering the nine measures the brief names',
  [[...dq.matchAll(/'(DQ-\d\d)'/g)].map(m => m[1]),
   ['Valid rates', 'Approved production', 'Required documentation', 'No duplicates', 'Material mappings', 'QA failures corrected', 'No open corrections', 'No orphans', 'No rate exceptions'].filter(m => !dq.includes(`'${m}'`))],
  [Array.from({ length: 10 }, (_, i) => 'DQ-' + String(i + 1).padStart(2, '0')), []]);
check('TEST-HO-022', 'an empty population scores NO DATA, never 100%', /WHEN total = 0 THEN 'NO DATA'/.test(dq) && /WHEN total = 0 THEN NULL/.test(dq), true);
check('TEST-HO-023', 'Sprint 32 states final financial approval is not automated', /Final financial approval is not automated, and must not be/.test(s32), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
