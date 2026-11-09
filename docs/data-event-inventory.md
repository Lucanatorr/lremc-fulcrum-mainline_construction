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
| 1 | Mainline Construction | **v7.6.0** | Development | new-record, load-record, edit-record, change, change-status, validate-record | work_date, labor_code, quantity, unit, work_category, sequentials, reel_link, rate_link, structures, qa_status, qa_owner, qa_due_date, correction_completed, production_type, adjusts_production_id | production_id, work_year/month/week/day_of_week, reporting_period, unit, labor_description, pull_count, conduit_diameter, conduit_material_code, segment_id, span_id, splice_band_derived, quantity, fingerprint_strict/segment/strength, exception_flags, exception_severity, submitted/reviewed/approved/reopened/reversed stamps, calc_version | none | MC Labor Code, MC Unit of Measure, rate/reel/structure record links | **Fully offline** | Production transaction derivation, exceptions, approval gate, lifecycle (REOPENED/REVERSED/Adjustment, D-018) | 2026-11-09 (v7.6.0 script 14:26; elements m151–m162 and two statuses 14:22) | v7.5.0 (elements change is additive: rolling back the script leaves the new fields unused) |
| 2 | MC Contractor Rate | **v1.1.0** | Development | change, validate-record | labor_code, effective_date, expiration_date, unit_rate | unit, labor_description (fill a blank only; never clear) | none | MC Labor Code | Fully offline | Rate versioning guard; blocks zero rate and backwards effective period | 2026-11-09 (script + r009/r010 editable, r018 currency, r019 contract reference) | v1.0.0 — **do not roll back the script**: v1.0.0 clears the unit on every save |
| 3 | MC Project Scope Line | v1.1.0 | Development | load-record, edit-record, change, change-status, validate-record | labor_code, project_link, original_planned_quantity, rate snapshots | scope_line_id, unit, baseline_set_date/by, exception_flags, exception_severity | none | MC Labor Code, rate link | Fully offline | Baseline immutability lock; scope exceptions | 2026-11-09 (unit guard; `s006 <- r010` applied by Fulcrum support 2026-10-28) | v1.0.0 |
| 4 | MC Change Order | v1.1.0 | Development | new-record, load-record, edit-record, change, change-status, validate-record, validate-repeatable | line_labor_code, line_quantity_change, line_rate, status | change_order_record_id, line_unit, approval stamps | none | MC Labor Code | Fully offline | Change-order line validation; zero-change rejection | 2026-11-09 | v1.0.0 |
| 5 | MC Fiber Reel | v2.0.0 | Development | validate-record | beginning/ending_sequential, original_reel_footage, waste_recorded | exception flags | none | — | Fully offline | Printed-range sanity; waste vs printed length. Stores **no** totals (D-012) | 2026-09-19 | v1.0.0 |
| 6 | MC Material Transaction | v1.1.0 | Development | validate-record | transaction_type, quantity, transaction_date | transaction_id | none | Material master link | Fully offline | Negative quantity allowed only on `Adjusted` (D-009) | 2026-11-09 | v1.0.0 |
| 7 | MC Structure | v1.1.0 | Development | load-record, edit-record, change, change-status, validate-record | structure_id, structure_type, housed_in | derived IDs, exception flags | none | — | Fully offline | Structure identity and housing validation | 2026-11-09 | v1.0.0 |
| 8 | MC Segment | v1.0.0 | Development | change, validate-record | from/to structure, segment_type | segment_id (direction-normalized) | none | — | Fully offline | Direction-normalized segment identity | 2026-09-17 | — |
| 9 | MC Project Closeout | v1.0.0 | Development | load-record, edit-record, change, change-status, validate-record | 11 milestone rows, readiness_reviewed, override_reason, blockers | milestone stamps, closeout_id, gates | none | Project link | Fully offline | Closeout milestone gates and override control | 2026-09-21 | — |

## Deployment state, plainly

All nine scripts match the repo in every way that affects behaviour. `mc-contractor-rate-dev` was live but uncommitted until 2026-11-09; it is now in the repo at v1.1.0. The five
held back by the `forms_update` outage (OI-02) were deployed on 2026-11-09
through the direct `fulcrum-app` server (`.mcp.json`), each read back and
diffed afterwards:

1. `mc-project-scope-line-dev` — guarded script (its `s006 <- r010` copy-down
   was applied by Fulcrum support on 2026-10-28)
2. `mc-change-order-dev` — script (unit guard)
3. `mc-material-transaction-dev` — script (parseDate)
4. `mc-structure-dev` — script (parseDate)
5. `mainline-construction-dev` — script v7.5.0, then elements (`m024 <- r010`
   and the m024 description), in that order so the old script never ran
   against the new copy-down

Remaining repo-vs-live differences are cosmetic and deliberately not pushed:
a trailing newline (`mc-fiber-reel-dev`, `mc-project-closeout-dev`) and one
comment each (`mc-project-closeout-dev`, `mc-segment-dev`).

### 2026-11-09, second round

6. `mainline-construction-dev` — elements m151–m162 and statuses REOPENED /
   REVERSED (14:22:34), then script v7.6.0 (14:26:23). Elements first, so the
   new script never ran against a form missing the fields it sets.
7. `mc-contractor-rate-dev` — elements and script v1.1.0 together (14:31:35).

Both read back and compared byte-for-byte with the repo.
