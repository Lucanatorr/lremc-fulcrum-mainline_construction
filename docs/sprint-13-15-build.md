# Sprints 13, 14 & 15 — Duplicates, Structures, Segments and Dashboards

Two new apps, four new reports, Data Events **v7.0.0**, and two SQL defects
fixed in the Sprint 10–12 reports. **573 tests across eleven suites.**

| Object | ID |
|---|---|
| MC Structure - Development | `397b52cf-a4f0-4871-b8ea-1fdb592fe2ab` |
| MC Segment - Development | `7da87588-940a-4b9e-915d-5ec25d5c0ebc` |

---

## First: two defects in last sprint's reports

Before building anything, I audited Sprints 10–12 against the brief. That found
two things that would have failed on first execution:

**58 `ROUND(x, 2)` calls across 12 reports.** PostgreSQL has
`round(double precision)` and `round(numeric, integer)` — but **not**
`round(double precision, integer)`. Every Fulcrum numeric column comes back as
`double`, so every one of those calls was a query that does not run. All now
wrapped in `CAST(... AS numeric)`, with `TEST-ROUND-*` asserting it stays that
way.

**A timestamp cast to `bigint`** in the duplicate report's "entered within five
minutes" check. Postgres rejects that cast; it is now
`EXTRACT(EPOCH FROM ...)`, guarded by `TEST-TS-*`.

Both were found by reading, not by running — which is the point of
`docs/sprint-10-12-gaps.md`. That document lists everything in 10–12 that is
**not** finished, and the headline is that no report has ever returned a row.

---

## Sprint 13 — Duplicate and data-integrity controls

### The fingerprint, and why a field is the right Fulcrum mechanism

> "Investigate the best method available within Fulcrum."

Comparing records needs *other* records, which a device cannot reach offline.
But **computing** a canonical signature needs only the record in hand — so the
device can do that part, offline, every single time.

Once every record carries the same canonical string, duplicate detection
collapses from a weighted self-join into:

```sql
GROUP BY fingerprint_strict HAVING COUNT(*) > 1
```

and the value is **visible on the record**, so a reviewer can see *why* two
records matched rather than trusting a score.

### Two fingerprints, because one string cannot do both jobs

| | Components | What a collision means |
|---|---|---|
| **Strict** | project, contractor, date, pay unit, cable ID, sequential range | Close to proof. The same physical cable cannot be placed twice. |
| **Segment** | project, contractor, date, pay unit, normalized from/to | Weaker, but it is the **only** duplicate signal available for boring, trenching and structure work, which have no sequentials. |

Both are **direction-normalized**. A crew pulling the other way, or recording
the sequential range backwards, produces the *same* fingerprint —
`TEST-FP-001/002/003`. Without that, the duplicate check would be defeated by
the direction of travel.

**No hashing.** Fulcrum Data Events expose no crypto, so the fingerprint is a
delimited string rather than a digest. That turns out to be an advantage: a
reviewer reads `S|PRJ-000001|CON-0001|2026-09-15|BFO.48.I|C-100|1000|5000` and
can see immediately which component differs.

### Three details that would each have broken it

**A blank component must be marked, not empty.** Two records each missing a
*different* field would otherwise produce the same string and look like
duplicates of each other. Absent components render as `~` — `TEST-FP-020`.

**The work date is used as a day, not a timestamp.** A time component would
split one day's work into two fingerprints — `TEST-FP-023`.

**The delimiter is not forgeable.** A `|` inside a cable ID is rewritten, so
field content cannot fake a component boundary — `TEST-FP-025`.

### Fingerprint strength, so a thin record cannot look like a duplicate

A record carrying only a project and a date matches half the job. Matching on
that would report every sparse record as a duplicate of every other, and the
report would be useless within a week.

`fingerprint_strength` counts the identifying values actually present. Below 4
the record is reported as **`TOO SPARSE TO CHECK`** — not as a duplicate, and
not silently skipped. The device flags it too, so a crew can fix it at source:

> "Only 3 identifying values recorded, so this record cannot be reliably
> duplicate-checked. Add the cable ID and sequentials, or the from/to
> structures."

### The persistent production ID

> "Do not generate a new identifier every time a record is edited."
> "Do not rely on a randomly recalculated field."

The production app this replaces used `Math.random()` **on every save**, so one
record reported a different ID each time it was edited — useless as a reference
in any document. Ours is set once and guarded (`TEST-PID-010/011`).

**The brief's example is `PRD-2026-000123`, a sequential number. I did not use
sequential numbering, deliberately:** it is not offline-safe. Two crews out of
service both take 124 and collide on sync, and neither device can see the
counter to avoid it. The suffix comes from Fulcrum's own record ID — globally
unique, platform-assigned, stable for the life of the record.

`RECORDID()` can be unavailable before a record's first save, and the old
fallback was a bare timestamp. Two devices saving in the same millisecond could
collide, so v7.0.0 folds in three characters of the user's email —
`TEST-PID-020/021`. Still set once, still not random per save.

---

## Sprint 14 — Structures and segments

### MC Structure

All nine types the brief lists, including Slack Storage and Splice Closure.
Conditional specification sections mean a pole record shows height, class and
material while a vault shows size and traffic rating — nobody scrolls past
fields that cannot apply.

**The Structure ID locks once the structure exists in the field.** Segments and
production records resolve through it, so renaming it would silently orphan
every reference. The help text changes to say exactly that, and to name the
alternative (deactivate, create a new structure).

The ID is also **normalized on save** — trimmed, upper-cased, internal
whitespace collapsed — because `hh-1 ` and `HH-1` becoming two structures is a
mess nothing downstream would ever reconcile.

Two flags worth calling out:

- **No location captured** → WARNING. A structure with no coordinates cannot be
  found, mapped, or used to derive a segment length. That is the whole point of
  the master.
- **A handhole or vault with no traffic rating** → WARNING. A structure in a
  roadway that nobody rated is a dig-it-up-again risk.

A splice closure or slack coil normally sits *inside* another structure, so
those two types get a `Housed In Structure ID` and a check that it is not
itself.

### MC Segment, and the requirement the brief called out

> "Ensure reversing From/To does not accidentally create uncontrolled duplicate
> segment identities."

This is the whole design. A crew boring from HH-002 back toward HH-001 is
working the same physical path. If the identity were `from + '_' + to`, that one
path would acquire two identities and **every report keyed on segment would
double-count it** — quantities, lengths, percent complete, all of it.

So the ID sorts the two structure IDs before joining them:

```javascript
return (a <= b) ? (a + '_' + b) : (b + '_' + a);
```

`HH-001_HH-002` is the only identity that path can have, whichever way a crew
drove. Case and padding normalize too (`TEST-SEGID-003/004/005`).

**The same function derives `segment_id` on the production app.** A production
record and a segment record therefore agree about a path's identity without
either knowing the other exists. `TEST-SEGID-040` runs both implementations over
the same inputs and fails if they ever diverge — because if they did, production
would be booked against a segment identity no segment record carried.

**A segment from a structure to itself is rejected outright.** It has no length
and no direction; it is always a mis-selection, and one would put a zero-length
path into every segment report.

One physical path can carry several segment records — one per type. The conduit
and the fiber inside it are different things with different lengths and
different pay units, so the duplicate check keys on `(segment_id, segment_type)`
rather than segment alone.

### What the apps deliberately do not do

Neither can detect that *another* record already claims an identity — that needs
other records. The normalized ID is what makes it a plain `GROUP BY` in
`reports/segment-integrity.sql`, which finds duplicate structure IDs, duplicate
segments, orphaned endpoints, production on an undefined segment, segments
marked complete with no production, and housing structures that do not exist.

---

## Sprint 15 — Management reports

### Project Summary

Every column the brief lists, one row per project.

**Planned footages come from the project master, not from the pay units.** The
master already carries `planned_fiber_footage`,
`planned_underground_footage`, `planned_aerial_footage` and `planned_splices` —
design intent, set once. Deriving them by classifying pay units into families
would mean inventing a mapping the contract does not state, and it would drift
every time a pay unit was added.

**Installed footages come from `work_category`**, which every production record
carries and which *is* the family: Fiber Placement, Underground, Aerial,
Splicing. No guessing from labor-code prefixes.

Each physical figure is fenced to one unit of measure — fiber and underground on
`unit = 'FT'`, splices on `unit = 'SPLICE'` — so the numbers stay valid
(convention 2).

Two additions beyond the list:

- **`days_to_required_completion`**, negative when overdue. That belongs on the
  same row as percent complete, not in a separate schedule report.
- **`open_qa_issues`** counts criticals, QA failures and records awaiting
  correction — including on **approved** records. A record can be approved with
  warnings, and those warnings do not stop being true.

### Production Dashboard

Four periods × four breakdowns. Sixteen separate queries would be sixteen
chances to define "this week" differently, so one pass computes all four periods
as columns and `GROUPING SETS` produces every breakdown level in one result —
a project row and the contractor rows inside it are guaranteed to reconcile.

Quantity appears only on rows grouped down to a single labor code. Everything
else reports value, plus footage/splices/each fenced to their own units.

`p_as_at` lets the whole dashboard run as at a past date, for a month-end pack.

### Remaining Work Report

The brief calls this "a critical management report", and it is the same
arithmetic as `project-scope-status.sql` presented for a manager rather than an
auditor: fewer columns, the four scope states as one field, and a sort that puts
**over-runs first, then the largest remaining value**. Alphabetical order by pay
unit would bury the thing the report exists to surface.

Remaining quantity is a plain subtraction — never clamped — so an over-run reads
negative.

---

## Deployed 2026-09-21 (this section described the outage; it has since cleared)

`forms_update` returned `could_not_update_form` for every form on the account
from 2026-09-17 until 2026-09-21, when it started working again with no change
on our side. `forms_create` worked throughout, which is why all four Sprint 9/14
apps went in without trouble.

The payload for `Mainline Construction - Development` was **146 elements** and
went in as one deploy:

| Sprint | Change, now live |
|---|---|
| 8 | size-dependent conduit material quantity (`m117` expression) |
| 12 | approval gate, correction fields `m137`–`m141` |
| 13 | fingerprints `m142`–`m144` |
| 14 | structure links `m145`–`m150` |

That is a larger single deploy than I would choose, and it was the direct cost
of the outage. Everything in it is tested against the shipped script via
`tests/harness.js`, and the deployed script was verified byte-identical to the
repo copy afterwards.

`duplicate-production.sql` sections 1 and 2 now return rows, because the
fingerprints they group on exist. Section 3, the original scored heuristic, is
kept as the fallback for records too sparse to fingerprint.
