# Business Decision Log

Required by the master prompt ("REQUIRED CONTINUOUS LOGS"). Columns are the
ones the prompt specifies. Decisions were previously recorded only as `RULING`
blocks inside scripts and prose in the implementation log; this is the register.

"Approved By" records who actually made the call. Where it says *Claude
(design)* the decision was made in the build and has not been ratified by the
business owner — those are the ones to review first.

| ID | Date | Decision | Reason | Affected Components | Approved By |
|---|---|---|---|---|---|
| D-001 | 2026-09-16 | The reporting week is ISO-8601, Monday start, Mon–Fri working week | The prompt asks for the first day of the reporting week to be settled explicitly; ISO-8601 is unambiguous across year boundaries | `work_week`, production-weekly, productivity, forecast-completion | Claude (design) |
| D-002 | 2026-09-16 | Only APPROVED production counts toward earned value | Prompt: "Never represent submitted historical activity as approved earned value" | Every financial report, project-financial, project-summary | Business owner |
| D-003 | 2026-09-16 | The rate is snapshotted physically onto the production record at selection | Prompt requires historical pricing to survive master repricing; a physical copy is also what makes pricing work offline | `rate_link` record_defaults, rate-audit, production-audit-trail | Business owner |
| D-004 | 2026-09-16 | `(n)` in `BM60(n)(size)` is the PULL COUNT | Rate-sheet reading confirmed with the business owner | Conduit derivation, material mapping | Business owner |
| D-005 | 2026-09-17 | Material consumption depends on conduit SIZE, not pull count alone: 1.25" bundled assemblies consume 1:1; 2" and 4" consume pull-count × footage | A multi-pull 1.25" run is one bundled product; 2" and 4" have no bundled equivalent. **This contradicts the master prompt's own Sprint 8 example**, which implies 3×1.25" consumes 3× footage | `conduit_material_quantity`, material-variance, mapping master | Business owner |
| D-006 | 2026-09-17 | Directional bore restructured into five discrete pay units `BM60(1..5)(1.25)DP`, retiring the base + "Dual" adder pair | The adder structure could not express the real contract price bands | MC Labor Code choice list, rate master | Business owner |
| D-007 | 2026-09-17 | Installed footage comes from `work_category`, never inferred from a labor-code prefix | A prefix is not a category; inferring one from the other makes the rule self-referential | `applyLaborMetadata`, Sprint 18 field UX | Business owner |
| D-008 | 2026-09-18 | **The DP rate schedule is BANDED, not additive**: 10 / 12 / 12 / 14 / 14 for 1–5 pulls | An earlier additive reading was wrong. Confirmed live: `BM60(2)(1.25)DP` = $12.00 | Rate master, conduit-dp-material tests | Business owner |
| D-009 | 2026-09-17 | Negative quantities are valid only on an `Adjusted` material transaction | Prompt: adjustments and reversals must use an explicit controlled transaction type | Material transaction script | Claude (design) |
| D-010 | 2026-09-17 | The project scope baseline is immutable once BASELINED; scope changes go through a change order | Prompt: "Baseline scope must remain distinguishable from approved change-order scope" | Scope line script, project-scope-status | Business owner |
| D-011 | 2026-09-18 | Only a CRITICAL exception blocks approval; WARNING and INFO never block a save | Prompt: "Do not automatically reject records solely because of a warning" | Approval gate, exception model | Business owner |
| D-012 | 2026-09-19 | No totals are stored on master records; every total is derived in a report | A stored total goes stale the moment the next production record syncs | Fiber reel (f008/f009/f011 removed), scope line | Claude (design) |
| D-013 | 2026-09-21 | Creator identity comes from platform metadata (`_created_by_id` → `memberships`), not a stored field | `USEREMAIL` resolves in neither runtime on this account, and a stored copy would go stale | `inspector_email` removed; audit-trail and qa-review-queue joins | Business owner |
| D-014 | 2026-09-21 | Ten labor–material mapping rows held back from the import rather than guessed | Prompt: "Never guess a multiplier. Flag ambiguous mappings for business review" | `data/import/_held-back-labor-material-mapping.csv` | Claude (design) |
| D-015 | 2026-09-22 | The unit is copied from the selected rate, not parsed from the labor code label | The Data Events runtime exposes no choice labels, so the documented derivation was impossible and was erasing the unit | `rate_link` record_defaults r010→m024, v7.4.0 | Claude (design) |
| D-016 | 2026-09-22 | The Labor-Material Mapping master is keyed on **labor code**; `CONDUIT-<size>-<n>PULL` is a readable derivation, not a key | The ledger and material master are keyed on stock part numbers | exception-dashboard, material-variance | Claude (design) |
| D-017 | 2026-09-22 | A work date is a calendar date, normalized from its UTC components | Reading UTC midnight with local getters moved every record back a day west of UTC | `parseDate`, v7.5.0 | Claude (design) |

## Decisions the prompt names that are still open

The prompt specifically lists these as decisions to record. Two have no answer yet.

| Question | Status |
|---|---|
| First day of the reporting week | Settled — D-001 |
| Whether only approved production counts toward completion | Settled — D-002 |
| The historical-rate snapshot rule | Settled — D-003 |
| Treatment of negative transactions | Settled for materials (D-009); **open for production** — production has no Adjusted/Reversed state |
| Closed-project behaviour | Partly settled — closeout gates exist; **whether a closed project hard-rejects new production is not enforced on the production app** |
| The organizational timezone | **Open.** D-017 makes derivation timezone-independent, which removes the defect, but nobody has stated the reporting timezone for the business |
