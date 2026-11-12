# LREMC Fulcrum Mainline Construction: Handoff

**Version 0.10.0 · 2026-11-12 · Development.** This is the single entry point
for a Fulcrum administrator or developer taking over the system without the
original conversation. Each section gives the essentials and links to the
detail; the linked files are maintained, and `tests/handoff.test.js` fails if
a link breaks or a section goes missing.

**State in one line:** built and tested in Development. Not in production:
4 of the 12 pre-deployment gates pass, and the other 8 need people (§1, §35).

---

## 1. Executive Summary

The system replaces hand-kept production and pay-quantity records for
underground, aerial, fiber and splicing construction with Fulcrum apps, so
that a crew's field entry flows automatically to priced, QA'd, approved
production and on to remaining work, reporting and invoice reconciliation.

- **13 Development apps:** 1 production transaction app, 12 masters and
  ledgers.
- **10 Data Events,** all fully offline.
- **74 read-only SQL reports.**
- **A test suite** that loads the deployed scripts (§25).
- **Pricing:** 146 contract pay units with versioned rates; one contractor
  so far (River City Communications).

The core design choices:
- Prices are frozen on each record (D-003).
- Only APPROVED production counts (D-002).
- No totals are stored: reports derive them (D-012).
- Approved work is corrected through REOPENED / REVERSED / Adjustment, never
  edited (D-018).
- Nobody approves their own production (v7.7.0).

**What stands between this and production:**
- the production app's exposed tokens (OI-01)
- the Contractor role decision (OI-22)
- UAT
- a baselined scope and a two-person chain demonstration
- named owners

Each has a prepared kit; see §35 and `docs/sprint-24-deployment-readiness.md`.

## 2. Architecture

One transaction app (Mainline Construction) and masters linked to it by
Fulcrum record links. Each link uses `record_defaults` to **copy** the
master's values onto the record when it is selected. Every device-side check
therefore reads only its own record, and works offline. Anything that needs
other records is a server-side SQL report. There are no stored totals, no
outbound calls from scripts, and no integration connected.
Detail: `docs/architecture.md`, `docs/sprint-19-21-build.md` (scale review).

## 3. Fulcrum App Inventory

Thirteen apps, with purpose, record counts, primary identifier, relationships
and owner, in **`docs/final-inventory.md` §1**. Form IDs and the
query-table naming rule are in `reports/_conventions.md` and
`docs/fulcrum-inventory.md`. The production app
`148545bf-b869-454e-a2b9-44a9860f23de` is **not** part of this system and is
read-only to it.

## 4. Field Dictionary

All 387 fields, with label, type, section, flags and description,
**generated from the schemas**: `docs/field-dictionary.md`. Regenerate it with
`python3 scripts/field_dictionary.py` after any schema change.

## 5. Field Key Dictionary

The same file maps each element **key** (e.g. `m021`), which `forms_update`
must preserve, to its **data_name** (`labor_code`). The data_name is both the
Data Event identifier (`$labor_code`) and the Query API column. Repeatable
fields are marked with their table (`<form id>/<repeatable>`). Never reuse or
change a key.

## 6. Relationship Diagram

The full map is in **`docs/relationship-map.md`**, as a Mermaid ER diagram
plus the seven chains the brief names:
- Project → Scope → Production
- Production → Contractor, Labor Code, Rate, Structure/Segment, Reel
- Labor Code → Mapping → Material
- Production → Material Transactions
- Project → Change Orders
- Production → QA/Approval
- Production → Reporting

It also explains the three ways a relationship is held (link, snapshot, key)
and which ones survive a deletion.

## 7. Labor Code Model

A pay unit is a value in the **MC Labor Code** choice list (146 codes), and
the code itself encodes contract facts that the script parses:
- **Pull count:** `BM60(n)(size)`, D-004
- **Conduit size**
- **Splice band:** `HO-1 (25-48)`

Retiring a code: never delete it. Add it to `RETIRED_LABOR_CODES` with its
replacement, and a stale device then gets a CRITICAL naming the replacement.

A labor code must define ten attributes before use:
- code, description, category, unit
- calculation method, work type
- material mapping, rate availability, effective date
- approval

Detail: `docs/sprint-26-governance.md` §3, D-004 to D-008.

## 8. Contractor Rate Model

MC Contractor Rate holds contractor × labor code, optionally × project (blank
means all projects), with:
- unit and rate (USD, D-020)
- effective and expiration dates
- a contract reference
- `supersedes_rate_id`

**Rates are versioned, never overwritten**: a price change is a new
`rate_id`.

Production selects a rate by record link, which **snapshots**:
- `contractor_rate`
- `rate_source_id`
- unit, description, effective date
- the rate's labor code and contractor

A later rate change never re-prices history (D-003). The device flags a
missing, zero or expired rate, or a mismatched rate. Server-side,
`rate-expected-audit` checks every record against the rate in force on its
work date. The two-person activation rule applies (governance §2).
Detail: `docs/sprint-2-build.md`, `data/import/contractor-rates-river-city.csv`,
D-008 (banded DP schedule).

## 9. Material Model

- **MC Material Master:** 135 stock items, keyed by `material_code` (part
  number).
- **MC Material Transaction:** an **atomic ledger**. One row per movement,
  balances never stored. A negative quantity is allowed only on `Adjusted`
  (D-009).
- **Production** carries the crew-reported `actual_material_used`
  (repeatable), and the device-derived conduit material.
- `material-variance.sql` compares expected material (from the mappings)
  with the ledger. Open issue OI-21 asks whether DRAFT ledger rows should
  count.

Detail: `docs/sprint-7-8-build.md` §Sprint 8.

## 10. Labor-to-Material Mapping Model

MC Labor-Material Mapping is keyed on **labor code** → `material_code`, with:
- calculation type (PER_UNIT / FIXED)
- multiplier and waste factor (the waste factor is a purchasing gross-up,
  never consumption)
- source and confidence
- effective dates and `supersedes_mapping_id`

Only APPROVED, active mappings count. There are 125 rows: 58 APPROVED and 67
NEEDS REVIEW. 49 of 146 pay units have an APPROVED mapping. The rest are
classified, with a disposition each, in `data/material-coverage-register.csv`
(OI-11, OI-12).

Conduit consumption depends on **size**, not just pull count (D-005):
- 1.25" bundles: 1:1
- 2" and 4": pull count × footage

Detail: `docs/sprint-5-6-build.md`, D-014, D-016.

## 11. Fiber Sequential Logic

A crew enters the printed **range**, not the footage. When quantity is left
blank for fiber in FT, the device derives it from the sequentials. A typed
quantity is never overwritten, and a mismatch over 5% is a WARNING. The reel
link copies the reel's printed range, so the **outside-reel-range** check
runs offline. Ranges are normalized, so direction doesn't matter.

**Cross-record overlap** is a server-side report (`sequential-overlap.sql`),
because a device cannot see other records offline:

| Finding | Severity |
|---|---|
| Exact duplicate | CRITICAL |
| Contained | CRITICAL |
| Partial | WARNING |
| Adjacent (one shared boundary) | INFO, which is legitimate |

The reel master keeps four separate figures, because they are separate
things: printed consumption, installed footage, slack and waste. Remaining
footage is computed (`reel-balance.sql`), never stored.
Detail: `docs/sprint-3-4-build.md`, `docs/sprint-5-6-build.md`, `docs/sprint-16-18-build.md`.

## 12. Underground Workflow

The pay unit encodes the conduit package: `BM60(3)(1.25) T` means three
1.25" conduits. The device derives the conduit count, diameter and conduit
footage (footage × count, so 500 FT of a 3× package is 1,500 FT of conduit).
It also derives the conduit material code and quantity.

Also captured:
- From/To station and depth
- surface, crossing and rock
- trace wire and restoration

Plausibility checks:
- depth under 36": WARNING
- a railroad crossing on a non-railroad unit: WARNING

Directional bore is five banded pay units, `BM60(1..5)(1.25)DP` (D-006,
D-008).
Detail: `docs/sprint-5-6-build.md` §Sprint 5, `docs/sprint-8-revision-build.md`.

## 13. Aerial Workflow

Captured:
- pole, previous and next pole
- a **direction-normalized span ID**
- span footage, which is **hand-entered** (L10), because there is no pole
  dataset with coordinates
- owner, height, class
- attachment, anchors, down guys, risers, snowshoes
- make-ready and bonding

A span over 500 FT is a WARNING.
Detail: `docs/sprint-5-6-build.md` §Sprint 6.

## 14. Splicing Workflow

The SPLICING section shows when the work category is Splicing. It captures:
- structure and closure
- incoming and outgoing cable
- **fiber count at location**
- splice quantity, express, cut and pass-through fibers
- splitters and ports
- test type, loss and result

The priced **splice band is parsed from the code**. A fiber count outside the
band is **CRITICAL**: the wrong band can more than double the price. Other
checks, all WARNING:
- splice quantity ≠ quantity
- loss over 0.10 dB
- test Fail

Detail: `docs/sprint-7-8-build.md` §Sprint 7.

## 15. QA/QC Workflow

QA lives on the production record:
- `qa_status` (MC QA Status list)
- QA owner and due date, with missing-owner and overdue warnings
- QA photos
- `correction_detail` (a picklist) and correction completed, with its
  by/date stamps

Exceptions are computed on every save, with severity INFO / WARNING /
CRITICAL. **A CRITICAL blocks approval; no exception blocks a save** (D-011).
In the field, a save is stopped only by a required field left blank or a
negative quantity on an Original record. The other refusals are office
actions:
- approving with a CRITICAL
- self-approval
- reopening or reversing without a reason

Four QA flags need other records, so they are reports:
- duplicates
- overlap
- over-plan
- material variance

The reviewer's queue is `qa-review-queue.sql`. OI-10 lists the QA fields not
yet built.
Detail: `docs/sprint-10-12-build.md` §Sprint 12.

## 16. Approval Workflow

**Statuses:**
- DRAFT
- SUBMITTED
- UNDER REVIEW
- APPROVED
- REJECTED
- CORRECTION REQUIRED
- VOID
- REOPENED
- REVERSED

**APPROVED is refused when:**
- the record carries a CRITICAL exception
- QA is Fail, Not Reviewed or blank
- the approver is the record's inspector or submitter (v7.7.0, OI-22)

Submission, review, approval, reopening and reversal are stamped with who
and when. VOID is honoured but not attributed (L6).

**Correcting approved work** (D-018):

| Need | Path |
|---|---|
| Re-review | **REOPENED**: reason required, approval cleared |
| Wrong in full | **REVERSED**: reason required, approval kept as evidence |
| Wrong by an amount | An **Adjustment** record naming the original (`adjusts_production_id`), which may be negative |

Sending a record back clears its approval. Once a record is APPROVED, its
quantity, labor code and rate link are read-only.

**Platform limit:** status permission is all-or-nothing. Segregation of
duties therefore rests on three layers: the role (`docs/uat/role-model.md`),
the script, and the weekly audit W-8.
Detail: `docs/sprint-10-12-build.md`, `docs/sprint-23-readiness.md`, `docs/training/`.

## 17. Scope Management

MC Project Scope Line holds one line per project × labor code (× phase), with
the original planned quantity and a budget-rate snapshot.
- **BASELINED locks it** (D-010).
- Authorized scope = BASELINED or CLOSED lines + APPROVED change-order lines.
- Production matches scope by project + labor code. Production on a
  project + code with no scope is listed by `unplanned-production.sql`.
- Validate a baseline before import with `scripts/validate_scope_baseline.py`
  (gate 6).

**No project has a baselined scope yet.**
Detail: `docs/sprint-9-build.md`, `data/import/scope-baseline-template.csv`.

## 18. Change Order Management

MC Change Order holds a reason:
- Design Change
- Field Condition
- Utility Conflict
- Rock
- Permit
- Railroad-DOT
- Owner Request
- Error-Omission

Its **lines are signed deltas** per labor code (a negative line is a
descope). Lines lock on approval, and only APPROVED orders move authorized
scope. Pending orders appear in their own column, never added in. A baseline
error is corrected by an `Error-Omission` change order, never by editing the
baseline.
Detail: `docs/sprint-9-build.md` §MC Change Order.

## 19. Financial Calculations

- `extended_value` = quantity × the **snapshotted** rate. Audit daily D-4
  checks it.
- Official value = APPROVED only.
- **Financial %** = approved value / current contract value.
- **Physical %** = earned value at budget rates / authorized value at budget
  rates. It is value-weighted, capped per line, and the overage is reported
  separately.
- The **spread** between financial and physical % is the rate variance.
- Original contract value = baselined scope at budget rates. Current = plus
  approved change orders.
- Billed value is NULL until a billing source exists.
- Quantities are never summed across units (rule 2). Value can be.

Detail: `docs/sprint-10-12-build.md` §Sprint 11, `reports/_conventions.md`.

## 20. Remaining Work Calculations

`remaining-work.sql` computes, per project × labor code (× phase):

| Figure | Formula |
|---|---|
| Authorized quantity | baseline + approved change orders |
| Remaining quantity | authorized − approved |
| Remaining value | remaining × budget rate |

It also shows pending production separately and a status: OVER PLAN, NOT
STARTED, NO AUTHORIZED SCOPE, and so on. **Remaining work is never
maintained by hand** and never stored. `forecast-completion.sql` divides the
remaining quantity by the recent daily average to estimate working days.
Detail: `docs/sprint-9-build.md`, `docs/sprint-16-18-build.md`.

## 21. Data Event Documentation

Ten scripts. The versions, triggers, fields monitored and modified,
dependencies and rollback targets are in **`docs/data-event-inventory.md`**.
Exact live bytes and rollback targets are in **`fulcrum/known-good/`** (`scripts/known_good.py`).

Sources and tests:
- The source is in `fulcrum/data-events/`.
- The tests load that source through `tests/harness.js`, which stubs the
  runtime.
- `tests/runtime-globals.test.js` guards against runtime globals that do not
  exist on the web, such as the `USEREMAIL()` crash (INC-0001).

The Mainline script stamps `calc_version` (D-019), so the records a version
calculated can be found.

## 22. Reporting Architecture

All reporting is read-only SQL against the Fulcrum Query API. Tables are
named by form ID; `_status` is the status column; repeatables are their own
tables.

The rules that decide what a number means are in `reports/_conventions.md`:
- APPROVED only
- no cross-unit sums
- T&M is not physical production
- the ISO week

There are 74 reports, with purpose, source, metrics, filters and audience in
**`docs/report-inventory.md`** (generated). Power BI datasets are in
`reports/bi/` (star schema; `docs/sprint-29-power-bi-readiness.md`). Running
a report through MCP: `scripts/flatten_report.py --mcp` (the `+` and size
limits, L13 and L14).

## 23. Security Model

- **Roles are account-wide**, status permission is all-or-nothing, and
  delete is permanent. The recommended role model and permission tests
  PERM-01..15 are in **`docs/uat/role-model.md`**.
- Credentials never go in a Data Event (it syncs to every device), a report
  or this repository.
- The production app's exposed tokens are OI-01, still open.
- Contractor rates and production leave the account through two unreviewed
  account-wide webhooks (OI-23).
- Integration rules are in `docs/sprint-30-integration-readiness.md` §7.

## 24. Offline Capability Matrix

Every Data Event is fully offline. No script performs a cross-record query,
and anything that needs other records is a server-side report, by design.
Detail: **`docs/offline-capability-matrix.md`**.

## 25. Testing Results

- **The suite:** `for t in tests/*.test.js; do node $t; done`. At 0.10.0 it
  had 26 suites, all passing: 1,264 counted assertions, plus the
  date-boundary sweep across every timezone. Each suite prints its own
  count.
- **Live-data runs:** every report was run against the live Development data.
- **Live backup:** verified, 15 datasets, 0 FAIL.
- **Configuration snapshot:** matches the baseline, 18/18.

What has **not** been tested is in `docs/sprint-23-test-matrix.md` and the
UAT plan:
- the destructive-change matrix (OI-04)
- permissions (PERM-01..15)
- UAT (57 cases)
- the two-person chain demonstration

Detail: `docs/sprint-23-test-matrix.md`, `docs/sprint-24-deployment-readiness.md`.

## 26. Known Limitations

L1–L18 are in the **FULCRUM LIMITATION FORMAT** in
**`docs/sprint-23-known-limitations.md`**. The ones that shape daily use:
- **L1/L2:** cross-record checks need a server-side report.
- **L4:** records cannot be created from this toolchain.
- **L10:** span footage is hand-entered.
- **L13/L14:** the MCP query transport limits.

Sprint 31 §1.1 adds that exports are not a platform backup. Sprint 32 §3
adds that device performance cannot be measured from here.

## 27. Administrator Guide

**`docs/training/administrator.md`**, plus `docs/operations-guide.md`
(deploying, master data, rates, retiring a pay unit, API gotchas) and
`docs/sprint-26-governance.md` (roles, the activation rule, procedures by
master, the audit cadence).

## 28. Field User Guide

**`docs/training/field-inspector.md`** and the quick-reference cards
(`docs/training/quick-reference.md`). They are written against the form's
real labels and the script's real messages.

## 29. Project Manager Guide

**`docs/training/project-manager.md`** covers:
- the four rules behind every number, and a daily ten-minute routine
- daily, weekly and monthly production
- remaining work and over-plan
- contractor performance and financials
- QA exceptions and pending approvals
- materials and change orders
- incomplete work and closeout
- what to do when a number looks wrong
- ten exercises that double as the UAT questions

How approved work is corrected (REOPENED, REVERSED, Adjustment) is in §16;
and in `docs/training/quick-reference.md`.

## 30. Contract/Finance Guide

**`docs/training/contract-finance.md`**. The invoice reconciliation is in
`docs/sprint-30-integration-readiness.md` §4
(`scripts/reconcile_invoice.py`).

## 31. Support Procedures

The support tiers, response times, priority-1 definition and incident
logging are in `docs/sprint-26-governance.md` §4. Significant incidents go to
**`data/incident-register.csv`** (Sprint 31 §5).
"When a figure looks wrong" is in `docs/operations-guide.md`.

## 32. Backup/Recovery Procedures

**`docs/sprint-31-backup-recovery.md`** covers:
- the export schedule
- verification and deletion detection (`scripts/backup_verify.py`)
- configuration snapshots
- recovery playbooks R-1..R-8: rate change, deleted master, bad mapping, bad
  deployment, mass update, user error, duplicates, scope error

The five rollback levels are in `docs/backout-recovery-procedure.md`.

## 33. Change-Control Procedures

- **Release process:** develop → test → regression → UAT → document →
  version → deploy (Development first) → validate → monitor. See
  `docs/sprint-32-continuous-improvement.md` §2.
- **Retention:** `known_good.py preflight` / `promote`.
- **Mass changes:** `scripts/mass_change.py` (Sprint 31 §4).
- **Destructive changes:** `docs/destructive-change-matrix.md`.
- **Business rules:** `docs/business-decision-log.md` (D-001..D-020).
- **The rules for AI/MCP sessions:** **`CLAUDE.md`**.

## 34. Release History

**`docs/release-history.md`**: semantic versions 0.1.0 to 0.10.0, each with
features, changes, fixes, data and Data Event changes, known issues and user
action. 1.0.0 is reserved for the first production release.

## 35. Open Issues

**`docs/open-issue-log.md`** (OI-01..OI-24). What still needs a person,
before production:

| # | Item | Issue / gate |
|---|---|---|
| 1 | Rotate the production app's API tokens | OI-01 (P1) |
| 2 | Contractor role: remove status permission, or accept the residual | OI-22 (P1) |
| 3 | Run UAT (8 roles, 57 cases) and the permission tests | OI-05, OI-06 |
| 4 | Execute the destructive-change matrix | OI-04 |
| 5 | Baseline one project's scope; run the two-person chain demonstration | gates 6, 7 |
| 6 | Name the nine governance roles | gate 12 |
| 7 | Confirm the two account-wide webhooks | OI-23 |
| 8 | Contract references on the rates; mapping review; billing-gap ruling | ENH-006, OI-11..13 |

Gate status: `docs/sprint-24-deployment-readiness.md`.
Disposition sheet: `docs/defect-disposition.md`.

## 36. Recommended Future Enhancements

**`data/enhancement-backlog.csv`** holds 16 requests, classified as BUG FIX,
DATA CORRECTION, CONFIGURATION CHANGE, BUSINESS RULE CHANGE, NEW FEATURE,
REPORT ENHANCEMENT or INTEGRATION, with priority, benefit, complexity, risk,
dependencies and a decision.

After the pilot:
- scheduled read-only audits (ENH-016)
- the first ERP integration (ENH-012)
- QA tracking fields (ENH-014)
- automatic span footage from a pole dataset (L10)

Final financial approval stays human (Sprint 32 §4).
