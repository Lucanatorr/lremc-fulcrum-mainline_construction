# Sprint 26 — Operational Governance

**Date:** 2026-11-09. **Status: drafted; no one is assigned.** Every name below
is blank, and the Business Owner fills them in. Until they are filled, Sprint 24
gate items 11 (production ownership) and 12 (support) stay FAIL.

---

## 1. Roles

One person can hold several roles. **Two pairs must never be the same
person:** the Rate Administrator and whoever approves rate changes, and anyone
who enters production and the reviewer who approves that production
(segregation of duties; see Sprint 24 finding P-1).

| Role | Accountable for | Fulcrum role needed | Name | Backup |
|---|---|---|---|---|
| **Business Owner** | Decisions in the business decision log; accepting gate items; go/no-go | Owner | | |
| **Fulcrum Administrator** | Apps, roles, memberships, deployments, drift checks, exports | Owner or Admin | | |
| **Data Owner** | Master-data quality overall; the monthly data-quality review | Manager | | |
| **Rate Administrator** | Contractor rates: creating, expiring, superseding | Manager (limited to the rate app) | | |
| **Material Administrator** | Material master and labor-material mappings | Manager | | |
| **Project Administrator** | Project master, scope baselines, change-order entry | Manager | | |
| **Technical / Data Event Owner** | Scripts, schemas, reports, tests and the repo; rollbacks | Admin | | |
| **Report Owner** | Report correctness; the weekly and monthly reviews | Standard User + run reports | | |
| **Support Contact** | First call for field and office users | Standard User | | |

**Who may delete records:** the Fulcrum Administrator and one named backup,
no one else. Today six Owners can (P-2).

---

## 2. The activation rule

> **Nothing becomes ACTIVE, APPROVED or BASELINED without a second person
> having validated it.**

A master record is created in DRAFT or NEEDS REVIEW. A second person checks it
against the procedure below and moves it on. The person who created it does
not activate it.

---

## 3. Procedures by master

### Projects
1. The Project Administrator creates the project in **PLANNING**, with planned
   fiber, underground and aerial footage and planned splices.
2. Validation: the Data Owner checks the planned quantities against the design package.
3. Set it **ACTIVE** only once its scope lines are BASELINED (below).
4. **ON HOLD** stops new production being expected; it does not block entry.
   **CLOSED** follows `closeout-readiness` reporting no CRITICAL blockers, or an
   override with a reason recorded in MC Project Closeout.

### Contractors
1. Create the contractor as **INACTIVE**, with its legal name and contractor ID.
2. Validation: Contract / Finance confirms there is an executed contract.
3. Set it **ACTIVE**. A contractor with no active rates cannot be priced; that is intended.

### Labor codes
**Every labor code must define all ten of these before it is used:**

| Attribute | Where it lives |
|---|---|
| Code | MC Labor Code choice list (value) |
| Description | Rate record `labor_description` (r009) |
| Category | `work_category`, chosen on each production record. Never inferred from the code's prefix (D-007) |
| Unit | Rate record `unit` (r010), which production copies |
| Calculation method | Script: `applyLaborMetadata` (pull count, size, band), or "quantity as entered" |
| Work type | Underground / Aerial / Fiber / Splicing / T&M (HR, EVENT) |
| Material mapping | Labor-Material Mapping, or an explicit "no material" note |
| Rate availability | At least one ACTIVE rate per contractor who will use it |
| Effective date | Rate `effective_date` (r012) |
| Approval | Business Owner sign-off, recorded in the business decision log |

**Duplicates.** Before adding a code, search the choice list for the same
work under another name. Two codes for one piece of work split its quantities
across two pay units, and no report can add them back together (rule 2:
quantities never sum across units). The 2026-09-17 restructuring of directional
bore (D-006) is the example to follow.

**Retiring a code:** never delete it. Add it to `RETIRED_LABOR_CODES` in the
production script with its replacement. A device with a stale list then gets a
CRITICAL naming the replacement.

### Rates
**Every rate change must capture these eight things. Never overwrite a rate.**

| Required | Captured in |
|---|---|
| Contractor | `contractor_link` (r002) |
| Applicability | `project_link` (r005); blank = all projects. `rate_scope` (r016) shows which |
| Labor code | `labor_code` (r008) |
| Old rate | The superseded record, named in `supersedes_rate_id` (r015) |
| New rate | `unit_rate` (r011), on a **new** record |
| Dates | `effective_date` (r012) on the new record; `expiration_date` (r013) on the old one |
| Reason | `notes` (r017) |
| Contract reference | `contract_reference` (r019) |
| **Approver** | **Not captured. No field exists** (OI-20). Until one is added, write *"Approved by <name>, <date>"* in `notes`, and the approver moves the record DRAFT → ACTIVE themselves |

Procedure:
1. The Rate Administrator creates the new rate in **DRAFT**, with all of the above.
2. The approver checks it against the executed contract or amendment and
   moves it to **ACTIVE**.
3. The Rate Administrator sets the old rate's expiration to the day before
   the new effective date, status **SUPERSEDED**, Active = No.
4. Run `rate-master-audit` (0 CRITICAL) and `rate-audit` (expect
   `DRIFTED FROM SOURCE` on older production, which is correct).

### Materials
1. Add the stock item to MC Material Master as **ACTIVE**, with its part
   number exactly as purchasing uses it.
2. Never change a part number in place. Set the old item to **DISCONTINUED** and add a new one.

### Mappings
1. The Material Administrator creates the mapping in **NEEDS REVIEW**: labor
   code, material code, multiplier, waste factor (kept separate) and confidence.
2. **APPROVED** only on evidence: both source projects agree within 5%, a
   single-source ratio is a whole number, or a recorded ruling settles it.
   The Data Owner approves. **Never guess a multiplier** (D-014).
3. Replacing a mapping: the new row names the old one in
   `supersedes_mapping_id`; the old one goes to **SUPERSEDED**.

### Structures
Created in the field, or imported from design. The ID locks once the
structure is **EXISTING** or **INSTALLED**. A duplicate ID is CRITICAL in
`segment-integrity`. Resolve it before any production references it.

### Scope
1. The Project Administrator creates one scope line per pay unit in **DRAFT**:
   planned quantity, budget rate and phase/WBS.
2. Validation: the Data Owner checks the lines against the contract schedule
   of values. The total of `original_budget_value` should equal the contract
   value.
3. Move each line to **BASELINED**. The quantity then locks (D-010). **A
   DRAFT line is not authorized scope**, and every report ignores it.

### Change orders
1. The Project Administrator raises the order in **DRAFT**, with one line per
   labor code. Each line is a **signed delta** at a stated rate.
2. **SUBMITTED** for approval. The approver is not the person who raised it.
3. **APPROVED** moves authorized scope and contract value. **REJECTED** or
   **CANCELLED** ends it. Either way it stops being an open closeout blocker.

---

## 4. Support process

| Tier | Who | Handles | Response |
|---|---|---|---|
| 1 | Support Contact | "How do I…", sync problems, a missing pick-list entry | Same working day |
| 2 | Fulcrum Administrator | Roles, access, a record stuck in the wrong status, master-data corrections | Next working day |
| 3 | Technical / Data Event Owner | A script refusing a valid save, a wrong derived value, a report error | Same day for anything on the money path |

**A field user who cannot save is a priority-1 incident.** Look first at the
Exceptions box and the INVALID message. Every message names its cause.

**Every incident is logged:** date, user, record ID, what happened, cause,
fix. Defects go to `docs/open-issue-log.md`. A pattern of "how do I" questions
goes to the training material.

---

## 5. Audit cadence

This is the schedule Sprint 27 builds on. Each check names the report that
answers it.

**Daily** (Report Owner, about 10 minutes)

| Check | Report |
|---|---|
| Missing or zero rates | `exception-dashboard` (Missing Rate, Zero Rate) |
| Failed calculations | `exception-dashboard` CRITICALs; `rate-audit` |
| Missing project or contractor | `exception-dashboard` |
| Potential duplicates | `duplicate-production` |
| Critical QA failures | `qa-review-queue` (BLOCKED - QA failed) |

**Weekly** (Report Owner and Project Manager)

| Check | Report |
|---|---|
| Over-plan production | `remaining-work` (OVER PLAN) |
| Sequential overlaps | `sequential-overlap` |
| Aged approvals | `exception-dashboard` (Old Pending Production) |
| Missing mappings | `exception-dashboard` (Missing Material Mapping) |
| Inactive or retired code use | `qa-review-queue` (BLOCKED - critical exception): the record's exceptions name the retired pay unit and its replacement |
| Material variance | `material-variance` |
| Contractor anomalies | `contractor-financial` (rejected %, wrong-contractor rates) |
| **Self-approval** | `production-audit-trail`: `approved_by` equal to the creator (P-1) |
| Configuration drift | Live hashes vs `fulcrum/baseline-*.json` (administrator guide §8) |

**Monthly** (Data Owner, with Contract / Finance)

| Review | Report or source |
|---|---|
| Financial reconciliation | `contractor-financial` = `project-financial`, to the cent |
| Rate review | `rate-master-audit`, `rate-audit` |
| Scope review | `project-scope-status`, change orders pending more than 30 days |
| Material review | `material-variance`, `reel-balance` |
| Permission review | `memberships_list` against §1. Leavers removed; delete held only by the two named people |
| Exception backlog | `exception-dashboard`, trend against last month |
| Data quality | `voided-reversed`: what was taken out, and why |

---

## 6. Backups and exports

Fulcrum keeps record history, but **a deleted record cannot be recovered from
the app**. So:

- **Weekly:** the Fulcrum Administrator exports every MC app's records (CSV,
  with child records) and keeps the export outside Fulcrum, for the contract
  retention period. The Business Owner states it; 7 years is suggested if none applies.
- **Before every deployment:** read the form (`forms_get`) and keep the JSON
  alongside the commit that changes it.
- **At every billing close:** export the approved production for the period,
  as the frozen record of what was billed.

---

## 7. Changing the system itself

Every change to a script, schema, status list, choice list or report goes
through the repo:
`docs/operations-guide.md` *Deploying a change*, then
`docs/training/administrator.md` §8. During a configuration freeze, the
deployment-blocking change procedure applies (`sprint-24-deployment-readiness.md` §4).
**No edits in the app designer.**
