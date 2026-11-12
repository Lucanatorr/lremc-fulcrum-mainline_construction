#!/usr/bin/env python3
"""
Compare two runs of reports/audit-history-fingerprint.sql (Sprint 27).

  python3 scripts/audit_history_check.py PREVIOUS CURRENT [--open-from YYYY-MM]

PREVIOUS and CURRENT are saved results of the report: the Query API's JSON
({"rows": [...]}, or a bare list of rows) or a CSV exported from the Fulcrum
Query UI. They must use the report's column names.

A period is CLOSED when it is earlier than --open-from (default: the month
the CURRENT file was run in, taken from its name if it starts YYYY-MM-DD, else
today). Open periods are still being worked, so differences there are normal
and are only listed.

In a CLOSED period every difference must be explained:
  CHANGED   same key, different fingerprint: some record's quantity, rate,
            value, status, relationship or approval changed
  ADDED     a key that did not exist: e.g. September work approved in
            November - legitimate, but it changes a period that was reported
  REMOVED   a key that disappeared: every record in it left history
Explain each with voided-reversed.sql (REVERSED / ADJUSTMENT) or the audit
trail. Exit 1 when a closed period differs, so the review cannot skip it.
"""
import csv, datetime, io, json, os, re, sys

KEY = ('ledger', 'project_id', 'contractor_id', 'period', 'unit')


def load(path):
    with io.open(path, encoding='utf-8-sig') as f:
        text = f.read()
    if path.lower().endswith('.csv'):
        rows = list(csv.DictReader(io.StringIO(text)))
    else:
        data = json.loads(text)
        rows = data['rows'] if isinstance(data, dict) else data
    out = {}
    for r in rows:
        k = tuple(str(r.get(c, '')) for c in KEY)
        if k in out:
            raise SystemExit('%s: duplicate key %s - is this the fingerprint report?' % (path, '/'.join(k)))
        out[k] = r
    return out


def num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return 0.0


def compare(prev, cur, open_from):
    findings = []
    for k in sorted(set(prev) | set(cur)):
        closed = k[3] < open_from
        a, b = prev.get(k), cur.get(k)
        if a and b and a.get('fingerprint') == b.get('fingerprint'):
            continue
        kind = 'ADDED' if a is None else 'REMOVED' if b is None else 'CHANGED'
        d = {c: num((b or {}).get(c)) - num((a or {}).get(c)) for c in ('records', 'total_quantity', 'total_value')}
        findings.append((closed, kind, k, d))
    return findings


def main(argv):
    import argparse
    ap = argparse.ArgumentParser(description='Compare two audit-history-fingerprint results.')
    ap.add_argument('previous')
    ap.add_argument('current')
    ap.add_argument('--open-from', help='first OPEN period, YYYY-MM')
    a = ap.parse_args(argv[1:])
    open_from = a.open_from
    if not open_from:
        m = re.match(r'(\d{4}-\d{2})-\d{2}', os.path.basename(a.current))
        open_from = m.group(1) if m else datetime.date.today().strftime('%Y-%m')
    args = [a.previous, a.current]
    prev, cur = load(args[0]), load(args[1])
    findings = compare(prev, cur, open_from)
    closed = [f for f in findings if f[0]]
    print('Compared %d -> %d fingerprinted groups; periods before %s are closed.'
          % (len(prev), len(cur), open_from))
    for is_closed, kind, k, d in findings:
        print('%-7s %-8s %s  records %+g  quantity %+g %s  value %+.2f'
              % ('CLOSED' if is_closed else 'open', kind, '/'.join(k),
                 d['records'], d['total_quantity'], k[4], d['total_value']))
    if closed:
        print('\n%d difference(s) in closed periods. Each must be explained by voided-reversed.sql '
              'or the audit trail before the monthly review is signed.' % len(closed))
        return 1
    print('\nNo unexpected change to closed-period history.')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
