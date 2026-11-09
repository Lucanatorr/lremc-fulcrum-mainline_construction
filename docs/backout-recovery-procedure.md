# Backout and Recovery Procedure

Readiness item 13 (Sprint 23.76) and Sprint 24. Written 2026-11-09.
**Documented, not yet rehearsed:** §5 is the rehearsal, and it has not been run.

This system has one property that makes recovery tractable, and the procedure
leans on it:

> **No total is stored anywhere (D-012).** Every quantity, value, balance and
> percentage is computed by a report from atomic records. Rolling back a
> script or a report therefore never leaves a stale total behind. Recovery is
> about **records and their derived fields**, never about rebuilding
> aggregates.

---

## 1. When to back out

| Trigger | Severity | Response |
|---|---|---|
| A deployed script blocks saving in the field (INVALID on clean records, JS error) | **Immediate** | Level 1 script rollback, within the hour |
| Wrong money: a derived value, rate or quantity is calculated wrong on new records | **Immediate** | Level 1 rollback, then Level 3 to repair the affected records |
| A schema change hides, breaks or mis-defaults a field | High | Level 2 |
| A report returns wrong figures | Medium | Level 4 (reports are read-only, so no data is at risk) |
| Approved production changed without an explanation | High | Level 3 investigation; do not roll anything back until it is understood |
| The system as a whole is unfit (pilot stop condition) | — | Level 5 |

**Who decides.** The Technical / Data Event Owner can perform a Level 1 or
Level 4 rollback alone, and tells the Business Owner the same day. Levels 2, 3
and 5 need the Business Owner first.

---

## 2. What can be rolled back to what

Every live script and schema is in git, and `fulcrum/baseline-2026-11-09.json`
records the hash of what was live on that date.

| App | Live | Roll back to | Commit holding the rollback target | Caveat |
|---|---|---|---|---|
| Mainline Construction | v7.6.0 | v7.5.0 | `0933a86` | v7.5.0 does not know REOPENED / REVERSED / Adjustment. Records already in those states keep them, but v7.5.0 treats them as unknown statuses. Their fields stay on the form (additive), unused. |
| MC Contractor Rate | v1.1.0 | **do not** | `2c363e4` is v1.0.0 | **v1.0.0 clears unit and description on every save.** Never redeploy it. Fix forward. |
| MC Project Scope Line | v1.1.0 | v1.0.0 | `964460a` | v1.0.0 can erase the unit; prefer fixing forward |
| MC Change Order | v1.1.0 | v1.0.0 | `964460a` | as above |
| MC Material Transaction | v1.1.0 | v1.0.0 | `46ab591` | v1.0.0 has the timezone date shift |
| MC Structure | v1.1.0 | v1.0.0 | `403af3f` | v1.0.0 has the timezone date shift |
| MC Fiber Reel | v2.0.0 | **none in the repo** | — | v1.0.0 predates the file's first commit, and it stored totals, which D-012 removed. Fix forward |
| MC Segment / Closeout / Mapping | v1.0.0 | — | — | first versions; roll back by disabling the handler, not by an older script |

**General rule: fix forward wherever the previous version has a known
defect.** Several "previous versions" here are exactly the defect a later
version fixed. Rolling back reintroduces it.

---

## 3. The five levels

### Level 1 — script rollback (minutes)

1. `git show <commit>:fulcrum/data-events/<app>.js > /tmp/rollback.js`
2. Read the live form with `forms_get` and keep the full JSON as the pre-rollback state.
3. Call `forms_update` with the **same elements**, and with `script` set to the rollback file.
4. Read it back and compare: the script must match the rollback file byte for byte.
5. Record the rollback in `docs/data-event-inventory.md` and `docs/implementation-log.md`.

A script change affects **only records saved afterwards**. Records already
saved keep the values the old script derived. That is why Level 3 follows
whenever the defect was in a derivation.

**Offline devices.** A device that has not synced keeps running the script it
last downloaded until it next syncs. Tell field users to sync. Expect records
derived by the old script to arrive for as long as offline devices are out.
Those records carry `calc_version` (D-019), so they can be identified.

### Level 2 — schema rollback (minutes, with care)

- **Never remove a field that holds data.** Removing an element in Fulcrum
  drops it from the form, and the column it fed disappears from the Query API.
  Hide it (`hidden: true`) instead.
- Adding fields back is safe. Re-adding a removed **key** with the same
  `data_name` restores the column.
- Status values: never remove one that records currently hold. Records keep
  the value, but it no longer appears in the status picker.
- Deploy elements and script in the order that never lets a script run against
  a form missing a field it sets: **elements first when fields are added,
  script first when they are removed.**
- Validate with `forms_validate` first. The live element `m053` has
  `allow_other: null`, which the validator rejects. Set it to `false` in the
  payload (OI-18).

### Level 3 — record repair (hours; needs the Business Owner)

The rules that apply to every repair:

1. **Never delete production.** Correct it through the lifecycle (D-018).
   - Never approved, and wrong → **VOID**.
   - Approved, and wrong in full → **REVERSED**, with a reason. The approval
     stamp stays as evidence.
   - Approved, and wrong by an amount → an **Adjustment** record naming the
     original Production ID. It carries a negative quantity if it takes
     work back.
   - Approved, and needing re-review → **REOPENED**, with a reason. This
     clears the approval.
2. **Find the affected set by `calc_version`.** For example, every record
   last calculated by the bad version:
   `SELECT production_id FROM "06c36c8e-…" WHERE calc_version = 'DE-7.x.y'`.
3. **Re-derive by re-saving.** Derived fields are recalculated on every
   save, so opening and saving a record under the fixed script repairs it. For
   many records, a bulk edit that touches any field causes a save.
   **API and CSV imports run no Data Events**, so an API re-save does **not**
   re-derive anything.
4. Never re-price approved production from the master. The rate snapshot is
   the historical truth (D-003). If the rate itself was wrong, that is an
   Adjustment, not an edit.
5. Run `production-audit-trail.sql` for the affected IDs, and keep the output
   with the incident record.

### Level 4 — report rollback (minutes, no data risk)

Reports are SQL files in `reports/`. A report saved in Fulcrum is replaced by
pasting the previous version from `git show <commit>:reports/<name>.sql`.
Before pasting, run `node tests/reporting.test.js` against that version.

### Level 5 — stop using the system (pilot stop condition)

1. The Business Owner announces the stop and the date from which field
   entry returns to the previous process.
2. Field users stop creating Mainline records. Records already entered stay
   where they are. **Nothing is deleted**, because they are the evidence for
   whatever is billed.
3. Export every Development app's records to CSV (`docs/sprint-26-governance.md` §6), and keep the export with the incident.
4. Unbilled production in this system is billed from the export, or
   re-entered in the previous system. Decide which before anything is billed
   twice. `contractor-financial.sql` shows what is approved and unbilled.
5. Leave the apps in place, read-only for everyone except the
   administrator, until billing for the stopped period is closed.

---

## 4. Recovery: what Fulcrum keeps

| Need | Source |
|---|---|
| An earlier version of a record | Fulcrum record history (`_version`; each version is retained). `production-audit-trail.sql` shows `record_version` and `last_changed_at` |
| An earlier version of a form or script | `forms_history`, and this repo |
| Who changed an app | `audit_logs_list` |
| A deleted record | **Not recoverable from the app.** Only from an export taken before the delete. That is why delete permission must stay narrow (Sprint 24 finding P-2), and why §6 of governance requires a scheduled export |

---

## 5. Rehearsal (to run once in Development before the pilot)

Not run yet. It needs records to be created, which this toolchain cannot do
(see limitation L4), and a person with the app open.

1. Note the current Mainline script hash from `fulcrum/baseline-2026-11-09.json`.
2. Create one record, save it, and note `calc_version` = `DE-7.6.0`.
3. Level 1: roll the script back to v7.5.0 (`0933a86`). Read back and compare.
4. Edit the record and save it. Confirm `calc_version` is unchanged: v7.5.0 does not set it. The field is left as it was, which demonstrates that a rollback does not erase what a later version wrote.
5. Roll forward to v7.6.0 (`6b2a9a3`). Read back and compare against the baseline hash.
6. Level 3 drill: approve the record, then REVERSE it with a reason. Confirm
   it drops out of `production-daily` and appears in `voided-reversed`.
7. Record the elapsed time for steps 3 to 5, and anything that surprised you, in
   `docs/implementation-log.md`. The step that takes longest is the one to
   script before the pilot.
