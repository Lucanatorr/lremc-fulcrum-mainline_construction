#!/usr/bin/env python3
"""
Generate docs/field-dictionary.md from fulcrum/schemas/*.elements.json (Sprint 32).

  python3 scripts/field_dictionary.py            # write docs/field-dictionary.md
  python3 scripts/field_dictionary.py --check    # exit 1 if the file is stale

Covers handoff sections 4 (Field Dictionary: what each field is) and 5 (Field
Key Dictionary: element key <-> data_name <-> Query API column). Generated, so
it cannot drift from the schemas; tests/handoff.test.js runs --check.
The schemas are compared with live by scripts/config_snapshot.py.
"""
import glob, io, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'docs', 'field-dictionary.md')

APPS = {   # schema file stem -> (app name, form id)
    'mainline-construction-dev': ('Mainline Construction', '06c36c8e-4a88-4cf3-a691-9a792f8374d2'),
    'mc-project-master-dev': ('MC Project Master', '5ce243d4-9ec1-4fbd-8659-7be9f632b55c'),
    'mc-contractor-master-dev': ('MC Contractor Master', 'd8a368b5-1e19-4f5f-8cf9-ff8fbdd03ab4'),
    'mc-contractor-rate-dev': ('MC Contractor Rate', 'a5529dd0-54fa-4b8d-b595-d0218df0ee97'),
    'mc-project-scope-line-dev': ('MC Project Scope Line', 'aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b'),
    'mc-change-order-dev': ('MC Change Order', '458ae172-b7b4-43b5-8917-d7a792c9e81a'),
    'mc-labor-material-mapping-dev': ('MC Labor-Material Mapping', '38e3d7fd-ca78-4016-8018-ec955446c13f'),
    'mc-material-master-dev': ('MC Material Master', '658143d1-edbd-430b-81bb-1b0bb1092729'),
    'mc-material-transaction-dev': ('MC Material Transaction', 'ee204906-adb3-431b-a1d9-d7427a4c842c'),
    'mc-fiber-reel-dev': ('MC Fiber Reel', '728477da-5f36-48cb-b3ab-cbc8c38d077f'),
    'mc-structure-dev': ('MC Structure', '397b52cf-a4f0-4871-b8ea-1fdb592fe2ab'),
    'mc-segment-dev': ('MC Segment', '7da87588-940a-4b9e-915d-5ec25d5c0ebc'),
    'mc-project-closeout-dev': ('MC Project Closeout', '351bb1f1-9837-47c8-be5b-bb0727fe93a0'),
}
LAYOUT = {'Section', 'Label'}


def cell(v, n=160):
    s = re.sub(r'\s+', ' ', str(v or '')).strip().replace('|', '\\|')
    return s if len(s) <= n else s[:n - 1].rstrip() + '…'


def walk(els, table, parent, out):
    for e in els:
        t = e.get('type')
        if t == 'Repeatable':
            out.append((e, table, parent))
            walk(e.get('elements') or [], '%s/%s' % (table, e.get('data_name')), e.get('label'), out)
        elif t in LAYOUT:
            walk(e.get('elements') or [], table, e.get('label') or parent, out)
        else:
            out.append((e, table, parent))


def flags(e):
    f = []
    if e.get('required'): f.append('required')
    if e.get('disabled'): f.append('read-only')
    if e.get('hidden'): f.append('hidden')
    if e.get('choice_list_id') or e.get('choices') or e.get('classification_set_id'): f.append('list')
    if e.get('form_id'): f.append('links')
    if e.get('expression'): f.append('calculated')
    return ', '.join(f)


def build():
    lines = ['# Field Dictionary and Field Key Dictionary', '',
             '**Generated** by `scripts/field_dictionary.py` from `fulcrum/schemas/*.elements.json`.',
             'Do not edit by hand: change the schema, deploy it, then regenerate. Handoff',
             'sections 4 and 5.', '',
             '- **Key** is Fulcrum\'s element key, the one `forms_update` preserves. **Never reuse',
             '  or change a key**: the column behind it carries history.',
             '- **data_name** is the field identifier used by Data Events (`$data_name`) and',
             '  the **Query API column** name.',
             '- **Table** is where the column lives: the form ID, or `<form id>/<repeatable>`',
             '  for repeatable rows (joined to the parent on `_parent_id`).',
             '- Every table also has Fulcrum\'s own columns: `_record_id`, `_status`,',
             '  `_version`, `_created_at`, `_updated_at`, `_server_updated_at`,',
             '  `_created_by_id`, `_updated_by_id`, `_latitude`, `_longitude`. Repeatable',
             '  rows have `_child_record_id` and `_parent_id` too.',
             '- Flags: required · read-only (set by a Data Event or calculation) · hidden ·',
             '  list (a choice list) · links (a record link) · calculated.', '']
    total = 0
    lines.append('| App | Form ID | Fields |')
    lines.append('|---|---|---:|')
    rows_by_app = []
    for stem, (name, fid) in APPS.items():
        els = json.load(open(os.path.join(ROOT, 'fulcrum', 'schemas', stem + '.elements.json')))
        els = els.get('elements', els) if isinstance(els, dict) else els
        out = []
        walk(els, fid, '', out)
        rows_by_app.append((stem, name, fid, out))
        total += len(out)
        lines.append('| [%s](#%s) | `%s` | %d |' % (name, re.sub(r'[^a-z0-9 -]', '', name.lower()).replace(' ', '-'), fid, len(out)))
    lines.append('| **Total** | | **%d** |' % total)
    lines.append('')
    for stem, name, fid, out in rows_by_app:
        lines += ['## %s' % name, '', 'Form `%s` · schema `fulcrum/schemas/%s.elements.json`' % (fid, stem), '',
                  '| Key | data_name | Label | Type | Section | Flags | Description |',
                  '|---|---|---|---|---|---|---|']
        for e, table, parent in out:
            dn = e.get('data_name') or ''
            if table != fid:
                dn += ' ⟨%s⟩' % table.split('/', 1)[1]
            lines.append('| `%s` | `%s` | %s | %s | %s | %s | %s |' % (
                e.get('key'), dn, cell(e.get('label'), 60), e.get('type'), cell(parent, 40), flags(e), cell(e.get('description'))))
        lines.append('')
    return '\n'.join(lines).rstrip() + '\n', total


def main(argv):
    text, total = build()
    if '--check' in argv:
        cur = io.open(OUT, encoding='utf-8').read() if os.path.exists(OUT) else ''
        if cur != text:
            print('docs/field-dictionary.md is stale: run python3 scripts/field_dictionary.py'); return 1
        print('docs/field-dictionary.md is current (%d fields)' % total); return 0
    io.open(OUT, 'w', encoding='utf-8').write(text)
    print('wrote docs/field-dictionary.md: %d fields across %d apps' % (total, len(APPS)))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv))
