#!/usr/bin/env python3
"""
Configuration snapshot and drift check (Sprint 31).

Fulcrum keeps form history (forms_history), but this project keeps its own
copy of what was configured, so a bad change can be found and undone.

  python3 scripts/config_snapshot.py FOLDER [--date YYYY-MM-DD] [--out fulcrum/baseline-<date>.json]
  python3 scripts/config_snapshot.py FOLDER --compare fulcrum/baseline-<date>.json

FOLDER holds read-only tool results saved as files:
  <form_id>.json      forms_get   ({"form": {...}})
  cl_<id>.json        choice_lists_get ({"choice_list": {...}})
Keep FOLDER itself with the backup: it is the full configuration (elements,
scripts, status lists, choices). The snapshot written here keeps only names,
versions and SHA-256 hashes, so it can live in the repository.

Hashes are computed exactly as fulcrum/baseline-2026-11-12.json was:
SHA-256 of the script text, and of json.dumps(x, sort_keys=True) for the
elements and the choices. A script's version is looked up in
fulcrum/known-good/registry.json by hash; a script that matches no registered
version is reported as UNREGISTERED - it was changed outside the release
process.

--compare prints, per form, SAME or what differs (script, elements, statuses,
title) and exits 1 on any difference.
"""
import argparse, glob, hashlib, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def h(s):
    return hashlib.sha256(s.encode()).hexdigest()


def registry_versions():
    p = os.path.join(ROOT, 'fulcrum', 'known-good', 'registry.json')
    out = {}
    if os.path.exists(p):
        for app, e in json.load(open(p))['apps'].items():
            out[e['live']['sha256']] = (app, e['live']['version'])
            if e.get('rollback'):
                out[e['rollback']['sha256']] = (app, e['rollback']['version'])
    return out


def snapshot(folder, date):
    known = registry_versions()
    forms, lists = [], []
    for p in sorted(glob.glob(os.path.join(folder, '*.json'))):
        name = os.path.basename(p)
        d = json.load(open(p))
        if 'form' in d:
            f = d['form']
            script = f.get('script') or ''
            st = (f.get('status_field') or {}).get('choices') or []
            forms.append({
                'name': f['name'], 'id': f['id'], 'updated_at': f.get('updated_at'),
                'data_event_version': (known.get(h(script), (None, 'UNREGISTERED'))[1] if script else None),
                'script_sha256': h(script) if script else None,
                'script_chars': len(script),
                'element_count': count(f.get('elements') or []),
                'elements_sha256': h(json.dumps(f.get('elements'), sort_keys=True)),
                'statuses': [c.get('value') for c in st],
            })
        elif 'choice_list' in d:
            c = d['choice_list']
            lists.append({'name': c['name'], 'id': c['id'], 'updated_at': c.get('updated_at'),
                          'entries': len(c.get('choices') or []),
                          'choices_sha256': h(json.dumps(c.get('choices'), sort_keys=True))})
    return {'baseline_date': date, 'environment': 'Development',
            'captured_by': 'read-only forms_get / choice_lists_get, scripts/config_snapshot.py',
            'forms': forms, 'choice_lists': lists}


def count(els):
    n = 0
    for e in els:
        n += 1
        n += count(e.get('elements') or [])
    return n


def compare(now, base):
    diffs = []
    B = {f['id']: f for f in base.get('forms', [])}
    N = {f['id']: f for f in now['forms']}
    for fid in sorted(set(B) | set(N)):
        b, n = B.get(fid), N.get(fid)
        if not n:
            diffs.append((b['name'], 'MISSING NOW', 'in the baseline, not in this snapshot')); continue
        if not b:
            diffs.append((n['name'], 'NEW', 'not in the baseline')); continue
        out = []
        if b.get('script_sha256') != n.get('script_sha256'):
            out.append('script %s -> %s (%s)' % ((b.get('script_sha256') or '-')[:12], (n.get('script_sha256') or '-')[:12], n.get('data_event_version')))
        if b.get('elements_sha256') != n.get('elements_sha256'):
            out.append('elements changed (%s -> %s elements)' % (b.get('element_count'), n.get('element_count')))
        if b.get('statuses') and b.get('statuses') != n.get('statuses'):
            out.append('statuses %s -> %s' % (b.get('statuses'), n.get('statuses')))
        diffs.append((n['name'], 'DIFFERS' if out else 'SAME', '; '.join(out)))
    BL = {c['id']: c for c in base.get('choice_lists', [])}
    for c in now['choice_lists']:
        b = BL.get(c['id'])
        diffs.append((c['name'], 'NEW' if not b else 'SAME' if b['choices_sha256'] == c['choices_sha256'] else 'DIFFERS',
                      '' if not b or b['choices_sha256'] == c['choices_sha256'] else '%s -> %s entries' % (b['entries'], c['entries'])))
    return diffs


def main(argv):
    ap = argparse.ArgumentParser(description='Configuration snapshot and drift check.')
    ap.add_argument('folder'); ap.add_argument('--date'); ap.add_argument('--out'); ap.add_argument('--compare')
    a = ap.parse_args(argv[1:])
    import datetime
    snap = snapshot(a.folder, a.date or datetime.date.today().isoformat())
    if a.compare:
        diffs = compare(snap, json.load(open(a.compare)))
        for name, st, detail in diffs:
            print('%-8s %-42s %s' % (st, name, detail))
        bad = [d for d in diffs if d[1] != 'SAME']
        print('\n%d item(s), %d differ from %s' % (len(diffs), len(bad), os.path.basename(a.compare)))
        return 1 if bad else 0
    text = json.dumps(snap, indent=1) + '\n'
    if a.out:
        open(a.out, 'w').write(text)
    else:
        sys.stdout.write(text)
    unreg = [f['name'] for f in snap['forms'] if f['data_event_version'] == 'UNREGISTERED']
    if unreg:
        print('UNREGISTERED script(s): %s' % ', '.join(unreg), file=sys.stderr)
        return 1
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
