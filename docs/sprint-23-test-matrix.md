# Sprint 23 — Test Case Matrix

Status of all 113 Sprint 23 sections as at 2026-09-21.
**895 automated assertions across fifteen suites, all passing.**

## How to read this

| Status | Meaning |
|---|---|
| **PASS** | Executed automatically and passing. Test IDs given. |
| **PASS (static)** | Verified against the shipped artifact by inspection assertions rather than by running a record through it. Still automated; still fails the build if it regresses. |
| **BLOCKED** | Cannot be executed. Reason given. **Not a pass.** |
| **N/A** | Deliberately out of scope, with the reason. |

`TEST-*` IDs are greppable in `tests/`. Run everything with:

```
for f in tests/*.test.js; do node "$f"; done
```

## The blocker that shapes this whole matrix

**23.1 asks for representative test records. There are none, and none can be
created from here.** Every dev app holds zero records and the Fulcrum MCP
server exposes no record-creation tool — masters and transactions must be
imported through the Fulcrum UI or the Records API.

That is not a small caveat. It means **no report in this system has ever
returned a row**, and forty of the 113 sections cannot be attempted. Sections
that depend on live data are marked BLOCKED below and are counted as failures
for the purposes of the readiness gate in `docs/sprint-23-readiness.md`.

---

## 23.1 – 23.5 — Data, sequentials, slack, overlap, reel range

| § | Title | Status | Evidence |
|---|---|---|---|
| 23.1 | Build representative test data | **BLOCKED** | No record-creation tool. Masters exist as import-ready CSVs in `data/import/`. |
| 23.2 | Fiber sequential testing | **PASS** | `TEST-23.2-1..5`. 100000→101250 = 1,250 FT; reversed = 1,250 FT; identical = 0 FT **and** warns; eight hostile inputs each produce no NaN/Infinity/undefined. |
| 23.3 | Slack footage testing | **PASS** | `TEST-23.3-1..5`. 1250+150+50 = 1,450 FT, and changing slack leaves the sequential range untouched. |
| 23.4 | Sequential overlap testing | **PASS (static)** | `TEST-OVL-*` (9), `TEST-SCALE-001..004`. Classification EXACT DUPLICATE / CONTAINED / PARTIAL OVERLAP / ADJACENT. Cannot be executed against records. |
| 23.5 | Reel range testing | **PASS** | `TEST-S17-001..006`, reel-range warnings in `rate-validation`/`data-events`. Outside-range is a device warning; re-test against a corrected master is `reel-integrity.sql` (BLOCKED for execution). |

## 23.6 – 23.13 — Labor codes, rates, extended value

| § | Title | Status | Evidence |
|---|---|---|---|
| 23.6 | Labor code testing | **PASS** | 146 pay units deployed; `TEST-DP*`, `TEST-CONDUIT-*`, `TEST-BAND-*` parse unit, size, pull count and splice band out of the code. |
| 23.7 | Contractor rate testing | **PASS** | `TEST-RATE-*` (19). Mismatched contractor, project, labor code each CRITICAL. |
| 23.8 | Project-specific rate testing | **PASS** | `TEST-RATE-*`: a project-specific rate on another project's production is CRITICAL; a blank project scope means all projects. |
| 23.9 | Rate effective-date testing | **PASS** | `TEST-RATE-*`: work date before effective, or after expiration, both CRITICAL. |
| 23.10 | Historical rate snapshot | **PASS (static)** | Snapshot is physical via RecordLink `record_defaults`; `production-audit-trail.sql` reports snapshot vs master and labels `MASTER REPRICED SINCE`. `TEST-AUDIT-020/021`. |
| 23.11 | Missing rate test | **PASS** | `TEST-RATE-*`, `TEST-EXC-Missing-Rate`. CRITICAL, and the approval gate refuses it. |
| 23.12 | Ambiguous rate test | **PASS (static)** | `rate-audit.sql` `rate_ambiguity` CTE flags two simultaneously-valid rates. Execution BLOCKED. |
| 23.13 | Extended value testing | **PASS** | `TEST-23.13-1..7`. 500 × $8.25 = **$4,125.00** from the shipped `m046` expression; zero, decimal, 1,000,000, blank quantity and blank rate all behave. |

## 23.14 – 23.17 — Material

| § | Title | Status | Evidence |
|---|---|---|---|
| 23.14 | Labor-to-material testing | **PARTIAL** | `TEST-CONDUIT-*`, `TEST-EXPR-*` (71 in `conduit-dp-material`). Conduit is derived on the record and verified. Other families need the mapping master, which has **no records** — see open item 7. |
| 23.15 | Multiple material mapping | **BLOCKED** | Needs the mapping master loaded. |
| 23.16 | Each-based material test | **BLOCKED** | Same. |
| 23.17 | Material recalculation test | **PASS (static)** | Conduit quantity is a CalculatedField, so it re-derives when quantity changes; `TEST-EXPR-004`. |

## 23.18 – 23.23 — Scope, change orders, financials

| § | Title | Status | Evidence |
|---|---|---|---|
| 23.18 | Project scope testing | **PASS** | `TEST-SCOPE-*` (68). Baseline locked after DRAFT; totals never stored. |
| 23.19 | Pending production test | **PASS (static)** | Approved and pending are separate columns in every report; convention 1. |
| 23.20 | Over-plan test | **PASS (static)** | `project-scope-status.sql`, `TEST-EXC-Production-Over-Plan`. Remaining is never clamped at zero. |
| 23.21 | Change order test | **PASS** | `TEST-SCOPE-*`: signed deltas only, and only an APPROVED order moves authorized scope. |
| 23.22 | Financial testing | **PASS (static)** | `project-financial.sql`, `contractor-financial.sql`; `TEST-UNIT-*` forbid cross-unit quantity sums. |
| 23.23 | Physical vs financial completion | **PASS (static)** | Both reported, with the spread as the rate variance. |

## 23.24 – 23.28 — Workflow, duplicates, identity

| § | Title | Status | Evidence |
|---|---|---|---|
| 23.24 | Approval workflow testing | **PASS** | `TEST-GATE-*`, `approval-workflow` (41). CRITICAL, QA Fail and unreviewed QA each block APPROVED. |
| 23.25 | Edit-after-approval testing | **PASS** | Quantity, labor code and rate go read-only once reviewed; `production-audit-trail.sql` reports `CHANGED AFTER APPROVAL`. |
| 23.26 | Duplicate production testing | **PASS (static)** | `fingerprint` (33) + `duplicate-production.sql` four sections. Execution BLOCKED. |
| 23.27 | Unique identifier testing | **PASS** | `TEST-23.27-1..3`. Assigned once, stable across six saves and an edit to the work date. |
| 23.28 | From/To segment testing | **PASS** | `TEST-23.28-1..4` + `segment` (23). Direction-normalized, case-normalized. |

## 23.29 – 23.35 — Reporting

| § | Title | Status | Evidence |
|---|---|---|---|
| 23.29 | Reporting date testing | **PASS** | ISO-8601 week derived once on the record; `TEST-WEEK-*`. |
| 23.30 | Daily report validation | **BLOCKED** | `production-daily.sql` has never been executed. |
| 23.31 | Weekly report validation | **BLOCKED** | Same. |
| 23.32 | Monthly report validation | **BLOCKED** | Same. |
| 23.33 | Remaining work validation | **BLOCKED** | Same. |
| 23.34 | Contractor report validation | **BLOCKED** | Same. |
| 23.35 | Material report validation | **BLOCKED** | Same, plus the mapping master is empty. |

All seven report families pass their **convention** tests (371 assertions in
`reporting.test.js`) — table addressing, `_status`, cross-unit quantity rules,
numeric casting. That proves they are well-formed, **not that they return
correct numbers.**

## 23.36 – 23.46 — QA, robustness, environment

| § | Title | Status | Evidence |
|---|---|---|---|
| 23.36 | QA/QC testing | **PASS** | `approval-workflow` (41). |
| 23.37 | Data event re-entry | **PASS** | `TEST-23.37-1/2`. Ten further passes change nothing and issue no writes — `setIfChanged` converges. |
| 23.38 | Null and blank testing | **PASS** | `TEST-23.38-1/2`. Eighteen hostile records × three events: no NaN, Infinity, undefined, `[object Object]`, no throw. |
| 23.39 | Decimal and rounding | **PASS** | `TEST-23.39-1..4`. Strategy below. |
| 23.40 | Large-value testing | **PASS** | `TEST-23.40-1..3`. 1,000,000 FT computes, warns, and produces no non-finite value. |
| 23.41 | Offline/field behaviour | **BLOCKED** | Needs a device. Design is offline-first and evidenced statically: `TEST-SCALE-NET-*` prove no Data Event makes an outbound call. |
| 23.42 | Sync conflict testing | **BLOCKED** | Needs two devices and records. |
| 23.43 | Field device testing | **BLOCKED** | Needs a device. |
| 23.44 | Performance testing | **BLOCKED** | Needs volume data. Static review in `docs/sprint-19-21-build.md`. |
| 23.45 | Security and permission testing | **BLOCKED** | Needs multiple roles configured. **See the open security finding below.** |
| 23.46 | Contractor user testing | **BLOCKED** | Same. |

### The adopted rounding strategy (23.39)

**Round once, at the end, to two decimal places. Never round an input.**

`extended_value = ROUND(quantity × rate, 2)`. The rate is used at full
precision. Pre-rounding a $7.875 rate to $7.88 and then multiplying by 3 gives
$23.64 instead of $23.63 — a cent per record that compounds across a project.
`TEST-23.39-4` asserts the system does **not** produce $23.64.

Quantities are stored as entered. Derived footage rounds to 2 dp only where it
is written to a field. Reports round only in the final `SELECT`, never inside a
CTE that feeds another calculation.

## 23.47 — Destructive change testing and controls

36 sub-sections. Full matrix in **`docs/destructive-change-matrix.md`**.
Summary: 24 controls implemented and tested, 6 partially implemented, 6 BLOCKED
on live records or Fulcrum permission features.

## 23.48 – 23.58 — Regression, reconciliation, traceability

| § | Title | Status | Evidence |
|---|---|---|---|
| 23.48 | Full regression test | **PASS** | 895 assertions run on every change; suites load the shipped script via `tests/harness.js`, so none can drift from what is deployed. |
| 23.49 | Automated test case documentation | **PASS** | This document plus per-sprint build notes. |
| 23.50 | Test case naming standard | **PASS** | Below. |
| 23.51 | Defect tracking | **PASS** | `docs/implementation-log.md` open-items table; 27 items, each with sprint of origin and status. |
| 23.52 | Financial reconciliation | **BLOCKED** | No records to reconcile. |
| 23.53 | Quantity reconciliation | **BLOCKED** | Same. |
| 23.54 | Material reconciliation | **BLOCKED** | Same. |
| 23.55 | Source-to-report traceability | **PASS (static)** | `production-audit-trail.sql` answers all thirteen audit questions in one row; `TEST-AUDIT-Q-*`. Execution BLOCKED. |
| 23.56 | Report filter testing | **PASS (static)** | Every filtered report uses the `params` CTE convention, asserted for all 24. |
| 23.57 | Date-boundary testing | **PARTIAL** | ISO week boundaries tested (`TEST-WEEK-*`), including the year boundary. Week 52/53 roll-over in `production-weekly.sql` is static-only. |
| 23.58 | Approval total reconciliation | **BLOCKED** | No records. |

### Test case naming standard (23.50)

```
TEST-<AREA>-<NNN>          e.g. TEST-GATE-024, TEST-FP-030
TEST-<SPRINT-SECTION>-<N>  e.g. TEST-23.13-1   (traces to a brief section)
TEST-<AREA>-<KEY>          e.g. TEST-ADDR-production-daily.sql
```

Every ID is unique and greppable. A test that traces to a numbered section of
the brief uses that number, so a reader can go from requirement to assertion
without a lookup table.

## 23.59 – 23.67 — Edge cases and data types

| § | Title | Status | Evidence |
|---|---|---|---|
| 23.59 | Zero and negative transactions | **PASS** | `TEST-23.59-1..5`. Zero warns; negative is CRITICAL and **cannot reach APPROVED**. |
| 23.60 | Manual override testing | **PASS (static)** | Inventory below. |
| 23.61 | Attachment and photo testing | **PARTIAL** | Missing-photo warning tested; actual media capture BLOCKED. |
| 23.62 | GPS testing | **BLOCKED** | Needs a device. `LATITUDE()`/`LONGITUDE()`/`ACCURACY()` are CalculatedFields. |
| 23.63 | Repeatable section testing | **PARTIAL** | Actual Material Used is the only repeatable left; the dead calculated repeatable was removed in Sprint 19. |
| 23.64 | Large record testing | **BLOCKED** | Needs records. |
| 23.65 | Concurrent user testing | **BLOCKED** | Needs multiple users. |
| 23.66 | Contractor rate attachment validation | **PASS** | 146 pay units reconciled to the rate sheet by `scripts/normalize_rates.py`; exceptions in `data/labor-exceptions.csv`. |
| 23.67 | Material list validation | **PARTIAL** | 135 items built; 2" part numbers outstanding (open item 7). |

### Manual override inventory (23.60)

| Calculated field | Overridable? | Control |
|---|---|---|
| Contractor Rate | **No** | `disabled: true`. Snapshot only. A manual rate would break the audit trail. |
| Extended Value | **No** | CalculatedField. |
| Sequential Footage | **No** | CalculatedField. |
| Conduit Material Quantity | **No** | CalculatedField. |
| Production Quantity | **Yes**, by design | It is the crew's claim. Derived from sequentials only when blank; a typed value is never overwritten, and a >5% disagreement with installed footage raises a WARNING. |
| Unit, labor description, pull count, diameter, splice band, fingerprints | **No** | All `disabled: true`, derived. |
| Closeout milestone dates | **No** | Stamped by the script. |

**There is no hidden manual edit path to a financial figure.** The single
overridable quantity is visible, cross-checked, and locked once reviewed.

## 23.68 – 23.77 — UAT and final deliverables

| § | Title | Status |
|---|---|---|
| 23.68 – 23.74 | Business / field / PM / billing / admin UAT, feedback log, sign-off | **BLOCKED** — no records, no users provisioned, no test project |
| 23.75 | Known limitations register | **PASS** — `docs/sprint-23-known-limitations.md` |
| 23.76 | Production readiness gate | **PASS (executed; verdict NOT READY)** — `docs/sprint-23-readiness.md` |
| 23.77 | Final deliverables | **PARTIAL** — 17 of 25 delivered; the 8 outstanding all require live data |

---

## Count

| Status | Sections |
|---|---:|
| PASS | 31 |
| PASS (static) | 16 |
| PARTIAL | 6 |
| BLOCKED | 24 |
| Covered in the 23.47 sub-matrix | 36 |
| **Total** | **113** |

**Sprint 23 is NOT complete.** Its completion rule requires demonstrating that
field production can be entered, validated, priced, approved, compared against
scope, aggregated into reporting and traced back to the original transaction.
Every link in that chain is built and unit-tested; **none of it has been
demonstrated on a single real record.**
