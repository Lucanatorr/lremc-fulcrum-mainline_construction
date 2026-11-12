#!/usr/bin/env python3
"""
Verify a backup folder, and find what was DELETED since the last one (Sprint 31).

  python3 scripts/backup_verify.py FOLDER [--previous OLDER_FOLDER] [--write-manifest OUT.json]

FOLDER holds one saved result per dataset, named <dataset>.json (Query API) or
<dataset>.csv (Fulcrum Query UI), from reports/continuity/backup-*.sql, plus
manifest.json|csv from reports/continuity/backup-manifest.sql run in the
same sitting.

CHECKS, per dataset in the manifest
  MISSING FILE      the manifest lists it, the folder has no export      FAIL
  COUNT MISMATCH    rows in the export <> row_count in the manifest       FAIL
  FINGERPRINT       MD5 of id:version rows <> the manifest fingerprint:
                    the export is not the data the manifest saw           FAIL
                    (a record was edited between the two runs, or rows
                    were cut off). Re-run both together.
  OK                count and fingerprint agree

AGAINST --previous (the last good backup)
  DELETED           an id in the previous backup is gone. Fulcrum cannot
                    restore a deleted record; the previous backup is now
                    the only copy of it. Every one must be explained   FAIL
  CHANGED / ADDED   counted, not failed: edits and new records are normal

Exit 1 on any FAIL. --write-manifest writes the verified counts and
fingerprints (no record data) so the evidence can be kept in the repository.
"""
import argparse, csv, hashlib, io, json, os, sys


def load(path):
    with io.open(path, encoding='utf-8-sig') as f:
        text = f.read()
    if path.lower().endswith('.csv'):
        return list(csv.DictReader(io.StringIO(text)))
    d = json.loads(text)
    return d['rows'] if isinstance(d, dict) else d


def find(folder, name):
    for ext in ('.json', '.csv'):
        p = os.path.join(folder, name + ext)
        if os.path.exists(p):
            return p
    return None


def id_column(rows, source_table):
    return '_child_record_id' if '/' in (source_table or '') else '_record_id'


def versions(rows, idc):
    out = {}
    for r in rows:
        v = r.get('_version')
        out[str(r[idc])] = str(int(float(v))) if v not in (None, '') else ''
    return out


def fingerprint(ver):
    # Same as the SQL: MD5 of "id:version" joined with "," in byte order.
    # The SQL returns MD5('') for an empty table.
    s = ','.join('%s:%s' % (k, ver[k]) for k in sorted(ver, key=lambda x: x.encode()))
    return hashlib.md5(s.encode()).hexdigest()


def verify(folder, previous=None):
    mpath = find(folder, 'manifest')
    if not mpath:
        raise SystemExit('%s has no manifest.json|csv - run reports/continuity/backup-manifest.sql with the exports' % folder)
    manifest = load(mpath)
    results, fails, summary = [], 0, []
    for m in manifest:
        ds, table = m['dataset'], m.get('source_table')
        p = find(folder, ds)
        if not p:
            results.append((ds, 'FAIL', 'MISSING FILE', 'manifest lists %s rows, no %s.json|csv' % (m['row_count'], ds)))
            fails += 1
            continue
        rows = load(p)
        idc = id_column(rows, table)
        ver = versions(rows, idc)
        want_n, got_n = int(float(m['row_count'])), len(rows)
        fp = fingerprint(ver)
        status = 'OK'
        if got_n != want_n or len(ver) != got_n:
            results.append((ds, 'FAIL', 'COUNT MISMATCH', 'export has %d rows (%d distinct ids), manifest says %d' % (got_n, len(ver), want_n)))
            status = 'FAIL'
        elif fp != m['fingerprint']:
            results.append((ds, 'FAIL', 'FINGERPRINT', 'export %s, manifest %s: re-run the export and the manifest together' % (fp, m['fingerprint'])))
            status = 'FAIL'
        else:
            results.append((ds, 'OK', 'OK', '%d rows, fingerprint matches' % got_n))
        fails += status == 'FAIL'
        prev_info = None
        if previous:
            pp = find(previous, ds)
            if pp:
                pver = versions(load(pp), idc)
                deleted = sorted(set(pver) - set(ver))
                added = sorted(set(ver) - set(pver))
                changed = sorted(k for k in set(ver) & set(pver) if ver[k] != pver[k])
                for d in deleted:
                    results.append((ds, 'FAIL', 'DELETED', '%s (version %s) is in %s and gone now; that backup is the only copy' % (d, pver[d], os.path.basename(previous.rstrip('/')))))
                    fails += 1
                prev_info = {'deleted': len(deleted), 'added': len(added), 'changed': len(changed)}
                if added or changed:
                    results.append((ds, 'OK', 'CHANGED / ADDED', '%d changed, %d added since the previous backup' % (len(changed), len(added))))
        summary.append({'dataset': ds, 'source_table': table, 'row_count': got_n, 'fingerprint': fp,
                        'last_server_update': m.get('last_server_update'), 'status': status,
                        'since_previous': prev_info})
    return results, fails, summary


def main(argv):
    ap = argparse.ArgumentParser(description='Verify a backup folder against its manifest.')
    ap.add_argument('folder')
    ap.add_argument('--previous')
    ap.add_argument('--write-manifest')
    a = ap.parse_args(argv[1:])
    results, fails, summary = verify(a.folder, a.previous)
    for ds, sev, finding, detail in results:
        print('%-4s %-22s %-16s %s' % (sev, ds, finding, detail))
    print('\n%d dataset(s), %d FAIL' % (len(summary), fails))
    if a.write_manifest:
        with open(a.write_manifest, 'w') as f:
            json.dump({'backup': os.path.basename(a.folder.rstrip('/')), 'verified': fails == 0,
                       'datasets': summary}, f, indent=1)
            f.write('\n')
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
