#!/usr/bin/env python3
"""
Known-good Data Event retention (Sprint 31).

The brief: "Retain the previous known-good Data Event version before deployment
and document rollback." fulcrum/known-good/ keeps, per app, the EXACT bytes
that were verified live (<app>.js) and the version before it (<app>.rollback.js)
where one is safe to redeploy. registry.json records versions, SHA-256 and
why a rollback is or is not allowed.

  python3 scripts/known_good.py check [--baseline fulcrum/baseline-<date>.json]
      Every file matches its registered hash; every registered live hash
      matches the baseline. Run in CI (tests/continuity.test.js).

  python3 scripts/known_good.py preflight APP FORMS_GET.json
      BEFORE a deployment: the script live right now must be the registered
      known-good. If it is not, someone changed it outside this procedure -
      stop and find out (AI/MCP operating rule 14). Exit 1 on mismatch.

  python3 scripts/known_good.py promote APP FORMS_GET.json --version X.Y.Z --commit HASH [--date YYYY-MM-DD]
      AFTER a deployment has been read back and verified: the previous
      known-good becomes the rollback target, the newly live bytes become the
      known-good.

  python3 scripts/known_good.py rollback APP > rollback.js
      Print the rollback target, for a Level 1 rollback
      (docs/backout-recovery-procedure.md). Refuses when the registry says the
      previous version must not be redeployed, and says why.
"""
import argparse, datetime, hashlib, json, os, shutil, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'fulcrum', 'known-good')


def sha(b):
    return hashlib.sha256(b if isinstance(b, bytes) else b.encode()).hexdigest()


def load_registry(d):
    return json.load(open(os.path.join(d, 'registry.json')))


def save_registry(d, reg):
    with open(os.path.join(d, 'registry.json'), 'w') as f:
        json.dump(reg, f, indent=1)
        f.write('\n')


def live_script(path):
    d = json.load(open(path))
    form = d.get('form', d)
    return form['id'], form.get('script') or ''


def latest_baseline():
    b = sorted(f for f in os.listdir(os.path.join(ROOT, 'fulcrum')) if f.startswith('baseline-') and f.endswith('.json'))
    return os.path.join(ROOT, 'fulcrum', b[-1])


def check(d, baseline):
    reg, problems = load_registry(d), []
    base = {f['id']: f for f in json.load(open(baseline))['forms']}
    for app, e in sorted(reg['apps'].items()):
        p = os.path.join(d, app + '.js')
        if not os.path.exists(p):
            problems.append('%s: %s.js missing' % (app, app)); continue
        if sha(open(p, 'rb').read()) != e['live']['sha256']:
            problems.append('%s: %s.js does not match the registered hash' % (app, app))
        b = base.get(e['form_id'])
        if b is None:
            problems.append('%s: form %s not in %s' % (app, e['form_id'], os.path.basename(baseline)))
        elif b['script_sha256'] != e['live']['sha256']:
            problems.append('%s: live script in %s (%s) is not the registered known-good (%s)'
                            % (app, os.path.basename(baseline), b['script_sha256'][:12], e['live']['sha256'][:12]))
        rb = e.get('rollback')
        if rb and rb.get('safe_to_redeploy'):
            rp = os.path.join(d, app + '.rollback.js')
            if not os.path.exists(rp):
                problems.append('%s: rollback marked safe but %s.rollback.js missing' % (app, app))
            elif sha(open(rp, 'rb').read()) != rb['sha256']:
                problems.append('%s: %s.rollback.js does not match the registered hash' % (app, app))
        if rb and not rb.get('safe_to_redeploy') and not rb.get('reason'):
            problems.append('%s: rollback refused without a reason' % app)
    return problems


def main(argv):
    ap = argparse.ArgumentParser(description='Known-good Data Event retention.')
    ap.add_argument('--dir', default=DIR)
    sub = ap.add_subparsers(dest='cmd', required=True)
    c = sub.add_parser('check'); c.add_argument('--baseline')
    p = sub.add_parser('preflight'); p.add_argument('app'); p.add_argument('forms_get')
    m = sub.add_parser('promote'); m.add_argument('app'); m.add_argument('forms_get')
    m.add_argument('--version', required=True); m.add_argument('--commit', required=True); m.add_argument('--date')
    r = sub.add_parser('rollback'); r.add_argument('app')
    a = ap.parse_args(argv[1:])
    d = a.dir

    if a.cmd == 'check':
        problems = check(d, a.baseline or latest_baseline())
        for x in problems:
            print('FAIL', x)
        print('%d problem(s)' % len(problems))
        return 1 if problems else 0

    reg = load_registry(d)
    if a.app not in reg['apps']:
        raise SystemExit('unknown app %s; known: %s' % (a.app, ', '.join(sorted(reg['apps']))))
    e = reg['apps'][a.app]

    if a.cmd == 'preflight':
        fid, script = live_script(a.forms_get)
        if fid != e['form_id']:
            print('FAIL %s is form %s, registry expects %s' % (a.forms_get, fid, e['form_id'])); return 1
        if sha(script) != e['live']['sha256']:
            print('FAIL the live %s script (%s) is not the registered known-good v%s (%s). It was changed outside '
                  'the release process. Stop, find out what changed, and register it before deploying anything.'
                  % (a.app, sha(script)[:12], e['live']['version'], e['live']['sha256'][:12]))
            return 1
        print('OK live %s is the registered known-good v%s; safe to deploy over it' % (a.app, e['live']['version']))
        return 0

    if a.cmd == 'promote':
        fid, script = live_script(a.forms_get)
        if fid != e['form_id']:
            raise SystemExit('%s is form %s, registry expects %s' % (a.forms_get, fid, e['form_id']))
        if sha(script) == e['live']['sha256']:
            raise SystemExit('the live script is already the registered known-good; nothing to promote')
        shutil.copyfile(os.path.join(d, a.app + '.js'), os.path.join(d, a.app + '.rollback.js'))
        e['rollback'] = dict(e['live'], safe_to_redeploy=True,
                             reason='previous known-good, verified live until %s' % (a.date or datetime.date.today().isoformat()))
        with open(os.path.join(d, a.app + '.js'), 'w', newline='') as f:
            f.write(script)
        e['live'] = {'version': a.version, 'sha256': sha(script), 'commit': a.commit,
                     'verified_live': a.date or datetime.date.today().isoformat()}
        save_registry(d, reg)
        print('promoted %s v%s; rollback target is now v%s' % (a.app, a.version, e['rollback']['version']))
        print('If the old rollback target must never be redeployed either, edit its reason by hand.')
        return 0

    if a.cmd == 'rollback':
        rb = e.get('rollback')
        if not rb:
            print('no rollback target for %s: %s' % (a.app, e.get('note', 'first version - disable the handler instead')), file=sys.stderr); return 1
        if not rb.get('safe_to_redeploy'):
            print('REFUSED: v%s must not be redeployed. %s' % (rb['version'], rb['reason']), file=sys.stderr); return 1
        sys.stdout.write(open(os.path.join(d, a.app + '.rollback.js')).read())
        return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
