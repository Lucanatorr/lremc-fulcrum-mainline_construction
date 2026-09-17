# Mainline Construction — Implementation Log

Running log for the Fulcrum **Mainline Construction** build.
Newest entries first. Every Fulcrum object this project creates is listed in
`docs/fulcrum-inventory.md`.

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
| 16 | **Budget rates are assumed to equal contract rates.** The scope line prices its budget from the contractor rate master. If LREMC budgets at an internal rate, that is a separate master | Sprint 9 | Open |
| 17 | **Change order line rates are typed, not snapshotted.** A RecordLink inside a repeatable was not attempted, so nothing checks a typed line rate against the rate sheet | Sprint 9 | Open |
| 15 | **`forms_update` outage.** v5.0.0 app payload ready but undeployable; every form update returns `could_not_update_form`. Retry when Fulcrum recovers | Sprint 8 rev | **Open — blocks deploy** |
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
