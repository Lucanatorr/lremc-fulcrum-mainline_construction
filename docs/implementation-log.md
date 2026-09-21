# Mainline Construction — Implementation Log

Running log for the Fulcrum **Mainline Construction** build.
Newest entries first. Every Fulcrum object this project creates is listed in
`docs/fulcrum-inventory.md`.

---

## 2026-09-21 — Sprints 16, 17 & 18: forecasting, fiber reels, field UX

Four reports, a restructured reel master, a field-entry pass on the production
app. **704 tests across thirteen suites.** Full write-up in
`docs/sprint-16-18-build.md`.

### Sprint 16 — two reports, one rule

`productivity.sql` (FT/day, EA/day, splices/day, value/day by crew, contractor
and construction method) and `forecast-completion.sql` (remaining / recent
average daily = estimated working days remaining).

Both turn on the brief's own rule that physical units cannot be added and
currency can. Every physical sum is fenced to one unit; value is the only
cross-unit aggregate, and a test fails the build if that slips.

Two things the arithmetic had to get right. **Active days, not elapsed days** —
a crew that placed 4,000 FT over four days ran at 1,000 FT/day, and dividing by
the week's five working days would report 800 and blame the rain. And **two
denominators** — a day spent entirely on flagging earns value but puts nothing
in the ground, so physical and value rates count active days separately.

The forecast returns NULL rather than a number whenever the arithmetic would be
dishonest: nothing remaining, no recent production, or fewer than three active
days of history. Every row states what it rests on.

### Sprint 17 — a field that was confidently wrong

Sprint 4 had already built most of the reel master. What Sprint 17 mostly did
was **take three fields away**.

`printed_sequential_consumed`, `slack_recorded` and
`estimated_remaining_footage` were all sums over production records, and nothing
populated them — nothing on a device can, since a record cannot see other
records. That was not just a blank field. `estimated_remaining_footage`
computed `original - consumed - waste` with the middle term permanently null, so
it reported `original - waste` and called it remaining. **A fully pulled reel
would still have shown its full length as available**, and somebody would have
planned a pull against it.

They are gone. `reel-balance.sql` computes the five concepts the brief insists
stay separate, the same way scope totals are computed rather than stored.

The subtle one is slack. The brief warns against subtracting it from the printed
range, and the physical reason is that slack comes off the reel *inside* the
consumed sequential range — the jacket numbers advance while the coil is pulled.
Subtracting it again would understate every reel by the size of its coils. Waste
*is* subtracted separately, because cut-back cable leaves the reel without ever
appearing in an installed range.

`reel-integrity.sql` covers what the device cannot: the app's outside-range
warning fires against the range snapshotted when the reel was linked, so a later
correction to the reel master never re-tests old records. This report does.
Overlap and duplicate range are deliberately NOT re-implemented — that is
`sequential-overlap.sql`, and two implementations of one check is how two
reports come to disagree.

### Sprint 18 — minimum entry, and one saving refused

Project, contractor, crew, route, work category and construction method now
carry forward to the next record. A crew booking twelve records re-picks none
of them.

**Work date deliberately does not.** `default_previous_value` persists across
days on a device, so the first entry of a new shift would inherit yesterday's
date — and a mis-dated record corrupts the ISO week, the forecast window and
every per-day rate, with nothing in the exception model to catch it. One tap
saved against a silent, wide failure.

Quantity now derives from sequentials for fiber placement billed in feet, since
a crew that recorded 1000→4200 has already said 3200 FT. Only when blank: a
typed quantity is the crew's claim and is never overwritten. A companion
warning fires when the two disagree by more than 5%, which is how a transposed
sequential gets caught at entry rather than in a billing dispute.

**Deriving work category from the labor code was refused.** It is the obvious
next saving, and it contradicts the 2026-09-17 ruling that installed footage
comes from `work_category` and is never inferred from a labor-code prefix.
Doing it would make that ruling self-referential. Reversing it is a business
decision, not a refactor — open item 26.

## 2026-09-21 — v7.1.0: a bare `USEREMAIL()` was crashing the web record editor

Reported from the field, minutes after the v7.0.0 deploy:

```
Uncaught ReferenceError: USEREMAIL is not defined
    at Runtime.eval (<anonymous>:278:3)
    at Runtime.trigger ... at e.onMessage (expressions-proxy.js)
```

plus: *"when clicking drop down menus and selecting an option, it does not
save. only populates after using F12 in chrome."*

**Two symptoms, one cause.** Line 278 was
`SETVALUE('inspector_email', USEREMAIL())` inside `ON('new-record')`.
`USERFULLNAME()` on line 277 worked fine.

`USEREMAIL` is an **expression** function — it is in the `context` category for
CalculatedFields and in none of the Data Events categories. The Data Events
runtime and the expression runtime share a documentation page, not a global
namespace, and the web editor exposes less than the mobile app.

The second symptom follows from the first. A ReferenceError in a Data Event is
not contained to its handler: it escapes `Runtime.trigger` and the expressions
proxy's `onMessage`, so the host never receives the reply carrying that event's
queued `SETVALUE` mutations. The derived values were computed and then dropped
on the floor. Opening devtools forced a re-render, which is why they appeared
only then — and why a crash in `new-record` looked like a bug in the dropdowns.

### The fix

1. **Every platform accessor now goes through a `typeof` guard** —
   `userFullName()`, `userEmail()`, `recordId()`, `recordStatus()`. `typeof` is
   the only safe test for an undeclared identifier: reading one throws, `typeof`
   on one returns `'undefined'`. `RECORDID` and `USEREMAIL` had `try`/`catch` in
   `assignProductionId` already; `STATUS()` was bare in four places and would
   have failed the same way in any runtime lacking it.
2. **`inspector_email` was removed entirely.** First it moved to a
   CalculatedField, `ONCE(IFERROR(USEREMAIL(), ''))` (`m151`), on the reasoning
   that `USEREMAIL` is documented for the expression runtime. **That was wrong,
   and the field came back blank.** On this account the function is effectively
   unavailable in both runtimes.

   The second attempt was the right one, and it deletes the field rather than
   populating it. **Fulcrum already records who created every record**:
   `_created_by_id`, joinable to `memberships.user_id` for `name`, `email` and
   `role_name`. There was never anything to capture.

   Worth stating why a copy would have been wrong even if `USEREMAIL` had
   worked: it duplicates platform metadata, and **it goes stale**. An address or
   a surname changes in one place and every record ever written keeps the old
   value. The join is always current. `qa-review-queue.sql` now exposes
   `created_by_name` / `created_by_email` / `created_by_role`, and
   `reports/_conventions.md` section 5 makes it the standing rule.

   `inspector` stays — it is the only identity a field user can read without
   running SQL — but its description now says `_created_by_id` is the authority.

### Why 573 tests didn't catch it

`tests/harness.js` stubbed every platform global unconditionally. **A test
environment more capable than the real one cannot find a missing-global bug.**

The harness now takes `omitGlobals`, which *deletes* the named globals so a bare
read throws exactly as it does on a device. `tests/runtime-globals.test.js` (28
tests) runs the shipped script with them gone, and additionally greps the source
so a future bare call fails the build without needing a runtime to reproduce it.

Verified the suite actually catches this: reintroducing the original two lines
turns it red (`TEST-RT-002`, and the bare-call greps) while every pre-existing
suite stays green — which is precisely the blind spot that let this ship.

**601 tests across twelve suites.** Deployed 2026-09-21T17:04:06Z, element tree
and script verified against the repo.

## 2026-09-21 — v7.0.0 deployed: the three-day `forms_update` outage cleared

**The outage ended without any change on our side.** `forms_update` had rejected
every form on the account since 2026-09-17 21:41Z with
`422 could_not_update_form`. Retried on 2026-09-21 with the same payload shape
and the same procedure, it succeeded. `MC Material Master` went first
(16:35:30Z), then the production app (16:45:48Z).

**One call cleared a four-sprint backlog.** 146 elements plus the v7.0.0
script, on `06c36c8e-4a88-4cf3-a691-9a792f8374d2`:

| Sprint | Change now live |
|---|---|
| 8 | size-dependent conduit material quantity (`m117`) |
| 12 | approval gate, correction fields `m137`-`m141` |
| 13 | production fingerprints `m142`-`m144` |
| 14 | structure links `m145`-`m150` |

**All three live defects are closed.** 2" and 4" multi-pull conduit now reads
pull count x footage instead of 1:1; a CRITICAL exception blocks approval; and
fingerprints exist, so `duplicate-production.sql` sections 1 and 2 return rows
rather than nothing.

### The call timed out and had already succeeded

The MCP client returned a timeout on a 77 KB payload. Rather than retry, the
form was read back: 146 elements live, the deployed script **byte-identical**
to `fulcrum/data-events/mainline-construction-dev.js`, and the element tree
matching the repo schema on key path, type, data_name, expression, linked
list/form, description, choices, `record_defaults` and `visible_conditions`.
A blind retry would have re-sent 77 KB to re-apply work that was already done.
This is now written into the gotchas: **read the form back, never retry blind.**

### Two stale texts caught on the way in, both about the same ruling

Neither would have failed a test, because neither is executable — and that is
exactly why they survived.

1. **The script header still documented the additive DP schedule.** It read
   `BM60(1)(1.25)DP .. BM60(5)(1.25)DP at 10/12/14/16/18` — the reading the
   contract owner corrected on 2026-09-17. The rate master and
   `scripts/normalize_rates.py` carry the correct banded schedule
   ($10 / $12 / $12 / $14 / $14), so nothing was mispriced; but the comment
   explaining the rule to the next reader taught the wrong rule, and a 5-pull
   bore priced from it overbills by 29%. Replaced with an explicit
   *RULING 2026-09-18 — THE DP RATE SCHEDULE IS BANDED, NOT ADDITIVE* block
   that states the wrong answer and why it is wrong.
2. **`m021` Labor Code still said "141 pay units."** The choice list has held
   146 since the DP expansion. Corrected in the deployed payload.

**573 tests across eleven suites, all passing.**

## 2026-09-17 — Sprints 13, 14 & 15 complete, and two defects fixed in 10-12

Two apps, four reports, Data Events **v7.0.0**. **569 tests across eleven
suites.** See `docs/sprint-13-15-build.md` and `docs/sprint-10-12-gaps.md`.

### Audited 10-12 first, and found two queries that would not run
- **58 `ROUND(x, 2)` calls across 12 reports.** Postgres has
  `round(double precision)` and `round(numeric, integer)` but NOT
  `round(double precision, integer)`, and every Fulcrum numeric column is a
  double. All wrapped in `CAST(... AS numeric)`; `TEST-ROUND-*` guards it.
- **A timestamp cast to `bigint`** in the duplicate report. Postgres rejects
  that; now `EXTRACT(EPOCH FROM ...)`, guarded by `TEST-TS-*`.

`docs/sprint-10-12-gaps.md` records everything in those sprints that is NOT
finished. The headline: **no report has ever returned a row**, because there
are zero records in every dev app and the MCP server has no record-creation
tool. Two syntax classes found in one review means more are likely, and the
document lists every construct still unverified against the live engine.

### Sprint 13 — the fingerprint is the mechanism
Comparing records needs other records, which a device cannot reach offline. But
COMPUTING a canonical signature needs only the record in hand, so the device
does that part every time. Duplicate detection then collapses from a weighted
self-join into `GROUP BY fingerprint HAVING COUNT(*) > 1`, and the value is
visible on the record so a reviewer sees WHY two records matched.

Two fingerprints, because one string cannot do both jobs: **strict** (cable and
sequential range — a collision is close to proof) and **segment** (the only
signal available for boring and trenching, which have no sequentials). Both
direction-normalized, so a crew pulling the other way cannot defeat the check.

Three details each of which would have broken it: a blank component renders as
`~` so two records missing DIFFERENT fields do not collide; the work date is
used as a day not a timestamp; and a `|` inside a value cannot fake a
delimiter. `fingerprint_strength` stops a sparse record matching everything —
below 4 it is reported as TOO SPARSE TO CHECK rather than as a duplicate.

**Production ID:** the brief's example is sequential (`PRD-2026-000123`). I did
not use sequential numbering: it is not offline-safe, since two crews out of
service both take 124 and neither can see the counter. The suffix is Fulcrum's
own record ID. The pre-first-save fallback now folds in the user's email, since
a bare timestamp let two devices collide in the same millisecond.

### Sprint 14 — direction normalization is the whole design
`MC Structure` (`397b52cf-…`) and `MC Segment` (`7da87588-…`).

The segment ID sorts its two structure IDs before joining them, so one physical
path has exactly one identity whichever way a crew drove. Without that, every
report keyed on segment would double-count a reversed run. The SAME function
derives `segment_id` on the production app, and `TEST-SEGID-040` runs both
implementations over the same inputs so they cannot diverge.

Structure IDs lock once the structure exists in the field and are normalized on
save — `hh-1 ` and `HH-1` becoming two structures is unreconcilable later. A
segment from a structure to itself is rejected outright.

### Sprint 15 — management reports
Project summary, production dashboard and remaining-work.

Planned footages come from the **project master** (design intent, set once);
installed footages come from **work_category**, which IS the family. Deriving
either from labor-code prefixes would mean inventing a mapping the contract does
not state. Each physical figure is fenced to one unit of measure.

The dashboard computes all four periods as columns in one pass with GROUPING
SETS, so a project row and the contractor rows inside it reconcile by
construction rather than by luck. The remaining-work report sorts over-runs
first and then by largest remaining value — alphabetical order by pay unit would
bury what the report exists to surface.

---

## 2026-09-17 — Sprints 10, 11 & 12 complete: reporting, financials, QA and approval

Ten new reports, Data Events **v6.0.0**, and `reports/_conventions.md`.
**418 tests pass across nine suites.** See `docs/sprint-10-12-build.md`.

### Four reporting rules, written down once
Each is a way a report can look authoritative and be wrong, so they are stated
in one place and asserted by `tests/reporting.test.js` against all thirteen SQL
files.
1. **Approved production is the only official production.** Pending gets its own
   column and is never folded in.
2. **Quantities cannot be summed across units.** Feet, each, splices and hours
   are not addable. Quantity aggregates only within one labor code or unit;
   anything crossing pay units aggregates value. The daily report's total rows
   suppress quantity entirely.
3. **HR and EVENT are not physical production.** Real value, no work in the
   ground.
4. **The week is defined once, on the record.** Reports read the derived
   `work_week`; no report recomputes one from `work_date`.

### Sprint 10 — production reporting
Daily (with `GROUPING SETS` so detail and totals cannot disagree), weekly,
monthly with project-to-date, and a trend report.

Two deliberate choices: the previous-week comparison uses a **self-join on the
ISO week label, not `LAG`**, because a gap week has no row and `LAG` would
report a change that never happened; and rolling windows use
`RANGE ... INTERVAL '6' DAY` rather than `ROWS`, so a crew that worked three
days does not get a fortnight-wide "7-day" figure.

**Average daily production divides by working days, Mon-Fri.** Dividing a
five-day week by seven understates a crew's rate by 29%.

### Sprint 11 — financial reporting
Financial % complete (approved value / current contract value) and physical %
complete (earned value at BUDGET rates) are both reported, and so is the spread
between them — **that spread is the rate variance**, which a single blended
percentage hides. Physical % is value-weighted, and per-line earned value is
capped at the authorized quantity so one over-run cannot mask untouched lines.

Contractor financials key every figure on the snapshotted contractor ID and
rate, then **check that this held**: `wrong_contractor_rate_records` counts
records priced from another contractor's rate on a shared project, which is the
exact failure the snapshotting exists to prevent.

The rate audit finds thirteen conditions. Two are only findable server-side:
**AMBIGUOUS RATE** (competing active rates in the master — the price was a coin
toss) and **DRIFTED FROM SOURCE**. Drift is WARNING not CRITICAL on purpose: the
likeliest cause is a legitimate reprice after the fact, in which case the
snapshot is right. The report states both causes rather than accusing anyone.

**Billed value is NULL** — no billing app exists. The column is present so the
report's shape does not change when one does.

### Sprint 12 — the approval gate
v6.0.0 refuses to approve a record carrying a CRITICAL exception, a failed QA
review, or an unrecorded QA outcome. **Warnings never block anything**, per the
brief. A CRITICAL is different in kind: an unpriced record cannot count toward
earned value, billing or remaining scope without corrupting all three.

**A test found a real hole.** The gate tested `qa_status === 'Not Reviewed'`,
which looked complete because the field defaults to that — but a record written
by an import or the API can arrive blank, and a blank sailed through.
`TEST-GATE-024` caught it; blank is now treated as unreviewed.

Correction cycle: sending a record back **clears its approval stamp** (that
stamp is what every downstream report reads) and resets the completion flag.
Once approved or rejected, quantity, labor code and rate link go read-only.

Four QA flags need other records, so they are reports: duplicate production
(five scored signals, graded rather than asserted — over-flagging teaches
reviewers to ignore the report), fiber overlap (Sprint 4), over-plan production,
and material variance (INSTALLED only, waste factor deliberately excluded).

---

## 2026-09-17 — Sprint 9 complete: project scope, budget and change orders

Two apps created (`forms_create` works even while `forms_update` is down), two
reports written, one existing report fixed. See `docs/sprint-9-build.md`.
**252 tests pass across seven suites.**

| Object | ID |
|---|---|
| MC Project Scope Line - Development | `aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b` |
| MC Change Order - Development | `458ae172-b7b4-43b5-8917-d7a792c9e81a` |

### The baseline is a record; the arithmetic is a report
Completed, Remaining, Percent Complete and Current Authorized Scope are all
aggregates over every production record for a project and pay unit. A device
cannot compute them (Data Events reach other records only through the
online-only `REQUEST`), and storing them would put a stale number in front of a
field user the moment the next record synced. The brief says remaining work
must not be manually maintained and the quantities stay authoritative, so the
scope line holds only the baseline and `reports/project-scope-status.sql` does
the rest — the same call made for sequential overlap in Sprint 4.

### Baseline immutability is enforced, not documented
`SETREADONLY` locks Original Planned Quantity and the budget rate once the line
leaves DRAFT, and `SETDESCRIPTION` rewrites the help text to say why and what to
do instead. Baseline Set Date and By are stamped on the transition. A negative
planned quantity is blocked outright, with the message naming the change order
as the way to reduce scope.

### Change orders are signed deltas with a real approval gate
Lines are `+2000` / `-500`, never a revised absolute quantity — a delta replays
against the baseline, an absolute figure destroys the history. Change Order
Value is `REPEATABLESUM` over the lines, never typed. Approval stamps
Date Approved and Approved By and freezes the lines; rejection **clears** that
stamp, because the stamp is what the report reads. Only APPROVED moves the
authorized scope, enforced in one place: the SQL join to the parent status.

### Two reports, plus one bug found in an old one
`project-scope-status.sql` computes the lot, keeping approved and pending apart,
never clamping remaining, and returning NULL rather than dividing by zero.
`unplanned-production.sql` is not in the brief: production against a pay unit
with no scope line is invisible in a scope report driven from scope lines, so it
needed its own anti-join. It is the scope-side counterpart of last sprint's
billing gaps.

Reading the Query API's real table definitions showed **tables are named by form
ID, not form name, and the status column is `_status`**.
`reports/sequential-overlap.sql` had both wrong and **would not have run** — it
had been written and reviewed but never executed. Corrected, and the new tests
assert the text of each report against the rules it must encode.

---

## 2026-09-17 — Sprint 8 revision: directional bore, size-dependent material, real SKUs

See `docs/sprint-8-revision-build.md`. **180 tests pass across six suites** (184 after the rate-band correction below).

### Ruling: 2" and 4" are always one pull — and v4.0.0 was wrong
There is no bundled 2" or 4" product; the catalogue stocks one 4" item, a single
pipe. So the material multiplier is **1 for bundled 1.25" whatever the pull
count, and the pull count for 2" and 4"**. v4.0.0 applied 1:1 to every size,
which **under-ordered a 3-pull 4" trench by 67%** — 500 FT recorded where 1,500
FT went in the ground. v3.0.0 had over-ordered 1.25" by 3x; both errors came
from assuming one multiplier fits every size.

### Ruling: directional bore is one pay unit per pull count
`BM60-(1.25)DP` ($10, one pipe) plus `BM60-(1.25)DPD Dual` ($2, "a second or
more") meant a 3-pull bore was three transactions and the record never stated
the pull count. Expanded to `BM60(1)(1.25)DP` .. `BM60(5)(1.25)DP`. Rates are **banded, not
additive** (contract owner, 2026-09-17): **$10** for one pipe, **$12** for 2-3,
**$14** for 4-5. An additive base-plus-adder reading would have priced a 5-pull
bore at $18 against $14 — a 29% overbill. Both source codes retired; selecting
one is flagged CRITICAL.

Labor master 143 → **146 pay units**. 2" and 4" directional bore keep their
base/adder pairs — the ruling named 1.25" — and are logged as open item 9.

### Material matched from observed consumption
Two projects' consumption records plus an inventory list, transcribed to
`data/source/material-observations.py` and built by
`scripts/build_material_mapping.py`: **135 items, 135 mappings, 58 APPROVED**.
A ratio is only approved when both projects agree, or when a single-source ratio
lands on a whole number, or when it follows from a ruling.

Confirmed by both projects independently: `AFO.GAA` = 1 helix anchor + **30 FT**
of strand + 1 washer + **2** guy grips; `BM2` = 1 rod + 1 clamp; `BM90` = 1 FT
tracer tape per FT; every `HO-1` band = 1 heat shrink sleeve per splice.

Three structural findings came out of the data:
- **Fractional ratios reveal the wrong driver.** `AFO.SL` markers and nut squares
  are per-POLE, not per-foot; HST stubs recorded against `AFO.RTD` footage belong
  to the `BFO.HST.*` per-stub units. Flagged, not approved.
- **Fiber cable SKU belongs to the reel.** `BFO.288.I` drew ACCUROLL on one
  project and Prysmian on the other. 18 cable mappings are REEL-SOURCED.
- **Pack size and waste factor are their own columns.** Ratios are in pieces and
  feet; 18 SKUs are packs. Conduit carries the source data's 10% waste, applied
  in purchasing only — the installed quantity stays a measurement.

### The data exposed seven billing gaps
Production recorded against labels with **no pay unit to bill them** —
`data/labor-billing-gaps.csv`. Largest: **11,004 FT of `BFO.96.I`** plus 2,008 FT
of `BFO.96.IE` (the sheet has 12/48/72/144/288, no 96) and **684 FT of a 4"
railroad bore** (only 1.25" and 2" railroad units exist).

### Test harness rewritten
Each suite used to re-type the functions it tested. When v5.0.0 changed the
multiplier, `splice-material.test.js` kept passing against its own stale copy
while asserting a SKU the ruling says does not exist. `tests/harness.js` now
loads the deployed script directly and stubs Fulcrum's runtime, so there is one
copy of every rule. Two parity tests pin the places a rule unavoidably repeats.

### BLOCKED: `forms_update` outage
The v5.0.0 app payload is **not deployed**. `forms_update` returns
`could_not_update_form` for every form on the account, including a 12-element
one, while `choice_lists_update` succeeds. Recreating the form was rejected as a
workaround because repointing `MC Material Transaction`'s RecordLink needs the
same endpoint. See the outage note in `docs/fulcrum-inventory.md`.

The choice list IS deployed, and the v4 script already parses the new DP codes,
so 1.25" is correct live. The one live defect is 2"/4" multi-pull material
quantity reading 1:1.

---

## 2026-09-16 — Sprints 7 & 8 complete

Data Events **v4.0.0** deployed to `06c36c8e-4a88-4cf3-a691-9a792f8374d2`
(via `forms_update` this time — the form ID was preserved deliberately, because
the new Material Transaction app links to it). 132 elements, eleven sections.

### Ruling: `(n)` is the pull count — and v3.0.0 was wrong because of it
`BM60(1)(1.25) P` is a **1-pull** plow, `BM60(2)(1.25) P` is **2-pull**. A
3-pull package is therefore **one bundled conduit assembly**, consumed at
**1 FT per production FT**.

v3.0.0 published `quantity × count` as *"Calculated Conduit Footage"*, which
would have ordered **3× the conduit** on every multi-pull run. Corrected in
v4.0.0: that field is now **"Total Duct Footage (informational)"** (still a real
engineering number, just not a purchasing number) and a new
**Conduit Material Quantity** field carries the 1:1 figure.

Conduit sizes in scope: **1.25", 2", 4" only**. Micro duct, 0.75" and
`BM60-DROP` derive nothing and raise INFO rather than inventing a SKU.

### Sprint 7 — Splicing
SPLICING section, conditional on Work Category. The priced band is parsed from
the pay-unit code (`HO-1 (25-48)` → 25-48; `HO-1 (145 or above)` → 145+, no
upper bound). **A band that does not contain the fiber count is CRITICAL**, not
a warning: `HO-1 (1-24)` is $32/splice against $15 for `HO-1 (145 or above)`, so
the wrong band more than doubles the money on identical physical work.

### Sprint 8 — Materials
Two new apps: **MC Material Master** (`658143d1-…`) and **MC Material
Transaction** (`ee204906-…`). The ledger stores no totals — every balance is
summed from atomic transactions, the same rule production follows. Linking a
production record gives Project → Production → Labor Code → Material, so an
auditor can see *why* a quantity is believed consumed.

Two save-blocking rules, the only `INVALID()` calls in the build: zero quantity
is not a transaction, and a negative quantity is valid only on an `Adjusted`
row (Sprint 23.59) so a reversal cannot quietly erase consumption.

Mapping regenerated: **36 rows — 14 APPROVED, 22 NEEDS REVIEW**. Every
multiplier is now `1`; the only thing missing is 2"/4" part numbers.

Also exported the deployed Data Events scripts into `fulcrum/data-events/`.
They were previously living only inside Fulcrum, unversioned.

**112 tests pass across five suites.** See `docs/sprint-7-8-build.md`.

---

## 2026-09-16 — Sprints 2-6 complete

Production app REBUILT and its **form ID changed** to
`06c36c8e-4a88-4cf3-a691-9a792f8374d2`. Large `forms_update` calls repeatedly
failed with an opaque `could_not_update_form`, while the identical element tree
created cleanly. With no records at risk, delete-and-recreate was the right
trade. See `docs/fulcrum-inventory.md`.

- Sprint 2: production wired to Project / Contractor / Rate masters; five rate
  exceptions detected offline. See `docs/sprint-2-build.md`.
- Sprint 3: Data Events v2.0.0. See `docs/sprint-3-4-build.md`.
- Sprint 4: reel master + reel link + offline range validation; overlap moved to
  a server-side report.
- Sprints 5-6: underground and aerial, Data Events v3.0.0, conduit package
  derived from the pay-unit code. See `docs/sprint-5-6-build.md`.

87 tests pass across four suites.

---

## 2026-09-16 — Sprint 1 complete, Sprint 2 started

### Ruling: railroad bore split
The source rate sheet carried **one** code, `BM60(1.25)DP SDR 7 Rail Road`, with
**two** rates — $12 (1.25" conduit) and $16 (2" conduit). Ruling: create one pay
unit per diameter rather than one ambiguous code.

| New code | Unit | Rate |
|---|---|---|
| `BM60(1.25)DP SDR Rail Road` | FT | $12.00 |
| `BM60(2)DP SDR Rail Road` | FT | $16.00 |

Labor code master went from 141 → **143** pay units.

> **Unresolved:** the source *code* string reads `SDR 7` while both source
> *descriptions* read `SDR 11`. That contradiction is in the contract document.
> Flagged for the contract administrator; not invented away.

### Sprint 1 — core production app
Dev app rebuilt from scratch (all previous fields deleted) to the Sprint 1
hierarchy. 71 elements. See `docs/sprint-1-build.md`.

### Sprint 0 — discovery
See `docs/sprint-0-discovery.md`. Headline: a production `Mainline Construction`
app already existed (142 records) and contained **live API credentials in its
Data Event script**. See the security note in that document.

---

## Open items requiring a business decision

| # | Item | Raised | Status |
|---|---|---|---|
| 1 | `SDR 7` (code) vs `SDR 11` (description) on both railroad units | Sprint 1 | **Open** |
| 2 | Rotate the Fulcrum + Smartsheet API tokens found in the production app script | Sprint 0 | **Open — security** |
| 3 | `BHF-10` appears twice at $55 with two different descriptions (drop vault / flower pot) | Sprint 0 | Open — financially neutral |
| 4 | Splice classification set uses `HO1 (1-24)`; rate sheet uses `HO-1 (1-24)`. Hyphen mismatch breaks the join | Sprint 0 | Open |
| 5 | `HO1-12R` (ribbon splice) exists in the classification set but has **no rate** | Sprint 0 | Open |
| 6 | ~~Bundled conduit ambiguity — 1 FT of the 3-PULL SKU, or 3 FT of the 1-PULL SKU?~~ | Sprint 5 | **CLOSED 2026-09-16** — `(n)` is the pull count, so consumption is 1:1. v3.0.0 corrected. |
| 7 | **2" and 4" conduit part numbers.** The 4" pipe is now known (`#RM-4-11-O-750`). 2" has no SKU in the catalogue at all, so 14 conduit mappings still cannot resolve. Multipliers are settled | Sprint 5 | **Open — 2" only** |
| 9 | **2" and 4" directional bore still use the base/adder pattern** (`BM60-(2)DP` + `BM60-(2) DPD Dual`, `BM60-(4)DP` + `BM60-(4) DPD Dual`). Same problem the 1.25" ruling fixed. Expand them the same way? | Sprint 8 rev | Open |
| 10 | ~~Directional bore rate composition~~ | Sprint 8 rev | **CLOSED 2026-09-17** — banded schedule stated by the contract owner: $10 / $12 (2-3) / $14 (4-5). Not additive. |
| 11 | **Seven billing gaps** — production recorded with no pay unit to bill it. Largest: 11,004 FT `BFO.96.I` + 2,008 FT `BFO.96.IE` (no 96-count unit exists) and 684 FT of 4" railroad bore. `data/labor-billing-gaps.csv` | Sprint 8 rev | **Open — revenue** |
| 12 | **Per-pole items mapped against per-foot production.** `AFO.SL` sign markers and nut squares, and the HST stubs under `AFO.RTD`. The driver is pole / stub count, not footage | Sprint 8 rev | Open |
| 13 | **Competing structure SKUs.** `BHF-30T` names three different vaults across two projects; `BHF-10`, `BHF-17T`, `BHF-48T` similar. One structure per unit, so a standard must be picked or the unit split by size | Sprint 8 rev | Open |
| 14 | **No 4-pull or 5-pull 1.25" SKU exists** for the new `BM60(4)(1.25)DP` / `BM60(5)(1.25)DP` units. Needs a new part number or a stated combination of existing ones | Sprint 8 rev | Open |
| 21 | **No report has ever been executed.** Zero records exist; the MCP server has no record-creation tool, so the masters cannot be loaded from here. Every report is unproven and the SQL dialect is inferred, not confirmed. See `docs/sprint-10-12-gaps.md` | Sprint 10-12 | **Open — biggest blocker** |
| 22 | **No dedicated project-to-date report.** PTD exists as running-total columns in the monthly and trend reports; the brief lists it as a period alongside daily/weekly/monthly | Sprint 10 | Open |
| 23 | **Nothing is wired into Fulcrum's own UI.** All reporting is Query API SQL; Report Builder templates, webhooks, reference files and extensions are untouched | Sprint 10-15 | Open |
| 24 | **"Unusually high quantity" is two global thresholds**, not per-pay-unit plausibility limits. Needs stated limits or a historical baseline, and there is no historical production | Sprint 12 | Open |
| 25 | **No QA reviewer assignment.** The app records who reviewed a record but there is no way to assign one to a reviewer in advance | Sprint 12 | Open |
| 18 | **No billing app exists**, so `billed_value` and `remaining_to_bill` are NULL in the project financial report | Sprint 11 | Open |
| 19 | **Material variance covers conduit only** until the Labor-Material Mapping master is loaded, which waits on the 2" part numbers | Sprint 12 | Open |
| 20 | **Duplicate-detection window (5 minutes) and material variance bands (±10% tolerance, ±25% critical) are proposals**, not rulings. Most likely to need tuning against real data | Sprint 12 | Open — confirm |
| 16 | **Budget rates are assumed to equal contract rates.** The scope line prices its budget from the contractor rate master. If LREMC budgets at an internal rate, that is a separate master | Sprint 9 | Open |
| 17 | **Change order line rates are typed, not snapshotted.** A RecordLink inside a repeatable was not attempted, so nothing checks a typed line rate against the rate sheet | Sprint 9 | Open |
| 15 | ~~`forms_update` outage~~ | Sprint 8 rev | **CLOSED 2026-09-21** — cleared on its own after ~3 days, with no change to the payload or the procedure. v7.0.0 deployed: 146 elements, `updated_at` 2026-09-21T16:45:48Z. Evidence table kept in `docs/fulcrum-inventory.md` as the path to re-walk if it recurs. |
| 26 | **Should work category be derived from the labor-code prefix?** It is the largest remaining entry saving in the field app, and the 2026-09-17 ruling forbids inferring category from a prefix. The ruling was written about footage classification; applying it to data entry may be stricter than intended | Sprint 18 | Open — needs a ruling |
| 27 | **Productivity and forecast reports read `work_day_of_week`**, derived on the record. Records written by import or API without running Data Events have it blank and drop out of both reports silently | Sprint 16 | Open |
| 8 | Span footage is hand-entered. Auto-derivation needs a pole dataset with coordinates; `Poles and Inspections_demo_app` (10,000 records) may be a source | Sprint 6 | Open |

## Rulings on record

| Date | Decision |
|---|---|
| 2026-09-16 | Reporting week = **ISO-8601, Monday start**. Working week Mon–Fri. Weekend production flagged INFO, never blocked. |
| 2026-09-16 | Rate lookup must be **offline-safe** → RecordLink + `record_defaults`, not the Query API. |
| 2026-09-16 | `HO-1TL` = **$9**. The $7 row is dropped. |
| 2026-09-16 | `HO-1 (x-y)` bands are the splice pay units. Bare `HO-1` @ $42 dropped. |
| 2026-09-16 | "Heavy metro adder" rows (3) excluded entirely. |
| 2026-09-16 | Railroad bore split into one pay unit per conduit diameter. |
| 2026-09-16 | Sequential overlap detection is a **server-side report**, not a device check, because a device check would silently vanish offline. Reel-range validation stays on the device. |
| 2026-09-16 | Touching sequential ranges (`a.end = b.start`) are legitimate **adjacency**, not an overlap. Reels are consumed continuously. |
| 2026-09-16 | `(n)` in `BM60(n)(size)` is the **pull count**. A multi-pull package is one bundled assembly consumed **1:1** per production foot. |
| 2026-09-16 | Conduit sizes in scope: **1.25", 2", 4"** only. Micro duct, 0.75" and `BM60-DROP` derive no material. |
| 2026-09-16 | A splice band that does not contain the fiber count is **CRITICAL**, because it is a mispricing, not a data-quality nit. |
| 2026-09-16 | Material balances are **never stored**. Every quantity is summed from atomic ledger transactions. |
| 2026-09-17 | **2" and 4" conduit is always a single pipe.** Material multiplier = pull count for those sizes; 1 for bundled 1.25". |
| 2026-09-17 | Directional bore 1.25" is **one pay unit per pull count**, `BM60(1..5)(1.25)DP`. Rates are **banded**: $10 for 1 pipe, $12 for 2-3, $14 for 4-5. Not additive. The base + Dual-adder pair is retired. |
| 2026-09-17 | A consumption ratio is **APPROVED only** when both projects agree, a single-source ratio is a whole number, or it follows from a ruling. Fractional single-source ratios mean the wrong driver. |
| 2026-09-17 | **Pack size and waste factor are separate columns**, never folded into the multiplier. Installed quantity stays a measurement; purchasing grosses it up. |
| 2026-09-17 | **Fiber cable SKU comes from the reel**, not from the pay unit. Two projects placed the same unit with different cable. |
| 2026-09-17 | Tests load the **deployed** Data Events source via `tests/harness.js`. No suite may re-type the code it tests. |
| 2026-09-17 | **Scope totals are never stored.** The scope line holds the baseline; completed, remaining, percent complete and authorized scope are computed in `reports/project-scope-status.sql`. |
| 2026-09-17 | The scope **baseline is locked** by `SETREADONLY` once a line leaves DRAFT. Scope changes go through a change order; a negative baseline is rejected. |
| 2026-09-17 | Change order lines are **signed deltas**, never revised absolute quantities, and only an **APPROVED** order moves the authorized scope. |
| 2026-09-17 | **Remaining quantity is never clamped at zero** and percent complete returns NULL rather than dividing by zero. |
| 2026-09-17 | **Quantities are never summed across units of measure.** Cross-pay-unit aggregation reports value; quantity stays within one labor code or unit. |
| 2026-09-17 | **HR and EVENT are not physical production.** They carry value but no work in the ground. |
| 2026-09-17 | Reports **read** the record's derived `work_week` / `work_month`. No report recomputes a period from `work_date`. |
| 2026-09-17 | **Average daily production divides by working days (Mon-Fri)**, counting only days with production. |
| 2026-09-17 | Financial and physical percent complete are **both** reported; the spread between them is the rate variance. |
| 2026-09-17 | **Only a CRITICAL exception, a failed QA review or an unrecorded QA outcome blocks approval.** Warnings and info flags never block. |
| 2026-09-17 | Sending a record back for correction or rejection **clears its approval stamp**. |
| 2026-09-17 | Production carries **two derived fingerprints**, both direction-normalized, so duplicate detection is a GROUP BY rather than a heuristic. An absent component is marked, never empty. |
| 2026-09-17 | The **Production ID is not sequential**. Sequential numbering is not offline-safe; the suffix is Fulcrum's own record ID, set once. |
| 2026-09-17 | A **segment ID sorts its endpoints** before joining them, so one physical path has one identity. A segment from a structure to itself is rejected. |
| 2026-09-17 | A **structure ID locks** once the structure exists in the field, and is normalized on save. |
| 2026-09-21 | **Reel consumed, slack and remaining footage are never stored.** They are sums over production records; the reel master keeps only its printed range and waste. |
| 2026-09-21 | **Slack is not subtracted from the printed reel range.** It comes off the reel inside the consumed sequential range, so it is already counted. Waste is subtracted separately. |
| 2026-09-21 | **Productivity rates divide by ACTIVE days**, and physical and value rates count them separately. A T&M day earns value and installs nothing. |
| 2026-09-21 | **A forecast with too little history returns NULL, not a number**, and every row states what it rests on. |
| 2026-09-21 | **Work date never carries forward between records.** Every other repeated field does. |
| 2026-09-21 | **No platform accessor is ever called bare.** The Data Events runtime and the expression runtime do not share a global namespace; `typeof` guards every one. Where only the expression runtime has the function, the value comes from a CalculatedField. |
| 2026-09-21 | **The test harness must never be more capable than the device.** Stubs are opt-out, so a suite can prove the script survives a runtime that lacks a global. |
| 2026-09-17 | Planned footages come from the **project master**; installed footages come from **work_category**. Neither is derived from labor-code prefixes. |
