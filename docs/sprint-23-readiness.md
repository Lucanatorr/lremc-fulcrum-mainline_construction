# Production Readiness Assessment  (Sprint 23.76 / 23.77)

**Date:** 2026-09-21
**Verdict: NOT READY FOR PRODUCTION.**

> The brief: "Do not simply state that testing was successful. Provide
> evidence, test results, exceptions, and unresolved issues."

---

## 1. The gate (23.76)

Fourteen conditions. **Six pass, one fails, seven cannot be assessed.**

| # | Condition | Verdict |
|---|---|---|
| 1 | All CRITICAL defects closed | **PASS** — none open. Eleven found and fixed during the build; each is written up in `docs/implementation-log.md`. |
| 2 | All HIGH defects closed or accepted | **FAIL** — two open: the production API tokens (open item 2) and seven billing gaps (item 11). Neither is code; both need a decision. |
| 3 | Financial reconciliation passes | **CANNOT ASSESS** — no records. |
| 4 | Quantity reconciliation passes | **CANNOT ASSESS** — no records. |
| 5 | Rate validation passes | **PASS** — 146 pay units reconciled to the rate sheet; 19 rate assertions; exceptions listed in `data/labor-exceptions.csv`. |
| 6 | Material mapping validation passes | **FAIL** — the mapping master is empty; 2" part numbers outstanding. |
| 7 | Approval workflow passes | **PASS** — 41 assertions. CRITICAL, QA Fail and unreviewed QA each block approval. |
| 8 | Historical rate protection passes | **PASS** — physical snapshots; the audit trail explains any divergence. |
| 9 | Destructive-change testing passes | **PARTIAL** — 24 of 36 controls tested; three honest gaps documented. |
| 10 | Offline limitations documented | **PASS** — `docs/sprint-23-known-limitations.md`, L1/L2. |
| 11 | Permission testing passes | **CANNOT ASSESS** — no roles provisioned (23.45/23.46 BLOCKED). |
| 12 | UAT sign-off complete | **FAIL** — no UAT has occurred. No test project, no records, no users. |
| 13 | Backout/recovery documented | **FAIL** — not written. Every schema and script is versioned in this repo, so a rollback is a redeploy of a prior commit, but that procedure has never been rehearsed. |
| 14 | Administrator and field-user documentation exists | **PASS** — `docs/operations-guide.md`. |

**Six pass. Four fail. Four cannot be assessed. The gate does not open.**

---

## 2. What is actually finished

This is a real system, and most of it is done.

- **Eleven Fulcrum apps**, all deployed and all versioned in this repo.
- **Twenty-four reports** covering production, financial, scope, QA, material,
  reel, forecasting, audit and exception reporting.
- **895 automated assertions** across fifteen suites, all passing, every one
  running against the **shipped** artifact rather than a copy of it.
- **146 pay units** normalized from the contractor rate sheet, with a banded
  directional-bore schedule the contract owner corrected in person.
- **The financial spine is sound.** Rates are snapshotted physically, so
  repricing the master cannot rewrite history; quantity, rate and value are
  separate; no total is stored anywhere; approved production is the only
  official production.
- **Eleven defects found and fixed during the build**, including three that
  would have shipped wrong numbers: a 67% conduit under-order, a 29% bore
  overbill, and a reel field that reported a fully-pulled reel as full.

## 3. What stands between here and production

### Blocker 1 — Nothing has ever been executed

**No report in this system has returned a row.** Zero records exist in any dev
app, and the toolchain has no record-creation capability.

The 371 report assertions verify *form*: correct table addressing, `_status`
not `status`, no cross-unit quantity sums, numeric casts that PostgreSQL will
accept. That proves the SQL will run. **It does not prove the numbers are
right.** Those are different claims and only the first has been tested.

**Remedy:** import the masters from `data/import/`, create the 23.1 test
project (`MCP-TEST-001`), enter the representative records, run all 24 reports,
reconcile.

### Blocker 2 — Two live API credentials on every field device

The production app carries a Fulcrum API token and a Smartsheet token as plain
literals in its Data Event script. App script syncs to every device. The
Fulcrum token has full account access.

Raised in Sprint 0. Still open. **Rotate both.**

### Blocker 3 — No UAT

Sections 23.68–23.74 are untouched: no field inspector, project manager,
billing or administrator acceptance testing. The people who will use this
have not seen it.

### Blocker 4 — Material mapping incomplete

The mapping master is empty because 2" conduit part numbers do not exist in the
catalogue. Only conduit is derived today.

---

## 4. Final deliverables (23.77)

| # | Deliverable | Status |
|---|---|---|
| 1 | Test summary | **DONE** — this document |
| 2 | Complete test case matrix | **DONE** — `docs/sprint-23-test-matrix.md` |
| 3 | PASS/FAIL results | **DONE** — 895 passing; 24 sections BLOCKED |
| 4 | Outstanding defects | **DONE** — 30 open items in `docs/implementation-log.md` |
| 5 | Defect severity summary | **DONE** — below |
| 6 | Financial reconciliation results | **BLOCKED** |
| 7 | Quantity reconciliation results | **BLOCKED** |
| 8 | Material reconciliation results | **BLOCKED** |
| 9 | Rate-sheet validation results | **DONE** — `data/labor-exceptions.csv` |
| 10 | Material-master validation results | **PARTIAL** — `data/material-mapping-conflicts.csv` |
| 11 | Offline compatibility matrix | **DONE** — limitations L1/L2 |
| 12 | Performance test results | **BLOCKED** — static review in `docs/sprint-19-21-build.md` |
| 13 | Security and permissions results | **BLOCKED** — but see L12 |
| 14 | Destructive-change test matrix | **DONE** — `docs/destructive-change-matrix.md` |
| 15 | User acceptance results | **BLOCKED** |
| 16 | Known limitations register | **DONE** — `docs/sprint-23-known-limitations.md` |
| 17 | Production readiness assessment | **DONE** — this document |
| 18 | Recommended remediation | **DONE** — section 5 |
| 19 | Administrator documentation | **DONE** — `docs/operations-guide.md` |
| 20 | Field user quick-start | **DONE** — `docs/operations-guide.md` |
| 21 | Management reporting guide | **DONE** — `docs/operations-guide.md` |
| 22 | Data Event version inventory | **DONE** — `docs/fulcrum-inventory.md` |
| 23 | Master data inventory | **DONE** — `docs/fulcrum-inventory.md` |
| 24 | Final architecture diagram | **DONE** — `docs/architecture.md` |
| 25 | Final data relationship diagram | **DONE** — `docs/architecture.md` |

**17 delivered, 2 partial, 6 blocked.** Every blocked item is blocked by the
same thing: no records.

### Defect severity summary

| Severity | Found | Fixed | Open |
|---|---:|---:|---:|
| CRITICAL | 11 | 11 | 0 |
| HIGH | 3 | 1 | **2** |
| MEDIUM | 14 | 6 | 8 |
| LOW | 20 | 0 | 20 |

The eleven CRITICALs are worth naming, because they are the argument for
having tested at all:

1. Conduit material under-ordered by 67% for 2"/4" multi-pull runs (v4.0.0).
2. Conduit material over-ordered by 3× for 1.25" (v3.0.0).
3. Directional bore overbilled by 29% at 5 pulls — an additive reading of a
   banded rate schedule, corrected by the contract owner.
4. A bare `USEREMAIL()` crashed the web record editor and silently dropped
   every queued write from the same event.
5. A reel field reported a fully-pulled reel as having its full length
   remaining.
6. Blank QA status bypassed the approval gate.
7. 58 `ROUND(x, 2)` calls that PostgreSQL would have rejected.
8. A timestamp cast to `bigint` that PostgreSQL would have rejected.
9. `sequential-overlap.sql` addressed tables by name and read `status` — it
   would never have run.
10. A test suite passing against its own re-typed copy while the shipped script
    disagreed with it.
11. A version header claiming v5.0.0 over a v7 script.

**Three of those eleven would have shipped wrong money.** Several were found
only because a test ran against the deployed artifact rather than a copy.

---

## 5. Recommended remediation, in order

1. **Rotate the two production API tokens.** Nothing else on this list matters
   if account credentials are sitting on every field device. *(Not code.)*
2. **Import the master data** — 146 rates, 135 materials, 3 contractors,
   3 projects, from `data/import/`.
3. **Build the 23.1 test project** `MCP-TEST-001` and enter representative
   records across underground, aerial, fiber and splicing.
4. **Run all 24 reports once** and reconcile. Expect defects: no report has
   ever executed.
5. **Resolve the 2" conduit part numbers** and load the mapping master.
6. **Settle the seven billing gaps** — 13,000+ FT already in the ground with no
   pay unit to bill it.
7. **Configure and test roles** (23.45/23.46), especially delete permission,
   which is the compensating control for limitation L3.
8. **Run UAT** with a field inspector, a project manager and someone from
   billing.
9. **Write and rehearse the backout procedure.**
10. **Then re-run this gate.**

---

## 6. The completion rule

> Sprint 23 is complete only when the system can demonstrate that field
> production can be entered once, validated automatically, translated into
> accurate labor and material quantities, priced using the correct contractor
> rates, approved through a controlled workflow, compared against authorized
> project scope, aggregated into reliable daily/weekly/monthly reporting, and
> traced from management-level totals back to the original field transaction
> without losing historical accuracy when master data changes.

Every link in that chain is **built and unit-tested**. Not one of them has been
**demonstrated on a real record**.

**Sprint 23 is not complete, and this system should not go to production yet.**

Per the brief's own stopping rule, no further production changes should be made
until these findings have been reviewed.
