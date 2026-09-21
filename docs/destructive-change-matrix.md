# Destructive Change Test Matrix  (Sprint 23.47)

What happens to historical production when master data changes underneath it.

## The governing principle (23.47.1)

**A production record must remain understandable after every master record it
points at has changed.**

This system does that with RecordLink `record_defaults`: selecting a project,
contractor, rate, reel or structure **physically copies** its values onto the
transaction at selection time. Nothing downstream re-reads the master for a
historical figure.

Snapshotted onto every production record, as 23.47.1 asks:

| Value | Field |
|---|---|
| Project ID / Name | `project_id_snapshot`, `project_name_snapshot` |
| Contractor ID / Name | `contractor_id_snapshot`, `contractor_name_snapshot` |
| Labor Code | `labor_code` |
| Labor Description | `labor_description` |
| Unit | `unit` |
| Rate Used | `contractor_rate` |
| Rate Record/Source ID | `rate_source_id` |
| Rate Effective Date | `rate_effective_date` |
| Rate Expiration | `rate_expiration_snap` |
| Rate scope (contractor / project / labor code) | `rate_contractor_id_snap`, `rate_project_id_snap`, `rate_labor_code_snap` |
| Extended Value | `extended_value` |
| Calculated material quantities | `conduit_material_code`, `conduit_material_quantity` |
| Reel printed range | `reel_begin_snap`, `reel_end_snap` |
| Structure IDs and types | `from_structure_id_snap`, `to_structure_id_snap`, and types |
| Work Date | `work_date` |
| Approval status | `_status` + approval stamps |

**Not snapshotted: material mapping version.** 23.47.1 says "where feasible".
The mapping master has no records loaded, so there is no version to snapshot
yet. Open item 28.

## The matrix (23.47.35)

| § | Change | Effect on history | Control | Status |
|---|---|---|---|---|
| 23.47.2 | Labor code deactivated | None. Code and description are on the record. | Choice list edit does not touch records; retired codes raise a CRITICAL if re-selected. | **TESTED** — `TEST-RETIRED-*` |
| 23.47.3 | Labor description changed | None. Snapshotted. | — | **TESTED** |
| 23.47.4 | Labor unit changed | None. Snapshotted. | — | **TESTED** |
| 23.47.5 | Contractor rate changed | **None — the point of the system.** | Rate copied physically; `production-audit-trail.sql` reports `MASTER REPRICED SINCE`. | **TESTED** — `TEST-AUDIT-020/021` |
| 23.47.6 | Rate versioning | New rate record, effective-dated. | `supersedes` + effective/expiration dates on the rate master. | **PARTIAL** — modelled, unexercised |
| 23.47.7 | Rate deletion | Snapshot survives; provenance says the master is gone. | `RATE RECORD NO LONGER EXISTS` in the audit trail. | **TESTED** |
| 23.47.8 | Material mapping changed | Conduit unaffected (derived on the record). Other families would shift. | Mapping master is effective-dated. | **PARTIAL** — master empty |
| 23.47.9 | Material mapping versioning | — | `supersedes_mapping_id` column exists in the import. | **PARTIAL** |
| 23.47.10 | Material deactivated | None. Code snapshotted on the ledger row. | `ACTIVE`/`INACTIVE`/`DISCONTINUED` status. | **TESTED** |
| 23.47.11 | Contractor deactivated | None. ID and name snapshotted. | — | **TESTED** |
| 23.47.12 | Contractor renamed | None. Name snapshotted. | — | **TESTED** |
| 23.47.13 | Project renamed | None. Name snapshotted. | — | **TESTED** |
| 23.47.14 | Project closed | Production stays readable; closeout is its own record. | Sprint 22 closeout app. | **TESTED** — `closeout.test.js` (44) |
| 23.47.15 | Project scope changed | Baseline never moves; changes are signed deltas. | Change order app; baseline `SETREADONLY` after DRAFT. | **TESTED** — `TEST-SCOPE-*` |
| 23.47.16 | Structure deactivated | None. ID and type snapshotted. | — | **TESTED** |
| 23.47.17 | Structure ID changed | None on history. | Structure ID locks once the structure exists in the field. | **TESTED** — `segment.test.js` |
| 23.47.18 | Fiber reel master changed | **Never recalculates history.** | Printed range snapshotted; `reel-integrity.sql` re-tests against the *current* range and flags affected records for review instead. | **TESTED (static)** — `TEST-RINT-*` |
| 23.47.19 | Choice list changed | None. Values snapshotted. | A device with a stale list can still hold a retired code — that raises a CRITICAL rather than being ignored. | **TESTED** |
| 23.47.20 | Data Event change control | Versioned header, change blocks, deploy verified against the repo. | `TEST-VER-002` fails the build if the declared version drifts from the newest change block. | **TESTED** |
| 23.47.21 | Data Event regression test | 895 assertions load the **shipped** script. | `tests/harness.js` — no suite may re-type the code it tests. | **TESTED** |
| 23.47.22 | No mass recalculation by default | **Honoured.** No script or migration has ever rewritten a historical record. | Derived values recompute only when that record is next saved. | **TESTED (static)** |
| 23.47.23 | Controlled recalculation | No mechanism exists, deliberately. | Any migration would be a documented, reconciled, approved exercise. | **N/A — none performed** |
| 23.47.24 | Approved record protection | Quantity, labor code and rate go read-only once APPROVED or REJECTED. | `applyWorkflowState` + `SETREADONLY`. | **PARTIAL** — see gap 1 |
| 23.47.25 | Approved record change workflow | APPROVED → CORRECTION REQUIRED clears the approval stamp and demands detail. | `TEST-GATE-*`; audit trail reports `CHANGED AFTER APPROVAL`. | **TESTED** |
| 23.47.26 | Reversal / adjustment model | Material ledger supports signed adjustments. Production does not. | Negative production quantity is CRITICAL and cannot be approved. | **PARTIAL** — see gap 2 |
| 23.47.27 | Delete control | Not enforceable from Data Events. | `VOID` status provided and excluded from every report. | **BLOCKED** — Fulcrum permissions |
| 23.47.28 | Soft delete / VOID | VOID excluded from all 24 reports. | Convention 1. | **TESTED (static)** — but see gap 3 |
| 23.47.29 | Referential integrity | Snapshots mean a broken link never breaks a figure. | `reel-integrity.sql` `UNKNOWN REEL`; `exception-dashboard.sql` missing project/contractor. | **TESTED (static)** |
| 23.47.30 | Orphan record detection | Missing Project / Missing Contractor / Unknown Reel findings. | `exception-dashboard.sql`, `reel-integrity.sql`. | **TESTED (static)** |
| 23.47.31 | Master data dependency review | `docs/fulcrum-inventory.md` lists every object and where its definition lives. | — | **TESTED** |
| 23.47.32 | Immutable identifier standard | `production_id` set once, never regenerated; `closeout_id` likewise. | `TEST-23.27-1..3`, `TEST-CLO-040/041`. | **TESTED** |
| 23.47.33 | Master data administration controls | Not enforceable from Data Events. | Fulcrum role permissions. | **BLOCKED** |
| 23.47.34 | Change impact report | — | `production-audit-trail.sql` `rate_drift` / `rate_provenance` answers it for rates. | **PARTIAL** — rates only |
| 23.47.35 | Test matrix | This document. | — | **DONE** |
| 23.47.36 | Acceptance criteria | Below. | — | **DONE** |

## Acceptance criteria (23.47.36) — assessed

| Criterion | Verdict |
|---|---|
| Historical financial records survive master-data change | **MET.** Physical snapshots, verified by test, and the audit trail explains any divergence. |
| No silent mass recalculation | **MET.** No such mechanism exists. |
| Approved production cannot be silently edited | **MET in the app; see gap 1.** |
| Deletion is controlled | **NOT MET — Fulcrum limitation.** VOID exists and is honoured by every report, but nothing stops a user with delete permission from removing a record outright. |
| Every destructive change has a detection path | **MET for rates, reels, structures, projects and contractors.** Not for material mapping, which has no records. |

## Three honest gaps

**1. `SETREADONLY` is a UI control, not a permission.** Quantity, labor code
and rate lock once a record is APPROVED, which stops a field user editing them
in the app. It does **not** stop the Records API, a CSV import, or a user
changing the status back to DRAFT first. The compensating control is detection,
not prevention: `production-audit-trail.sql` reports `CHANGED AFTER APPROVAL`
for any record whose `_updated_at` is later than its `approved_date`. A true
lock needs Fulcrum role permissions, which are outside Data Events.

**2. There is no production adjustment transaction.** 23.47.26 asks whether
corrections to billed production should be adjustments rather than edits. The
material ledger works that way; production does not. Today a 1,000 FT record
corrected to 900 FT is edited, which loses the original claim. Implementing the
adjustment model means a transaction-type field on production and a report
change to net them. **Open item 29 — a business decision, not a defect.**

**3. VOID is excluded but not attributed.** Every report drops VOID records, but
the app records no void reason, voided-by or void date, which 23.47.28 asks for.
**Open item 30.**
