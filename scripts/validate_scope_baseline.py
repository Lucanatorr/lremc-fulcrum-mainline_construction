#!/usr/bin/env python3
"""
Validate a project scope baseline BEFORE it is imported (Sprint 24 gate 6).

The Project Administrator fills in data/import/scope-baseline-template.csv, one
row per pay unit the project will use. This checks the file against the masters
the rest of the system depends on, and writes an import-ready file in the
MC Project Scope Line format only when nothing is wrong.

  python3 scripts/validate_scope_baseline.py                       # the template
  python3 scripts/validate_scope_baseline.py path/to/filled.csv

Exit 0: clean (warnings allowed).  Exit 1: errors; nothing is written.

ERRORS (block the import)
  - unknown project, or a project with no planned footage on the master
  - a labor code with no ACTIVE rate (the work could never be priced)
  - a quantity that is blank, non-numeric, zero or negative (D-010: a baseline
    is never negative; scope reductions are change orders)
  - the same project + labor code + phase twice (it would double the plan)
  - planned finish before planned start
WARNINGS (import allowed; each is a pilot entry criterion to close)
  - budget rate left blank, so the contractor rate is used
  - a pay unit with no APPROVED material mapping and no signed-off entry in
    data/material-coverage-register.csv (pilot entry criterion 4)
  - the baseline's value differs from the project's contract value by > 1%
"""
import csv, io, os, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMP = os.path.join(ROOT, 'data', 'import')
FIELDS = ['project_id', 'labor_code', 'phase_wbs', 'original_planned_quantity',
          'budget_rate', 'planned_start', 'planned_finish', 'notes']
OUT_FIELDS = ['status', 'project_id_snap', 'project_name_snap', 'labor_code', 'unit',
              'original_planned_quantity', 'budget_rate', 'rate_source_id',
              'rate_labor_code_snap', 'rate_project_id_snap', 'phase_wbs',
              'planned_start', 'planned_finish', 'active', 'notes']


def read(path):
    with io.open(path, encoding='utf-8-sig') as f:
        return list(csv.DictReader(f))


def num(v):
    try:
        return float(str(v).replace(',', '').strip())
    except (TypeError, ValueError):
        return None


def validate(path, root=ROOT):
    imp = os.path.join(root, 'data', 'import')
    projects = {p['project_id']: p for p in read(os.path.join(imp, 'project-master.csv'))}
    rates = collections.defaultdict(list)
    for r in read(os.path.join(imp, 'contractor-rates-river-city.csv')):
        if r.get('status') == 'ACTIVE' and r.get('active', 'yes') != 'no':
            rates[r['labor_code']].append(r)
    approved = {m['labor_code'] for m in read(os.path.join(imp, 'labor-material-mapping.csv'))
                if m.get('status') == 'APPROVED'}
    register = {}
    reg_path = os.path.join(root, 'data', 'material-coverage-register.csv')
    if os.path.exists(reg_path):
        register = {r['labor_code']: r for r in read(reg_path)}

    rows = read(path)
    errors, warnings, out = [], [], []
    seen = set()
    value_by_project = collections.defaultdict(float)
    for n, r in enumerate(rows, start=2):                 # row 1 is the header
        where = 'row %d' % n
        pid, code = (r.get('project_id') or '').strip(), (r.get('labor_code') or '').strip()
        if not pid and not code:
            continue                                      # blank line
        p = projects.get(pid)
        if p is None:
            errors.append('%s: project %r is not in the project master' % (where, pid))
            continue
        cands = rates.get(code, [])
        # A project-specific rate wins over an all-projects rate (rate-audit's rule).
        scoped = [c for c in cands if c.get('project_id_snap') == pid] or \
                 [c for c in cands if not c.get('project_id_snap')]
        if not scoped:
            errors.append('%s: %s has no ACTIVE rate for %s - this work could never be priced'
                          % (where, code or '(blank labor code)', pid))
            continue
        if len(scoped) > 1:
            warnings.append('%s: %s has %d competing active rates; the first (%s) is used'
                            % (where, code, len(scoped), scoped[0]['rate_id']))
        rate = scoped[0]
        q = num(r.get('original_planned_quantity'))
        if q is None or q <= 0:
            errors.append('%s: %s planned quantity %r must be a number above zero '
                          '(a reduction is a change order, never a baseline - D-010)'
                          % (where, code, r.get('original_planned_quantity')))
            continue
        key = (pid, code, (r.get('phase_wbs') or '').strip().upper())
        if key in seen:
            errors.append('%s: %s / %s / phase %r appears twice - it would double the plan'
                          % (where, pid, code, key[2] or '(none)'))
            continue
        seen.add(key)
        b = num(r.get('budget_rate'))
        if b is None:
            b = num(rate['unit_rate'])
            warnings.append('%s: %s budget rate blank - using contractor rate %s (%s)'
                            % (where, code, rate['rate_id'], rate['unit_rate']))
        s, f = (r.get('planned_start') or '').strip(), (r.get('planned_finish') or '').strip()
        if s and f and f < s:
            errors.append('%s: %s planned finish %s is before planned start %s' % (where, code, f, s))
        reg = register.get(code)
        covered = code in approved or (reg and reg['classification'].startswith('NO')
                                       and (reg.get('signed_off_by') or '').strip())
        if not covered:
            why = ('register says %s, not yet signed off' % reg['classification']) if reg else 'no mapping'
            warnings.append('%s: %s has no APPROVED material mapping (%s) - pilot entry criterion 4'
                            % (where, code, why))
        value_by_project[pid] += q * b
        out.append({
            'status': 'DRAFT', 'project_id_snap': pid, 'project_name_snap': p['project_name'],
            'labor_code': code, 'unit': rate['unit'], 'original_planned_quantity': q,
            'budget_rate': b, 'rate_source_id': rate['rate_id'],
            'rate_labor_code_snap': code, 'rate_project_id_snap': rate.get('project_id_snap', ''),
            'phase_wbs': r.get('phase_wbs', ''), 'planned_start': s, 'planned_finish': f,
            'active': 'yes', 'notes': r.get('notes', ''),
        })
    for pid, v in value_by_project.items():
        cv = num(projects[pid].get('original_contract_value'))
        if cv and abs(v - cv) / cv > 0.01:
            warnings.append('%s: baseline value %.2f differs from the contract value %.2f by %.1f%%'
                            % (pid, v, cv, (v - cv) / cv * 100))
    if not out and not errors:
        errors.append('no scope lines in %s' % path)
    return errors, warnings, out


def main(argv):
    path = argv[1] if len(argv) > 1 else os.path.join(IMP, 'scope-baseline-template.csv')
    errors, warnings, out = validate(path)
    for w in warnings:
        print('WARNING  ' + w)
    for e in errors:
        print('ERROR    ' + e)
    if errors:
        print('\n%d error(s). Nothing written.' % len(errors))
        return 1
    target = os.path.splitext(path)[0] + '.import.csv'
    with io.open(target, 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=OUT_FIELDS)
        w.writeheader()
        w.writerows(out)
    print('\n%d scope line(s), %d warning(s). Import-ready: %s' % (len(out), len(warnings), target))
    print('Import into MC Project Scope Line as DRAFT, set the Project link on each line, '
          'then a second person moves each line to BASELINED (docs/sprint-26-governance.md §3).')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
