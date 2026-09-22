# Data Event Version Inventory

Required by the master prompt ("REQUIRED CONTINUOUS LOGS"). Columns are the
ones the prompt specifies.

**One fact governs every row: no Data Event in this system performs a
cross-record query.** `REQUEST` is the only way a Data Event can reach another
record, it is online-only, and at field scale it would be a network round trip
per keystroke. Every cross-record control here is therefore a server-side
report instead, and every script reads only fields on its own record — which is
what makes all of them fully offline.

| # | Name | Version | Env | Triggers | Fields Monitored | Fields Modified | Queries | Dependencies | Offline | Purpose | Deployed | Rollback |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Mainline Construction | **v7.5.0** | Development | new-record, load-record, edit-record, change, change-status, validate-record | work_date, labor_code, quantity, unit, work_category, sequentials, reel_link, rate_link, structures, qa_status, correction_completed | production_id, work_year/month/week/day_of_week, reporting_period, unit, labor_description, pull_count, conduit_diameter, conduit_material_code, segment_id, span_id, splice_band_derived, quantity, fingerprint_strict/segment/strength, exception_flags, exception_severity, submitted/reviewed/approved stamps | none | MC Labor Code, MC Unit of Measure, rate/reel/structure record links | **Fully offline** | Production transaction derivation, exceptions, approval gate | **NOT DEPLOYED** (v7.4.0/v7.5.0 blocked, OI-02); v7.3.0 live | v7.3.0 |
| 2 | MC Contractor Rate | v1.0.0 | Development | change, validate-record | labor_code, effective_date, expiration_date, unit_rate | unit, labor_description | none | MC Labor Code | Fully offline | Rate versioning guard; blocks zero rate and backwards effective period | 2026-09-16 | — |
| 3 | MC Project Scope Line | v1.1.0 (repo) | Development | load-record, edit-record, change, change-status, validate-record | labor_code, project_link, original_planned_quantity, rate snapshots | scope_line_id, unit, baseline_set_date/by, exception_flags, exception_severity | none | MC Labor Code, rate link | Fully offline | Baseline immutability lock; scope exceptions | **NOT DEPLOYED** (unit guard pending, OI-02); v1.0.0 live | v1.0.0 |
| 4 | MC Change Order | v1.1.0 (repo) | Development | new-record, load-record, edit-record, change, change-status, validate-record, validate-repeatable | line_labor_code, line_quantity_change, line_rate, status | change_order_record_id, line_unit, approval stamps | none | MC Labor Code | Fully offline | Change-order line validation; zero-change rejection | **NOT DEPLOYED** (unit guard pending, OI-02); v1.0.0 live | v1.0.0 |
| 5 | MC Fiber Reel | v2.0.0 | Development | validate-record | beginning/ending_sequential, original_reel_footage, waste_recorded | exception flags | none | — | Fully offline | Printed-range sanity; waste vs printed length. Stores **no** totals (D-012) | 2026-09-19 | v1.0.0 |
| 6 | MC Material Transaction | v1.1.0 (repo) | Development | validate-record | transaction_type, quantity, transaction_date | transaction_id | none | Material master link | Fully offline | Negative quantity allowed only on `Adjusted` (D-009) | **NOT DEPLOYED** (parseDate fix pending, OI-02); v1.0.0 live | v1.0.0 |
| 7 | MC Structure | v1.1.0 (repo) | Development | load-record, edit-record, change, change-status, validate-record | structure_id, structure_type, housed_in | derived IDs, exception flags | none | — | Fully offline | Structure identity and housing validation | **NOT DEPLOYED** (parseDate fix pending, OI-02); v1.0.0 live | v1.0.0 |
| 8 | MC Segment | v1.0.0 | Development | change, validate-record | from/to structure, segment_type | segment_id (direction-normalized) | none | — | Fully offline | Direction-normalized segment identity | 2026-09-17 | — |
| 9 | MC Project Closeout | v1.0.0 | Development | load-record, edit-record, change, change-status, validate-record | 11 milestone rows, readiness_reviewed, override_reason, blockers | milestone stamps, closeout_id, gates | none | Project link | Fully offline | Closeout milestone gates and override control | 2026-09-21 | — |

## Deployment state, plainly

Five of the nine scripts have repo changes that are **not live**, all blocked by
the same `forms_update` outage (OI-02). Nothing is half-deployed: every rejected
write was verified to have changed nothing.

Pending, in dependency order:

1. `mainline-construction-dev` — elements (`m024 ← r010`) + script v7.5.0
2. `mc-project-scope-line-dev` — elements (`s006 ← r010`) + guarded script
3. `mc-change-order-dev` — script only
4. `mc-material-transaction-dev` — script only (parseDate)
5. `mc-structure-dev` — script only (parseDate)
