# Sprint 1 — Core Mainline Construction App

**App:** `Mainline Construction - Development` — `61e3f7b6-f703-4f43-9602-51afb7b7843d`
**Status:** built, logic-tested, awaiting first real record entry.

Development app only. The production app was not modified.

## Hierarchy (71 elements)

```
Production ID
PROJECT INFORMATION    project, contractor, work date, inspector, crew, route,
                       segment id, + derived reporting period
WORK INFORMATION       work category, construction method, labor code,
                       labor description, quantity, unit
LOCATION               from / to, GPS lat / lon / accuracy
FIBER INFORMATION      conditional: Fiber Placement | Aerial | Drops
                       type, count, cable id, reel id, start/end sequential,
                       sequential footage, slack, other added, total installed
PRODUCTION VALUE       contractor rate, rate source id, rate effective date,
                       extended value
MATERIALS              calculated material usage (repeatable, read-only)
                       actual material used (repeatable)
QA / QC                qa status, photos, notes, exceptions, severity
APPROVAL               submitted / reviewed / approved by+date, reason, signature
```

**Status workflow:** `DRAFT → SUBMITTED → UNDER REVIEW → APPROVED | REJECTED | CORRECTION REQUIRED | VOID`

## Design decisions

### Arithmetic lives in CalculatedFields, not Data Events
The spec asked us to *investigate* Data Events for fiber footage. Pure arithmetic
— `ABS(end − start)`, total installed footage, extended value, GPS — is
implemented as CalculatedFields instead because they:

- evaluate offline with no connectivity assumption,
- are deterministic, and
- **cannot form the A→B→A update loops** that Sprint 23.37 exists to catch.

Data Events keep what arithmetic cannot do: reporting periods, labor metadata,
the persistent Production ID, segment derivation, and exception flagging.

### No master data hard-coded in JavaScript
Unit and description are parsed from the labor code's choice **label**
(`"BM2 (EA) Ground Rod"`), so the `MC Labor Code` choice list stays the single
source of truth. Adding or repricing a code needs no script change (Sprint 23.72).

Verified against paren-heavy codes such as `BM60(3)(1.25) T` — the unit capture
group only matches the six known unit tokens, so embedded `(1)` / `(MICRO)`
groups cannot be mistaken for a unit.

### Production ID
Derived from the **immutable Fulcrum record id**, assigned once, never
regenerated. Replaces the production app's `Math.random()` (defect D-03).
Format `PRD-<year>-<8 chars>`.

### Segment ID is direction-normalized
`HH-001→HH-002` and `HH-002→HH-001` both yield `HH-001_HH-002`, so reversing
From/To cannot create a phantom second segment (Sprint 23.28).

### Exceptions warn, they do not block
| Severity | Triggers |
|---|---|
| CRITICAL | missing rate, zero rate, negative quantity |
| WARNING | zero/blank quantity, orphan sequential, identical sequentials, >50,000 FT, future work date, no photos |
| INFO | weekend work date, T&M unit (HR/EVENT), missing From/To |

T&M units are explicitly tagged so they cannot leak into physical production totals.

## Test results — 31/31 pass

`node tests/data-events.test.js`

Functions are copied **verbatim** from the deployed Data Event script, so the
tests exercise the shipped logic rather than a reimplementation.

Coverage: 23.2 (sequentials — increasing, decreasing, identical, both nulls,
garbage input), 23.3 (slack), 23.13 (extended value incl. `$7.875` and
1,000,000 FT), 23.29 (Jan 1, Dec 31 → W53, week boundaries, leap day),
labor label parsing, 23.28 (segment reversal).

## Known gaps

1. **No record-creation tool exists in the Fulcrum MCP server.** Sample records
   could not be created, so **Fulcrum's own evaluation of the CalculatedField
   expressions is unverified**. They were accepted by the form API; that is not
   the same as having run. First real record entry is the actual test.
2. `Project` and `Contractor` are ChoiceFields, not RecordLinks — the masters do
   not exist yet. Both are marked in-app for Sprint 2 conversion, and the
   snapshot fields are already present so the swap will not restructure the form.
