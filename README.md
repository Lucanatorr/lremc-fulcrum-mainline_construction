# LREMC — Fulcrum Mainline Construction

Configuration-as-code, test harness and design record for the Fulcrum
**Mainline Construction** system: broadband/fiber construction production
tracking from initial construction through closeout.

## Layout

| Path | Contents |
|---|---|
| `docs/` | Implementation log, discovery findings, per-sprint build notes, object inventory |
| `scripts/` | Rate-sheet normalization |
| `tests/` | Data Event logic tests (`node tests/data-events.test.js`) |
| `fulcrum/` | Deployed schemas and Data Event sources |
| `data/` | Extracted + normalized master data |

## Start here

1. `docs/implementation-log.md` — what happened, what was decided, what is open
2. `docs/sprint-0-discovery.md` — environment inventory **and a live security finding**
3. `docs/fulcrum-inventory.md` — every Fulcrum object created

## Run the tests

```
node tests/data-events.test.js
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
