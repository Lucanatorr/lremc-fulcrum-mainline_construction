# Fulcrum Administrator Training — Mainline Construction

Sprint 25. For whoever maintains the apps, the master data and the scripts.
About two hours. Read `docs/operations-guide.md` Part 1 first: it holds the
golden rules, the deploy steps and the API gotchas. This guide does not repeat
them.

---

## 1. App structure

Thirteen Development apps. The IDs are what reports address. Report SQL never
uses app names.

| Layer | App | ID (prefix) | Data Event |
|---|---|---|---|
| Transactions | **Mainline Construction** | `06c36c8e` | v7.6.0 |
| | MC Material Transaction (ledger) | `ee204906` | v1.1.0 |
| | MC Change Order | `458ae172` | v1.1.0 |
| Masters | MC Project Master | `5ce243d4` | — |
| | MC Contractor Master | `d8a368b5` | — |
| | MC Contractor Rate | `a5529dd0` | v1.1.0 |
| | MC Material Master | `658143d1` | — |
| | MC Labor-Material Mapping | `38e3d7fd` | v1.0.0 |
| | MC Fiber Reel | `728477da` | v2.0.0 |
| | MC Structure | `397b52cf` | v1.1.0 |
| | MC Segment | `7da87588` | v1.0.0 |
| Plan and close | MC Project Scope Line | `aa1d8c1e` | v1.1.0 |
| | MC Project Closeout | `351bb1f1` | v1.0.0 |

Five MC choice lists: Labor Code (146), Work Category (11), Construction
Method (14), Unit of Measure (6) and QA Status (4). Full IDs and hashes are
in `fulcrum/baseline-2026-11-09.json`.

**How they connect.** Production *links* to a project, a contractor, a rate, a
reel and two structures. On selection, `record_defaults` **copies** the
fields it needs onto the production record (the snapshots). A link is
navigation; a snapshot is history. Reports read snapshots, so a later change
to a master never rewrites the past.

## 2. Field keys

- Every element has a **key** (`m023`, `r010`…) and a **data_name**
  (`quantity`, `unit`…). Reports and scripts use data_names; the API uses keys.
- **A key is never reused or renamed.** Removing a field and re-adding it
  under the same key with a different meaning makes old data mean something new.
- **A field's type cannot change.** A new type means a new key, and the old
  field is hidden, not removed, while it holds data.
- The prefix identifies the app: `m` Mainline, `r` Rate, `s` Scope Line, `g`
  Mapping, `f` Reel, `z` Segment. Keep that convention when you add a field.

## 3. Data Events

Ten scripts, inventoried in `docs/data-event-inventory.md`. Three rules govern
all of them:

1. **No script makes a network call or reads another record.** Every
   cross-record check is a report. That is why every script works offline.
2. **The runtime exposes no choice labels** and no reliable user role or
   email. A script that parses a label silently does nothing. That cost two
   defects (D-015).
3. **A date-only field arrives as UTC midnight.** Always parse it with
   `parseDate()`, which re-anchors on UTC components (D-017).

`calc_version` on each production record names the script version that last
calculated it (D-019). Use it to find the records a defect touched.

## 4. Master data maintenance

| Master | How it changes | Never |
|---|---|---|
| Rate | New record with a new effective date; expire the old one | Edit a rate in place; set 0.00 |
| Labor code | Choice-list entry plus a rate plus a mapping decision (governance §3) | Delete a code that production uses; retire it instead (`RETIRED_LABOR_CODES`) |
| Mapping | Edit the multiplier, or add a row; APPROVED only on evidence | Guess a multiplier (D-014) |
| Material | Add stock items | Change a part number in place |
| Structure / Segment | Field-created; normalized on save | Rename an ID once structures reference it |

## 5. Setting up a project

1. **MC Project Master**: create the project, with planned fiber,
   underground and aerial footage and planned splices. Status ACTIVE.
2. **MC Project Scope Line**: one line per pay unit the project will use,
   with the original planned quantity and the budget rate. Move each line to
   **BASELINED**. From then on its quantity is locked; changes go through a
   change order.
3. Check `project-summary`: the project must no longer say
   `NO BASELINE - scope not set`.
4. Check `remaining-work`: every line should read `NOT STARTED`.
5. Check that every pay unit on the scope has an active rate for the
   contractor, and an APPROVED mapping or a documented "no material".
   `exception-dashboard` will flag either one missing once production arrives.
   It is cheaper to find it now.

## 6. Permissions

Read `docs/sprint-24-deployment-readiness.md` §2 before changing a role. As
configured today:

- The **Contractor** role can change status, so it can **approve** (P-1).
- There are six **Owners**, and every one can delete (P-2). Delete is the
  only way to lose a record permanently, so keep it to one or two people.
- The **Inspector** role cannot submit or edit (P-3).

Roles are account-wide. A change affects the production app and every other
app on the account. Test a role change in a scratch membership first.

## 7. Exceptions

Two layers, by design:

| Layer | Where | Sees | Works offline |
|---|---|---|---|
| Record exceptions | `exception_flags` / `exception_severity`, set by the script on every save | This record only | Yes |
| Cross-record exceptions | `exception-dashboard` and its source reports | Duplicates, overlaps, over-plan, aged pending | No — after sync |

Only CRITICAL blocks approval (D-011). Review `exception-dashboard` daily
(governance §5).

## 8. Deployments

The toolchain is set out in `.mcp.json`: the **direct `fulcrum-app` MCP
server**, authenticated by the `FULCRUM_API_BEARER` environment variable. The
claude.ai Fulcrum connector refused every `forms_update` (OI-02); the direct
server does not.

Order of operations for a change that adds fields **and** changes the script:
**elements first, then the script**, so the new script never runs against a
form without the fields it sets. Read back after each step. The rollback
targets for every app, including the versions that must **never** be
redeployed, are in `docs/backout-recovery-procedure.md` §2.

**Drift check (weekly).** Read every app and compare its script and
elements hashes with `fulcrum/baseline-2026-11-09.json`. Any difference
without a matching commit is an edit made in the app designer, and it will be
overwritten by the next deploy. Golden rule 3.

## 9. Tests

```bash
for f in tests/*.test.js; do node "$f" || echo "FAILED: $f"; done
```

Over 900 assertions in 19 suites, every one against the **shipped** script
via `tests/harness.js`, never a copy. Timezone-sensitive suites run under
several `TZ` values. Run the whole suite before every deploy. A deploy with
a red test is not a deploy.

The report tests check structure: table addressing, `_status`, casts, the
status lists. They **cannot** tell you the Query engine will accept a
statement. `production-trend` passed every test and was still refused live.
**Run a changed report once against live data before you call it done.**

## 10. Exercises

1. Find the rollback target for MC Change Order, and explain why you would rather fix forward.
2. Baseline a scope line for the test project, then raise a +100 change order and approve it. Confirm `project-scope-status` moves.
3. Add a rate for a repriced pay unit. Expire the old one. Confirm existing production keeps its rate.
4. Run the drift check against the baseline file.
