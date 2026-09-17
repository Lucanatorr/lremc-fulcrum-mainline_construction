# Sprints 5 & 6 — Underground and Aerial

Both deployed to `Mainline Construction - Development`
(`06c36c8e-4a88-4cf3-a691-9a792f8374d2`), Data Events **v3.0.0**.

The app now has 112 elements across ten sections. UNDERGROUND and AERIAL are
conditional on Work Category, so a boring crew never scrolls past pole fields.

## Sprint 5 — Underground

### The conduit package derives itself

The rate sheet encodes the package **in the pay-unit code**: `BM60(3)(1.25) T`
*means* three 1.25" conduits, by the contract's own naming. So the app reads it
rather than asking:

| Labor code | Conduit count | Diameter |
|---|---:|---|
| `BM60(3)(1.25) T` | 3 | 1.25 |
| `BM60(2)(2) T` | 2 | 2 |
| `BM60-(4)DP` | 1 | 4 |
| `BM60-(7Way)P Micro Duct` | 1 | MICRO |
| `BM60-R` (rock adder) | — | — |
| `BM60-DROP` | — | — |

**Calculated Conduit Footage = production footage × conduit count.** 500 FT of a
3× package is 1,500 FT of conduit, and the field user never does that arithmetic
— exactly the Sprint 5 worked example.

**42 of 43 BM60 codes parse.** `BM60-DROP` states no size, so it derives nothing
and raises an INFO flag rather than guessing.

This is not "hard-coded master data": parsing the code reads a contract fact.
*Which* SKU that consumes, and how much, is a business rule and lives in the
mapping master.

### Other underground capture
From/To station, depth, surface type, crossing type (incl. railroad), rock
encountered, trace wire, and restoration required / type / status — the last two
conditional on restoration being required.

Plausibility flags: depth below the 36" contract minimum (WARNING), and a
railroad crossing recorded against a non-railroad pay unit (WARNING).

## Sprint 6 — Aerial

Pole ID, previous/next pole, derived Span ID, span footage, pole owner, height,
class, status, attachment type, anchors, down guys, risers, snowshoes,
make-ready and bonding.

**Span ID is direction-normalized** by the same function as Segment ID, so
`P-101 → P-102` and `P-102 → P-101` are one span, not two.

**Span footage is entered, not derived.** Sprint 6 asks whether it can be
automatic. It cannot yet: there is no pole dataset with coordinates in this
account. The existing `Poles and Inspections_demo_app` (10,000 records) may be a
candidate source — worth investigating before anyone hand-keys span lengths at
scale.

Plausibility: a span over 500 FT is unusual for distribution (WARNING).

## Labor → Material mapping

`MC Labor-Material Mapping - Development` (`38e3d7fd-ca78-4016-8018-ec955446c13f`).

Multipliers are **records, not code**. Mappings are effective-dated, versioned
via `Supersedes Mapping ID`, and carry a `Source` field recording provenance —
`DERIVED` (a fact from the code), `BUSINESS RULE` (a human decided), or
`NEEDS REVIEW`. A mapping whose source is still NEEDS REVIEW cannot be approved.
A zero multiplier is blocked outright: it consumes nothing, which is
indistinguishable from a missing mapping in every downstream report.

### 🔴 Two findings that block material automation

**1. The bundled-conduit ambiguity — a 3× difference.**
The material master stocks `1-PULL`, `2-PULL` and `3-PULL` 1.25" conduit as
*separate SKUs*. So `BM60(3)(1.25) T` could mean either:

- 1 FT of the **3-PULL** SKU per production FT, or
- 3 FT of the **1-PULL** SKU per production FT.

Both are defensible. They differ by 3× in material consumption. All 14 proposed
mappings assume the bundled reading and are flagged `NEEDS_REVIEW` — none will
drive a calculation until someone confirms. This is precisely the case Sprint
23.67 says to escalate rather than invent.

**2. The material master only stocks 1.25" conduit.**
29 of 43 conduit pay units have no material SKU at all:

| Missing | Pay units affected |
|---|---:|
| 2" conduit | 12 |
| 4" conduit | 10 |
| Micro duct | 3 |
| 0.75" conduit | 3 |
| Size not stated (`BM60-DROP`) | 1 |

Those codes can be priced and their conduit footage calculated, but material
consumption cannot be derived until the SKUs exist.

Proposed mappings: `data/import/labor-material-mapping-proposed.csv`.
Gaps: superseded 2026-09-17 by `data/material-mapping-conflicts.csv` and `data/labor-billing-gaps.csv`.

## Sequential overlap — a server-side report, by decision

`reports/sequential-overlap.sql`.

Cross-record overlap detection requires scanning other records. Data Events
offer only online-only HTTP, so a device-side check would **silently vanish**
whenever a crew loses service — and people would keep trusting it. The split:

- **On the device, offline:** outside-reel-range validation, which needs only
  values already copied onto the record.
- **Server-side, always:** cross-record overlap.

### Adopted adjacency rule (Sprint 23.4)

Ranges that share exactly one boundary (`a.end = b.start`) are **legitimate
adjacency, not an overlap**. Reels are consumed continuously, so the end of one
pull is routinely the start of the next; flagging those would bury real overlaps
in noise. Only an intersection of more than a single sequential counts.

| Classification | Severity |
|---|---|
| EXACT DUPLICATE | CRITICAL |
| CONTAINED | CRITICAL |
| PARTIAL OVERLAP | WARNING |
| ADJACENT | INFO |

Ranges are normalized before comparison, so direction never affects the result.
9/9 tests pass, including the spec's own worked examples and reversed variants.
