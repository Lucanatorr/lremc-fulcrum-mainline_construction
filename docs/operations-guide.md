# Operations Guide  (Sprint 23.77 #19, #20, #21)

Three audiences, three sections: administrators, field users, managers.

---

# Part 1 — Administrator documentation

## Before anything else

**This system has never held a record.** Nothing below has been exercised
end to end. See `docs/sprint-23-readiness.md` before deploying anything.

## Golden rules

1. **Never edit a generated CSV by hand.** `data/import/*.csv` come from
   `scripts/normalize_rates.py` and `scripts/build_material_mapping.py`. Both
   are idempotent. Change the script, re-run, commit.
2. **Never put a secret in app script.** It syncs to every field device. There
   is a live example of why in the production app today (limitation L12).
3. **Never hand-edit a deployed form in the app designer.** The repo is the
   source of truth. A designer edit silently diverges and the next deploy
   overwrites it.
4. **Never store a total.** Every balance is summed from atomic transactions.
   Three sprints removed stored totals that could not be populated.
5. **Never mass-recalculate history** (23.47.22). Changing a rule changes
   future saves only.

## Deploying a change

```bash
# 1. Edit the schema and/or script in the repo
#    fulcrum/schemas/<app>.elements.json
#    fulcrum/data-events/<app>.js

# 2. Bump the script version header AND add a CHANGE IN block.
#    TEST-VER-002 fails the build if the two disagree.

# 3. Run everything
for f in tests/*.test.js; do node "$f"; done     # 895 assertions

# 4. Deploy via the Fulcrum MCP forms_update, passing the COMPLETE element
#    array plus removed_element_keys for anything dropped.

# 5. VERIFY. Read the form back and diff it against the repo.
```

**Step 5 is not optional.** A large `forms_update` can time out client-side
and still succeed server-side — that has happened three times here. Read back;
never retry blind.

## API gotchas, learned the hard way

- Every element needs explicit `required`/`disabled`/`hidden`. A large payload
  missing them returns an opaque **500**.
- `YesNoField` also needs `neutral_enabled`, `positive`, `negative` — and
  rejects `default_value` when they are supplied.
- **A form GET cannot be sent straight back.** The API omits on read what it
  demands on write.
- `elements` is mandatory on every update. There is no script-only deploy.
- `forms_update` and `choice_lists_update` **blank the name** unless `name` is
  resent every time.
- A field's **type cannot be changed** after creation. Converting one means a
  new key; the old field is dropped.
- `CalculatedField` `display.style` must be `text`, `number`, `date` or
  `currency`.
- If `forms_update` starts failing for everything, run `forms_validate` on the
  same payload. `valid: true` plus a rejected update means the endpoint is
  down, not your payload. That outage lasted three days.

## Master data

| Master | Source | Count |
|---|---|---:|
| Contractor rates | `scripts/normalize_rates.py` | 146 |
| Material master | `scripts/build_material_mapping.py` | 135 |
| Labor→material mapping | same | 135 proposed, **58 approved** |

A mapping is only APPROVED when both source projects agree within 5%, a
single-source ratio is a whole number, or a ruling settles it. Fractional
single-source ratios mean the wrong driver and stay unapproved.

## Changing a rate

**Never edit a rate in place.** Create a new rate record with an effective
date, and expire the old one. Production already booked keeps its snapshot —
that is the design. `production-audit-trail.sql` will report
`MASTER REPRICED SINCE` for affected records, which is correct, not an error.

## Retiring a pay unit

Add it to `RETIRED_LABOR_CODES` in the production script and remove it from the
choice list. A device with a stale list can still hold the old code; the script
raises a CRITICAL naming the replacement rather than silently deriving nothing.

---

# Part 2 — Field user quick-start

## Recording production

You need six things. Everything else fills itself in.

| # | What | Notes |
|---|---|---|
| 1 | **Project** | Carries over from your last record. |
| 2 | **Contractor / Crew** | Carries over. |
| 3 | **Work Date** | **Does not carry over — check it.** |
| 4 | **Work Type** | Carries over. Decides which sections appear. |
| 5 | **Labor Code** | Fills in the unit, description, pull count, conduit size and splice band. |
| 6 | **Quantity *or* sequentials** | For fiber in feet, enter the range and the quantity fills itself. |

Then **From / To**, and **photographs**.

### Why the work date does not carry over

Everything else does, because a crew works one project all day. The date does
not, because it would quietly bring yesterday's date into this morning's first
record — and a mis-dated record lands in the wrong week, the wrong forecast and
the wrong daily rate, with nothing to catch it. **Check the date.**

### Fiber: enter the range, not the footage

Record start and end sequentials and the quantity appears. Direction does not
matter — 101250→100000 is the same 1,250 FT as 100000→101250.

If you type a quantity yourself it is kept, never overwritten. If it disagrees
with the sequentials by more than 5% you get a warning, because that is usually
a transposed digit.

**Slack and Other Added Footage are separate on purpose.** Slack is installed
cable that is not route distance. Keeping them apart is what lets the reel
report tell real consumption from handling.

### What the warnings mean

| Level | Meaning |
|---|---|
| **INFO** | Noted. Carry on. |
| **WARNING** | Probably worth a look. **Never blocks your save.** |
| **CRITICAL** | Something is wrong that stops this record being priced or counted. It saves, but it **cannot be approved.** |

**A warning never loses your work.** You can always save. If you are out of
service, save anyway — everything on the form works offline.

### What the app cannot tell you offline

It cannot know whether someone else already claimed your sequential range, or
booked the same work. Those need other records. They are caught after sync, by
report, before approval.

---

# Part 3 — Management reporting guide

All 24 reports are SQL for the Fulcrum Query API, in `reports/`. Conventions in
`reports/_conventions.md`.

> **None of these has ever been executed.** They pass structural tests, which
> proves they will run — not that the numbers are right.

## Start here

| Question | Report |
|---|---|
| What happened today / this week / this month? | `production-daily` / `-weekly` / `-monthly` |
| Where does the project stand? | `project-summary`, `project-scope-status` |
| What is left? | `remaining-work` |
| When will it finish? | `forecast-completion` |
| How fast are crews working? | `productivity` |
| What is it worth? | `project-financial`, `contractor-financial` |
| **What needs attention?** | **`exception-dashboard`** — start here daily |
| What is waiting on me? | `qa-review-queue` |
| Are we being billed twice? | `duplicate-production`, `sequential-overlap` |
| Where did this number come from? | `production-audit-trail` |
| Can we close this project? | `closeout-readiness` |

## Four rules behind every number

1. **Approved production is the only official production.** Pending is always a
   separate column, never folded in. VOID is excluded everywhere.
2. **Quantities are never summed across units.** Feet, each, splices and hours
   do not add. Anything crossing pay units aggregates **value**, because
   dollars are dollars.
3. **HR and EVENT are not physical production.** They carry value; they put
   nothing in the ground.
4. **The week is defined once, on the record.** ISO-8601, Monday start,
   Mon–Fri. No report recomputes it.

## Reading rates and forecasts

Per-day rates divide by **active days** — days that crew actually booked
production — not elapsed days. A crew that placed 4,000 FT over four days ran
at 1,000 FT/day, not 800 because it rained on Friday.

Forecasts return **blank rather than a number** when there is too little
history, and every row states what it rests on. A blank forecast is the report
declining to guess.

## Filtering

Every filterable report opens with a `params` CTE of `NULL` literals. Edit that
one block; nothing is hidden further down.

```sql
WITH params AS (
  SELECT
    CAST('PRJ-000001' AS varchar) AS p_project_id,
    CAST(NULL AS varchar)         AS p_contractor_id
),
```

## When a figure looks wrong

1. `production-audit-trail.sql` filtered to that `production_id` — it answers
   who, when, what rate, from where, who approved, and whether it changed
   afterwards.
2. If the rate disagrees with the rate sheet, read `rate_provenance`. It
   usually says `MASTER REPRICED SINCE`, which means history was preserved —
   working as designed.
3. If a quantity looks doubled, run `duplicate-production.sql` and
   `sequential-overlap.sql`.
