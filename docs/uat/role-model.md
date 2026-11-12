# Recommended Role Model and Permission Test Matrix

Sprint 24 gate 7 (permissions). The prompt asks for a role model *"using actual
Fulcrum capabilities"* and documented platform limits. Fulcrum roles have
exactly **15 account-wide switches**. These were read live on 2026-11-09:

`can_create_records` · `can_update_records` · `can_change_status` ·
`can_delete_records` · `can_export_records` · `can_run_reports` ·
`can_manage_apps` · `can_manage_choice_lists` · `can_manage_classification_sets` ·
`can_manage_layers` · `can_manage_projects` · `can_manage_members` ·
`can_manage_roles` · `can_manage_subscription` · `can_update_organization`

## Platform limits that shape the model

1. **Roles are account-wide.** A role cannot be limited to one app, so the
   *Rate Administrator* holds the same switches in every app on the account.
2. **Status permission is all-or-nothing.** `can_change_status` lets a user
   set **any** status, APPROVED included. Fulcrum has no "may submit but not
   approve" switch.
3. **The Data Events runtime exposes no role.** A script cannot ask "is this
   user a reviewer?". It can ask who the user is (`USERFULLNAME`), and v7.7.0
   uses that to refuse self-approval.
4. **Delete is permanent.** There is no recycle bin. Delete is the only way to
   lose a record that the lifecycle (VOID / REVERSED / Adjustment) cannot undo.

So segregation of duties is enforced in three layers: the **role** (who can
change status at all), the **script** (nobody approves their own record:
v7.7.0) and the **audit** (`approval_independence` in
`production-audit-trail`, reviewed weekly).

## Recommended roles

| Role | create | update | status | delete | export | reports | manage apps / lists / projects | members / roles / org |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **Owner** (1 person, plus 1 backup) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ |
| **Admin** (Fulcrum Administrator) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | members only |
| **Reviewer** (new: PM, CM, contract admin) | ✔ | ✔ | ✔ | — | ✔ | ✔ | — | — |
| **Field Inspector** (replaces *Inspector*) | ✔ | ✔ | ✔ | — | — | ✔ | — | — |
| **Contractor** | ✔ | ✔ | **—** | — | — | ✔ | — | — |
| **Finance Viewer** (new) | — | — | — | — | ✔ | ✔ | — | — |

Why each line differs from today:

- **Owner: 6 → 1 + backup (P-2).** Every Owner can delete and can change the
  subscription.
- **Field Inspector gains update and status (P-3).** Without them an inspector
  cannot submit or correct a record. They can technically approve as well
  (limit 2), but not their own work (v7.7.0), and the weekly audit shows who
  approved what.
- **Contractor loses `can_change_status` (P-1).** A contractor enters and
  corrects production; it stays DRAFT until an LREMC person submits it on
  review. If the business wants contractors to submit, keep the switch: v7.7.0
  still stops self-approval, and the residual risk (contractor A approving
  contractor B) is reported weekly. **This is the business decision OI-22
  asks for.**
- **Contractor gains `can_run_reports` (P-4)** only if contractors should see
  their own production before billing. Fulcrum reports are not filtered per
  contractor, so they would see every contractor's. Default: no.

## How to apply it (Fulcrum web, an Owner)

Settings → Roles → *role* → tick or untick the switches above → Save. Then
Settings → Members → assign each person their role. Change Contractor last:
the moment it loses `can_change_status`, contractors cannot move records out of
DRAFT, so the Reviewer role must already be assigned.

None of this can be done from the toolchain: the Fulcrum MCP server can list
roles but has no tool to change them.

## Permission test matrix (gate 7: run with one real user per role)

Each cell is the **expected** result. Record the actual result and the date.
A mismatch is a defect: log it in `uat-feedback-register.csv` as BUG with
severity HIGH.

| # | Action | Owner | Admin | Reviewer | Field Inspector | Contractor | Finance Viewer | Actual |
|---|---|---|---|---|---|---|---|---|
| PERM-01 | View production records | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | |
| PERM-02 | Create a production record | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ | |
| PERM-03 | Edit a DRAFT record | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ | |
| PERM-04 | Move DRAFT → SUBMITTED | ✔ | ✔ | ✔ | ✔ | **✘** | ✘ | |
| PERM-05 | Approve **someone else's** clean record | ✔ | ✔ | ✔ | ✔ (limit 2) | ✘ | ✘ | |
| PERM-06 | Approve **own** record | ✘ v7.7.0 | ✘ v7.7.0 | ✘ v7.7.0 | ✘ v7.7.0 | ✘ | ✘ | |
| PERM-07 | Edit quantity on an APPROVED record | ✘ locked | ✘ locked | ✘ locked | ✘ locked | ✘ | ✘ | |
| PERM-08 | VOID a record | ✔ | ✔ | ✔ | ✔ | ✘ | ✘ | |
| PERM-09 | REVERSE an approved record (reason required) | ✔ | ✔ | ✔ | ✔ | ✘ | ✘ | |
| PERM-10 | **Delete** a record | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | |
| PERM-11 | Export records | ✔ | ✔ | ✔ | ✘ | ✘ | ✔ | |
| PERM-12 | Run reports | ✔ | ✔ | ✔ | ✔ | ✘ | ✔ | |
| PERM-13 | Edit the app / its Data Events | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | |
| PERM-14 | Edit a choice list (labor codes) | ✔ | ✔ | ✘ | ✘ | ✘ | ✘ | |
| PERM-15 | Manage members / roles | ✔ | members | ✘ | ✘ | ✘ | ✘ | |

PERM-06 is the one test that has already passed: in the test harness
(`TEST-SOD-001..007`). It still needs running once in the app, with two real
accounts.
