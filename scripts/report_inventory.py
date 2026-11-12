#!/usr/bin/env python3
"""
Generate docs/report-inventory.md from the SQL itself (Sprint 32).

  python3 scripts/report_inventory.py            # write it
  python3 scripts/report_inventory.py --check    # exit 1 if stale, or a report has no audience

For every report in reports/, reports/bi/ and reports/continuity/:
  purpose   the header's first sentence(s)
  source    the apps it reads (form IDs in the SQL, named)
  metrics   the columns of the final SELECT
  filters   the p_ parameters declared in its params CTE
  audience  AUDIENCE below. A new report without an entry fails --check, so
            somebody has to decide who it is for.
"""
import glob, io, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'report-inventory.md')

FORMS = {
    '06c36c8e-4a88-4cf3-a691-9a792f8374d2': 'Production',
    'a5529dd0-54fa-4b8d-b595-d0218df0ee97': 'Rate',
    '5ce243d4-9ec1-4fbd-8659-7be9f632b55c': 'Project',
    'd8a368b5-1e19-4f5f-8cf9-ff8fbdd03ab4': 'Contractor',
    'aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b': 'Scope Line',
    '458ae172-b7b4-43b5-8917-d7a792c9e81a': 'Change Order',
    '38e3d7fd-ca78-4016-8018-ec955446c13f': 'Mapping',
    '658143d1-edbd-430b-81bb-1b0bb1092729': 'Material',
    'ee204906-adb3-431b-a1d9-d7427a4c842c': 'Material Transaction',
    '728477da-5f36-48cb-b3ab-cbc8c38d077f': 'Fiber Reel',
    '397b52cf-a4f0-4871-b8ea-1fdb592fe2ab': 'Structure',
    '7da87588-940a-4b9e-915d-5ec25d5c0ebc': 'Segment',
    '351bb1f1-9837-47c8-be5b-bb0727fe93a0': 'Closeout',
}
PM, FIN, EXEC, ADMIN, DATA, QA, MAT, AUD, BI, INT = ('Project Manager', 'Contract / Finance', 'Executive / Business Owner',
    'Fulcrum Administrator', 'Data Owner', 'QA Reviewer', 'Warehouse / Materials', 'Auditor', 'Power BI developer', 'Integration owner')
AUDIENCE = {
    'analytics-contractor': [EXEC, FIN], 'analytics-crew-productivity': [PM], 'analytics-daily-burn-rate': [PM, EXEC],
    'analytics-executive-summary': [EXEC], 'analytics-production-velocity': [PM, EXEC], 'analytics-project-performance': [EXEC, PM],
    'audit-daily': [ADMIN, DATA], 'audit-weekly': [AUD, ADMIN], 'audit-monthly': [AUD, FIN], 'audit-history-fingerprint': [AUD],
    'closeout-readiness': [PM], 'contractor-financial': [FIN], 'data-quality-scorecard': [DATA, EXEC],
    'duplicate-production': [DATA, PM], 'exception-dashboard': [PM, DATA], 'forecast-completion': [PM, EXEC],
    'integration-export-production': [INT, FIN], 'integration-id-integrity': [INT, ADMIN], 'invoice-reconciliation-basis': [FIN],
    'material-variance': [MAT, PM], 'production-audit-trail': [AUD, FIN], 'production-daily': [PM], 'production-weekly': [PM],
    'production-monthly': [PM, FIN], 'production-dashboard': [PM, EXEC], 'production-trend': [PM, EXEC], 'productivity': [PM],
    'project-financial': [FIN, PM], 'project-scope-status': [PM], 'project-summary': [PM, EXEC], 'qa-review-queue': [QA],
    'rate-audit': [FIN, AUD], 'rate-expected-audit': [FIN, AUD], 'rate-master-audit': [ADMIN, FIN], 'reel-balance': [MAT],
    'reel-integrity': [MAT, DATA], 'remaining-work': [PM], 'segment-integrity': [DATA], 'sequential-overlap': [DATA, PM],
    'unplanned-production': [PM, FIN], 'voided-reversed': [FIN, AUD],
}


# Where a header's opening paragraph is not a usable one-line purpose.
PURPOSE = {
    'audit-daily': 'Daily checklist: missing or zero rates, failed calculations, missing project/contractor, potential duplicates, critical QA failures. One row per check; 0 items = PASS.',
    'audit-weekly': 'Weekly checklist: aged approvals, missing mappings, inactive-code use, material variance, self-approval (W-8). One row per check.',
    'audit-monthly': 'Monthly review: financial, rate, scope, material, permission, exception-backlog and data-quality checks. One row per check.',
    'duplicate-production': 'Possible duplicate production: records sharing a strict or segment fingerprint (project, contractor, date, pay unit, cable/segment, range).',
    'sequential-overlap': 'Fiber sequential ranges on one reel that overlap another record\'s range. Server-side because a device cannot see other records offline.',
    'analytics-executive-summary': 'One row per project: authorized, approved and pending value, percent complete and schedule position. Value and counts only, never quantities.',
    'analytics-project-performance': 'One row per project x pay unit: original, change-order and authorized quantity against approved and pending, with percent complete.',
    'analytics-daily-burn-rate': 'One row per project per working day: approved value that day and the rolling burn rate.',
    'analytics-production-velocity': 'One row per project x pay unit x ISO week: approved quantity and value, days worked, and week-on-week change.',
    'analytics-crew-productivity': 'One row per crew x contractor x unit: active days, approved quantity and quantity per active day.',
    'backup-manifest': 'One row per Development table: row count, last server change and an MD5 fingerprint of every id:version. Verifies the backup exports.',
    'voided-reversed': 'What came out of the official numbers in the period (VOID, REVERSED) and what went back in (Adjustments, re-approvals).',
}


def header(sql):
    lines = []
    for l in sql.splitlines():
        if not l.startswith('--'):
            break
        lines.append(l[2:].strip())
    title = re.sub(r'\s*\(.*?\)\s*$', '', lines[0]) if lines else ''
    body = []
    for l in lines[1:]:
        if re.match(r'^[0-9a-f]{8}-[0-9a-f]{4}-', l) or l.startswith('See reports/'):
            if body: break
            continue
        if not l:
            if body: break
            continue
        body.append(l)
    purpose = ' '.join(body)
    m = re.match(r'(.+?[.:])(\s|$)', purpose)
    if len(purpose) > 240 and m:
        purpose = m.group(1)
    return title, purpose


def strip(sql):
    sql = re.sub(r'--[^\n]*', ' ', sql)
    return re.sub(r"'(?:[^']|'')*'", "''", sql)


def final_columns(sql):
    s = strip(sql)
    depth, top = 0, []
    for m in re.finditer(r"\(|\)|\bSELECT\b|\bFROM\b", s, re.I):
        t = m.group(0).upper()
        if t == '(':
            depth += 1
        elif t == ')':
            depth -= 1
        elif depth == 0:
            top.append((t, m.start(), m.end()))
    sel = [i for i, (t, _, _) in enumerate(top) if t == 'SELECT']
    if not sel:
        return []
    i = sel[0]          # the main statement's first SELECT names the columns (a UNION's later branches do not)
    start = top[i][2]
    end = next((p for t, p, _ in top[i + 1:] if t == 'FROM'), len(s))
    seg, cols, depth, cur = s[start:end], [], 0, ''
    for ch in seg:
        if ch == '(':
            depth += 1
        elif ch == ')':
            depth -= 1
        if ch == ',' and depth == 0:
            cols.append(cur); cur = ''
        else:
            cur += ch
    cols.append(cur)
    out = []
    for c in cols:
        c = c.strip()
        if not c:
            continue
        m = re.search(r'\bAS\s+"?([A-Za-z_][A-Za-z0-9_]*)"?\s*$', c, re.I)
        if m:
            out.append(m.group(1))
        elif c == '*' or c.endswith('.*'):
            out.append('* (every column)')
        else:
            out.append(re.split(r'[.\s]', c)[-1].strip('"'))
    return out


def sources(sql):
    ids = sorted(set(re.findall(r'"([0-9a-f]{8}-[0-9a-f-]{27})(?:/([a-z_]+))?"', sql)))
    names = []
    for fid, rep in ids:
        n = FORMS.get(fid, fid)
        names.append(n + (' / ' + rep if rep else ''))
    return sorted(set(names))


def filters(sql):
    m = re.search(r'WITH\s+params\s+AS\s*\((.*?)\n\)', sql, re.S | re.I)
    return re.findall(r'\bAS\s+(p_[a-z_]+)', m.group(1)) if m else []


def audience(path):
    rel = os.path.relpath(path, os.path.join(ROOT, 'reports'))
    stem = os.path.splitext(os.path.basename(path))[0]
    if rel.startswith('bi/'):
        return [BI]
    if rel.startswith('continuity/'):
        return [ADMIN]
    return AUDIENCE.get(stem)


def build():
    groups = [('Operational and management reports', sorted(glob.glob(os.path.join(ROOT, 'reports', '*.sql')))),
              ('Power BI datasets (`reports/bi/`)', sorted(glob.glob(os.path.join(ROOT, 'reports', 'bi', '*.sql')))),
              ('Backup and continuity (`reports/continuity/`)', sorted(glob.glob(os.path.join(ROOT, 'reports', 'continuity', '*.sql'))))]
    missing, lines, n = [], [], 0
    lines += ['# Report Inventory', '',
              '**Generated** by `scripts/report_inventory.py` from the SQL, so it cannot drift from it.',
              'Purpose is the report\'s own header, source the apps it reads, metrics the',
              'columns it returns, filters its `params` CTE. Shared rules are in',
              '`reports/_conventions.md`. Every report runs read-only through the Query API',
              'or the Fulcrum Query UI. How to run one through the MCP tool is in `scripts/flatten_report.py`.', '']
    for title, files in groups:
        lines += ['## %s (%d)' % (title, len(files)), '',
                  '| Report | Purpose | Source | Metrics | Filters | Audience |', '|---|---|---|---|---|---|']
        for p in files:
            sql = io.open(p, encoding='utf-8').read()
            t, purpose = header(sql)
            stem = os.path.splitext(os.path.basename(p))[0]
            purpose = PURPOSE.get(stem, purpose)
            if os.path.relpath(p, ROOT).startswith('reports/bi/'):
                g = re.search(r'(grain:.*?)(?:key:|$)', sql.splitlines()[0] + ' ' + sql.splitlines()[1])
                k = re.search(r'key:\s*([^\n]+)', '\n'.join(sql.splitlines()[:3]))
                purpose = ' '.join(x for x in [re.sub(r'\s*--\s*', ' ', g.group(1)).strip() if g else '', ('Key: ' + k.group(1).strip()) if k else '',
                                               purpose if not purpose.startswith('key:') else ''] if x)
            aud = audience(p)
            if aud is None:
                missing.append(os.path.relpath(p, ROOT)); aud = ['**UNASSIGNED**']
            cols = final_columns(sql)
            lines.append('| `%s`<br>%s | %s | %s | %s | %s | %s |' % (
                os.path.relpath(p, os.path.join(ROOT, 'reports')), t.replace('|', '/'), purpose.replace('|', '/'),
                ', '.join(sources(sql)) or '—', ', '.join('`%s`' % c for c in cols) or '—',
                ', '.join('`%s`' % f for f in filters(sql)) or '—', ', '.join(aud)))
            n += 1
        lines.append('')
    return '\n'.join(lines).rstrip() + '\n', n, missing


def main(argv):
    text, n, missing = build()
    for m in missing:
        print('NO AUDIENCE: %s - add it to AUDIENCE in scripts/report_inventory.py' % m)
    if '--check' in argv:
        cur = io.open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
        if cur != text:
            print('docs/report-inventory.md is stale: run python3 scripts/report_inventory.py'); return 1
        print('docs/report-inventory.md is current (%d reports)' % n)
        return 1 if missing else 0
    io.open(OUT, 'w', encoding='utf-8').write(text)
    print('wrote docs/report-inventory.md: %d reports' % n)
    return 1 if missing else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
