# Sprints 16, 17 & 18 — forecasting, fiber reels, field UX

Four new reports, a restructured reel master, and a field-entry pass over the
production app. **704 tests across thirteen suites.**

Deployed 2026-09-21: `MC Fiber Reel` at 17:32:15Z, the production app
(v7.2.0) at 17:40:37Z. Both verified element-by-element against this repo.

---

## Sprint 16 — Forecasting and productivity

Two reports. Both live or die on one rule the brief states twice, from
different directions:

> "Do not mix unlike units into a meaningless physical-production total.
> Financial production can be aggregated across different labor units because
> they share a currency unit."

### `productivity.sql`

FT/day, EA/day, splices/day, SF/day and value/day, by **crew**, **contractor**
and **construction method**.

Every physical column is fenced to one unit of measure and reported as its own
column. Value is the only figure summed across pay units. A productivity report
is precisely where someone is tempted to add feet to each to splices and call
the result "units per day", so `TEST-PROD-001` fails the build if any
`SUM(...quantity...)` in that file is not fenced by `unit = '...'`.

**Two denominators, deliberately.** The brief says to avoid zero-production
days, so the divisor is ACTIVE days — days that crew actually booked
production — not elapsed or working days. A crew that placed 4,000 FT over four
days ran at 1,000 FT/day; dividing by the week's five working days reports 800
and makes a crew look slow because it rained on Friday.

But a day spent entirely on flagging (HR) earns value and puts nothing in the
ground. So `physical_active_days` and `value_active_days` are counted
separately. One denominator for both would understate the physical rate of any
crew that did T&M work.

Every row carries `sample_strength`. A rate from two days is arithmetic, not a
trend, and it says so rather than looking authoritative.

### `forecast-completion.sql`

`remaining quantity / recent average daily production = estimated working days
remaining`, per project **and pay unit**.

- `p_window_days` (default 10) is the configurable recent window the brief asks
  for, counted in active working days and ranked by recency. Recent matters:
  a crew that averaged 300 FT/day in easy plow and is now at 80 FT/day in rock
  will finish at 80. A project-to-date average forecasts from conditions that
  are gone.
- `HAVING SUM(quantity) > 0` is what makes the window *active*. A gap for
  weather is not a slow day; counting it as a zero halves the rate and doubles
  the forecast.
- Below `p_min_days_for_forecast` (default 3) the estimate is **NULL**, not a
  number. Every row states its `forecast_basis`.
- One row per pay unit, never per project: there is no "average daily
  production" for a project whose work is feet, each and splices. Across a
  project the days-remaining figure is a MAX, not a SUM — pay units run
  concurrently, so the longest pole is the finish date.

The brief's own caution is in the file header: this is an operational estimate,
not a contractual completion guarantee. It knows nothing about permits,
make-ready, weather or rock.

---

## Sprint 17 — Fiber reel management

Sprint 4 had already built most of the reel master and anticipated this sprint
by name. What Sprint 17 added, and what it had to take away.

### Added

- **Project and contractor assignment** (`f013`–`f018`), RecordLinks with the
  ID and name copied down, like every other link in this system, so a reel
  record resolves offline and survives a master edit.
- **`reel-balance.sql`** — the five concepts the brief insists stay separate.
- **`reel-integrity.sql`** — outside reel range, impossible sequential, unknown
  reel, no reel linked, over-consumed reel.

### Removed, and why it mattered

`printed_sequential_consumed`, `slack_recorded` and
`estimated_remaining_footage` were fields on the reel master. All three were
**sums over production records**, and nothing populated them — nothing on a
device *can*, because a record cannot see other records.

The consequence was not merely a blank field. `estimated_remaining_footage` was
a CalculatedField:

```
original_reel_footage - printed_sequential_consumed - waste_recorded
```

with the middle term permanently null. So it computed `original - waste` and
labelled it "Estimated Remaining Footage". **A reel that had been fully pulled
would still report its full length as remaining**, and somebody would plan a
pull against it.

A confidently wrong number on a master is worse than no number. The three
fields are gone; `reel-balance.sql` computes them, exactly as scope totals are
computed in `project-scope-status.sql` rather than stored.

Only `waste_recorded` stays, because it is a fact about the reel that no
production record carries.

### The five concepts

| Concept | Where it comes from |
|---|---|
| Printed sequential consumed | `SUM(sequential_footage)` — the jacket numbers |
| Physical installed footage | `SUM(total_installed_footage)` — sequential + slack + other |
| Slack | `SUM(slack_footage)` — installed, but not route distance |
| Waste | `waste_recorded` on the reel — off the reel, installed nowhere |
| Remaining (estimate) | original − printed consumed − waste |

**Slack is not subtracted twice.** The brief warns against subtracting slack
from the printed range, and the reason is physical: slack is pulled off the reel
*inside* the consumed sequential range — the jacket numbers advance while the
coil is being pulled — so it is already inside "printed consumed". Subtracting
it again would understate every reel by the size of its coils. Waste *is*
subtracted separately, because cut-back cable leaves the reel without ever
appearing in an installed range. `TEST-REEL-002` asserts the remaining
expression contains no slack term.

`handling_difference` (physical installed − printed consumed) is the column
that exposes the thing the brief cares about: cable handling causing physical
consumption to differ from route footage.

### What reel-integrity deliberately does NOT do

Overlap and duplicate range are **not** re-implemented. `sequential-overlap.sql`
already classifies them (EXACT DUPLICATE / CONTAINED / PARTIAL OVERLAP /
ADJACENT, with touching ranges treated as legitimate adjacency). Two
implementations of one check is how two reports come to disagree about the same
pair of records. `TEST-RINT-002` fails the build if that logic reappears here.

What it does add is the check the device cannot repeat: the app's outside-range
warning fires against the reel range **as snapshotted when the reel was
linked**. If the reel master is later corrected, that warning does not re-run —
by design, since correcting a reel must never silently rewrite historical
installation. This report re-tests every record against the reel's *current*
range and is how those records get found.

---

## Sprint 18 — Field user experience

> "The goal is minimum manual entry... The system should derive everything else
> that can safely be derived."

### Fields that carry forward

`default_previous_value` on project, contractor, crew, route, work category and
construction method. A crew booking twelve records in a shift now re-picks none
of them.

**Work date is deliberately excluded.** `default_previous_value` persists across
days on a device, so the first entry of a new shift would silently inherit
yesterday's date. A mis-dated record corrupts the ISO week, the forecast window
and every per-day rate in `productivity.sql` — and unlike a future date, nothing
in the exception model would catch it. The saving is one tap; the failure is
silent and wide. `TEST-S18-030` asserts it stays off.

### Quantity derives from sequentials

The brief asks for "production quantity **or** sequentials". A crew that
recorded 1000→4200 has already said 3200 FT, so for fiber placement billed in
FT, quantity fills in from sequential + slack + other as soon as the range is
entered.

Only when blank. **A typed quantity is never overwritten** — the billed quantity
is the crew's claim, not this script's arithmetic.

It is computed from the component fields rather than read from
`$total_installed_footage`: that field is a CalculatedField evaluated by the
expression runtime, and this runs in the Data Events runtime, where its value
may not yet reflect the current save. The components are plain fields and are
current.

A companion WARNING fires when a typed quantity and the installed footage
disagree by more than 5% — how a transposed sequential or a quantity typed in
the wrong unit gets caught at entry instead of in a billing dispute.

### Deriving work category from the labor code: NOT done

This is the obvious next saving and it was left alone. It contradicts the
2026-09-17 ruling that installed footage comes from `work_category` and is never
inferred from a labor-code prefix. Deriving the category from the prefix would
make that ruling self-referential — the prefix would decide the category the
ruling says must not come from the prefix. `TEST-S18-020` asserts the script
never sets `work_category`.

Reversing that ruling is a business decision, not a refactor. See open item 26.

### Conditional fields and validation levels: already in place

The brief's conditional-visibility table was satisfied by Sprints 5–7, and
audited here against the spec:

| Work Type | Brief asks to show | State |
|---|---|---|
| Fiber | Cable ID, Reel ID, Fiber Count, Start/End Sequential, Slack | FIBER INFORMATION section, visible for Fiber Placement / Aerial / Drops |
| Underground | Construction Method, Conduit Package, From/To Structure, Footage | UNDERGROUND section; construction method and From/To are in always-visible sections, which is a superset |
| Splicing | Structure, Closure, Cable, Fiber Count, Splice Quantity | SPLICING section |
| Aerial | Pole / span fields | AERIAL section |

The three-level model — INFORMATIONAL / WARNING / BLOCKING — has been the
exception model since Sprint 18's rules were written into `buildExceptions`.
Blocking is reserved for CRITICAL, and the approval gate is the only place a
save is refused outright. Warnings never block: a blocked save loses field work.

---

## Still open after these sprints

- **No report has been executed.** Zero records exist in any dev app and the MCP
  server exposes no record-creation tool. The four new reports join the other
  seventeen as unproven SQL. This remains the project's biggest blocker.
- `productivity.sql` and `forecast-completion.sql` both read `work_day_of_week`,
  which is derived on the record. Backfilled or API-written records that never
  ran the Data Events would have it blank and drop out of both reports.
