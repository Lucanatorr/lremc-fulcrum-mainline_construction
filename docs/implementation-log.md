# Mainline Construction — Implementation Log

Running log for the Fulcrum **Mainline Construction** build.
Newest entries first. Every Fulcrum object this project creates is listed in
`docs/fulcrum-inventory.md`.

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
| 6 | **Bundled conduit ambiguity.** `BM60(3)(1.25)` = 1 FT of the 3-PULL SKU, or 3 FT of the 1-PULL SKU? A **3x** difference in material consumption. Blocks all 14 proposed conduit mappings | Sprint 5 | **Open — blocks material automation** |
| 7 | **Material master stocks only 1.25" conduit.** 29 of 43 conduit pay units (2", 4", micro, 0.75") have no SKU | Sprint 5 | **Open** |
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
