# LREMC — Fulcrum Mainline Construction

Configuration-as-code, test harness and design record for the Fulcrum
**Mainline Construction** system: broadband/fiber construction production
tracking from initial construction through closeout.

## Layout

| Path | Contents |
|---|---|
| `docs/` | Implementation log, discovery findings, per-sprint build notes, object inventory |
| `scripts/` | Rate-sheet normalization |
| `tests/` | Data Event logic tests, 112 of them |
| `fulcrum/` | Deployed schemas and Data Event sources |
| `data/` | Extracted + normalized master data, and import-ready CSVs |
| `reports/` | Server-side exception reports (SQL) |

## Start here

1. `docs/implementation-log.md` — what happened, what was decided, what is open
2. `docs/sprint-0-discovery.md` — environment inventory **and a live security finding**
3. `docs/fulcrum-inventory.md` — every Fulcrum object created, and where its
   schema and Data Events source live in this repo

## Run the tests

112 tests, no dependencies, plain `node`:

```
for f in tests/*.test.js; do node "$f"; done
```

## Regenerate the labor master

```
python3 scripts/normalize_rates.py
```

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
