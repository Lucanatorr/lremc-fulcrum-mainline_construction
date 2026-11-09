# Project Manager Training — Mainline Construction

Sprint 25. For anyone who runs a project from this system's numbers. About
an hour, at a desk, using the reports in `reports/` against the
Development apps.

Every report opens with a `params` block of NULLs at the top. That one block
is where you filter: set `p_project_id` to `'PRJ-000003'` and nothing else needs
touching.

---

## 1. Four rules behind every number

Learn these first. Every "this number looks wrong" conversation ends at one of them.

1. **Only APPROVED production is official.** Pending (DRAFT, SUBMITTED, UNDER
   REVIEW, CORRECTION REQUIRED, REOPENED) is always a separate column and is
   never folded in. VOID and REVERSED are excluded everywhere.
2. **Quantities never add across units.** Feet, each, splices and hours
   don't sum. Anything that crosses pay units reports **value**.
3. **HR and EVENT are not physical production.** They carry value and put
   nothing in the ground. They are excluded from footage and burn rates.
4. **The week is ISO, Monday start, and is stored on the record.** No report
   recomputes it, so every report agrees on what "this week" means.

## 2. Your daily ten minutes

| Order | Report | You are looking for |
|---|---|---|
| 1 | `exception-dashboard` | Anything CRITICAL. Each row names the record, the figure and the report to open next |
| 2 | `qa-review-queue` | What is waiting on a reviewer. `queue_state` says why, and `priority` orders it |
| 3 | `production-daily` | Yesterday's work, with approved and pending side by side |

## 3. Production: daily, weekly, monthly

| Question | Report | Read |
|---|---|---|
| What happened on a day? | `production-daily` | DETAIL rows, then DAY TOTAL, then GRAND TOTAL |
| How did this week compare with last? | `production-weekly` | `trend` = UP / DOWN / FLAT / NO PRIOR WEEK |
| Month and project to date? | `production-monthly` | `ptd_*` columns run cumulatively |
| Is the crew speeding up or slowing down? | `production-trend` | `rolling_7d_*`, `previous_7d_*`, `velocity_change_7d_value` |
| What is the burn rate? | `production-trend` | `daily_burn_rate_value` and `daily_burn_rate_footage`: the 7-day total divided by **working** days |
| Today, this week, this month on one screen | `production-dashboard` | Five rollup levels, from all projects down to the labor code |

## 4. Remaining work and over-plan

| Question | Report |
|---|---|
| How much of each pay unit is left? | `remaining-work`: `scope_status` = OVER PLAN, NO AUTHORIZED SCOPE, IN PROGRESS, NOT STARTED or COMPLETE |
| Where does the project stand overall? | `project-scope-status` and `project-summary` |
| What was built that was never planned? | `unplanned-production`: production on a pay unit with no scope line |
| When will it finish? | `forecast-completion`: blank when there is too little history, and the `forecast_basis` column says why |

**Remaining quantity is never clamped at zero.** A negative remaining is over
plan, and it is the number to act on. The fix is a change order, never an edit
to the baseline. The baseline locks once it is set.

## 5. Contractor performance

- `productivity`: per crew, per contractor and per construction method; FT
  per **active** day. `sample_strength` warns when there are under 3 days of
  data.
- `contractor-financial`: approved, pending and rejected value per
  contractor; `rejected_value_pct`; records priced on **another
  contractor's** rate.

## 6. Financials

| Question | Report | Column |
|---|---|---|
| Contract value now | `project-financial` | `current_contract_value` = original + approved change orders |
| Earned to date | `project-financial` | `approved_production_value` |
| Left in the contract | `project-financial` | `remaining_contract_value` |
| Are we on budget? | `project-financial` | `financial_minus_physical_pts`: positive means money is running ahead of the work |

## 7. QA exceptions and pending approvals

- `qa-review-queue`: every unapproved record, with why it is waiting.
  *BLOCKED - critical exception* and *BLOCKED - QA failed* cannot be approved
  as they stand.
- **Overdue deficiencies.** A QA Fail or Conditional Pass with no **QA
  Owner**, no **QA Due Date**, or past its due date shows as a WARNING on the
  record and in the exception dashboard.

## 8. Materials

- `material-variance`: installed material against what the pay units imply.
  Over 25% either way is CRITICAL. *NO MATERIAL REPORTED* means conduit was
  recorded but no material was booked against it.
- `reel-balance`: printed length, consumed, waste and remaining for each reel.
- Only **57 of 146** pay units have a material mapping today (OI-11). An
  unmapped unit derives no material at all, and the exception dashboard says so.

## 9. Change orders

Raised in **MC Change Order**: one line per labor code, each a **signed
change** (+500 or −200), never a new total. Only an **APPROVED** change order
moves authorized scope. A pending one shows in `project-scope-status` as
`pending_co_qty_change`, so you can see it coming.

## 10. Incomplete work and closeout

`closeout-readiness` lists every blocker for closing a project: unapproved
production, failed QA, open corrections, remaining planned work, material
discrepancies, approved records with no photos, unresolved change orders and
untested splices.

## 11. When a number looks wrong

1. `production-audit-trail`, filtered to the `production_id`. It shows who
   entered it and when, what rate was applied and where it came from, who
   approved it, and whether it **changed after approval**.
2. A rate that disagrees with today's rate sheet usually reads
   `MASTER REPRICED SINCE`: history was preserved, as designed.
3. Quantity looks doubled? Run `duplicate-production` and `sequential-overlap`.
4. Corrections to approved work appear in `voided-reversed`: every VOID, every
   REVERSED record and every Adjustment, with its effect on official totals.

## 12. Exercises — the ten UAT questions

Answer each one from reports alone, for the test project:

1. What was installed yesterday?
2. How much underground footage this week?
3. How much fiber has been placed project to date?
4. What is left to build, by pay unit?
5. What value is approved, and what is pending?
6. What remains in the contract?
7. Which pay units are over plan?
8. What QA issues are open, and who owns them?
9. What has each contractor produced this month?
10. What still stands between this project and closeout?
