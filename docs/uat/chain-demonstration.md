# Completion-Rule Demonstration (Sprint 24 gate 1)

Sprint 23 is complete only when *"field production can be entered once,
validated automatically, translated into accurate labor and material
quantities, priced correctly, approved through a controlled workflow, compared
with authorized scope, aggregated into reliable reporting, and traced from
management totals to original transactions without losing historical accuracy
after master-data changes."*

Every link is built and tested in the harness, and every report runs against
live data. **What has never happened is an approval.** Approval needs a person
in the app (an API write runs no Data Events, so it would prove nothing about
the gate), and since v7.7.0 it needs a **second** person.

**Time:** about 20 minutes. **Who:** the record's creator (Lucas Collins), plus
one other account holder (Owner or Admin) as the approver.

## Steps in the app (Development, MCP-TEST-001)

| # | Who | Do | Proves |
|---|---|---|---|
| 1 | Creator | Open **PRD-2026-FB71F938** (DRAFT). Add a photo. Set QA Status = **Pass**. Save | Validation; `calc_version` becomes DE-7.7.0 |
| 2 | Creator | Open **PRD-2026-143C1840** (SUBMITTED). Re-select its **Applicable Contractor Rate** (fills its blank unit, OI-19). Add a photo, QA = Pass. Save | The unit copy-down |
| 3 | Creator | Set FB71F938 to **SUBMITTED** | Submitted stamp |
| 4 | Creator | Try to set FB71F938 to **APPROVED** | **Must be refused** (v7.7.0). If it saves, stop: that is a defect |
| 5 | Approver | Set both records to **APPROVED** | The controlled workflow; Approved By = approver |
| 6 | Approver | Try to edit the quantity on either record | Locked |
| 7 | Admin | In MC Contractor Rate, **create a new rate** for `BM60(1)(1.25)DP` at 11.00, effective today. Set the old one's expiry to yesterday | A master change, which must not move history |
| 8 | Approver | Set PRD-2026-143C1840 to **REVERSED**, reason "UAT demonstration" | Reversal leaves the totals and stays reportable |

## What the reports must then show (run by the Technical Owner)

| Check | Report | Expected |
|---|---|---|
| C-1 | production-daily | FB71F938 approved_value **5,000.00** (500 FT × 10.00) |
| C-2 | contractor-financial vs project-financial | The same approved value, to the cent |
| C-3 | production-audit-trail, FB71F938 | `approval_independence` = INDEPENDENT; `rate_provenance` = **MASTER REPRICED SINCE**; rate_applied still **10.00** after step 7 |
| C-4 | voided-reversed | 143C1840 listed as REVERSED, *EXCLUDED FROM OFFICIAL TOTALS*, 6,000.00 |
| C-5 | production-trend, production-dashboard | Approved value appears once, never including 143C1840 |
| C-6 | audit-history-fingerprint | A fingerprint for 2026-11; re-run after step 7 → **unchanged** |
| C-7 | material-variance | FB71F938 *NO MATERIAL REPORTED* (no ledger row), proving the link to the material ledger |

C-1 to C-7 all passing **is** the gate 1 evidence. Record the results in
`docs/implementation-log.md`.

**Scope comparison** (the "compared with authorized scope" link) needs a
baselined scope line for the test project covering `BM60(1)(1.25)DP`, the pay
unit of FB71F938. Copy `tests/fixtures/scope-baseline-clean.csv`, add a row
`PRJ-000001,BM60(1)(1.25)DP,UG-2,2000,,,,`, run
`scripts/validate_scope_baseline.py` on it, import the result, and baseline it
(a second person). `remaining-work` must then show BM60(1)(1.25)DP with 500 FT
completed and 1,500 FT remaining.

The test project is flagged *TEST PROJECT - must never contaminate production
reporting*. Its records stay in Development.
