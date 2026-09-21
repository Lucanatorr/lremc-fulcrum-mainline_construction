# Master data import runbook

Five files, ~412 records, in this order. Pre-flighted against the deployed
schemas by `scripts/validate_import.py` — **run that first; it exits non-zero
if anything would import wrong.**

```
python3 scripts/validate_import.py
```

## Why this could not be done from the build session

Two independent blockers, both verified rather than assumed:

1. **The Fulcrum MCP server has no record-creation tool.** It exposes
   `forms_*`, `choice_lists_*`, `classification_sets_*`, `projects_*`,
   `webhooks_*`, `report_templates_*` and `reports_create`. Its only record
   tool, `query_records`, is documented read-only.
2. **`api.fulcrumapp.com` is blocked by the environment's network policy** —
   the proxy answers `403` to `CONNECT api.fulcrumapp.com:443`. So even with a
   token, the Records API is unreachable from that session.

Import through the **Fulcrum web UI** (Data → *app* → Import), or the Records
API from a machine that can reach it.

## Order matters

Later files reference earlier ones. Import top to bottom.

| # | File | App | Rows |
|---|---|---|---:|
| 1 | `project-master.csv` | MC Project Master | 3 |
| 2 | `contractor-master.csv` | MC Contractor Master | 3 |
| 3 | `material-master.csv` | MC Material Master | 135 |
| 4 | `contractor-rates-river-city.csv` | MC Contractor Rate | 146 |
| 5 | `labor-material-mapping.csv` | MC Labor-Material Mapping | 125 |

**Every column header is already the app's exact `data_name`**, so Fulcrum's
importer maps them automatically. Do not rename them.

## Two things to know before you start

### RecordLinks do not import from CSV

`MC Contractor Rate` has `contractor_link` and `project_link` RecordLink
fields. A CSV import cannot populate them; they will be empty.

**This does not break anything.** Production records copy their rate values
from the rate's *snapshot* columns (`contractor_id_snap`, `project_id_snap`,
`labor_code`, `unit_rate`, `effective_date`, `expiration_date`), and all of
those do import. The links are for navigation only. Set them by hand later if
you want click-through, or leave them.

### 10 mapping rows are held back, on purpose

`labor-material-mapping.csv` has **125** rows, not the 135 in
`labor-material-mapping-proposed.csv`. The other 10 are in
`_held-back-labor-material-mapping.csv` with the reason on each row.

They map material to six pay units that **do not exist in the rate sheet** —
`AFO.BANDING`, `BDO(M)`, `BFO.96.I`, `BFO.96.IE`, `BM60 (4)DP SDR11 RR`,
`HO1-12R`. Those are the billing gaps (open item 11): work already in the
ground with no priced unit to bill it. Importing them would put a required
ChoiceField in an empty state on 10 records.

**None of the 10 is APPROVED**, so nothing approved is lost. Once a pay unit is
created for those codes, re-run the validator and the rows move across
automatically.

## After importing

1. **Spot-check three records per app** against the CSV — particularly a
   conduit mapping, to confirm `waste_factor` and `confidence` landed. Both
   fields were added to the app on 2026-09-21 specifically because the import
   would otherwise have dropped them.
2. **Run every report once.** None has ever returned a row.
   ```sql
   -- start here; it should return nothing on clean master data
   -- reports/exception-dashboard.sql
   ```
3. **Then build the 23.1 test project** `MCP-TEST-001` and enter representative
   production across underground, aerial, fiber and splicing.
4. Re-run the readiness gate in `docs/sprint-23-readiness.md`.

## Regenerating these files

Never edit them by hand.

```
python3 scripts/normalize_rates.py          # 146 pay units + the rate CSV
python3 scripts/build_material_mapping.py   # material master + mapping
python3 scripts/validate_import.py          # pre-flight + the go/held-back split
```

All three are idempotent.
