# LREMC — Fulcrum Mainline Construction

Configuration-as-code, test harness and design record for the Fulcrum
**Mainline Construction** system: broadband/fiber construction production
tracking from initial construction through closeout.

## Layout

| Path | Contents |
|---|---|
| `docs/` | Implementation log, discovery findings, per-sprint build notes, object inventory |
| `scripts/` | Rate-sheet normalization |
| `tests/` | Data Event logic tests, 774 of them, run against the authoritative script |
| `fulcrum/` | Deployed schemas and Data Event sources |
| `data/` | Extracted + normalized master data, and import-ready CSVs |
| `reports/` | Production, financial, scope and QA reports (SQL) — see `reports/_conventions.md` |

## Start here

1. `docs/implementation-log.md` — what happened, what was decided, what is open
2. `docs/sprint-10-12-gaps.md` — **what is not finished**, and why. Read this
   before assuming any report works: none has ever been executed
3. `docs/sprint-0-discovery.md` — environment inventory **and a live security finding**
4. `docs/fulcrum-inventory.md` — every Fulcrum object created, and where its
   schema and Data Events source live in this repo

## Run the tests

774 tests, no dependencies, plain `node`. Data Event tests load the shipped
script directly via `tests/harness.js`, and report tests check each SQL file
against `reports/_conventions.md`, so neither can drift:

```
for f in tests/*.test.js; do node "$f"; done
```

## Regenerate the masters

```
python3 scripts/normalize_rates.py          # 146 pay units + the rate CSV
python3 scripts/build_material_mapping.py   # material master + labor->material
```

Both are idempotent and are the only way these files should change — never edit
the generated CSVs by hand.

## Conventions

- **Development objects only.** No production Fulcrum app is modified.
- **No secrets in app script**, ever. Fulcrum app script syncs to every field device.
- **Reporting week is ISO-8601, Monday start**, working week Mon–Fri. Every report uses this.
- **Rates are snapshotted onto transactions**, never recalculated from master.
- **Totals are never stored.** Production and material balances are summed from
  atomic transactions.
- **Master data is never hard-coded into app script.** Parsing a fact out of a
  contract code is reading the contract; deciding what it consumes is a business
  rule and lives in a master app.
