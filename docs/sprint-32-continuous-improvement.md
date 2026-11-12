# Sprint 32: Continuous Improvement and System Maturity

**Date:** 2026-11-12. **Environment:** Development. No app, field, record or
script was changed. The scorecard and every query timing below are from live,
read-only runs.

| Deliverable | Where |
|---|---|
| Enhancement backlog (16 requests, all seven classes) | `data/enhancement-backlog.csv` |
| Release process | §2 |
| Release history, semantic versions | `docs/release-history.md` |
| Periodic review | §3 |
| Data-quality scorecard (10 measures, run live) | `reports/data-quality-scorecard.sql`, §3.2 |
| Automation opportunities | §4 |
| AI/MCP operating model (15 rules) | §5, and `CLAUDE.md` so future sessions load it |
| Final inventories | `docs/final-inventory.md`, `docs/report-inventory.md` (generated), `docs/field-dictionary.md` (generated) |
| Relationship map | `docs/relationship-map.md` |
| Final success workflow | §6 |
| Final handoff (36 sections) | **`docs/HANDOFF.md`** |
| Tests | `tests/handoff.test.js` |

---

## 1. Enhancement backlog

`data/enhancement-backlog.csv` records every field the brief names: request
ID, description, requester, business problem, users, priority, benefit,
complexity, risk, dependencies, decision and target sprint. It adds the
change class and a source (an open issue, incident or report).

| Class | Meaning here | Examples in the backlog |
|---|---|---|
| BUG FIX | Code does not do what is documented | ENH-009 stale script headers |
| DATA CORRECTION | Records are wrong; the code is right | ENH-005 test record unit; ENH-006 contract references; ENH-007 mappings |
| CONFIGURATION CHANGE | Roles, settings, element properties | ENH-001 token rotation; ENH-002 Contractor role; ENH-010 m053 |
| BUSINESS RULE CHANGE | The rule itself changes, which needs a decision-log entry | ENH-004 POSTED-only material; ENH-008 billing gaps |
| NEW FEATURE | New capability | ENH-003 rate approver; ENH-014 QA fields; ENH-016 scheduled audits |
| REPORT ENHANCEMENT | Read-only, no data risk | ENH-013 fiscal year; ENH-015 timezone |
| INTEGRATION | Data crossing the system boundary | ENH-011 webhooks; ENH-012 ERP |

**How a request moves:**
1. Add a row as PROPOSED.
2. The Business Owner decides: APPROVED, DEFERRED or DECLINED, with a
   reason. A BUSINESS RULE CHANGE also gets a `docs/business-decision-log.md`
   entry.
3. APPROVED work is built through the release process (§2), and the row
   gets the release version.
4. A DATA CORRECTION touching more than one record follows the mass-change
   procedure (Sprint 31 §4).

`tests/handoff.test.js` checks the backlog's classes, priorities and IDs.

---

## 2. Release process

> *"Develop, test, regression test, conduct UAT as appropriate, document,
> version, deploy, validate, and monitor. Never make untested Data Event
> changes directly in production."*

| Step | What it means in this system | Tool / evidence |
|---|---|---|
| **Develop** | In the repo, against the Development apps only. Read the live configuration first (rules 1–3) | `forms_get`; `known_good.py preflight` |
| **Test** | Unit tests load the **deployed** script source, not a copy, and the harness stubs the runtime | `tests/*.test.js` |
| **Regression test** | The whole suite, every time. A change to one app's script runs every app's tests | `for t in tests/*.test.js; do node $t; done` |
| **UAT** | For anything a user sees or that moves money: the affected role sessions from `docs/uat/uat-plan.md`. Findings go to `uat-feedback-register.csv` | People |
| **Document** | The app's data-event inventory row; the decision log for rule changes; training material for user-visible changes | `docs/` |
| **Version** | Bump the script's `CALC_VERSION` (Mainline) or header version, plus the system version in `release-history.md` | §2.1 |
| **Deploy** | Development first, through `forms_update` only. Elements before script when adding fields; script before elements when removing them | backout procedure Level 2 |
| **Validate** | Read back and compare byte for byte; run `config_snapshot.py --compare`; run the reports the change touches, live | `known_good.py promote`; `fulcrum/baseline-<date>.json` |
| **Monitor** | Audit daily, for a week; the scorecard at month end; any CRITICAL becomes an incident | `audit-daily.sql`; incident register |

**Production** gets a change only once Development has passed all of the
above, the Business Owner approves, and the twelve pre-deployment gates allow
it. That has not happened yet, so **no change has gone to production**.

### 2.1 Versions

| | Version | Where it lives |
|---|---|---|
| System | MAJOR.MINOR.PATCH, now **0.10.0**. 1.0.0 = first production release | `docs/release-history.md` |
| Each Data Event | Its own semantic version, e.g. Mainline 7.7.0 | the script header; `fulcrum/known-good/registry.json`; `CALC_VERSION` on every production record |
| Each report | Git history; `reports/` files are the source | `docs/report-inventory.md` |

A release that changes a Data Event bumps both the script's version and the
system version. A change to reports or docs only bumps the system version.

---

## 3. Periodic review

**Quarterly**, by the Fulcrum Administrator and the Technical Owner, with
the result kept in the implementation log. The first baseline was taken on
2026-11-12:

| Area | Measure | 2026-11-12 | Review trigger |
|---|---|---|---|
| Record volume | Production records | 2 | Each 10× step: re-run the Sprint 19 scale review |
| | Projects / contractors | 3 / 3 | |
| Rate complexity | ACTIVE rates; pay units | 146; 146 (one contractor) | A second contractor's sheet: check rate-selection effort in the field |
| Material complexity | Materials; mappings; pay units with an APPROVED mapping | 135; 125; 49 of 146 | |
| Reports | Count | 74 (41 + 17 BI + 16 continuity) | A report no one has run in a quarter: retire it |
| Offline | Data Events with a cross-record query | **0 of 10** | Any non-zero is a design regression (`offline-capability-matrix.md`) |
| Integrations | Active webhooks | 2, account-wide, unreviewed (OI-23) | Any change in `webhooks_list` |
| Form size | Mainline elements / script | 152 elements / 50,547 characters | +25%: review sync time on a low-end device |
| Query time | End to end, through the MCP query tool, including the round trip | 1.0–1.4 s for the scorecard, manifest, daily production, remaining work, daily audit; 1.2 s for the full rate export (248 KB) | Over 10 s, or a timeout: partition the report (Sprint 19 pattern) |
| Load / save / event / sync | On a device | **Not measured** (below) | |
| Large projects | Behaviour at 100k records | Designed for it in Sprint 19: no save-time queries; the self-joins partitioned and date-windowed | Re-measure once a real project passes 10k records |

**Requested Capability:** measure record load, save, Data Event and sync
performance.

**Fulcrum Limitation:** this toolchain has no device and cannot create
records (L4). Fulcrum exposes no per-device timing through the MCP tools.

**Operational Impact:** the device side of performance is unmeasured. Field
experience is the only signal until the pilot.

**Recommended Alternative:** during UAT, record the time to open, save and
sync a record on the slowest device in use, as part of the field-inspector
session. Repeat at each quarterly review.

### 3.1 Review checklist

1. Run `data-quality-scorecard.sql`, and compare it with last quarter.
2. Run `config_snapshot.py --compare` against the latest baseline. Every
   DIFFERS must be a release.
3. Run `known_good.py check`.
4. Run `webhooks_list` and `memberships_list` (active members, roles; P-2:
   who can delete).
5. Read the incident register: are preventive actions done?
6. Groom the backlog.
7. Fill in the measures table above.

### 3.2 Data-quality scorecard (live, 2026-11-12)

| ID | Measure | Good / total | Score | Target | Status |
|---|---|---:|---:|---:|---|
| DQ-01 | Valid rates (unit, rate > 0, effective, not expired) | 146 / 146 | 100% | 100% | MEETS TARGET |
| DQ-02 | Rates traceable to a contract | 0 / 146 | 0% | 100% | **BELOW TARGET** (ENH-006) |
| DQ-03 | Approved production | 0 / 2 | 0% | — | INFO (both are test records) |
| DQ-04 | Required documentation (approved with a QA photo) | — | — | 100% | NO DATA |
| DQ-05 | No duplicates | 2 / 2 | 100% | 100% | MEETS TARGET |
| DQ-06 | Pay units with an approved mapping | 49 / 146 | 33.6% | — | INFO (ENH-007) |
| DQ-07 | QA failures corrected | — | — | 100% | NO DATA |
| DQ-08 | No open corrections | 2 / 2 | 100% | 100% | MEETS TARGET |
| DQ-09 | No orphans (production, scope, rates, mappings) | 206 / 206 | 100% | 100% | MEETS TARGET |
| DQ-10 | No rate exceptions | 2 / 2 | 100% | 100% | MEETS TARGET |

An empty population is NO DATA, not 100%. DQ-03 and DQ-06 have no target on
purpose. Approval rate is a pipeline measure, and mapping coverage depends on
the no-material rulings that are still open.

The scorecard does **not** catch PRD-2026-143C1840's null unit, because no
measure tests units. Audit daily D-3 does catch it. The two are complements:
the audits list problems, and the scorecard measures trends.

---

## 4. Automation opportunities

| Opportunity | Today | Safe next step | Must stay human |
|---|---|---|---|
| Exception identification | **Automated on the device**: exception flags and severity on every save. **Server-side**: `exception-dashboard`, `audit-daily` | Run audit-daily on a schedule and send non-zero checks to their owners (ENH-016) | Deciding what an exception means |
| Project status | Manual (PLANNING / ACTIVE / ON HOLD / CLOSED) | Suggest ACTIVE when scope is BASELINED; suggest READY TO CLOSE from `closeout-readiness`. Suggestions in a report only | The status change itself |
| Rate validation | **Automated**: rate copied by record link; device checks zero rate and expired rate; `rate-expected-audit` server-side | Scheduled expected-rate audit after every rate change | Rate activation (two-person rule) |
| Material variance | `material-variance.sql` | Monthly scheduled run with the threshold from `audit-weekly` | Write-offs and adjustments |
| Reporting periods | **Automated**: `work_week`, `work_month`, `reporting_period` derived on the device, timezone-independent | None needed | Closing a period for billing |
| Scope warnings | **Automated**: `unplanned-production`, `remaining-work`, device scope exceptions | A weekly digest per project manager | Change orders |
| Fiber overlap warnings | Reel-range check on the device (offline); cross-record overlap in `sequential-overlap.sql` | Daily scheduled run, date-windowed | Deciding which record is wrong |
| Backup and drift checks | Scripts, run by hand | A scheduled job runs the manifest and exports, then `backup_verify.py` | Explaining a DELETED or a DIFFERS |

**Final financial approval is not automated, and must not be.** APPROVED is
set by a person. v7.7.0 also refuses approval by whoever entered or submitted
the record. Any automation proposal that sets APPROVED, REVERSED or an
Adjustment needs explicit requirements, controls and a Business Owner
decision, and none exists.

Every scheduled job proposed above is **read-only**. It needs a server-side
scheduler and a read-only integration user whose token stays off devices
(OI-01 rule). The token lives in that scheduler, never in a Data Event or
this repository.

---

## 5. AI/MCP operating model

The same fifteen rules are in **`CLAUDE.md`** at the repository root, which
Claude Code loads at the start of every session. Each rule is tied here to
what it means in this repository.

| # | Rule | In practice here |
|---|---|---|
| 1 | Inspect configuration before modifying it | `forms_get` first. `known_good.py preflight` must pass before any deployment |
| 2 | Use actual field keys | Keys and data_names from `docs/field-dictionary.md` (generated from the schemas). `forms_update` preserves keys. Never invent one; `mass_change.py` refuses unknown fields |
| 3 | Read current Data Events first | The live script, not the repo copy: `fulcrum/known-good/<app>.js` is the live bytes |
| 4 | Avoid deletion without impact analysis | Never remove an element that holds data: hide it (backout Level 2). Never delete a record: lifecycle (D-018) |
| 5 | Explain significant changes | Commit message; implementation log; data-event inventory; release history |
| 6 | Preserve historical financial values | Rates are snapshotted (D-003); approved production is never edited; `mass_change.py` blocks historical records |
| 7 | Test code before completion | The full suite green before every commit. A deployed script is read back byte for byte |
| 8 | Use the Test Project | PRJ-000001 MCP-TEST-001 for test records |
| 9 | Never test destructive logic against live production records | The production app `148545bf…` is read-only to this project. Destructive tests run in the harness, or on Development test records only |
| 10 | Maintain version information | Script header + `CALC_VERSION` + `registry.json` + `release-history.md`. OI-24 is the current gap |
| 11 | Document MCP modifications | Every write is listed in the implementation log, with the tool used, the time and the read-back result |
| 12 | State limitations rather than fabricate support | The FULCRUM LIMITATION FORMAT; `docs/sprint-23-known-limitations.md` L1–L18 |
| 13 | Reconcile after major changes | `config_snapshot.py --compare`; `backup_verify.py`; `mass_change.py reconcile`; the reports the change touches |
| 14 | Stop on unexpected schema or data conditions | A failed preflight, an UNREGISTERED script, a DELETED row or a DIFFERS: stop and ask |
| 15 | Prefer data-driven maintenance over hard-coded JavaScript | Prices in the rate master, materials in mappings, codes in the choice list. The script keeps only what cannot be data (e.g. `RETIRED_LABOR_CODES`, the pull-count parse) |

**This session's own constraints**, which a future session inherits:
- Writes go through `mcp__fulcrum-app__app-mcp_fulcrum_forms_update` only.
  Never route a write around the tool.
- Never put a token or webhook URL in the repository. Webhook URLs contain
  signing secrets: record IDs only.
- Never mark an unexecuted test PASS.

---

## 6. Final success workflow

> Project Scope → Field Construction → Production Record → Automatic Labor
> Classification → Automatic Fiber/Quantity Calculation → Automatic
> Contractor Rate Selection → Automatic Material Calculation → QA/QC →
> Approval → Project Quantity Update → Financial Production Update →
> Remaining Work → Daily/Weekly/Monthly Reporting → Invoice/Management
> Reconciliation

| Step | Mechanism | Evidence | Proven |
|---|---|---|---|
| Project scope | Scope line, locked at BASELINED; change orders | `validate_scope_baseline.py`; `tests/project-scope.test.js` | Tests. **No scope baselined live yet** (gate 6) |
| Field construction → production record | Mainline app, fully offline | 2 Development records | Live |
| Automatic labor classification | `applyLaborMetadata`: pull count, size, band; `work_category` chosen, never inferred (D-007) | `tests/data-events.test.js`, `conduit-dp-material.test.js` | Tests; live record shows `pull_count`, `conduit_diameter` |
| Automatic fiber / quantity calculation | Device: quantity from sequentials when left blank, reel-range check, 5% sequential-vs-quantity check. Form calculation: `total_duct_footage` = quantity × pull count | `tests/sprint16-18.test.js`, `overlap-classification.test.js` | Tests |
| Automatic contractor rate selection | Rate link copies rate, unit, description; snapshot frozen (D-003) | `tests/contractor-rate.test.js`, `rate-validation.test.js` | Tests; live (RATE-000083 on PRD-2026-FB71F938) |
| Automatic material calculation | Conduit on the device; others from mappings in `material-variance` | `tests/splice-material.test.js` | Tests; live conduit `CONDUIT-1.25-1PULL` × 500 |
| QA/QC | `qa_status`, owner, due date; QA gate | `tests/approval-workflow.test.js` | Tests |
| Approval | Approval gate + no self-approval (v7.7.0) | `tests/lifecycle.test.js` TEST-SOD-001..007 | Tests. **A live two-person approval is not yet demonstrated** (`docs/uat/chain-demonstration.md`, C-1..C-7) |
| Project quantity update | Computed by reports from APPROVED production; nothing stored (D-012) | `project-scope-status.sql` | Ran live |
| Financial production update | `extended_value` = qty × snapshotted rate; `contractor-financial`, `project-financial` | audit-daily D-4 | Ran live |
| Remaining work | `remaining-work.sql`: authorized − approved | `tests/reporting.test.js` | Ran live (no scope yet, so no rows) |
| Daily / weekly / monthly reporting | `production-daily/weekly/monthly` | Run live | Live |
| Invoice / management reconciliation | `reconcile_invoice.py` against `invoice-reconciliation-basis.sql` | `tests/invoice-reconciliation.test.js`; live demo, *UNAPPROVED PRODUCTION BILLED* on the test record | Tests + live demo |

**Verdict:** every step exists and is tested. The chain has **not** been
walked end to end on live records, because that needs a baselined scope and
two people. The 20-minute runbook in `docs/uat/chain-demonstration.md` is
that walk. Until it is done, the system is **demonstrably built, not yet
demonstrated in use**.

---

## 7. Final review: stop

Sprint 32 ends with the master prompt's *"Stop for final review and
approval."* Approval is the Business Owner's call. These items still need
people:

| # | Item | Gate / issue |
|---|---|---|
| 1 | Rotate the production app's tokens | OI-01, ENH-001 |
| 2 | Contractor role change | OI-22, ENH-002 |
| 3 | Name the nine governance roles | gate 12 |
| 4 | Baseline one project's scope; run the chain demonstration | gate 6, gate 7 |
| 5 | Run UAT (8 roles, 57 cases) | OI-06 |
| 6 | Confirm the two webhooks | OI-23 |
| 7 | Contract references on 146 rates; mapping review | ENH-006, ENH-007 |
| 8 | Name backup storage and retention; ask Fulcrum about platform backup | Sprint 31 §6 |
