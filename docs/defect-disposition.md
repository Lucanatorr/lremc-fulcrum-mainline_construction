# Defect Disposition — Sprint 24 gate 2

The gate: *"All CRITICAL defects are closed. HIGH defects are closed or formally
accepted."* This sheet lists every open CRITICAL and HIGH item with its status as
of 2026-11-12, and a line for each decision the Business Owner has to make.

## CRITICAL

| ID | Defect | Status 2026-11-12 | Residual | Decision needed |
|---|---|---|---|---|
| **OI-22 / P-1** | A contractor could approve their own production | **Fixed in the app:** v7.7.0 refuses an approval whose approver is the record's inspector or submitter (`TEST-SOD-001..007`; deployed and verified 2026-11-12). `production-audit-trail` reports `approval_independence` for anything the app can't see (API, old devices). | One contractor can still approve **another's** record while the Contractor role holds `can_change_status`. | Apply `docs/uat/role-model.md` (Contractor loses status change), **or** accept the residual with weekly audit. ☐ apply ☐ accept |

No CRITICAL **code** defect is open. The eleven found during the build are closed;
see `docs/sprint-23-readiness.md`.

## HIGH

| ID | Defect | Status | What closes it | Decision |
|---|---|---|---|---|
| **OI-01** | API tokens in the production app's script | Literal **removed** from the live script (edited 2026-10-21, verified read-only 2026-11-09). Rotation **unconfirmed**. | Revoke both tokens in Fulcrum (Settings → API) and in Smartsheet, issue new ones only where needed, and record the date. A token removed from the script is still in form history and on every device that synced the old script. | ☐ rotated on ______ |
| **OI-13** | Seven billing gaps: production recorded against labels with no pay unit | Open: a pricing decision | One ruling per label (below), added to the rate sheet as a contract amendment | ☐ per label |
| **P-2** | Six Owners, all able to delete | Open: configuration | Role model: 1 Owner + 1 backup | ☐ apply |
| **P-3** | The Inspector role cannot submit or correct | Open: configuration (no one holds the role yet) | Role model: Field Inspector gains update + status | ☐ apply |

### OI-13 — what the rate sheet itself suggests

From `data/labor-billing-gaps.csv` against the River City rate sheet. These are
**observations for the contract owner, not prices**. Only an executed
amendment sets a price (Sprint 26: every rate needs a contract reference).

| Label | Qty in source data | Nearest evidence on the rate sheet | Indicated rate | Indicated value |
|---|---:|---|---|---:|
| `BFO.96.IE` | 2,008 FT | Every *in existing duct* unit, 12 to 288 fibers, is **$1.50** | $1.50 — strong | 3,012.00 |
| `BFO.96.I` | 11,004 FT | *In conduit*: 12/48/72 fibers $1.50; 144/288 fibers $1.65. 96 sits between the bands | $1.50 **or** $1.65 — contract must say which | 16,506.00 – 18,156.60 |
| `BM60 (4)DP SDR11 RR` | 684 FT | Railroad bore: 1.25" $12, 2" $16. No 4" unit | Unknown | — |
| `AFO.BANDING` | 214 | `AFO.B` already prices ADSS *attached by banding* ($1.95/FT); this may be a naming error, not a missing unit | Reconcile the label first | — |
| `BDO(M)`, `BHF-PH`, `HO1-12R` | 45 / 9 / 69 | No equivalent unit | Unknown | — |

## MEDIUM and LOW

Tracked in `docs/open-issue-log.md` and `docs/implementation-log.md`. None of
them is on the money path. The gate does not require them closed.

## Sign-off

| Decision | By | Date |
|---|---|---|
| OI-22 residual: role change applied / risk accepted | | |
| OI-01 tokens rotated | | |
| OI-13 rulings issued (or the gap formally accepted for pilot) | | |
| P-2 / P-3 role model applied | | |

**Gate 2 passes when every line above is signed.**
