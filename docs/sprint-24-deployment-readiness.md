# Sprint 24 — Pre-Deployment Gate, Configuration Baseline, Pilot and Rollout Plan

**Date:** 2026-11-09
**Verdict: DO NOT DEPLOY. The pre-deployment gate fails on 7 of 12 items.**

> Master prompt, end of Sprint 23: *"Once Sprint 23 is complete, STOP. Do not
> make production changes until test results and readiness findings have been
> reviewed."*

This sprint was carried out **as an assessment only**. Nothing in production
was changed. The only writes made on 2026-11-09 were to the **Development**
apps (Sprint 23 build work: Mainline v7.6.0 and Contractor Rate v1.1.0). The
production `Mainline Construction` app (`148545bf…`) was **read once**, to check
open issue OI-01, and was not modified.

The pilot and the rollout waves below are a **plan**. Neither has started, and
neither should start until the gate passes and someone with authority signs
section 7.

---

## 1. Pre-deployment gate

The prompt lists the items to confirm. Every item is marked PASS, FAIL or
NOT APPLICABLE, with the evidence.

| # | Item | Verdict | Evidence |
|---|---|---|---|
| 1 | Sprint 23 complete | **FAIL** | The Sprint 23 completion rule needs the chain demonstrated on real records, from field entry through approval to traced totals. Two test records exist; neither has been approved, so approval, earned value and approved-quantity reconciliation have never run on a record. |
| 2 | Defect disposition | **FAIL** | No CRITICAL **code** defect is open. **One new CRITICAL configuration finding** (P-1 below: a contractor can approve their own production). The HIGH items are still open: OI-01 token rotation is unconfirmed and OI-13 is unpriced work. |
| 3 | Rate validation | **PASS** | 146 rates, all ACTIVE, all with unit and description. `rate-master-audit.sql`: 0 CRITICAL; 146 WARNING (no contract reference) and 146 INFO (no currency). Both fields are new as of today. `rate-audit.sql`: 0 findings on live production. |
| 4 | Material validation | **FAIL** | 125 mappings loaded: 58 APPROVED, 67 NEEDS REVIEW. Only 57 of the 146 pay units have any mapping, and 49 have an approved one (OI-11). 2" part numbers are still unknown (OI-12). |
| 5 | Labor code validation | **PASS** | The MC Labor Code choice list has 146 entries, and the rate master has 146 distinct codes, all priced. Rate-sheet exceptions are recorded in `data/labor-exceptions.csv`. |
| 6 | Scope validation | **FAIL** | **None of the three projects has a scope baseline** (`project-summary.sql` shows `NO BASELINE - scope not set` for all three). Scope, remaining-work and over-plan logic are unit-tested and run against live data, but there is nothing to measure. |
| 7 | Permissions | **FAIL** | Configured roles were read for the first time; findings P-1 to P-4 are below. Nothing has been tested with a real user. |
| 8 | Versioned Data Events | **PASS** | 13 apps and 10 scripts. Every script and every schema in the repo matches live (section 4). The Labor-Material Mapping script was live but uncommitted, and was committed unchanged today. |
| 9 | Offline / known limitations documented | **PASS** | `docs/offline-capability-matrix.md` and `docs/sprint-23-known-limitations.md`. |
| 10 | UAT | **FAIL** | No UAT session has been held and no feedback register exists (OI-06). |
| 11 | Production ownership | **FAIL** | No one is named. `docs/sprint-26-governance.md` defines the nine roles; every name is blank. |
| 12 | Support process | **FAIL** | A procedure is written (`docs/sprint-26-governance.md` §4), but nobody is assigned to answer it. |

**Five PASS, seven FAIL, none NOT APPLICABLE.**

### Re-reading the Sprint 23 readiness gate with today's evidence

`docs/sprint-23-readiness.md` (2026-09-21) scored 6 PASS / 4 FAIL / 4 CANNOT
ASSESS. Two of its premises have since changed: the masters are imported, and
records exist. The table below shows only the rows that moved.

| # | Condition | 2026-09-21 | 2026-11-09 |
|---|---|---|---|
| 3 | Financial reconciliation | CANNOT ASSESS | **PARTIAL.** Pending value reconciles across three reports: production-daily, contractor-financial and project-summary all show 11,000.00 pending from 2 records. **Approved** value cannot be reconciled until something is approved. |
| 4 | Quantity reconciliation | CANNOT ASSESS | **PARTIAL**, for the same reason. 500 FT + 500 FT pending agrees in production-daily and production-weekly. |
| 6 | Material mapping | FAIL | **Still FAIL**, but no longer empty: 125 mappings loaded. |
| 9 | Destructive-change testing | PARTIAL | **PARTIAL.** Condition 11 (an approved record cannot be silently overwritten) now has controls in place (D-018), but they are untested on a live record. |
| 11 | Permission testing | CANNOT ASSESS | **FAIL**, with findings (§2). |
| 13 | Backout / recovery documented | FAIL | **PASS (documented), NOT REHEARSED.** See `docs/backout-recovery-procedure.md`. |

---

## 2. Permission findings (first reading of the configured roles)

Read with `roles_list` and `memberships_list` on 2026-11-09. Read-only.

| Role | Members | Create | Update | Change status | Delete | Export | Manage apps |
|---|---:|:-:|:-:|:-:|:-:|:-:|:-:|
| Owner | **6** | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Admin | 2 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Contractor | 10 | ✔ | ✔ | ✔ | — | — | — |
| Inspector | 0 | ✔ | — | — | — | — | — |
| Manager | 0 | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| Standard User | 0 | ✔ | ✔ | ✔ | — | — | — |
| Record Creator | 0 | ✔ | — | ✔ | — | — | — |

**P-1 — CRITICAL. A contractor can approve their own production.** The
Contractor role holds `can_change_status`. Fulcrum's status permission is
all-or-nothing: whoever can move a record to SUBMITTED can also move it to
APPROVED. The approval gate (`enforceApprovalGate`) checks the **data**,
meaning exceptions, QA status and rate. It does not check **who** is
approving. So a contractor whose record is clean, with QA marked Pass, can
approve their own work into earned value and billing. That is a
segregation-of-duties failure, and it sits on the money path.

*Remedy (business decision; not made here):* either (a) contractors do not
enter production in Fulcrum, and an LREMC inspector enters it, or (b) the
Contractor role loses `can_change_status`, and a reviewer moves records past
DRAFT. Either way, add a control in `production-audit-trail.sql` that flags any
record whose `approved_by` matches `submitted_by` or its creator. A device
check cannot enforce this, because `USERROLE`/`USEREMAIL` do not resolve in this
account's runtime (D-013).

**P-2 — HIGH. Six Owners.** Every Owner can delete records, export
everything, manage apps and roles, and edit the subscription. Delete is the
compensating control for limitation L3 (see `sprint-23-known-limitations.md`),
so it should belong to as few people as possible. Recommended: one Owner, one
backup Admin, and everyone else on a role without delete.

**P-3 — HIGH. The Inspector role cannot submit or correct a record.** It has
`can_create_records` only: no update and no change status. An inspector can
save a new record, but cannot edit it afterwards, submit it, or correct one
that was sent back. The field workflow in `docs/operations-guide.md` Part 2
would fail at step one for anyone on this role. No one holds it yet.

**P-4 — MEDIUM. Contractors cannot run reports.** That may be deliberate. If
contractors are meant to check their own production before billing, they need
`can_run_reports` or a shared report.

None of these were changed. Roles are account-wide and also govern the
production app and every other app on the account.

---

## 3. Evidence added since the Sprint 23 verdict

### Every report has now executed against live data

The Sprint 23 verdict's first blocker was *"No report in this system has
returned a row."* On 2026-11-09, all 26 reports ran through `query_records`
against the live Development apps:

| Rows | Reports |
|---|---|
| Returned rows | production-daily (5), production-dashboard (6), project-summary (3), production-monthly (2), production-weekly (2), production-trend (2), contractor-financial (2), production-audit-trail (2), qa-review-queue (2), material-variance (2), unplanned-production (2), closeout-readiness (1), exception-dashboard (4), rate-master-audit (292) |
| Ran, nothing to report | duplicate-production, sequential-overlap, voided-reversed, segment-integrity, reel-balance, reel-integrity, rate-audit, remaining-work, forecast-completion, productivity, project-scope-status, project-financial |

The second group returned zero rows for a stated reason: there is no approved
production, no scope baseline, no reel and no structure yet. Zero rows is the
correct answer for each of them today. It is **not** proof that their
arithmetic is right.

**One defect was found that no static test could catch.** `production-trend.sql`
used a window frame ending at `7 DAY PRECEDING`. The Query engine refuses that
(*"frame starting from following row cannot have preceding rows"*). It is now
written as the 14-day window minus the 7-day window, which covers the same set
of days, and `TEST-LIFE-RPT-006` guards every report against the pattern.

**The transport limit is higher than recorded.** An 8.6 KB statement
(`project-summary.sql`) ran; 11.9 KB is still refused. Only
`exception-dashboard.sql` (12.1 KB) needs `scripts/slice_report.py`, and both
of its slices ran.

### OI-01 — the production credentials

On 2026-11-09, a read-only check of the production app's script found that **the
Fulcrum token literal is gone** (the script was edited 2026-10-21). The
remaining Smartsheet lines are its API base URL and a sheet ID, plus
commented-out code naming an undefined token variable. No credential-shaped
literal remains. **Rotation cannot be verified from here:** a token removed
from the current script is still in the form's version history and on every
device that synced the old script. Until someone confirms both tokens were
revoked, OI-01 stays open.

---

## 4. Configuration freeze and baseline

### What is frozen

From the date the gate is signed (§7) until the pilot closes, these do not change
except through the deployment-blocking change procedure below:

- the MC Labor Code choice list (146 codes) and the other four MC choice lists
- the contractor rate master (146 rates): no edits, only new versioned rates
- the labor-material mapping master
- project scope baselines, once set for the pilot project
- every Data Event script (10) and every form schema (13 apps)
- status lists and approval logic
- field keys (`m###`, `r###`, …): never renamed and never reused, frozen or not

**Deployment-blocking change procedure.** A change during the freeze needs:
1. a written reason saying what it blocks;
2. the change in the repo with its tests, run green;
3. the Technical Owner's approval and the Business Owner's;
4. deployment through `forms_update`, then read back and compared with the repo;
5. a new baseline file, with the old one kept.

### The baseline

Machine-readable: **`fulcrum/baseline-2026-11-09.json`**. It records the ID,
`updated_at`, script SHA-256, element count, elements SHA-256, status list and
record counts for each app, plus the entry count and hash for each choice
list. To detect drift, read the live form, hash it the same way, and compare.

| App | Data Event | Elements | Statuses | Records |
|---|---|---:|---:|---|
| Mainline Construction - Development | **v7.6.0** | 152 | 9 | 1 DRAFT, 1 SUBMITTED |
| MC Contractor Rate - Development | v1.1.0 | 22 | 4 | 146 ACTIVE |
| MC Contractor Master - Development | — | 10 | 2 | 3 ACTIVE |
| MC Project Master - Development | — | 22 | 5 | 3 ACTIVE |
| MC Project Scope Line - Development | v1.1.0 | 24 | 3 | 0 |
| MC Change Order - Development | v1.1.0 | 31 | 5 | 0 |
| MC Labor-Material Mapping - Development | v1.0.0 | 18 | 4 | 58 APPROVED, 67 NEEDS REVIEW |
| MC Material Master - Development | — | 12 | 3 | 135 ACTIVE |
| MC Material Transaction - Development | v1.1.0 | 21 | 3 | 0 |
| MC Fiber Reel - Development | v2.0.0 | 19 | 5 | 0 |
| MC Structure - Development | v1.1.0 | 31 | 4 | 0 |
| MC Segment - Development | v1.0.0 | 26 | 4 | 0 |
| MC Project Closeout - Development | v1.0.0 | 43 | 6 | 0 |

| Choice list | Entries | Last changed |
|---|---:|---|
| MC Labor Code | 146 | 2026-09-17 |
| MC Work Category | 11 | 2026-09-16 |
| MC Construction Method | 14 | 2026-09-16 |
| MC Unit of Measure | 6 | 2026-09-16 |
| MC QA Status | 4 | 2026-09-16 |

**Repo vs. live, verified 2026-11-09.** All 13 schemas match on every
attribute the repo records. 7 of 10 scripts are byte-identical. The other
three differ only cosmetically: `mc-fiber-reel-dev` (a trailing newline),
`mc-project-closeout-dev` (one comment word and a trailing newline) and
`mc-segment-dev` (one comment line). The Project Master and Contractor Master
schemas, which had never been committed, are now in `fulcrum/schemas/`
unchanged.

**Reports in the baseline:** 26 SQL files in `reports/`. **Permissions:** §2.
**Active projects:** PRJ-000001 (MCP-TEST-001), PRJ-000002 (Hoke CAB) and
PRJ-000003 (Laurinburg Pon 12), all ACTIVE and none baselined.

---

## 5. Pilot plan

**Pilot project (recommended): Laurinburg Pon 12 (PRJ-000003)** or a project
of similar size chosen by the Business Owner. It should carry underground,
aerial, fiber placement, splicing and material in one job. Avoid Hoke CAB for
the first pilot: its splicing is already recorded in a separate app, under a
standing instruction that its records and form fields must not change. Two
systems recording the same splices would produce two answers to the same
question.

**Entry criteria — all must hold before the first pilot record.**

1. This gate passes (§1), or each failing item is formally accepted in writing by the Business Owner.
2. P-1 is resolved by whichever remedy the business chooses.
3. The pilot project has a BASELINED scope line for every pay unit it will use.
4. Every pay unit the pilot will use has an APPROVED material mapping, or is
   explicitly listed as having no material.
5. Pilot users hold roles that can actually perform their workflow (P-3).
6. Backout procedure rehearsed once in Development (`backout-recovery-procedure.md` §5).
7. A named support contact is available for the pilot's first two weeks.

**Success criteria — the prompt's, made measurable.**

| Criterion | Measured by | Pass |
|---|---|---|
| Field entry is usable | Inspector UAT notes; time to enter a record | No BLOCKER feedback; median entry under 5 minutes |
| Correct events, rates, materials and footage | `rate-audit`, `material-variance` and `exception-dashboard` | 0 CRITICAL left unexplained at week end |
| Reports reconcile | Weekly: approved value in project-financial = contractor-financial = sum of approved records | Equal to the cent |
| Approvals work | `qa-review-queue`; audit trail | Every APPROVED record has a reviewer distinct from its creator (P-1 control) |
| Offline behaviour understood | Inspector debrief against `offline-capability-matrix.md` | No surprise reported |
| Management reporting usable | PM walkthrough of the reporting guide | PM can answer the 10 UAT questions from reports alone |
| No critical defects | Defect register | 0 open CRITICAL at pilot close |

**Duration:** at least two full billing periods, so that at least one
period closes, is reconciled and is billed from this system.

---

## 6. Rollout waves (after pilot sign-off)

| Wave | Scope | Hold point |
|---|---|---|
| 1 | 1–3 projects, including the pilot | Two weeks of clean daily audit checks (`docs/sprint-26-governance.md` §5) |
| 2 | 5–10 projects | One reconciled billing period across all wave-2 projects |
| 3 | All remaining projects | — |

Between waves: re-run this gate's items 2, 3, 4 and 7, refresh the baseline
file, and confirm no field key or status changed.

**Stop conditions at any wave:** a CRITICAL defect on the money path; a
reconciliation that does not tie out; or an approved record found changed
after approval without an explanation. Stop the wave and apply the backout
procedure.

---

## 7. Sign-off

Not signed. The gate does not pass.

| Role | Name | Decision | Date |
|---|---|---|---|
| Business Owner | | | |
| Fulcrum Administrator | | | |
| Technical / Data Event Owner | | | |
