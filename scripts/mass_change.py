#!/usr/bin/env python3
"""
Mass-change control (Sprint 31).

The brief: "Before mass changes: export affected records, count them,
calculate impact, test a sample, perform the update, reconcile, and document
the result." This script does the arithmetic of every step except the update
itself, which a person performs in Fulcrum.

  1. PLAN    python3 scripts/mass_change.py plan EXPORT --where FIELD=VALUE ... --set FIELD=VALUE ...
                    [--ids FILE] [--sample N] [--allow-history] --out PLAN.json
     EXPORT is a full-table export: reports/continuity/backup-<dataset>.sql,
     saved as JSON or CSV. Prints the count by status, the money impact and
     the sample to try first. Writes PLAN.json, which holds the before-image
     of EVERY row, so the change can be reconciled and, if needed, undone.

  2. SAMPLE  apply the change to the sample records only, export again, then
             python3 scripts/mass_change.py reconcile PLAN.json AFTER --sample-only
     Every sample record must show exactly the change and nothing else; every
     other record must be untouched.

  3. UPDATE  apply the change to the rest.

  4. RECONCILE  export again, then
             python3 scripts/mass_change.py reconcile PLAN.json AFTER [--allow-field F ...] [--out RESULT.json]
     FAIL on: a target not changed, a field changed that the plan did not
     name, a record outside the set changed, a record gone.

  5. DOCUMENT  keep PLAN.json and RESULT.json with the change record (or the
             incident, data/incident-register.csv).

HISTORICAL RECORDS ARE BLOCKED. A plan touching APPROVED or REVERSED
production, a BASELINED or CLOSED scope line, an APPROVED change order or an
APPROVED mapping is refused unless --allow-history is given. Approved
production is corrected through the lifecycle (REOPENED / REVERSED /
Adjustment, D-018), never by editing the values that were paid (D-003).

Fields that start with "_" are Fulcrum's own and are ignored when comparing,
except _status. Fields that a Data Event or calculation re-derives on save
(extended_value, exception_flags, fingerprints, stamps...) will change too:
name them with --allow-field so they are reported, not failed.
NOTE: an API or CSV import runs no Data Events, so those fields are NOT
re-derived by an import (docs/backout-recovery-procedure.md, Level 3).
"""
import argparse, collections, csv, hashlib, io, json, sys

HISTORY = {'APPROVED', 'REVERSED', 'BASELINED', 'CLOSED'}
MONEY = ('quantity', 'contractor_rate', 'extended_value', 'labor_code', 'unit', 'rate_link',
         'project_id_snapshot', 'contractor_id_snapshot', '_status', 'line_quantity_change', 'line_rate',
         'unit_rate', 'multiplier')


def load(path):
    with io.open(path, encoding='utf-8-sig') as f:
        text = f.read()
    if path.lower().endswith('.csv'):
        return list(csv.DictReader(io.StringIO(text)))
    d = json.loads(text)
    return d['rows'] if isinstance(d, dict) else d


def rid(r):
    return str(r.get('_child_record_id') or r['_record_id'])


def parse_value(v):
    try:
        return json.loads(v)
    except ValueError:
        return v


def norm(v):
    if v is None or v == '' or v == []:
        return None
    if isinstance(v, bool):
        return str(v).lower()
    if isinstance(v, (int, float)):
        return repr(float(v))
    if isinstance(v, (list, dict)):
        return json.dumps(v, sort_keys=True)
    s = str(v)
    try:
        return repr(float(s))
    except ValueError:
        pass
    if s.startswith('[') or s.startswith('{'):
        try:
            return json.dumps(json.loads(s), sort_keys=True)
        except ValueError:
            pass
    return s


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def pairs(items):
    out = []
    for it in items or []:
        if '=' not in it:
            raise SystemExit('expected FIELD=VALUE, got %r' % it)
        k, v = it.split('=', 1)
        out.append((k, parse_value(v)))
    return out


def fp(rows):
    s = ','.join('%s:%s' % (rid(r), r.get('_version')) for r in sorted(rows, key=lambda r: rid(r).encode()))
    return hashlib.md5(s.encode()).hexdigest()


def plan(export, where, sets, ids=None, sample=3, allow_history=False):
    rows = load(export) if isinstance(export, str) else export
    if ids is not None:
        affected = [r for r in rows if rid(r) in ids or str(r.get('production_id')) in ids]
    else:
        affected = [r for r in rows if all(norm(r.get(k)) == norm(v) for k, v in where)]
    if not sets:
        raise SystemExit('nothing to change: give at least one --set FIELD=VALUE')
    unknown = [k for k, _ in sets if rows and k not in rows[0]]
    if unknown:
        raise SystemExit('no such field(s) in the export: %s. Use the actual field keys (data_name).' % ', '.join(unknown))
    by_status = collections.Counter(r.get('_status') or '(none)' for r in affected)
    hist = [rid(r) for r in affected if (r.get('_status') or '') in HISTORY]
    already = [rid(r) for r in affected if all(norm(r.get(k)) == norm(v) for k, v in sets)]
    money_fields = [k for k, _ in sets if k in MONEY]

    impact = collections.defaultdict(lambda: {'before': 0.0, 'after_estimate': 0.0, 'approved_before': 0.0, 'records': 0})
    for r in affected:
        after = dict(r); after.update(dict(sets))
        bkey = (r.get('project_id_snapshot') or '~', r.get('contractor_id_snapshot') or '~')
        akey = (after.get('project_id_snapshot') or '~', after.get('contractor_id_snapshot') or '~')
        bv = num(r.get('extended_value'))
        if 'extended_value' in dict(sets):
            av = num(after['extended_value'])
        elif 'quantity' in dict(sets) or 'contractor_rate' in dict(sets):
            av = round(num(after.get('quantity')) * num(after.get('contractor_rate')), 2)   # what the calculation will give
        else:
            av = bv
        impact[bkey]['before'] += bv
        impact[bkey]['records'] += 1
        if r.get('_status') == 'APPROVED':
            impact[bkey]['approved_before'] += bv
        impact[akey]['after_estimate'] += av
    impact_rows = [{'project_id': k[0], 'contractor_id': k[1], 'records': v['records'],
                    'value_before': round(v['before'], 2), 'value_after_estimate': round(v['after_estimate'], 2),
                    'value_delta': round(v['after_estimate'] - v['before'], 2),
                    'approved_value_before': round(v['approved_before'], 2)} for k, v in sorted(impact.items())]
    order = sorted(affected, key=lambda r: hashlib.md5(rid(r).encode()).hexdigest())
    sample_ids = [rid(r) for r in order[:min(sample, len(order))]]
    blocked = bool(hist) and not allow_history
    return {
        'export_rows': len(rows), 'export_fingerprint': fp(rows),
        'where': [[k, v] for k, v in where], 'set': [[k, v] for k, v in sets],
        'affected_count': len(affected), 'affected_fingerprint': fp(affected),
        'by_status': dict(by_status), 'historical_ids': hist, 'already_at_target': already,
        'money_fields': money_fields, 'impact': impact_rows,
        'net_value_delta': round(sum(i['value_delta'] for i in impact_rows), 2),
        'sample_ids': sample_ids, 'blocked': blocked,
        'affected_ids': [rid(r) for r in affected],
        'before': {rid(r): r for r in rows},
    }


def reconcile(p, after_rows, allow_fields=(), sample_only=False):
    after = {rid(r): r for r in after_rows}
    target = set(p['sample_ids'] if sample_only else p['affected_ids'])
    sets = dict((k, v) for k, v in p['set'])
    allow = set(allow_fields)
    findings = []

    def f(sev, rec, what, detail):
        findings.append({'severity': sev, 'record': rec, 'finding': what, 'detail': detail})

    for i, b in p['before'].items():
        a = after.get(i)
        if a is None:
            f('FAIL', i, 'RECORD GONE', 'in the before-image, not in the after export'); continue
        fields = (set(a) | set(b)) - {k for k in set(a) | set(b) if k.startswith('_') and k != '_status'}
        changed = sorted(k for k in fields if norm(a.get(k)) != norm(b.get(k)))
        if i in target:
            for k, v in sets.items():
                if norm(a.get(k)) != norm(v):
                    f('FAIL', i, 'TARGET NOT CHANGED', '%s is %r, plan says %r' % (k, a.get(k), v))
            for k in changed:
                if k in sets:
                    continue
                if k in allow:
                    f('INFO', i, 'DERIVED CHANGE', '%s: %r -> %r' % (k, b.get(k), a.get(k)))
                else:
                    f('FAIL', i, 'UNPLANNED FIELD CHANGE', '%s: %r -> %r' % (k, b.get(k), a.get(k)))
        elif str(a.get('_version')) != str(b.get('_version')) or changed:
            f('FAIL', i, 'OUTSIDE THE SET CHANGED',
              '%s (version %s -> %s)' % (', '.join(changed) or 'saved with no field change', b.get('_version'), a.get('_version')))
    for i in sorted(set(after) - set(p['before'])):
        f('INFO', i, 'NEW RECORD', 'created after the plan; not part of the change')
    done = sum(1 for i in target if i in after and all(norm(after[i].get(k)) == norm(v) for k, v in sets.items()))
    return findings, done, len(target)


def main(argv):
    ap = argparse.ArgumentParser(description='Mass-change control: plan, then reconcile.')
    sub = ap.add_subparsers(dest='cmd', required=True)
    pl = sub.add_parser('plan')
    pl.add_argument('export'); pl.add_argument('--where', action='append'); pl.add_argument('--set', action='append')
    pl.add_argument('--ids'); pl.add_argument('--sample', type=int, default=3)
    pl.add_argument('--allow-history', action='store_true'); pl.add_argument('--out', required=True)
    rc = sub.add_parser('reconcile')
    rc.add_argument('plan'); rc.add_argument('after'); rc.add_argument('--allow-field', action='append', default=[])
    rc.add_argument('--sample-only', action='store_true'); rc.add_argument('--out')
    a = ap.parse_args(argv[1:])

    if a.cmd == 'plan':
        ids = None
        if a.ids:
            ids = {l.strip() for l in open(a.ids) if l.strip()}
        if not a.where and ids is None:
            raise SystemExit('select the records: --where FIELD=VALUE or --ids FILE. A change to "everything" is not a plan.')
        p = plan(a.export, pairs(a.where), pairs(a.set), ids, a.sample, a.allow_history)
        print('EXPORT     %d rows, fingerprint %s' % (p['export_rows'], p['export_fingerprint']))
        print('AFFECTED   %d record(s): %s' % (p['affected_count'], ', '.join('%s %d' % kv for kv in sorted(p['by_status'].items())) or '-'))
        if p['already_at_target']:
            print('           %d already hold the target value' % len(p['already_at_target']))
        print('CHANGE     %s' % ', '.join('%s = %r' % (k, v) for k, v in p['set']))
        if p['money_fields']:
            print('IMPACT     money fields touched: %s' % ', '.join(p['money_fields']))
            for i in p['impact']:
                print('           %-12s %-10s %3d rec  before %12.2f  after~ %12.2f  delta %+12.2f  (approved before %.2f)'
                      % (i['project_id'], i['contractor_id'], i['records'], i['value_before'], i['value_after_estimate'], i['value_delta'], i['approved_value_before']))
            print('           net %+.2f' % p['net_value_delta'])
        else:
            print('IMPACT     no money field touched')
        print('SAMPLE     change these first, then reconcile --sample-only: %s' % ', '.join(p['sample_ids']))
        if p['historical_ids']:
            print('HISTORY    %d APPROVED/REVERSED/BASELINED/CLOSED record(s) in the set' % len(p['historical_ids']))
        with open(a.out, 'w') as f:
            json.dump(p, f, indent=1, default=str)
        if p['blocked']:
            print('BLOCKED    historical records are corrected through REOPENED / REVERSED / Adjustment (D-018), '
                  'not edited. Narrow --where, or --allow-history with the Business Owner\'s written approval.')
            return 2
        print('PLAN       written to %s' % a.out)
        return 0

    p = json.load(open(a.plan))
    findings, done, total = reconcile(p, load(a.after), a.allow_field, a.sample_only)
    for x in findings:
        print('%-4s %-38s %-24s %s' % (x['severity'], x['record'], x['finding'], x['detail']))
    fails = sum(1 for x in findings if x['severity'] == 'FAIL')
    print('\n%s: %d of %d target record(s) at the planned value; %d FAIL' % ('SAMPLE' if a.sample_only else 'RECONCILE', done, total, fails))
    if a.out:
        with open(a.out, 'w') as f:
            json.dump({'plan': a.plan, 'sample_only': a.sample_only, 'targets': total, 'done': done,
                       'fails': fails, 'findings': findings}, f, indent=1)
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
