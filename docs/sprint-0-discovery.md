# Sprint 0 — Discovery

Environment inspected 2026-09-16 via the Fulcrum MCP server.

## 🔴 Security finding — act before anything else

The **production** `Mainline Construction` app (`148545bf-b869-454e-a2b9-44a9860f23de`)
contains two live API credentials as plain string literals in its Data Event script:

- a **Fulcrum API token** (80 hex chars) — grants full account access
- a **Smartsheet API token**

Fulcrum app script is synced to **every field device** holding the app. Both
tokens must be treated as compromised and **rotated**. Any outbound integration
should obtain credentials from a server-side proxy instead.

The token values are deliberately **not** reproduced in this repository. They are
in the first six lines of that form's `script` field.

Neither token was copied into the development app.

## Account inventory

16 forms. Those that matter here:

| Form | Records | Script | Note |
|---|---:|---:|---|
| Poles and Inspections_demo_app | 10,000 | — | demo |
| Fiber Field Audit | 5,448 | 296 B | |
| SAINT PAULS | 1,274 | — | |
| Hoke CAB Splicing | 1,042 | 2,690 B | |
| **Mainline Construction** | **142** | **6,261 B** | production; see below |
| Pick List Materials | 200 | — | material master data |

- **Choice lists: 0.** The account had none before this project.
- **Classification sets: 4** — `Picklist Material Items` (the material master),
  `Bore Set`, `MST Unit`, `Splicing Type`.
- **Projects: 7.**

## What the production app actually is

`Mainline Construction` is an **as-built / inspection** app, not a production or
pay app. It has no contractor, labor code, rate, quantity, extended value, work
date or crew field anywhere. The pay/production layer is greenfield.

### Defects found in the production app

| ID | Defect |
|---|---|
| D-01 | All four footage calculations use `end - start`, not `ABS(end - start)`. Reversed sequentials yield negative footage. |
| **D-02** | `fiber_footage_sc_er` references `$end_sequential_sc` / `$start_sequential_sc` — the **Construction** keys — instead of the `_er` keys. Emergency Response footage is computed from the wrong fields. **Live data bug.** |
| D-03 | `task_id` is `Math.random()`-derived: not collision-free, not a durable identifier. |
| D-04 | Required-field validation is bypassed for a hard-coded email allowlist. |

## Offline architecture finding

Fulcrum Data Events expose exactly one cross-record lookup mechanism: `REQUEST`
(HTTP), which is **online-only**. The production script contains three
abandoned, commented-out `REQUEST`/Query attempts — the team already hit this.

What they shipped instead is the correct pattern and the one this project adopts:
**`RecordLinkField` + `record_defaults`**, which physically copies values from a
linked record at selection time. It works offline, and because the copy is
physical, a later master-data change cannot retroactively rewrite history.

One mechanism therefore satisfies both the offline requirement and the
historical-rate-snapshot requirement.

**Open question for Sprint 2:** whether `record_conditions` can filter selectable
records against *the current record's* values, or only static conditions. The
production app only uses the static form. This determines how much of rate
selection can be automatic.

## Rate sheet analysis — `River_City_Rates.xlsx`

149 rows, one contractor, no contractor / project / effective-date columns.

- 6 distinct units after normalization from **7 inconsistent source strings**.
- **4 duplicate code keys, 3 with conflicting rates.**
- 77 of 149 codes carry stray whitespace, newlines or U+FFFD replacement chars.
- Several plow-block descriptions are shifted one row relative to their code.
- `BM60(n)(size)` encodes conduit count × diameter **in the code itself** — most
  of the labor→material multiplier table can be derived rather than hand-authored.

143 pay units are loadable after the rulings in the implementation log.
Regenerate with `scripts/normalize_rates.py`.
