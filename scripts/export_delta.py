#!/usr/bin/env python3
"""
Reference consumer for reports/integration-export-production.sql (Sprint 30).

Turns successive exports of production STATE into idempotent financial
POSTINGS. This is the logic an ERP / accounting integration must implement;
it is here so the contract is executable and tested, not so it runs in
production as-is.

  python3 scripts/export_delta.py CURRENT_EXPORT --state STATE.json [--out postings.csv] [--dry-run]

CURRENT_EXPORT  the report's result: Query API JSON ({"rows": [...]}) or a CSV
STATE.json      what the consumer has already posted, per production_id:
                {"PRD-...": {"export_hash", "official_quantity", "official_value"}}
                Created on first run. Updated unless --dry-run.

THE RULES
  * The key is production_id. A record's money downstream always equals its
    CURRENT official_value in Fulcrum - never the sum of everything it was.
  * A posting is made only when export_hash changed AND the official quantity
    or value moved. Amount = current official value - last posted value.
  * posting_key = production_id|export_hash. Deterministic: the same state
    always yields the same key, so a receiver that stores posting keys can
    discard a repeat even if this script is run twice against the same state.
  * Re-running against the same export posts nothing: idempotent.
  * A record missing from the export is NOT reversed automatically - a filter
    or a partial export would otherwise wipe money. It is reported instead.
"""
import argparse, csv, io, json, os, sys


def load_rows(path):
    with io.open(path, encoding='utf-8-sig') as f:
        text = f.read()
    if path.lower().endswith('.csv'):
        return list(csv.DictReader(io.StringIO(text)))
    data = json.loads(text)
    return data['rows'] if isinstance(data, dict) else data


def num(v):
    try:
        return round(float(v), 2)
    except (TypeError, ValueError):
        return 0.0


def compute(rows, state):
    postings, new_state, seen = [], dict(state), set()
    for r in rows:
        pid = r['production_id']
        if pid in seen:
            raise SystemExit('export lists %s twice - not a valid export' % pid)
        seen.add(pid)
        prev = state.get(pid, {'export_hash': None, 'official_quantity': 0.0, 'official_value': 0.0})
        if r['export_hash'] == prev['export_hash']:
            continue
        dq = round(num(r['official_quantity']) - num(prev['official_quantity']), 2)
        dv = round(num(r['official_value']) - num(prev['official_value']), 2)
        if dq or dv:
            postings.append({
                'posting_key': '%s|%s' % (pid, r['export_hash']),
                'production_id': pid,
                'project_id': r.get('project_id'), 'contractor_id': r.get('contractor_id'),
                'labor_code': r.get('labor_code'), 'unit': r.get('unit'), 'period': r.get('period'),
                'record_status': r.get('record_status'),
                'quantity_delta': dq, 'value_delta': dv,
                'reason': ('TAKEN BACK' if num(r['official_value']) == 0 and num(prev['official_value']) != 0
                           else 'NEW' if num(prev['official_value']) == 0
                           else 'CHANGED'),
            })
        new_state[pid] = {'export_hash': r['export_hash'],
                          'official_quantity': num(r['official_quantity']),
                          'official_value': num(r['official_value'])}
    missing = sorted(k for k, v in state.items() if k not in seen and v.get('official_value'))
    return postings, new_state, missing


def main(argv):
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[1])
    ap.add_argument('export')
    ap.add_argument('--state', required=True)
    ap.add_argument('--out')
    ap.add_argument('--dry-run', action='store_true')
    a = ap.parse_args(argv[1:])
    state = json.load(open(a.state)) if os.path.exists(a.state) else {}
    postings, new_state, missing = compute(load_rows(a.export), state)
    for p in postings:
        print('POST %-40s %-10s qty %+g  value %+.2f  %s' % (p['posting_key'][:40], p['reason'], p['quantity_delta'], p['value_delta'], p['production_id']))
    for m in missing:
        print('MISSING %s - posted %.2f earlier, absent from this export; not reversed automatically' % (m, state[m]['official_value']))
    print('%d posting(s); net value %+.2f' % (len(postings), sum(p['value_delta'] for p in postings)))
    if a.out and postings:
        with open(a.out, 'w', newline='') as f:
            w = csv.DictWriter(f, fieldnames=list(postings[0].keys()))
            w.writeheader(); w.writerows(postings)
    if not a.dry_run:
        with open(a.state, 'w') as f:
            json.dump(new_state, f, indent=1, sort_keys=True)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
