#!/usr/bin/env python3
"""
Reconcile a contractor invoice against approved production (Sprint 30).

  python3 scripts/reconcile_invoice.py INVOICE.csv BASIS [--labor-codes FILE]
                                       [--previous PRIOR_INVOICE.csv ...] [--out findings.csv]

INVOICE.csv  one row per invoice line; template: data/import/invoice-template.csv
             invoice_number, invoice_date, contractor_id, project_id, period,
             labor_code, production_id (optional), quantity, unit_rate, amount
BASIS        result of reports/invoice-reconciliation-basis.sql (JSON or CSV)
--labor-codes  known pay units: a CSV with a labor_code column (dim_labor, or
             the rate import). Default: data/import/contractor-rates-river-city.csv
--previous   earlier invoices, so a Production ID billed twice across
             invoices is caught too

MATCHING. A line that names a Production ID is matched to that record. A line
without one is matched to the APPROVED production for the same project +
contractor + labor code + period, summed. Production IDs are the stronger
match; the brief asks for them "where available".

FINDINGS                                              severity
  UNKNOWN CODE            code is not a pay unit        CRITICAL
  DUPLICATE ITEM          same Production ID twice, on this or an earlier
                          invoice; or an identical line repeated   CRITICAL
  PRODUCTION ID NOT FOUND no such record                CRITICAL
  KEY MISMATCH            the record belongs to another contractor, project,
                          code or period                CRITICAL
  UNAPPROVED PRODUCTION BILLED  the record (or every record in the group)
                          is not APPROVED               CRITICAL
  QUANTITY ABOVE APPROVED billed more than approved     CRITICAL
  QUANTITY BELOW APPROVED billed less (under-billing is still a mismatch) WARNING
  WRONG RATE              invoice rate is not the rate Fulcrum priced at  CRITICAL
  AMOUNT ARITHMETIC       amount <> quantity x rate on the line itself    WARNING
  MATCH                   none of the above             OK

Exit 1 when any CRITICAL is found, so a payment run can gate on it.
"""
import argparse, collections, csv, io, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TOL = 0.005


def rows(path):
    with io.open(path, encoding='utf-8-sig') as f:
        text = f.read()
    if path.lower().endswith('.json'):
        d = json.loads(text)
        return d['rows'] if isinstance(d, dict) else d
    return list(csv.DictReader(io.StringIO(text)))


def num(v):
    try:
        return float(str(v).replace(',', '').strip())
    except (TypeError, ValueError):
        return None


def s(v):
    return (v or '').strip() if isinstance(v, str) or v is None else str(v)


def reconcile(invoice, basis, known_codes, previous=()):
    out = []
    by_id = {s(b['production_id']): b for b in basis}
    groups = collections.defaultdict(list)
    for b in basis:
        groups[(s(b['project_id']), s(b['contractor_id']), s(b['labor_code']), s(b['period']))].append(b)
    billed_before = collections.Counter(s(r.get('production_id')) for r in previous if s(r.get('production_id')))
    seen_ids, seen_lines = collections.Counter(), collections.Counter()
    pooled = collections.defaultdict(list)          # group -> invoice lines without a production id

    def add(line_no, line, finding, severity, detail, value_at_risk=None):
        out.append({'line': line_no, 'invoice_number': s(line.get('invoice_number')),
                    'production_id': s(line.get('production_id')), 'labor_code': s(line.get('labor_code')),
                    'finding': finding, 'severity': severity, 'detail': detail,
                    'value_at_risk': None if value_at_risk is None else round(value_at_risk, 2)})

    for i, line in enumerate(invoice, start=2):
        code, pid = s(line.get('labor_code')), s(line.get('production_id'))
        qty, rate, amount = num(line.get('quantity')), num(line.get('unit_rate')), num(line.get('amount'))
        key = (s(line.get('project_id')), s(line.get('contractor_id')), code, s(line.get('period')))
        found = []
        if amount is not None and qty is not None and rate is not None and abs(amount - qty * rate) > 0.01:
            found.append(('AMOUNT ARITHMETIC', 'WARNING', 'amount %.2f but quantity x rate is %.2f' % (amount, qty * rate), abs(amount - qty * rate)))
        if code not in known_codes:
            found.append(('UNKNOWN CODE', 'CRITICAL', '%s is not a pay unit on the rate sheet' % code, amount))
        sig = key + (qty, rate)
        seen_lines[sig] += 1
        if pid:
            seen_ids[pid] += 1
            if seen_ids[pid] > 1 or billed_before[pid]:
                found.append(('DUPLICATE ITEM', 'CRITICAL', '%s billed %s' % (pid, 'again on this invoice' if seen_ids[pid] > 1 else 'on an earlier invoice'), amount))
            b = by_id.get(pid)
            if b is None:
                found.append(('PRODUCTION ID NOT FOUND', 'CRITICAL', 'no production record %s' % pid, amount))
            else:
                bkey = (s(b['project_id']), s(b['contractor_id']), s(b['labor_code']), s(b['period']))
                diffs = [n for n, a, c in zip(('project', 'contractor', 'labor code', 'period'), key, bkey) if a and a != c]
                if diffs:
                    found.append(('KEY MISMATCH', 'CRITICAL', '%s differs from the record (%s)' % (', '.join(diffs), '/'.join(bkey)), amount))
                if s(b['record_status']) != 'APPROVED':
                    found.append(('UNAPPROVED PRODUCTION BILLED', 'CRITICAL', '%s is %s' % (pid, b['record_status']), amount))
                else:
                    bq, br = num(b['quantity']) or 0.0, num(b['rate_applied'])
                    if qty is not None and qty > bq + TOL:
                        found.append(('QUANTITY ABOVE APPROVED', 'CRITICAL', 'billed %g, approved %g %s' % (qty, bq, s(b.get('unit'))), (qty - bq) * (rate or br or 0)))
                    elif qty is not None and qty < bq - TOL:
                        found.append(('QUANTITY BELOW APPROVED', 'WARNING', 'billed %g, approved %g %s' % (qty, bq, s(b.get('unit'))), None))
                    if rate is not None and br is not None and abs(rate - br) > TOL:
                        found.append(('WRONG RATE', 'CRITICAL', 'billed at %.2f, priced at %.2f (%s)' % (rate, br, s(b.get('rate_id'))), (rate - br) * (qty or 0)))
        else:
            if seen_lines[sig] > 1:
                found.append(('DUPLICATE ITEM', 'CRITICAL', 'identical line repeated (no Production ID to tell them apart)', amount))
            pooled[key].append((i, line))
        if found:
            for f in found:
                add(i, line, *f)
        elif pid:
            add(i, line, 'MATCH', 'OK', 'matches %s' % pid)

    # Lines without a Production ID: compare the group total with approved
    # production NOT already billed by ID - on this invoice or an earlier one -
    # so one record cannot be paid once by ID and again inside a lump line.
    billed_by_id = set(seen_ids) | set(billed_before)
    for key, lines in pooled.items():
        grp = groups.get(key, [])
        approved = [b for b in grp if s(b['record_status']) == 'APPROVED' and s(b['production_id']) not in billed_by_id]
        aq = sum(num(b['quantity']) or 0 for b in approved)
        bq = sum(num(l.get('quantity')) or 0 for _, l in lines)
        rates = sorted({round(num(b['rate_applied']), 2) for b in approved if num(b['rate_applied']) is not None})
        for i, line in lines:
            if s(line.get('labor_code')) not in known_codes:
                continue                                    # already reported
            rate = num(line.get('unit_rate'))
            issues = []
            if not approved:
                pend = [b for b in grp if s(b['record_status']) != 'APPROVED']
                issues.append(('UNAPPROVED PRODUCTION BILLED', 'CRITICAL',
                               'no APPROVED production for %s (%d unapproved record(s))' % ('/'.join(key), len(pend)), num(line.get('amount'))))
            else:
                if rate is not None and rates and all(abs(rate - r) > TOL for r in rates):
                    issues.append(('WRONG RATE', 'CRITICAL', 'billed at %.2f, priced at %s' % (rate, ', '.join('%.2f' % r for r in rates)), None))
            for f in issues:
                add(i, line, *f)
        if approved:
            i0, l0 = lines[0]
            if bq > aq + TOL:
                add(i0, l0, 'QUANTITY ABOVE APPROVED', 'CRITICAL',
                    '%s: billed %g, approved %g across %d record(s)' % ('/'.join(key), bq, aq, len(approved)),
                    (bq - aq) * (num(l0.get('unit_rate')) or 0))
            elif bq < aq - TOL:
                add(i0, l0, 'QUANTITY BELOW APPROVED', 'WARNING', '%s: billed %g, approved %g' % ('/'.join(key), bq, aq))
            elif not any(o['line'] in [n for n, _ in lines] and o['severity'] != 'OK' for o in out):
                add(i0, l0, 'MATCH', 'OK', '%s: billed %g = approved %g' % ('/'.join(key), bq, aq))
    return sorted(out, key=lambda o: (o['line'], o['finding']))


def main(argv):
    ap = argparse.ArgumentParser(description='Reconcile a contractor invoice against approved production.')
    ap.add_argument('invoice'); ap.add_argument('basis')
    ap.add_argument('--labor-codes', default=os.path.join(ROOT, 'data', 'import', 'contractor-rates-river-city.csv'))
    ap.add_argument('--previous', nargs='*', default=[])
    ap.add_argument('--out')
    a = ap.parse_args(argv[1:])
    known = {s(r['labor_code']) for r in rows(a.labor_codes)}
    prev = [r for p in a.previous for r in rows(p)]
    findings = reconcile(rows(a.invoice), rows(a.basis), known, prev)
    for f in findings:
        print('line %-3s %-8s %-29s %-18s %s' % (f['line'], f['severity'], f['finding'], f['production_id'] or '-', f['detail']))
    crit = [f for f in findings if f['severity'] == 'CRITICAL']
    risk = sum(f['value_at_risk'] or 0 for f in crit)
    print('\n%d finding(s), %d CRITICAL, value at risk %.2f' % (len(findings), len(crit), risk))
    if a.out:
        with open(a.out, 'w', newline='') as fh:
            w = csv.DictWriter(fh, fieldnames=['line', 'invoice_number', 'production_id', 'labor_code', 'finding', 'severity', 'detail', 'value_at_risk'])
            w.writeheader(); w.writerows(findings)
    return 1 if crit else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
