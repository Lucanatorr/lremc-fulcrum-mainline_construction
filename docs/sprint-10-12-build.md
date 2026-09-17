# Sprints 10, 11 & 12 — Reporting, Financials, QA/QC and Approval

Ten new reports, one app version, one shared conventions document.
**418 tests pass across nine suites.**

| Sprint | Deliverable |
|---|---|
| 10 | `production-daily.sql`, `production-weekly.sql`, `production-monthly.sql`, `production-trend.sql` |
| 11 | `project-financial.sql`, `contractor-financial.sql`, `rate-audit.sql` |
| 12 | Data Events **v6.0.0** (approval gate + correction tracking), `qa-review-queue.sql`, `duplicate-production.sql`, `material-variance.sql` |

`reports/_conventions.md` holds the four rules every report obeys, and
`tests/reporting.test.js` asserts each file against them.

---

## Four rules that decide what a number means

Written down once because each of them is a way a report can look authoritative
and be wrong.

### 1. Approved production is the only official production
Completed quantity, financial completion, earned value, remaining scope and
billing all count **APPROVED** only. Pending appears in its own column and is
never folded in. A single "Production Value" column mixing the two is the most
common way a report overstates what a contractor has earned.

### 2. Quantities cannot be summed across units
A project's production is feet of conduit, each of handholes, splices, and hours
of flagging. `SUM(quantity)` across those produces a number that looks
authoritative and means nothing.

So quantity is aggregated **only within one labor code or one unit**, and
anything crossing pay units aggregates **value**. In the daily report the
per-day and grand-total rows suppress quantity entirely:

```sql
CASE WHEN GROUPING(labor_code) = 0 THEN SUM(quantity) END AS quantity
```

`TEST-UNIT-*` asserts the three cross-unit reports never sum raw quantity.
Footage is the one exception, summed on its own because every `FT` pay unit
shares a unit of measure.

### 3. Time-and-materials units are not physical production
`HR` and `EVENT` are billed for time, not work in the ground. They carry real
value but no production, so physical-production figures exclude them and value
figures include them. A contractor billing mostly hours is a different
conversation from one billing mostly footage, and the reports keep those apart.

### 4. The week is defined once, on the record
The production app derives `work_year`, `work_month`, `work_week` (ISO-8601,
Monday start) and `reporting_period` when the work date is set. **Reports read
those fields.** `TEST-WEEK-*` asserts no report computes a week from
`work_date` — a second definition of "week" in SQL is how two reports come to
disagree about the same Monday.

---

## Sprint 10 — Production reporting

### Daily
Transaction detail with per-day totals and a grand total, via `GROUPING SETS`
so the detail and the totals come from one query and cannot disagree. Filters
for project, contractor, crew, work category, labor code and a date range.

Value is split four ways — total, approved, pending, rejected — so no figure is
a subset a reader has to infer.

### Weekly, and the previous-week comparison
Grouped by project, contractor, week and labor code.

The prior-week comparison **deliberately does not use `LAG`**. A week with no
production has no row, so `LAG` would silently compare against whatever week
came before the gap and report a change that never happened. Instead a self-join
matches the actual preceding ISO week label, and a genuine gap reads as
`NO PRIOR WEEK` rather than a fabricated number:

```sql
LEFT JOIN weekly prev
  ON prev.project_id = w.project_id
 AND ...
 AND prev.work_week IN (  -- one step back, or week 52/53 across a year end
```

ISO years have 52 or 53 weeks, so both are tried and at most one exists.

### Monthly, and project-to-date
Grouped by project, contractor, month and labor code, with running totals as
window functions — the fourth period the brief asks for. The project-level
running total is **value only**, per rule 2.

### Trend
Daily, rolling 7-day, rolling 30-day, week, month and project-to-date.

The rolling windows use `RANGE ... INTERVAL '6' DAY`, not `ROWS`. A crew that
worked three days in a week would otherwise have its seven-day window stretched
back a fortnight, and the "7-day production" figure would cover whatever span
happened to hold seven rows.

**Average daily production divides by working days, Mon–Fri** (ruling
2026-09-16), counting only days that actually had production. Dividing a
five-day week's output by seven understates a crew's rate by 29% and makes every
target look missed. Weekend production is counted separately rather than
excluded, because it is real work.

---

## Sprint 11 — Financial reporting

### Two percent-complete measures, and why the pair matters

```
Financial % = approved production value / current contract value
              what has been earned at the rates actually applied
Physical  % = earned value at BUDGET rates / authorized value at budget rates
              how much of the planned work is in the ground
```

Same quantities, priced differently — so the **spread between them is the rate
variance**. Physical running ahead of financial means work is being done below
budget rate; financial ahead of physical means above. The report publishes the
gap as `financial_minus_physical_pts`, because a single blended "percent
complete" hides exactly the thing worth knowing.

Physical % is **value-weighted**, not an average of per-line percentages. A
plain mean would let a 40 EA handhole line count as much as an 80,000 FT fiber
line. Per-line earned value is also capped at the authorized quantity, so one
over-running line cannot push a project past 100% physical while other lines sit
untouched — the uncapped overage is reported separately as
`over_plan_value_at_budget_rates`.

`Original Contract Value` is the sum of baselined scope lines at budget rates;
`Current Contract Value` adds **approved** change orders only. Pending changes
appear in their own column and are never added in.

**Billed value is NULL.** No billing app exists yet. The column is present so
the report's shape does not change when billing arrives, and the header says so
outright rather than leaving a zero to be misread as "nothing billed".

### Contractor financials, and keeping contractors apart

> "Where multiple contractors work on the same project, keep production and
> pricing properly separated."

Every figure is keyed on the **snapshotted** contractor ID and priced from the
**snapshotted** rate on each record. So a contractor's earned value comes from
the rates those records were actually priced at — not from whatever the rate
master says today, and never from another contractor's rates on the same
project.

The report then checks that this held: `wrong_contractor_rate_records` counts
records whose snapshotted rate belongs to a *different* contractor, and
`wrong_contractor_rate_value` prices the exposure. That is the specific failure
the snapshotting exists to prevent, so it is surfaced next to the money rather
than left for someone to go looking for.

Rejection rate is reported **by value**, not by count: one rejected 5,000 FT
record matters more than ten rejected handholes.

### Rate audit

Thirteen findings, ordered by severity so the first match is the one worth
acting on. Eleven are CRITICAL — unpriced, zero, negative, missing rate record,
wrong pay unit, wrong contractor, wrong project, expired, not yet in force. Two
are WARNING:

- **AMBIGUOUS RATE** — the rate master holds more than one active rate for that
  contractor and pay unit. Whichever one a user picked, the price was a coin
  toss. Needs a scan of the master, so a device cannot find it.
- **DRIFTED FROM SOURCE** — the snapshot no longer matches the rate record.
  This is WARNING rather than CRITICAL **on purpose**: the most likely cause is
  a legitimate reprice after the production was saved, in which case the
  snapshot is correct and the master is right too. The other cause is a value
  written by an import or API call bypassing the record link. The report cannot
  tell them apart, so it says both and points at the rate record's history
  rather than accusing anyone of an override.

Each row carries `value_difference` — what the record would be worth at the
current rate — so the exposure is quantified per record, not just flagged.

---

## Sprint 12 — QA/QC and the approval workflow

### The gate

Data Events **v6.0.0** refuses to set a record to APPROVED when:

1. it carries a **CRITICAL** exception,
2. QA status is **Fail**,
3. QA status is **Not Reviewed or blank**.

Everything else — warnings, info flags — never blocks anything.

> "Do not automatically reject records solely because of a warning unless there
> is a clear business rule requiring rejection."

Warnings are judgement calls. A 600 FT span may be real; a missing photo may be
unavoidable. A reviewer decides. A CRITICAL is different in kind: an unpriced or
mispriced record cannot count toward earned value, billing or remaining scope
without corrupting all three. Approving one is not a judgement call, it is an
error — which is the clear business rule the brief allows for.

The messages name the consequence and the alternative, rather than just refusing:

> "This record carries a CRITICAL exception and cannot be approved: … Approved
> production is what earned value, billing and remaining scope are computed
> from. Fix the exception, or send the record back with CORRECTION REQUIRED."

**A test found a real hole here.** The gate originally tested
`qa_status === 'Not Reviewed'`. The field defaults to that in the app, so it
looked complete — but a record written by an import or the API can arrive with
the field blank, and a blank sailed straight through. `TEST-GATE-024` caught it;
the script now treats blank as unreviewed.

### Correction cycle

New fields: `correction_detail` (a picklist of what needs fixing, required when
a record is sent back), `correction_completed`, and a completed date and by.

- Sending a record back **clears its approval stamp**. That stamp is what every
  downstream report reads to decide the production counts, so a record under
  correction must not keep one.
- It also clears `correction_completed`, so a second round starts clean.
- Marking a correction complete stamps who and when; un-marking clears both.
- Once APPROVED or REJECTED, quantity, labor code and the rate link go
  read-only. Those are what the money is computed from; a correction cycle
  reopens them.

`correction_detail` is a picklist rather than free text because "what kind of
thing goes wrong" is reportable and free text is not. Repeat causes are how a
process gets fixed rather than policed.

### The QA flags a device cannot evaluate

Sprint 12 lists twelve automated flags. Eight are on the record already
(v5/v6 `buildExceptions`): missing photos, missing sequentials, invalid range,
missing labor code, missing rate, zero quantity, unusually high quantity,
missing From/To. Four need other records:

| Flag | Report | Why not on the device |
|---|---|---|
| Possible duplicate production | `duplicate-production.sql` | scans other records |
| Possible fiber overlap | `sequential-overlap.sql` (Sprint 4) | scans other records |
| Production over planned quantity | `qa-review-queue.sql` | needs scope + approved-to-date |
| Material variance | `material-variance.sql` | needs the material ledger |

#### Duplicate detection grades, it does not assert
Two records can legitimately share a day, crew and pay unit — a bore crew doing
300 FT at one crossing and 400 FT at another is two real transactions. So five
signals are scored (same quantity, same segment, same sequentials, same crew,
entered within five minutes) and graded `NEAR CERTAIN` → `SAME DAY AND PAY UNIT
ONLY`.

Identical sequentials on one reel is `NEAR CERTAIN` and CRITICAL: the same
physical cable cannot be placed twice. "Entered within five minutes with the
same quantity" is the signature of a double-tap on save.

Over-flagging would teach reviewers to dismiss the report, which costs more than
the duplicates would.

#### Material variance compares installed, not issued
Only `Installed` ledger rows count. Issued material is on a truck, not in the
ground; counting it would show every project over-consuming from the day it was
stocked.

The **10% purchasing waste factor is not applied.** Expected installed quantity
is the clean figure. Comparing actual installed against a number grossed up for
waste would report a 10% shortfall on every correctly built run.

A ±10% band is `WITHIN TOLERANCE`, beyond ±25% is CRITICAL, and the note for a
large over-consumption points at the likeliest cause — the pull-count rule,
where a 2" or 4" multi-pull run consumes a multiple of the footage and a bundled
1.25" run does not.

Scope is conduit only for now: it is the only family whose expected quantity the
app derives onto the record. The rest wait on the mapping master being loaded,
which waits on the 2" part numbers.

#### The review queue
One list of everything pending, saying what blocks each record — `BLOCKED -
critical exception`, `NEEDS QA REVIEW`, `AWAITING CORRECTION`, `REVIEW -
sequential overlap`, `REVIEW - would exceed authorized scope`, `READY TO
APPROVE` — ordered by priority band and then by value, because a blocked
5,000 FT record holds up more money than a blocked handhole.

`would_exceed_plan_by` answers the question a reviewer actually has: would
approving *this* record put the pay unit over its authorized scope? That may be
correct — it is what a change order is for — but it should be a decision, not a
side effect.

---

## The bug the tests keep catching

Both of the last two sprints have turned up a report that would not have run:

- Sprint 9 found `sequential-overlap.sql` addressing tables by **form name** and
  reading `status` instead of `_status`.
- `tests/reporting.test.js` now checks all thirteen reports for both, plus
  guarded divisions, approved/pending separation, VOID exclusion, no cross-unit
  quantity sums, and no recomputed weeks.

Checking the *text* of SQL is a weak proxy for executing it. It is also what
caught a report that had been written, reviewed and would have failed on first
use — so it stays until these queries can be run against real records.

---

## Open for the business

- **No billing app exists**, so `billed_value` and `remaining_to_bill` are NULL.
  Sprint 11 asks for billed value "if billing data is available"; it is not.
- **Material variance covers conduit only** until the Labor-Material Mapping
  master is loaded, which is waiting on 2" part numbers.
- **The duplicate five-minute window and the ±10% / ±25% variance bands are
  proposals**, not rulings. They are the numbers most likely to need tuning once
  real data runs through them.
- **v6.0.0 is not deployed.** `forms_update` has been returning
  `could_not_update_form` for every form on the account since 2026-09-17,
  including a twelve-element one, while `forms_create` works fine — which is why
  both Sprint 9 apps went in without trouble. The reports are unaffected: they
  read whatever is there. The app-side approval gate and correction fields wait
  on the endpoint.
