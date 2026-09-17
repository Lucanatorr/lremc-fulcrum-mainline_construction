# Sprint 9 — Project Scope, Budget, Remaining Work and Change Orders

Two new apps, two new reports, one correction to an existing report.

| Object | ID |
|---|---|
| MC Project Scope Line - Development | `aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b` |
| MC Change Order - Development | `458ae172-b7b4-43b5-8917-d7a792c9e81a` |

Both created with `forms_create`, which still works while `forms_update` is
down — see the outage note in `docs/fulcrum-inventory.md`.

---

## The central decision: the baseline is a record, the arithmetic is a report

Sprint 9 asks for Completed, Remaining, Percent Complete, Over/Under Plan and
three value figures. None of those can live on the scope line record.

Each is an aggregate over **every** production record for a project and pay
unit. A Fulcrum device can reach other records only through `REQUEST`, which is
online-only — the same constraint that pushed sequential-overlap detection into
a server-side report in Sprint 4. Worse, a stored `completed_quantity` would be
wrong the instant the next production record synced, and the brief is explicit
on both counts:

> "Remaining work must NOT be manually maintained."
> "Do not use status alone as the authoritative measurement. The underlying
> quantities remain authoritative."

So the split is:

| Lives on the record | Lives in the report |
|---|---|
| Original Planned Quantity (the baseline) | Completed, Remaining, Percent Complete |
| Budget Rate snapshot, Original Budget Value | Current Authorized Scope |
| Change order lines and their approval state | Approved vs pending split |
| | Scope Status, Over Plan quantity |

`reports/project-scope-status.sql` is the deliverable that computes all of it.

---

## MC Project Scope Line

One record per Project + Labor Code. `Scope Line ID` derives as
`SCOPE-{project}-{labor code}` — a natural key, so two lines budgeting the same
pay unit are visible rather than quietly double-counting.

### The baseline is enforced, not just requested

> "Do not overwrite the original baseline."

A comment in a field description would not have achieved that. The Data Event
uses `SETREADONLY` on `load-record`, `edit-record` and `change-status`:

```javascript
function applyBaselineLock() {
  var locked = isBaselined();                 // BASELINED or CLOSED
  SETREADONLY('original_planned_quantity', locked);
  SETREADONLY('rate_link', locked);
  SETDESCRIPTION('original_planned_quantity', locked
    ? 'LOCKED. This line is baselined. Raise a change order ...'
    : 'THE BASELINE. Editable while this line is DRAFT ...');
}
```

While the line is `DRAFT` the budget is being built and the quantity is
editable. From `BASELINED` onwards it is read-only and the help text changes to
say why and what to do instead. `Baseline Set Date` and `Baseline Set By` are
stamped on the transition, so there is a record of when the number became fixed.

The budget rate is locked at the same moment. A budget whose rate could still
move would not be a baseline either.

Only `BASELINED` and `CLOSED` lines are scope as far as the report is concerned
(`TEST-SQL-011`). A `DRAFT` line is someone's working draft, not a commitment.

### Budget rate is snapshotted, like every other price in this system

`Budget Rate Source` is a RecordLink to the rate master and copies down the
rate, its record ID, its labor code and its project scoping. Repricing the rate
master later cannot restate a budget that was already approved — the same
discipline production transactions use.

That copy-down also makes two checks possible offline, both **CRITICAL**:

- the rate prices a different labor code than the scope line budgets
- the rate is specific to a different project

A budget priced off the wrong pay unit is the scope-side equivalent of a
mispriced production record, so it carries the same severity.

### One blocking rule

A negative planned quantity is rejected outright:

```javascript
INVALID('Planned quantity cannot be negative. To reduce scope, raise a ' +
        'change order with a negative quantity change.');
```

A negative baseline would make `Original + Approved Changes = Authorized`
meaningless. Reducing scope is a change order, which is exactly what the message
says.

---

## MC Change Order

Header plus a repeatable line per affected labor code — the brief lists
"Associated Labor Codes" and "Quantity Changes" in the plural, and a change
order is approved as one document, so the lines have no independent lifecycle.

### Lines are signed deltas, never revised totals

`Quantity Change` is `+2000` or `-500`, never "the revised quantity is 12,000".
A delta can be replayed against the baseline to reconstruct the scope at any
date; an absolute figure throws that history away and leaves the baseline and
the current figure unreconcilable.

`Change Order Value` is `REPEATABLESUM` over the lines, not typed:

```
ROUND(REPEATABLESUM($quantity_changes,
      COALESCE(NUM($line_quantity_change),0) * COALESCE(NUM($line_rate),0)), 2)
```

A hand-entered total is the first thing to drift out of step with the detail it
claims to summarise.

### Approval moves the scope, and nothing else does

Statuses are Draft, Submitted, Approved, Rejected, Cancelled. `Date Approved`
and `Approved By` are stamped on approval, and **cleared** on rejection or
cancellation — that stamp is what the report reads to decide the order moved the
scope, so a rejected order must not keep one.

Once Approved (or Rejected/Cancelled) the lines, the project link and the change
order number go read-only. An approved change order is a contract document;
editing its lines afterwards would silently restate the authorized scope. A
superseding change order is the way to correct one.

`Date Approved` is also what makes the authorized scope reconstructable **as at
a past date**, which is what an auditor asks for.

### Blocking rules

- an approved order with no lines → `INVALID`. It would move the authorized
  scope by an undefined amount.
- rejected or cancelled with no reason → `INVALID`, and the field is made
  required by `SETREQUIRED`. A dead change order with no stated reason is
  unauditable.
- a zero quantity change on a line → `INVALID`. That is not a change.
- a negative rate → `INVALID`, with the fix named: make the *quantity*
  negative and leave the rate positive.

---

## reports/project-scope-status.sql

Per Project + Labor Code, with the baseline shown next to the authorized figure
so `Original + Approved Changes = Current Authorized` is checkable by eye.

The four rules the brief tests for, and where each is enforced:

| Rule | Enforcement |
|---|---|
| Completed counts **approved** production only (23.19) | `SUM(CASE WHEN _status = 'APPROVED' ...)`, with pending summed into its own column |
| Only **approved** change orders move authorized scope (23.21) | `WHERE co._status = 'APPROVED'` on the join to the parent — the line table carries no status of its own |
| Remaining is **never clamped** (23.20) | plain `authorized_quantity - completed_quantity`; `TEST-SQL-007` asserts no `GREATEST` wrapper was ever added |
| Percent complete **guards division by zero** (0.11) | `CASE WHEN authorized_quantity = 0 THEN NULL` — null, not an error and not a fake 0% |

Pending change orders get their own columns too, so a reviewer can see what
*would* happen on approval without that touching any authorized number.
Rejected and Cancelled appear in neither: they are dead, and showing them as
"coming soon" would mislead.

Scope Status derives `NOT STARTED` / `IN PROGRESS` / `COMPLETE` / `OVER PLAN`,
plus `NO AUTHORIZED SCOPE` for a line a descope emptied. It is for scanning a
list; the quantities beside it stay authoritative.

## reports/unplanned-production.sql

Production booked against a Project + Labor Code with **no baselined scope
line**.

This one is not in the brief, and it matters because the scope report is driven
*from* the scope lines — so unplanned work is invisible there by construction.
It would never appear in any percent-complete figure and nobody would notice.
Every row is either a missing scope line or a missing change order. Rows with
value already booked are CRITICAL; quantity-only rows are WARNING.

It is the scope-side counterpart of the billing gaps the material data turned up
last sprint, and it exists for the same reason: work that no budget anticipated
is exactly what a scope system is for.

---

## A bug this sprint exposed in an existing report

Inspecting the Query API's real table definitions for the new apps showed two
things the Sprint 4 overlap report got wrong:

- tables are named by **form ID**, not by form name
- the record status column is **`_status`**, not `status`

`reports/sequential-overlap.sql` used `FROM "Mainline Construction - Development"`
and `WHERE status <> 'VOID'`. **It would not have run.** Corrected, with the
form-ID-to-name mapping in a header comment so the SQL stays readable, and
`TEST-SQL-030` / `TEST-SQL-031` now guard both mistakes.

Worth noting how it survived: that report was never executed, only written and
reviewed. The new tests check the *text* of the SQL for each rule it must
encode, which is a weak proxy for running it but strong enough to have caught
this.

---

## Tests

`tests/project-scope.test.js` — **68 passing**. **252 across seven suites.**

The scope arithmetic ships as SQL, which cannot be executed here. So the rules
are modelled once in JavaScript, exercised against the brief's own test cases,
and then a second block asserts the shipped SQL still contains every guard the
model assumes. If the two drift, a test fails rather than a number quietly going
wrong.

| Test case | Covered by |
|---|---|
| 23.18 — 10,000 planned, 2,500 approved → 2,500 / 7,500 / 25% | `TEST-SCOPE-001..006` |
| 23.19 — pending stays out of completed and shows separately | `TEST-SCOPE-010..018` |
| 23.20 — 10,500 against 10,000 → −500 and OVER PLAN, unclamped | `TEST-SCOPE-020..028` |
| 23.21 — +2,000 approved → 12,000; pending and rejected excluded; baseline preserved | `TEST-CO-001..035` |
| 0.11 — division by zero guarded | `TEST-SCOPE-040..043`, `TEST-CO-033..035` |
| SQL keeps each rule the model assumes | `TEST-SQL-001..031` |

Cases worth calling out beyond the brief's list:

- `TEST-SCOPE-017/018` — REJECTED and VOID production count as neither
  completed nor pending. They are not work.
- `TEST-CO-030..032` — several approved orders accumulate while a submitted and
  a rejected one in the same set change nothing.
- `TEST-CO-033..035` — a descope that removes all the scope leaves authorized at
  zero, percent complete `null` rather than a division error, and status
  `NO AUTHORIZED SCOPE`.
- `TEST-SCOPE-041..043` — production against zero authorized scope is OVER PLAN
  by its whole quantity, and percent complete stays `null` rather than infinite.

---

## Open for the business

- **Budget rates are assumed to be contract rates.** The scope line prices its
  budget from the contractor rate master. If LREMC budgets at an internal rate
  that differs from the contractor's, that is a separate master and a change
  here.
- **Change order line rates are typed, not linked.** A RecordLink inside a
  repeatable was not attempted, so the line rate is entered from the rate sheet
  rather than snapshotted from it. The approved order keeps the price it was
  approved at either way, but there is no automatic check that the typed rate
  matches the rate sheet. A candidate for the next pass.
- **Change order numbers are not enforced unique.** Fulcrum cannot check
  uniqueness across records offline. The separate system-assigned
  `Change Order Record ID` makes a double entry detectable in reporting.
