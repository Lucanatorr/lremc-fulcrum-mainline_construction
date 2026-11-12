# Sprint 27 — Audit and Compliance Operations

**Date:** 2026-11-12. **Built and run against live data; not yet operated by a
person.** Who runs each check is set by `docs/sprint-26-governance.md` §1, and
those names are still blank.

Everything here is a report in `reports/`: SQL for the Fulcrum Query API.
Paste it into the Query UI, or run it through the API. Each audit report
returns **one row per check**: `items` (0 means PASS), `value_at_risk`,
`result` (PASS / REVIEW / NOTE) and `see_report`, which names the report that
lists the records behind a REVIEW.

---

## Daily — `reports/audit-daily.sql` (Report Owner, about 5 minutes)

| Check | What it counts | The prompt's item |
|---|---|---|
| D-1 | Live production with no rate linked | missing rates |
| D-2 | Linked rate of 0.00 | zero rates |
| D-3 | A derivation that did not run: no unit, week or production ID, or a priced quantity with no value | failed calculations |
| D-4 | Extended value ≠ quantity × rate (written by something other than the app) | failed calculations |
| D-5 | No project or no contractor | missing project/contractor |
| D-6 | Records sharing a strict fingerprint | potential duplicates |
| D-7 | QA Fail not yet corrected | critical QA failures |
| D-8 | Any record carrying a CRITICAL exception | — |
| D-9 | Records not recalculated since `calc_version` existed (NOTE) | — |

**First live run, 2026-11-12:** 7 PASS, 1 REVIEW, 1 NOTE. The REVIEW is D-3:
PRD-2026-143C1840 has no unit (OI-19), $6,000.00. It is the known test record
whose rate needs re-selecting, and the daily check caught it unprompted.

## Weekly — `reports/audit-weekly.sql` (Report Owner + Project Manager)

| Check | What it counts | The prompt's item |
|---|---|---|
| W-1 | Pay units whose approved quantity exceeds authorized scope | over-plan production |
| W-2 | Pairs of records whose sequential ranges overlap on one reel | sequential overlaps |
| W-3 | Pending past 14 days (`p_aged_days`) | aged approvals |
| W-4 | Pay units used this week with no mapping: check against `data/material-coverage-register.csv` | missing mappings |
| W-5 | Priced from a rate that was not in force on the work date | inactive-code use |
| W-6 | Material installed more than 25% off expected | material variance |
| W-7a / 7b | Priced on another contractor's rate; a contractor's rejected value over 10% in 30 days | contractor anomalies |
| W-8 | **Self-approved production** (OI-22): what v7.7.0 cannot see | — |
| W-9 | Approved production changed after approval | — |

**First run:** 9 PASS, 1 REVIEW (W-3: the same 21 September record, 52 days pending).

## Monthly — `reports/audit-monthly.sql` (Data Owner + Contract/Finance)

Set `p_month_override` to review a closed month.

| Review | Checks |
|---|---|
| Financial | M-1a approved value in the month (NOTE: reconcile it against both financial reports); M-1b approved value ≠ quantity × rate; M-1c pending past 30 days |
| Rate | M-2a active rates with no contract reference; M-2b expired but active; M-2c priced off the expected rate |
| Scope | M-3a change orders open past 30 days; M-3b scope lines still DRAFT; M-3c production with no baselined scope |
| Material | M-4a ledger entries still DRAFT (OI-21); M-4b approved conduit work with no material booked |
| Permission | M-5a active Owners above 2; M-5b active members, so leavers can be reviewed |
| Exception backlog | M-6a CRITICALs older than 30 days; M-6b QA deficiencies past due |
| Data quality | M-7a VOID/REVERSED this month; M-7b adjustments; M-7c records too sparse to duplicate-check |

**First run (2026-11):** M-2a 146 rates with no contract reference; M-3c 2 pay
units with production and no baseline; M-5a **6 active Owners**; M-1c one stale
pending record. All four are known open issues (OI-09, gate 6, P-2, OI-19), now
measured every month instead of found once.

**The memberships table also holds inactive members.** The Query API's
`memberships` lists 29 rows (14 Owners); only 19 are active (6 Owners). M-5
counts active members only. A count without that filter would have reported 14 Owners.

## The rate-audit report the prompt specifies — `reports/rate-expected-audit.sql`

*"contractor, project, labor code, production date, rate used, expected rate,
rate source, and difference"*: all eight columns, plus `value_difference`.

The **expected rate is looked up from scratch**: the rate for this contractor
and labor code **in force on the work date**, preferring a project-specific
rate over an all-projects rate, and never a DRAFT. That makes it independent of
the rate the record happens to link. `rate-audit.sql` checks the link (is the
linked rate still the same, is it ambiguous); this report checks whether the
link was the right one. Every record gets a row, so a clean month reads as a
full reconciliation, not an empty list.

**First run:** both live records MATCH (12.00 and 10.00, all-projects rates
RATE-000084 and RATE-000083).

## History integrity — `reports/audit-history-fingerprint.sql` + `scripts/audit_history_check.py`

*"Periodically verify that historical quantities, rates, values, statuses,
relationships, and material quantities have not unexpectedly changed."*

1. **Monthly**, run the fingerprint report. Save the result as
   `data/audit-snapshots/<YYYY-MM-DD>-history.json` (API) or `.csv` (Query UI
   export), and commit it.
2. `python3 scripts/audit_history_check.py data/audit-snapshots/<previous> data/audit-snapshots/<current>`
3. Periods before the current month are **closed**. Any CHANGED, ADDED or
   REMOVED group in a closed period makes the script exit 1. Each must be
   explained by a REVERSED record or an Adjustment (`voided-reversed.sql`), or
   by a late approval found in the audit trail. Open-period differences are
   listed only.

The fingerprint is an MD5 over every APPROVED and REVERSED production record,
and every non-draft material ledger row, in each ledger / project / contractor
/ month / unit group. It covers quantity, unit, rate, rate source, value,
status, project, contractor, segment, reel, sequentials, conduit material
quantity and the approval stamp. Units are never summed together.

**First snapshot:** `data/audit-snapshots/2026-11-12-history.json`, **empty by
design**: nothing is approved yet. The SQL was also exercised on all live
records, to prove it runs and hashes. The comparison is covered by
`tests/audit-history.test.js` (closed vs open, all three change kinds, CSV ≡ JSON).

## Sign-off

The monthly review is signed only when every REVIEW row is explained or
ticketed, and `audit_history_check.py` exits 0 or every closed-period
difference has its explanation written next to it.

| Month | Reviewer (Data Owner) | Contract/Finance | Date |
|---|---|---|---|
| 2026-11 | | | |
