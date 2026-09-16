# Sprint 2 — Master Data and Contractor Pricing

**Status:** COMPLETE. Masters built and the production app is wired to them.

## Apps created

| App | ID |
|---|---|
| MC Contractor Master - Development | `d8a368b5-1e19-4f5f-8cf9-ff8fbdd03ab4` |
| MC Project Master - Development | `5ce243d4-9ec1-4fbd-8659-7be9f632b55c` |
| MC Contractor Rate - Development | `a5529dd0-54fa-4b8d-b595-d0218df0ee97` |

## The rate architecture

A rate record is keyed by **Contractor + Project(optional) + Labor Code + effective period**.
Leaving Project blank makes a rate apply to every project; a project-specific
rate outranks an all-projects rate for the same contractor, code and date.

### Why RecordLink + `record_defaults`, not a query

Fulcrum Data Events expose exactly one cross-record lookup: `REQUEST` (HTTP),
which is **online-only** and therefore unusable for field work that loses
service. `record_defaults` instead performs a **physical copy** from the linked
record at selection time.

That single mechanism satisfies two requirements at once:

1. **Offline-safe** — linked records sync to the device; no connectivity needed.
2. **Historical rate snapshot** — because the copy is physical, repricing the
   master later cannot retroactively rewrite an approved transaction
   (Sprints 23.10, 23.47.5).

The Rate app already demonstrates the pattern: selecting a Contractor copies
`contractor_id` and `contractor_name` down; selecting a Project copies
`project_id` and `project_name` down.

### Rate versioning

Rates are **never overwritten**. To reprice:

1. Set an Expiration Date on the current rate and move it to `EXPIRED`/`SUPERSEDED`.
2. Create a new rate record with the new Effective Date.
3. Record the old Rate ID in the new record's `Supersedes Rate ID`.

A rate referenced by production must **never be deleted** — mark it Inactive or
Expired (Sprint 23.47.7).

### Guards already enforced in the rate master

- Expiration Date earlier than Effective Date → **blocked**.
- Unit Rate of zero → **blocked**, with guidance to deactivate instead. A zero
  rate must never reach production silently (Sprint 23.11).
- Unit and description derive from the labor code label, so the labor master
  stays the single source of truth.

## Master data import files

The Fulcrum MCP server exposes **no record-creation tool**, so master data
cannot be loaded from here. `data/import/` holds ready-to-import CSVs:

| File | Rows |
|---|---:|
| `contractor-master.csv` | 3 |
| `project-master.csv` | 3 |
| `contractor-rates-river-city.csv` | **143** |

Reconciliation checks run at generation: every rate row ties back to a labor
master entry, all 143 Rate IDs are unique, units distribute
FT 71 / EA 51 / HR 13 / SPLICE 5 / SF 2 / EVENT 1, and rates span $1.00–$1,875.00.

All River City rates are loaded as **all-projects**, effective **2026-01-01**,
open-ended. Only River City supplied a rate sheet; the other two contractors are
placeholders with no pricing.

## Production app wiring — done

`Mainline Construction - Development` now carries three RecordLinks:

| Link | Target | Copies down |
|---|---|---|
| `project_link` | Project Master | `project_id`, `project_name` |
| `contractor_link` | Contractor Master | `contractor_id`, `contractor_name` |
| `rate_link` | Contractor Rate | unit rate, rate id, effective date, expiration, rate's own contractor / project / labor code |

`Contractor Rate` on the transaction is now **read-only** — it can only arrive
from a linked rate record, so a hand-typed price cannot break the audit trail.

### The five rate exceptions, all detected offline

`validateRate()` compares only values already copied onto the record, so no
query and no connectivity is needed:

| Exception | Detection |
|---|---|
| Missing rate | no `rate_source_id` |
| Zero / blank rate | snapshot rate is 0 or empty |
| Contractor mismatch | rate's contractor ID ≠ record's contractor ID |
| Project mismatch | rate is project-specific for a different project (blank = all projects, always valid) |
| Expired / not yet effective | work date outside the snapshot effective window, compared by calendar day |

All are CRITICAL, and all are **warnings, not blocks** — a blocked save loses
field work. 19/19 tests pass in `tests/rate-validation.test.js`.

### Ambiguous rate — a documented gap

Sprint 23.12 wants two simultaneously-valid rates flagged. That requires
scanning other rate records, which is **online-only**. The offline design makes
it structurally undetectable at entry time. Mitigation: detect it in the master
(a server-side exception report over the Rate app), not on the device.
