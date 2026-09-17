# Sprint 8 revision — directional bore, size-dependent material, real SKUs

Three rulings landed 2026-09-17 and one of them corrected v4.0.0.

---

## Ruling 1 — 2" and 4" are always one pull

> "2" and 4" should always be 1 pull."

There is no bundled 2" or 4" product. The catalogue stocks exactly one 4" item,
`#RM-4-11-O-750` *4" SDR 11 ORANGE (750') CONDUIT* — a single pipe.

That settles the multiplier question per size:

| Diameter | Product | Material per production FT |
|---|---|---|
| 1.25" | bundled 1-, 2- and 3-PULL assemblies | **1 FT**, whatever the pull count |
| 2" | single pipe | **n FT** for an n-pull run |
| 4" | single pipe | **n FT** for an n-pull run |

**v4.0.0 was wrong for 2" and 4".** It applied 1:1 to every size, so a 3-pull 4"
trench recorded 500 FT of pipe where 1,500 FT went in the ground — a **67%
under-order**. v5.0.0 makes the multiplier size dependent.

The direction of the v4 error is worth noting: v3.0.0 over-ordered 1.25" by 3x,
v4.0.0 fixed that and under-ordered 2"/4" by the same factor. Both came from
assuming one multiplier fits every size.

---

## Ruling 2 — directional bore becomes one unit per pull count

The source sheet priced directional bore as a base plus an adder:

| Source code | Rate | Wording |
|---|---:|---|
| `BM60-(1.25)DP` | $10.00/FT | one pipe |
| `BM60-(1.25)DPD Dual` | $2.00/FT | "a **second or more** ... pulling multiple pipes back at one time" |

So a 3-pull bore meant **three transactions** ($10 + $2 + $2) and nothing in the
record stated the pull count. Ruling: expand into one unit per pull count, named
like the plow units.

| New pay unit | Rate | Band |
|---|---:|---|
| `BM60(1)(1.25)DP` | **$10.00** | one pipe |
| `BM60(2)(1.25)DP` | **$12.00** | 2-3 pipes |
| `BM60(3)(1.25)DP` | **$12.00** | 2-3 pipes |
| `BM60(4)(1.25)DP` | **$14.00** | 4-5 pipes |
| `BM60(5)(1.25)DP` | **$14.00** | 4-5 pipes |

**The schedule is banded, not additive** — stated by the contract owner
2026-09-17. Pipes 2 and 3 cost the same, and so do 4 and 5; the $2 Dual adder
does not compound per pipe. An additive reading would have priced a 5-pull bore
at $18 instead of $14, a **29% overbill**.

The bands are listed literally in `scripts/normalize_rates.py` rather than
computed. A banded schedule is master data: any formula fitted to five points
would also be a claim about pipes 6 and up, which nobody has priced.
`TEST-DPRATE-013` asserts the table is *not* additive, so it cannot be
"simplified" back into a formula.

The two source codes are **retired**. The Data Event flags either of them as
**CRITICAL** if a device with a stale choice list still offers one, naming the
replacement — a retired code carries no pull count, so silently accepting it
would lose the fact the restructure exists to capture.

**2" and 4" directional bore keep their base/adder pairs.** The ruling named
1.25". `BM60-(2)DP` / `BM60-(2) DPD Dual` and `BM60-(4)DP` / `BM60-(4) DPD Dual`
have the identical structure and the identical problem, and are listed as an
open item rather than changed unasked.

Labor master: 143 → **146 pay units** (two retired, five added).

---

## Ruling 3 — material matched from observed consumption

Three tables supplied: two projects' per-unit consumption records and one
inventory list. Transcribed verbatim into
`data/source/material-observations.py` and turned into masters by
`scripts/build_material_mapping.py`.

### The method

A ratio is *item quantity ÷ eligible production quantity*. Nothing is invented:

| Confidence | Rule | Status |
|---|---|---|
| **RULING** | derived from a stated business rule (all conduit) | APPROVED |
| **CONFIRMED** | both projects agree within 5% | APPROVED |
| **SINGLE SOURCE** | one project, ratio lands on a whole number | APPROVED as a baseline |
| **SINGLE SOURCE** | one project, fractional ratio | review — wrong driver |
| **CONFLICT** | projects disagree on the ratio | review |
| **COMPETING SKU** | a one-structure unit names several structures | review |
| **REEL-SOURCED** | fiber cable — SKU belongs to the reel | review |

**135 material items, 135 mappings, 58 APPROVED.**

### Ratios two independent projects confirmed

These are the strongest results in the whole dataset — same numbers, different
jobs, different crews:

| Pay unit | Consumes |
|---|---|
| `AFO.GAA` (screw anchor + down guy) | 1 helix anchor, **30 FT** of 1/4" EHS strand, 1 spring washer, **2** guy grips |
| `AFO.GG` | 1 guy guard |
| `AFO.BOND` | 1 #4 split bolt, 1 Weaver connector |
| `BM2` | 1 ground rod, 1 ground-rod clamp |
| `BM53` | 1 marker post |
| `BM81` | 1 riser guard |
| `BM90` | 1 FT toneable tracer tape per FT |
| `AFO.OLASH` | 1 FT lash wire per FT |
| `HO-1 (any band)` | 1 40mm heat shrink sleeve per splice |

`AFO.GAA` is the nicest: 4,590 ÷ 153 and 3,150 ÷ 105 both give exactly **30 FT**
of strand per anchor, and both give exactly **2** guy grips. Two projects
agreeing to that precision is a derivation, not a guess.

### Fractional ratios reveal the wrong driver

`AFO.SL` consumes sign markers at 0.0025/FT and 5/8" nut squares at 0.0022/FT.
Those are not per-foot items — they are **per pole**. A ratio against footage
just encodes whatever pole spacing that job happened to have. Flagged with the
question stated: find the real driver (pole count, span count, structure count)
before approving. The same reading applies to the HST stubs recorded against
`AFO.RTD` footage, which belong to the `BFO.HST.*` per-stub pay units.

### Competing SKUs are not a bill of materials

`BHF-30T` names three structures across the two projects: a 17x30x24 shield
vault, a 17x30x24 Duralite and a 24x36x36 Duralite. A handhole pay unit installs
**exactly one** structure, so approving all three would order three vaults per
hole. Seven such rows are demoted to review with the choice stated. The same
check does *not* fire on `AFO.GAA`, where an anchor and a washer genuinely are
both consumed.

### Pack size is separate from multiplier

Many SKUs are a pack, not a piece: a 100pc box of D-clamps, a 5,000 FT strand
reel, an 8,000 FT conduit reel. The observed ratios are in **pieces and feet**,
so pack size is its own column (18 items carry one) and purchasing divides by
it. Folding a pack size into a multiplier would silently corrupt the quantity.

### Waste factor is separate too

The source data heads the conduit block **"DUCT PLUS 10% WASTE"**. That 10% is a
purchasing allowance, not a measurement, so it is a `waste_factor` column on the
mapping and is **not** applied in the app. Installed quantity stays a clean
statement of what went in the ground:

```
purchase qty = production qty x multiplier x waste_factor
installed qty = production qty x multiplier
```

### Fiber cable SKU belongs to the reel, not the pay unit

`BFO.288.I` drew `26507676` (288F ACCUROLL) on one project and
`FIBR288SMSALTOS` (288F Prysmian Loose Tube) on the other. Same pay unit, same
fiber count, different cable. The SKU is a property of the physical reel, so 18
cable mappings are marked **REEL-SOURCED**: take the code from the linked Fiber
Reel record. A static labor→material row would be wrong on one project or the
other, always.

---

## What the data exposed: seven billing gaps

Production was recorded against seven labels with **no pay unit in the rate
sheet** — work done with no rate to bill it. In `data/labor-billing-gaps.csv`:

| Label | Eligible | Note |
|---|---:|---|
| `BFO.96.I` | **11,004** | 96-count buried fiber. The sheet has 12/48/72/144/288, no 96 |
| `BFO.96.IE` | **2,008** | same, `.IE` variant |
| `BM60 (4)DP SDR11 RR` | **684** | 4" railroad bore. Only 1.25" and 2" railroad units exist |
| `AFO.BANDING` | 214 | 214 banding bolts consumed, no pay unit |
| `BDO(M)` | 45 | medium pedestal. `BDO7` exists; not obviously the same unit |
| `HO1-12R` | 69 | ribbon splice. Already open item 5 — in the classification set, no rate |
| `BHF-PH` | 9 | no pay unit |

13,000+ FT of 96-count fiber is the one to look at first.

Eleven further source labels **were** reconciled as transcription variants and
are listed in `LABOR_CODE_ALIASES` — including `HO-1 (73-144)`, which the rate
sheet carries as `HO-1 (73 -144)` with a stray space.

---

## Deployment state

| Object | State |
|---|---|
| `MC Labor Code` choice list | **DEPLOYED** — 146 entries, DP restructured |
| Rate sheet CSV, labor master, material master, mappings | in the repo, regenerated by script |
| `Mainline Construction - Development` v5.0.0 elements + script | **NOT DEPLOYED** |

`forms_update` is returning `could_not_update_form: Please try again later` for
**every** form on this account, including a 12-element one. `choice_lists_update`
succeeds, so this is not permissions and not payload shape — it is the form
update endpoint. Confirmed by four attempts across two forms and three payload
shapes.

Recreating the form was rejected as a workaround: `MC Material Transaction`
holds a RecordLink to this form's ID, and repointing it needs the same broken
endpoint, so a recreate would leave a dangling link.

**Live behaviour meanwhile.** The v4.0.0 script already parses
`BM60(n)(1.25)DP` correctly — the regex reads `BM60(n)(size)` whatever follows —
so the new DP units derive their pull count, diameter and material code today,
and 1.25" material quantity is right. The one live defect is **2" and 4"
multi-pull material quantity, which still reads 1:1** and under-reports. No 2"
or 4" conduit SKU is loaded yet either, so nothing downstream consumes that
number until the part numbers arrive.

`fulcrum/schemas/mainline-construction-dev.elements.json` and
`fulcrum/data-events/mainline-construction-dev.js` hold the exact v5.0.0 payload
to push when the endpoint recovers.

---

## Tests

**180 passing across six suites** at this commit, 184 once the rate-band
tests landed. The new `tests/conduit-dp-material.test.js` (67, then 71) covers DP parsing 1-5, the
size-dependent multiplier for all three diameters, out-of-scope sizes, the
retired-code CRITICAL flag, and the five expanded DP rates read from the
generated CSV.

Two parity tests exist because one rule now lives in more than one place:

- **TEST-EXPR-001..004** — the multiplier sits in the `m117` CalculatedField
  expression rather than a derived field (that field is what the broken endpoint
  refuses to add). The test reads `BUNDLED_CONDUIT_SIZES` out of the script and
  asserts the expression tests the same size and agrees on every conduit unit.
- **TEST-PARITY-001..002** — `scripts/build_material_mapping.py` reimplements the
  conduit parser in Python. The test runs both over all 146 pay units and fails
  if they disagree on any one.

### The harness change

`tests/harness.js` is new and the older suites now use it. Each suite used to
re-type the functions it tested. When v5.0.0 changed the conduit multiplier,
`tests/splice-material.test.js` kept passing against its own stale copy while
asserting `CONDUIT-2-2PULL`, a SKU the ruling says does not exist.

A suite that passes while the shipped script disagrees with it is worse than no
suite. The harness loads `fulcrum/data-events/*.js` directly, stubs Fulcrum's
runtime globals, and defines the `$field` identifiers as getters over a mutable
record, so `SETVALUE` is observable exactly as on a device. There is now one
copy of every rule and the tests cannot drift from it.
