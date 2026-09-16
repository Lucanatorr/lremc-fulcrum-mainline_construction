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

## Sprint 4 — Fiber Construction: COMPLETE

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

### Reel link — done
`reel_link` on the production app copies the reel's ID and printed
beginning/ending sequential down onto the transaction. `validateReelRange()`
then compares production sequentials to those snapshots **offline**. The reel
range is normalized, so a reel entered high-to-low still validates correctly.

### Sequential overlap — implemented as a server-side report

`reports/sequential-overlap.sql`. See `docs/sprint-5-6-build.md` for the
reasoning and the adopted adjacency rule.
