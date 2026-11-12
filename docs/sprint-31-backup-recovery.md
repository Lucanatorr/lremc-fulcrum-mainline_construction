# Sprint 31: Backup, Recovery and Business Continuity

**Date:** 2026-11-12. **Environment:** Development only. Nothing in any app was
changed. Every query below was run live through the read-only
`query-mcp_query_records` tool, and every config read used `forms_get`.

> *"Define periodic exports … Document recovery … Retain the previous
> known-good Data Event version before deployment … Before mass changes:
> export affected records, count them, calculate impact, test a sample,
> perform the update, reconcile, and document the result. Track significant
> incidents."*

| Deliverable | Where |
|---|---|
| Backup exports, one per dataset (15) | `reports/continuity/backup-*.sql` |
| Backup manifest: count and fingerprint per table | `reports/continuity/backup-manifest.sql` |
| Backup verification and deletion detection | `scripts/backup_verify.py` |
| Verified live manifest, 2026-11-12 (no record data) | `data/backup-manifests/2026-11-12.json` |
| Configuration snapshot and drift check | `scripts/config_snapshot.py` |
| Known-good Data Event retention and rollback | `fulcrum/known-good/`, `scripts/known_good.py` |
| Mass-change control | `scripts/mass_change.py` |
| Incident register | `data/incident-register.csv` (10 incidents) |
| Recovery playbooks R-1 to R-8 | §2 below |
| Tests | `tests/continuity.test.js`, 37 cases |

---

## 1. Periodic exports

### 1.1 Exports are not a platform backup

**Requested Capability:** periodic backups of production, projects, rates,
materials, scope, change orders, approvals and configuration.

**Fulcrum Limitation:** this toolchain can only *read*: the Query API (SQL)
and `forms_get` / `choice_lists_get`. It cannot take, schedule or restore a
platform backup. Whatever Fulcrum retains internally is outside this
project's control and is not described here. An export also does not
contain:
- photo, signature or attachment **files** (it holds only their ids)
- record **history**, the earlier versions behind `_version`
- the account's users, roles and memberships

**Operational Impact:** the exports are this project's own copy of its data.
They let you restore what a record *said*, and they prove what existed on a
date. They do not let you restore Fulcrum itself. **A deleted record cannot
be recovered from the app** (backout procedure §4). Its last export becomes
the only copy.

**Recommended Alternative:** run the exports below on schedule, and verify
each one. Ask Fulcrum, through the account owner, what platform-level
retention and restore the subscription includes, and write the answer here.
Download photos with each project's closeout package (governance §6).

### 1.2 What is exported, and when

| Dataset | Export | Weekly | Billing close | Before a deployment | Before a mass change |
|---|---|:-:|:-:|:-:|:-:|
| Production | `backup-production.sql` | ● | ● | ● | ● |
| Production actual materials (repeatable) | `backup-production-materials.sql` | ● | ● | ● | ● |
| Projects | `backup-projects.sql` | ● | | | ● if touched |
| Contractors | `backup-contractors.sql` | ● | | | ● if touched |
| Rates | `backup-rates.sql` | ● | ● | | ● if touched |
| Materials | `backup-materials.sql` | ● | | | ● if touched |
| Labor-material mappings | `backup-mappings.sql` | ● | | | ● if touched |
| Scope lines | `backup-scope-lines.sql` | ● | ● | | ● if touched |
| Change orders and their lines | `backup-change-orders.sql`, `backup-change-order-lines.sql` | ● | ● | | ● if touched |
| Material transactions | `backup-material-transactions.sql` | ● | ● | | ● if touched |
| Fiber reels, structures, segments, closeouts | `backup-reels/-structures/-segments/-closeouts.sql` | ● | | | ● if touched |
| **Approvals** | Approval stamps are columns on each record, so they are in the exports above. `reports/bi/fact_approval_event.sql` lists them as events | ● | ● | | |
| **Configuration** | `forms_get` for the 13 apps and `choice_lists_get` for the 5 lists, then `scripts/config_snapshot.py` | ● | | ● | |
| The money basis, frozen | `contractor-financial.sql`, `invoice-reconciliation-basis.sql` | | ● | | |

Each export is `SELECT *`, so a field added later is backed up without
editing the export. Rows are ordered by record id in byte order
(`COLLATE "C"`).

### 1.3 How to take one (about 15 minutes)

1. Create a folder named for the date, for example `backup-2026-11-19/`, in
   the controlled storage the Business Owner names. **Not** this repository:
   the exports contain contractor contact details and pricing.
2. Run `backup-manifest.sql` and each `backup-*.sql` in one sitting. Use the
   Fulcrum Query UI (CSV) or the Query API (JSON). Save each result as
   `<dataset>.csv|json`, with the manifest as `manifest.csv|json`.
3. Verify the folder:
   ```
   python3 scripts/backup_verify.py backup-2026-11-19 --previous backup-2026-11-12 \
           --write-manifest data/backup-manifests/2026-11-19.json
   ```
   - **COUNT MISMATCH / FINGERPRINT:** the export is not what the manifest
     saw. Someone saved a record in between, or a download was cut off.
     Re-run both.
   - **DELETED:** a record in the previous backup no longer exists. Every one
     must be explained in the incident register. The previous folder is now
     the only copy of it: **never delete a backup that holds a deleted
     record.**
4. Configuration: save each `forms_get` / `choice_lists_get` result into the
   same folder (`<form_id>.json`, `cl_<id>.json`), then
   ```
   python3 scripts/config_snapshot.py backup-2026-11-19 --compare fulcrum/baseline-2026-11-12.json
   ```
   Any DIFFERS that no release explains is an unauthorised change: log it as
   an incident.
5. Commit only the verified manifest (`data/backup-manifests/`): counts and
   fingerprints, no record data.

**Retention:** keep weekly backups for at least 13 weeks, and billing-close
and pre-change backups for the contract retention period. Governance §6
suggests 7 years if the Business Owner states none.

### 1.4 Run live, 2026-11-12

All 16 queries ran. `backup_verify.py` reported **15 datasets, 0 FAIL**: the
fingerprint Python computed from the exported rows equalled the one the Query
API computed, for every table.

| Dataset | Rows | Dataset | Rows |
|---|---:|---|---:|
| production | 2 | rates | 146 |
| production_materials | 0 | materials | 135 |
| projects | 3 | mappings | 125 |
| contractors | 3 | scope_lines, change_orders, change_order_lines | 0 |
| material_transactions, reels, structures, segments, closeouts | 0 | | |

`config_snapshot.py`, run against the same day's `forms_get` reads, reproduces
`fulcrum/baseline-2026-11-12.json`: **18 of 18 items SAME** (13 forms, 5 choice
lists).

---

## 2. Recovery playbooks

These sit on top of the five levels in `docs/backout-recovery-procedure.md`.
The rules that apply to every playbook:
- **Never delete production.** Correct it through the lifecycle (D-018).
- **Never re-price approved production** from a master (D-003).
- **Take an export first** (§1.3), even under time pressure.
- **Log it** in `data/incident-register.csv`.

### R-1 Accidental rate change

*Symptom:* a rate's `unit_rate`, unit, dates or applicability changed with no
superseding rate. You see one of these:
- `backup_verify.py --previous` counts the rate among CHANGED; compare its two
  rows.
- `rate-expected-audit.sql` shows production priced off the rate in force.
- A contractor queries a price.

1. Find the previous values: the record's history in Fulcrum (`_version`), or
   the last backup's `rates` export.
2. Find production priced from it **after** the change. A record keeps the
   `rate_source_id` and `contractor_rate` it snapshotted (D-003):
   `SELECT production_id, _status, contractor_rate, quantity FROM "06c36c8e-…" WHERE rate_source_id = 'RATE-xxxxxx' AND _server_updated_at >= '<change time>'`.
   Production saved **before** the change still holds the correct rate. That
   is the snapshot working.
3. Restore the rate:
   - If no production used it at the wrong price, edit it back and note why.
   - If any did, **expire** the wrong version and create a corrected rate
     with `supersedes_rate_id`, so each record can be traced to the price it
     carried.
4. Affected **unapproved** production: re-select the rate link and save.
   **Approved** production: an Adjustment record per item, naming the
   original Production ID.
5. Run `rate-expected-audit.sql`. No production should differ from the rate
   in force on its work date, except as explained.

### R-2 Deleted or deactivated master record

**Deactivated** (project, contractor, rate, material, mapping): set the
status back, with a note. Status history shows who and when.

**Deleted:**
1. `backup_verify.py --previous` names the record (DELETED) and its last
   version. Take its row from that backup.
2. Recreate it with the **same business key** (`project_id`, `contractor_id`,
   `rate_id`, `material_code`, `mapping_id`). It gets a **new** Fulcrum
   `_record_id`.
3. Record links hold the old `_record_id`, so links from other records
   now point at nothing. History is safe anyway. Production keeps
   `project_id_snapshot`, `contractor_id_snapshot`, `rate_source_id` and the
   rate, so every report that reads snapshots is unaffected.
4. Unapproved records that linked to it: re-select the link. Approved
   records: leave them, because the snapshot is the record of what was paid.
5. Run `integration-id-integrity.sql` (no blank or duplicate key) and
   `exception-dashboard.sql`.
6. Prevention: delete permission stays narrow (Sprint 24 P-2,
   `docs/uat/role-model.md`).

### R-3 Bad labor-material mapping

Mappings are superseded, never edited (governance §3).
1. Set the bad mapping to SUPERSEDED or REJECTED. Create the corrected one
   with `supersedes_mapping_id`.
2. Expected material is computed by the reports (`material-variance`,
   `bridge_labor_material`) from APPROVED mappings at run time. No total is
   stored (D-012), so the reports are correct as soon as the status changes.
3. The material **ledger** (MC Material Transaction) holds what was actually
   issued and installed. A wrong ledger entry is VOIDed and re-entered; it is
   never edited.
4. Run `material-variance.sql` for the affected projects, before and after,
   and keep both with the incident.

### R-4 Bad Data Event deployment

This is Level 1 of the backout procedure, now with the exact rollback bytes
retained (§3):
```
python3 scripts/known_good.py rollback mainline-construction-dev > /tmp/rollback.js
```
1. `forms_get`: keep the JSON (the bad state).
2. `forms_update` with the **same elements** and `script` = `/tmp/rollback.js`.
   `known_good.py rollback` refuses a version marked never-redeploy and says
   why. For those apps, fix forward.
3. Read back. The script must match the rollback file byte for byte.
4. Find records saved under the bad version by `calc_version`, Mainline only
   (D-019). For other apps, use `_server_updated_at` between the deployment
   and the rollback.
5. Re-derive by re-saving in the app. **An API or CSV import runs no Data
   Events, so it does not re-derive anything.**
6. Tell field users to sync. An offline device runs the old script until it
   syncs.

### R-5 Mass update gone wrong

The plan written by `mass_change.py plan` (§4) holds the **before-image of
every row**, which makes it the undo source.
1. Stop. Export the table again, then run
   `mass_change.py reconcile PLAN.json NOW.json` to list exactly what changed.
2. For the changed records, restore the planned fields to their before-image
   values. Restore derived fields too, or re-save in the app so they
   re-derive.
3. Reconcile again until 0 FAIL. Keep PLAN, both RESULTs and the incident.
4. Approved records touched by the mass update are a Level 3 repair, which
   needs the Business Owner.

### R-6 User error

| State of the record | Correction |
|---|---|
| DRAFT | The inspector fixes it |
| SUBMITTED / UNDER REVIEW | The reviewer sets CORRECTION REQUIRED with the reason, and the inspector fixes it and resubmits |
| APPROVED, wrong in full | REVERSED, with a reason |
| APPROVED, wrong by an amount | An Adjustment record naming the original Production ID |
| APPROVED, needs re-review | REOPENED, with a reason. The approval is cleared, and the export posts the take-back (Sprint 30 §3) |
| Never approved, should not exist | VOID |

The field guides in `docs/training/` show the messages users see.

### R-7 Duplicate production

1. `duplicate-production.sql` lists records with identical strict
   fingerprints. Audit daily D-6 runs it every day.
2. Decide which record is the original: usually the earlier `_created_at`,
   or the one with photos.
3. The duplicate: VOID if never approved, REVERSED if approved. **Never
   delete**: the void is the evidence.
4. If it was already billed, the invoice reconciliation
   (`reconcile_invoice.py`) shows *DUPLICATE ITEM* or *UNAPPROVED PRODUCTION
   BILLED* on the next invoice. Recover the money through Contract / Finance.

### R-8 Scope error

1. **Before import:** `validate_scope_baseline.py` catches problems while
   they are still cheap to fix (gate 6):
   - unknown projects
   - codes with no ACTIVE rate
   - blank, zero or negative quantities
   - the same line twice
2. **DRAFT scope line:** edit it.
3. **BASELINED scope line:** it is locked by design. Correct it with a
   **change order**, reason `Error-Omission`, carrying the signed difference
   as a line. The original baseline stays visible, so the correction is
   auditable.
4. Run `project-scope-status.sql` and `remaining-work.sql` before and after.

---

## 3. Known-good Data Event retention

**What is retained.** `fulcrum/known-good/<app>.js` holds the exact bytes
verified live for each of the 10 apps with a Data Event, captured 2026-11-12
from `forms_get`. `<app>.rollback.js` holds the version before it, where
redeploying that version is safe. `registry.json` records each version's
SHA-256, commit and date, and why a rollback is allowed or refused.

| App | Live | Rollback target | Allowed? |
|---|---|---|---|
| Mainline Construction | 7.7.0 | 7.6.0 (`6b2a9a3`, live 2026-11-09 to 11-12) | **Yes**. It removes the no-self-approval guard, so the weekly audit W-8 must cover approvals until 7.7.x is restored |
| MC Contractor Rate | 1.1.0 | 1.0.0 | **No**: it clears unit and description on save |
| MC Project Scope Line, MC Change Order | 1.1.0 | 1.0.0 | **No**: it can erase the unit |
| MC Material Transaction, MC Structure | 1.1.0 | 1.0.0 | **No**: timezone date shift |
| MC Fiber Reel | 2.0.0 | none | v1.0.0 predates the repository. Disable the handler |
| MC Segment, Closeout, Mapping | 1.0.0 | none | First versions. Disable the handler |

**Found while building it.** Three repository files differ from the live
bytes, and none of the differences is code:
- `mc-fiber-reel-dev.js`: a trailing newline only
- `mc-segment-dev.js` and `mc-project-closeout-dev.js`: one comment line each,
  edited after deployment

The retained copies are the live bytes, so a rollback restores exactly what
was live. Separately, four scripts (Scope Line, Change Order, Material
Transaction, Structure) still say `v1.0.0` in their own header comment, while
the deployed fix is v1.1.0. The registry is the source of truth for
versions. Correct the headers at each app's next deployment (**OI-24**).

**The deployment procedure, with retention:**

1. `forms_get` for the app. Save the JSON as the pre-deploy state.
2. `python3 scripts/known_good.py preflight <app> <forms_get.json>`. If the
   live script is not the registered known-good, **stop**: someone changed
   it outside the release process (AI/MCP rule 14).
3. Deploy to Development with `forms_update`. Read back, and compare byte
   for byte.
4. `python3 scripts/known_good.py promote <app> <forms_get-after.json> --version X.Y.Z --commit <hash>`.
   The previous known-good becomes the rollback target, with its exact bytes.
5. If the new version must never be rolled back past, for example because it
   fixes data corruption, edit the rollback entry's `safe_to_redeploy` and
   `reason` by hand.
6. Commit `fulcrum/known-good/`, and update `docs/data-event-inventory.md`.
7. `known_good.py check` runs in the test suite, so a registry that disagrees
   with the files or the baseline fails CI.

---

## 4. Mass-change procedure

A *mass change* is any change to more than one record by bulk edit, import or
API. It is never applied to live production records to test logic
(AI/MCP rule 9).

| Step | Brief | How |
|---|---|---|
| 1 | Export affected records | The full table: `backup-<dataset>.sql`. The plan keeps a before-image of **every** row, so changes outside the set are caught too |
| 2 | Count them | `mass_change.py plan EXPORT --where field=value … --set field=value … --out PLAN.json` prints the count by status |
| 3 | Calculate impact | The same output: value before, estimated after, and delta per project × contractor, with approved value shown separately. Moving records between projects shows money leaving one bucket and arriving in another |
| 4 | Test a sample | Change only the printed sample (default 3, chosen deterministically), export, then `mass_change.py reconcile PLAN.json AFTER.json --sample-only`. The sample shows the change and nothing else, and every other record is untouched |
| 5 | Perform the update | In Fulcrum, by the person who owns that data, after the Business Owner approves a plan that touches money |
| 6 | Reconcile | Export again, then `mass_change.py reconcile PLAN.json AFTER.json --allow-field <derived fields> --out RESULT.json`. It fails on a target not changed, an unplanned field change, a record outside the set changed, or a record gone |
| 7 | Document the result | Keep PLAN.json and RESULT.json with the change request (Sprint 32 backlog) or the incident |

**Built-in refusals:**
- A selection that matches **APPROVED / REVERSED / BASELINED / CLOSED**
  records is BLOCKED (exit 2). Correct those through the lifecycle, or pass
  `--allow-history` with the Business Owner's written approval.
- No `--where` and no `--ids`: refused, because "everything" is not a plan.
- A field name that is not an actual field key: refused.

**Derived fields.** Fields that a Data Event or calculation recomputes on save
(`extended_value`, `exception_flags`, fingerprints, stamps) change too. Name
them with `--allow-field` so they are reported as DERIVED CHANGE rather than
failed. **An import does not run Data Events**, so after an import those
fields are *not* recomputed. Re-save in the app, or include them in the
change.

**Tried on live data, 2026-11-12, read-only.** Plan: set `contractor_rate`
to 12 for PRJ-000001. Result: 2 records (DRAFT 1, SUBMITTED 1). One already
holds 12 (PRD-2026-143C1840). Estimated impact: +$1,000.00 (from $11,000 to
$12,000), with $0 approved. The plan was not applied. Nothing in Fulcrum was
changed.

---

## 5. Incident register

`data/incident-register.csv` holds every field the brief names: ID, date
detected, detector, description, projects, records, financial impact,
operational impact, root cause, correction, preventive action and resolution
date. It also has severity, status and references to commits and issues.
`tests/continuity.test.js` checks it:
- IDs are unique
- dates are real
- a RESOLVED incident has a root cause, a correction, and a resolution date
  no earlier than detection
- an OPEN incident has no resolution date
- there are no URLs or token-like strings

Ten incidents are recorded from this project's own history:

| ID | Detected | Severity | Incident | Status |
|---|---|---|---|---|
| INC-0001 | 2026-09-21 | HIGH | `USEREMAIL()` crashed the web record editor | RESOLVED |
| INC-0002 | 2026-09-22 | CRITICAL | Unit erased on every save (Mainline, Scope Line, Change Order) | RESOLVED; test record open (OI-19) |
| INC-0003 | 2026-09-22 | CRITICAL | Every work date derived a day early | RESOLVED |
| INC-0004 | 2026-09-18 | HIGH | `forms_update` refused all writes for about 7 weeks (OI-02) | RESOLVED |
| INC-0005 | 2026-11-09 | HIGH | Rate v1.0.0 cleared the unit on save (latent) | RESOLVED |
| INC-0006 | 2026-11-09 | MEDIUM | Three report status-filter defects | RESOLVED |
| INC-0007 | 2026-11-09 | CRITICAL | Self-approval possible (OI-22) | MITIGATED (v7.7.0); role change open |
| INC-0008 | 2026-09-16 | CRITICAL | Credentials in the production app's Data Event (OI-01) | OPEN |
| INC-0009 | 2026-11-12 | LOW | PRD-2026-143C1840 null unit, found by audit-daily D-3 | OPEN |
| INC-0010 | 2026-11-12 | HIGH | Account-wide webhooks sending MC data to unreviewed flows (OI-23) | OPEN |

**What is significant enough to log:**
- anything on the money path
- any deletion found by `backup_verify.py`
- any DIFFERS from `config_snapshot.py` that no release explains
- any failed deployment or rollback
- any security finding
- any user unable to save for more than an hour (governance §4: priority 1)

---

## 6. Needs a person

| # | What | Who |
|---|---|---|
| 1 | Name the controlled storage for backup folders, and the retention period | Business Owner |
| 2 | Ask Fulcrum what platform-level backup and restore the subscription includes (§1.1) | Fulcrum Administrator |
| 3 | Take the first weekly backup outside this session, and verify it | Fulcrum Administrator |
| 4 | Rehearse R-4 (rollback 7.7.0 → 7.6.0 → 7.7.0) in Development. Needs a record to be created, so it cannot be done from this toolchain (L4) | Technical Owner |
| 5 | Resolve OI-01, OI-22, OI-23 (INC-0008, -0007, -0010) | Account owner / Business Owner |
