# Final System Inventory

Sprint 32, "Final System Review". **As of 2026-11-12, Development.**

Sources:
- Record counts: the live backup manifest (`data/backup-manifests/2026-11-12.json`).
- Configuration: `fulcrum/baseline-2026-11-12.json`.
- Data Event versions: `fulcrum/known-good/registry.json`.

**Owner** is the accountable governance role from `docs/sprint-26-governance.md`
§1. None of those roles has a person named yet; naming them is gate 12.

## 1. Apps

| App | Form ID | Purpose | Records | Primary identifier | Relationships | Owner |
|---|---|---|---:|---|---|---|
| **Mainline Construction** | `06c36c8e-4a88-4cf3-a691-9a792f8374d2` | The production transaction: one record per unit of work, priced, QA'd and approved | 2 (DRAFT 1, SUBMITTED 1). Repeatable actual materials: 0 | `production_id` (`PRD-2026-xxxxxxxx`) | Project, Contractor, Rate, Structure ×2, Reel (links); Segment (key); Adjustment → original (`adjusts_production_id`) | Technical Owner (app); Project Manager (records) |
| **MC Project Master** | `5ce243d4-9ec1-4fbd-8659-7be9f632b55c` | Projects and their planned quantities | 3 (ACTIVE) | `project_id` (`PRJ-000001`) | Parent of scope, change orders, production, reels, structures, segments, closeout | Project Administrator |
| **MC Contractor Master** | `d8a368b5-1e19-4f5f-8cf9-ff8fbdd03ab4` | Contractors | 3 (ACTIVE) | `contractor_id` (`CON-0001`) | Parent of rates, production, reels, change orders | Fulcrum Administrator; Contract / Finance validates |
| **MC Contractor Rate** | `a5529dd0-54fa-4b8d-b595-d0218df0ee97` | Versioned contract pricing: contractor × labor code (× project) | 146 (ACTIVE) | `rate_id` (`RATE-000084`) | Contractor, Project (links); snapshotted onto production and scope | Rate Administrator |
| **MC Project Scope Line** | `aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b` | The authorized baseline per project × labor code | 0 | `scope_line_id` | Project, Rate (links); production by key | Project Administrator |
| **MC Change Order** | `458ae172-b7b4-43b5-8917-d7a792c9e81a` | Signed quantity deltas to the baseline | 0 (lines 0) | `change_order_number` | Project, Contractor (links); lines per labor code | Project Administrator; Business Owner approves |
| **MC Labor-Material Mapping** | `38e3d7fd-ca78-4016-8018-ec955446c13f` | Expected material per pay unit | 125 (APPROVED 58, NEEDS REVIEW 67) | `mapping_id` (`MAP-000131`) | Labor code; Material (key) | Material Administrator |
| **MC Material Master** | `658143d1-edbd-430b-81bb-1b0bb1092729` | Stock items | 135 (ACTIVE) | `material_code` | Mappings, ledger, structures | Material Administrator |
| **MC Material Transaction** | `ee204906-adb3-431b-a1d9-d7427a4c842c` | Atomic material ledger: issued, installed, returned, adjusted | 0 | `transaction_id` | Project, Contractor, Production, Material (links) | Material Administrator |
| **MC Fiber Reel** | `728477da-5f36-48cb-b3ab-cbc8c38d077f` | Reels: printed sequential range and waste | 0 | `reel_id` | Project, Contractor (links); production links to it | Material Administrator |
| **MC Structure** | `397b52cf-a4f0-4871-b8ea-1fdb592fe2ab` | Handholes, vaults, pedestals, poles | 0 | `structure_id` | Project; housed-in structure; segment endpoints | Project Administrator |
| **MC Segment** | `7da87588-940a-4b9e-915d-5ec25d5c0ebc` | FROM→TO paths, direction-normalized | 0 | `segment_id` + `segment_type` | Two structures, Project (links); production by key | Project Administrator |
| **MC Project Closeout** | `351bb1f1-9837-47c8-be5b-bb0727fe93a0` | Eleven milestones, readiness review, authorized override | 0 | `closeout_id` | Project (link) | Project Manager; Business Owner for overrides |

**Not part of this system:** the production app *Mainline Construction*
`148545bf-b869-454e-a2b9-44a9860f23de`, which is read-only to this project
(OI-01).

## 2. Data Events

Ten apps have a script. All are **fully offline**: none performs a
cross-record query. Detail is in `docs/data-event-inventory.md`; the exact
live bytes are in `fulcrum/known-good/`.

| App | Live | Rollback | What it does |
|---|---|---|---|
| Mainline Construction | **7.7.0** | 7.6.0 (safe) | Derives period, unit, labor metadata, segment/span, fingerprints, exceptions, `calc_version`. Enforces the approval gate, the lifecycle (D-018) and no self-approval |
| MC Contractor Rate | 1.1.0 | refused (1.0.0 clears unit) | Rate versioning guard; fills blank unit and description only |
| MC Project Scope Line | 1.1.0 | refused | Baseline lock; scope exceptions |
| MC Change Order | 1.1.0 | refused | Line validation; zero-change rejection; approval stamps |
| MC Material Transaction | 1.1.0 | refused | Negative quantity only on Adjusted (D-009) |
| MC Structure | 1.1.0 | refused | Identity and housing validation |
| MC Fiber Reel | 2.0.0 | none | Printed-range sanity; stores no totals |
| MC Segment | 1.0.0 | none | Direction-normalized identity |
| MC Project Closeout | 1.0.0 | none | Milestone gates; override control |
| MC Labor-Material Mapping | 1.0.0 | none | Multiplier and effective-period validation |

## 3. Master data

| Master | Where | Count | Owner | Governs |
|---|---|---:|---|---|
| Labor codes (pay units) | Choice list **MC Labor Code** `ddccba3b-c5b6-4a38-8892-805e916afacd` | 146 | Business Owner approves; Rate Administrator maintains | Every production record, rate, scope line, mapping |
| Units of measure | Choice list MC Unit of Measure | 6 | Fulcrum Administrator | Quantities are only summed within one unit |
| Work categories | Choice list MC Work Category | 11 | Data Owner | Chosen on each record, never inferred from the code (D-007) |
| Construction methods | Choice list MC Construction Method | 14 | Data Owner | Productivity breakdowns |
| QA statuses | Choice list MC QA Status | 4 | Data Owner | The QA gate |
| Projects | MC Project Master | 3 | Project Administrator | |
| Contractors | MC Contractor Master | 3 | Fulcrum Administrator | |
| Contractor rates | MC Contractor Rate | 146 (one contractor: River City) | Rate Administrator | Pricing. **0 of 146 have a contract reference** (scorecard DQ-02) |
| Materials | MC Material Master | 135 | Material Administrator | |
| Labor-material mappings | MC Labor-Material Mapping | 125; 49 of 146 pay units have an APPROVED mapping | Material Administrator | Expected material. The other pay units are classified in `data/material-coverage-register.csv` |

Repository data: the rate import (`data/import/contractor-rates-river-city.csv`),
the labor master (`data/labor-master.json`), billing gaps, labor exceptions,
and mapping conflicts (`data/`).

## 4. Reports

**74 reports**, all read-only SQL, all run live at least once. The generated
inventory, giving purpose, source, metrics, filters and audience for every one,
is **`docs/report-inventory.md`**.

| Group | Count | For |
|---|---:|---|
| Production (daily, weekly, monthly, dashboard, trend, productivity) | 6 | Project Manager |
| Financial and pricing (project, contractor, rate ×3, invoice basis, voided/reversed) | 7 | Contract / Finance |
| Scope and forecast (scope status, remaining work, unplanned, forecast, project summary, closeout) | 6 | Project Manager |
| Integrity and exceptions (exception dashboard, duplicates, sequential overlap, segment, reel ×2, material variance, QA queue, audit trail) | 9 | Data Owner, QA, Auditor |
| Audit cadence (daily, weekly, monthly, history fingerprint) and the data-quality scorecard | 5 | Fulcrum Administrator, Auditor |
| Analytics | 6 | Executives |
| Integration (export, ID integrity) | 2 | Integration owner |
| Power BI datasets (`reports/bi/`) | 17 | Power BI developer |
| Backup and continuity (`reports/continuity/`) | 16 | Fulcrum Administrator |

## 5. Scripts and tools

| Script | Purpose |
|---|---|
| `flatten_report.py`, `slice_report.py` | Run a report through the MCP query tool (one line; `+` workaround; size limit) |
| `validate_import.py`, `normalize_rates.py`, `build_material_mapping.py` | Master-data import pre-flight and builders |
| `validate_scope_baseline.py` | Scope baseline pre-flight (gate 6) |
| `audit_history_check.py` | Closed-period history check |
| `export_delta.py` | Idempotent posting from the integration export |
| `reconcile_invoice.py` | Invoice against approved production |
| `backup_verify.py`, `config_snapshot.py` | Backup verification, deletion detection, configuration drift |
| `known_good.py` | Known-good retention, preflight, promote, rollback |
| `mass_change.py` | Mass-change plan and reconcile |
| `field_dictionary.py`, `report_inventory.py` | Generate the field dictionary and the report inventory |

The test suite is `for t in tests/*.test.js; do node $t; done`. Suite and
assertion counts are in `docs/HANDOFF.md` §25.
