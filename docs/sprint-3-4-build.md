# Sprints 3 & 4 — Automation, and Fiber Construction

## Sprint 3 — Automation and Data Events: COMPLETE

Deployed as **v2.0.0** on `Mainline Construction - Development`, superseding the
Sprint 1 v1.0.0 script. Version identifier and change rationale are in the
script header (Sprint 23.47.20).

Priority order from the spec, and where each landed:

| # | Capability | Implementation |
|---|---|---|
| 1 | Fiber sequential calculation | CalculatedField, `ABS(end - start)` |
| 2 | Fiber total calculation | CalculatedField, sequential + slack + other |
| 3 | Labor metadata | Data Event, parsed from the choice label |
| 4 | Rate lookup | RecordLink + `record_defaults` (offline-safe copy) |
| 5 | Extended pricing | CalculatedField, `ROUND(qty * rate, 2)` |
| 6 | Material calculation | **Deferred** — needs the mapping master |
| 7 | Reporting dates | Data Event, ISO week / month / year / day |
| 8 | Validation | `validateRate()` + `buildExceptions()` |
| 9 | QA flags | `exception_flags` + `exception_severity` |

### Reusable functions
`isBlank`, `toNum`, `choiceValue`, `choiceLabel`, `setIfChanged`, `parseDate`,
`dayOnly`, `isoWeek`, `pad2`, `deriveReportingPeriod`, `applyLaborMetadata`,
`deriveSegmentId`, `validateRate`, `buildExceptions`, `assignProductionId`.

### Loop safety (Sprint 23.37)
Two structural defences rather than one:

1. All arithmetic lives in CalculatedFields, which cannot trigger Data Events.
2. Every Data Event write goes through `setIfChanged`, which compares before
   writing, so a no-op save writes nothing.

## Sprint 4 — Fiber Construction: PARTIAL

### Done
`MC Fiber Reel - Development` (`728477da-5f36-48cb-b3ab-cbc8c38d077f`).

The reel master keeps **printed sequential consumption, physical installed
footage, slack and waste as four separate concepts**, because cable handling
means the physical quantity consumed differs from route footage (Sprint 17).
`Estimated Remaining Footage` subtracts consumption and waste but deliberately
**not** slack — slack is installed footage already inside the consumed
sequential range, so subtracting it again would double-count.

Guards: a zero-length reel and a reel over 40,000 FT are both blocked in the
master, where one bad range would otherwise mis-validate every production record
referencing that reel.

The production app already carries `cable_id`, `reel_id`, `fiber_type`,
`fiber_count`, sequentials, slack, other added footage and total installed
footage, conditional on work category.

### Remaining
1. Add `reel_link` (RecordLink → Fiber Reel) to the production app, copying down
   the reel's beginning/ending sequential.
2. Add outside-reel-range validation comparing production sequentials to those
   snapshots — offline-safe, same pattern as the rate checks.

### Sequential overlap detection — an architectural limitation

Sprint 4 asks for overlap detection across records (`100000-105000` vs
`104500-108000`). This **cannot be done offline**: it requires scanning other
production records, and Data Events offer only online-only HTTP lookup.

Options, in preference order:

1. **Server-side exception report** over the production dataset. Catches every
   overlap, needs no connectivity in the field, but is after-the-fact.
2. **Online-only check** via `REQUEST` when connectivity exists — best-effort
   only, and silently absent offline, which is the worst property for a control.
3. Reel-range validation (item 2 above), which is **not** overlap detection but
   catches the most common data-entry error offline.

Recommendation: 1 + 3. Do not pretend 2 is a control.
