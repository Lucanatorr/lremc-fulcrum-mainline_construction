#!/usr/bin/env python3
"""
Pre-flight the master-data import against the DEPLOYED app schemas.

Fulcrum's CSV import is unforgiving in a quiet way: a ChoiceField value that is
not in the app's list does not stop the import, it lands as nothing, and a
required field that ends up empty fails the row. Both look like success until
somebody reads the data.

This script catches that before the import rather than after. It also splits
rows that cannot be imported into a held-back file, with the reason, so a
partial import is a deliberate act instead of a surprise halfway through.

Run:  python3 scripts/validate_import.py
Idempotent. Writes to data/import/.
"""
import csv, io, json, os, sys, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMP = os.path.join(ROOT, 'data', 'import')

def rows(name):
    with io.open(os.path.join(IMP, name), encoding='utf-8') as f:
        return list(csv.DictReader(f))

def write(name, header, data):
    with io.open(os.path.join(IMP, name), 'w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=header)
        w.writeheader()
        for r in data:
            w.writerow(r)

# The deployed labor choice list was generated from this file by
# scripts/normalize_rates.py, so it is the authority on which pay units exist.
with io.open(os.path.join(ROOT, 'data', 'labor-choices.json'), encoding='utf-8') as f:
    LABOR = {c['value'] for c in json.load(f)}

UOM = {'FT', 'EA', 'HR', 'SPLICE', 'SF', 'EVENT'}

# data_name -> allowed values, per deployed app. Kept here rather than fetched
# so this runs offline; forms_get is the authority if they ever disagree.
ALLOWED = {
    'labor-material-mapping-proposed.csv': {
        'calculation_type': {'PER_UNIT', 'FIXED'},
        'source': {'DERIVED', 'OBSERVED_CONSUMPTION', 'BUSINESS_RULE', 'NEEDS_REVIEW'},
        'confidence': {'RULING', 'CONFIRMED', 'SINGLE SOURCE', 'CONFLICT',
                       'COMPETING SKU', 'REEL-SOURCED'},
        'status': {'NEEDS REVIEW', 'APPROVED', 'SUPERSEDED', 'REJECTED'},
        'material_unit': UOM,
        'active': {'yes', 'no'},
    },
    'contractor-rates-river-city.csv': {
        'unit': UOM, 'active': {'yes', 'no'},
        'status': {'ACTIVE', 'PENDING', 'SUPERSEDED', 'EXPIRED', 'VOID'},
    },
    'material-master.csv': {'unit': UOM, 'active': {'yes', 'no'}},
    'contractor-master.csv': {'active': {'yes', 'no'}},
}

problems = []
def flag(sev, where, msg):
    problems.append((sev, where, msg))

# ---------------------------------------------------- choice value validation
for fname, cols in ALLOWED.items():
    data = rows(fname)
    for col, allowed in cols.items():
        if not data or col not in data[0]:
            continue
        bad = collections.Counter(r[col] for r in data if r[col] and r[col] not in allowed)
        for v, n in bad.items():
            flag('BLOCKER', f'{fname}[{col}]',
                 f'{n} row(s) carry "{v}", which is not a choice in the deployed app')

# ------------------------------------------------ labor codes must exist
for fname in ('contractor-rates-river-city.csv', 'labor-material-mapping-proposed.csv'):
    data = rows(fname)
    orphans = collections.Counter(r['labor_code'] for r in data if r['labor_code'] not in LABOR)
    for code, n in orphans.items():
        flag('BLOCKER', f'{fname}[labor_code]',
             f'{n} row(s) reference pay unit "{code}", which has no entry in the '
             f'choice list, so a required field would import empty')

# ------------------------------- split the mapping file into go / held back
mapping = rows('labor-material-mapping-proposed.csv')
hdr = list(mapping[0].keys())
ok = [r for r in mapping if r['labor_code'] in LABOR]
held = [dict(r, held_back_reason=(
    f'Pay unit {r["labor_code"]} does not exist in the rate sheet, so there is '
    f'no priced unit to map material to. This is one of the seven billing gaps '
    f'(open item 11), not a mapping defect.')) for r in mapping if r['labor_code'] not in LABOR]

write('labor-material-mapping.csv', hdr, ok)
write('_held-back-labor-material-mapping.csv', hdr + ['held_back_reason'], held)

# ------------------------------------------------------------------ report
print(f'labor choice list      : {len(LABOR)} pay units')
print(f'mapping rows total     : {len(mapping)}')
print(f'  importable           : {len(ok)}  -> data/import/labor-material-mapping.csv')
print(f'  held back            : {len(held)}  -> data/import/_held-back-labor-material-mapping.csv')
approved_held = sum(1 for r in held if r['status'] == 'APPROVED')
print(f'  held back & APPROVED : {approved_held}  (nothing approved is being lost)'
      if approved_held == 0 else
      f'  held back & APPROVED : {approved_held}  ** APPROVED MAPPINGS WOULD BE LOST **')

print('\nfindings:')
if not problems:
    print('  none - every file is import-ready')
blocking_after_split = 0
for sev, where, msg in problems:
    resolved = 'labor_code' in where and 'labor-material-mapping' in where
    tag = 'RESOLVED by the split' if resolved else sev
    if not resolved:
        blocking_after_split += 1
    print(f'  [{tag}] {where}: {msg}')

print(f'\n{blocking_after_split} unresolved blocker(s).')
sys.exit(1 if blocking_after_split else 0)
