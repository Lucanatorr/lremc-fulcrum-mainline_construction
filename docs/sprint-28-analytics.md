# Sprint 28 — Advanced Reporting and Management Analytics

**Date:** 2026-11-12. **Six reports built; all six run against live data.**
With no approved production yet, they return the correct empty or pending
picture. The window functions were also exercised on the two live test
records, with the status filter widened, to prove they compute.

> The brief: *"Use Fulcrum reporting where it meets requirements; otherwise
> prepare clean data for external analytics such as Power BI. Fulcrum remains
> the operational source of truth."*

## 1. The six reports

| Brief | Report | Grain | Answers |
|---|---|---|---|
| Executive Project Summary | `analytics-executive-summary.sql` | project | Authorized / earned / remaining value; physical and financial %; current production (7 days) and trend; awaiting approval; turnaround; CRITICAL and WARNING counts; open QA failures and corrections; approved work with no material; forecast working days left; a one-line headline |
| Project Performance | `analytics-project-performance.sql` | project × pay unit | Original, change-order, authorized, completed, remaining and pending **quantity in the unit's own unit**; % complete; last 7 days vs prior 7; average per active day; forecast; scope status, including **UNPLANNED** work |
| Contractor Analytics | `analytics-contractor.sql` | contractor | Approved / pending / rejected / T&M value; FT, EA and splices kept apart; rejection, correction, QA-fail and exception rates; wrong-contractor rates; days from work to submit and from submit to approve |
| Crew Productivity | `analytics-crew-productivity.sql` | crew × contractor × unit | Quantity and value per **active** day; last 14 vs prior 14 days (FASTER / SLOWER / STEADY); correction, QA-fail and rejected share; sample strength |
| Daily Burn Rate | `analytics-daily-burn-rate.sql` | project × working day | Approved value that day (idle days included); 5-working-day average; cumulative; remaining; **required daily burn** to hit the required completion date; ON / BEHIND PACE |
| Production Velocity | `analytics-production-velocity.sql` | project × pay unit × ISO week | Weekly quantity and value, week-on-week change and %, 4-worked-week moving average, cumulative, ACCELERATING / DECELERATING |

## 2. Metric dictionary (one definition, used everywhere)

| Metric | Definition |
|---|---|
| Authorized quantity | Baselined scope (BASELINED or CLOSED lines) + approved change-order deltas |
| Authorized value | Authorized quantity × budget rate, per pay unit, summed |
| Completed quantity | Approved production quantity |
| Earned value | Completed quantity × budget rate, **capped at authorized quantity** per pay unit |
| Physical % | Earned value / authorized value |
| Financial % | Approved production value (at contract rates) / authorized value. The gap to physical % is the rate variance |
| Current production | Approved value with a work date in the last 7 days |
| Turnaround | Calendar days, submitted → approved |
| Active day | A Mon–Fri date with approved production > 0 for that subject |
| Burn rate | Approved value per **working** day, idle days included: it measures the project, which pays for idle days |
| Productivity | Quantity per **active** day: it measures the crew, which should not be penalised for rain |
| Forecast | Remaining ÷ average per active day over the last 10 active days. **Blank with fewer than 3**, rather than a guess |
| Correction rate | Records with `correction_completed` set, or now in CORRECTION REQUIRED. **A floor**: a second send-back clears the flag, and record history is not queryable |

**Units are never added together.** Every project-wide figure is value or a
count. Every quantity sits on a row whose grain includes the pay unit or the
unit. `TEST-ANL-001..004` enforce this.

## 3. Fulcrum vs external analytics

**Fulcrum's Query API meets the requirement for everything above as tables.**
Every metric the brief lists is computed in SQL inside Fulcrum, from the
operational records, with no copy held anywhere. That keeps Fulcrum the
source of truth by construction.

**What Fulcrum reporting does not do well, and so goes to Power BI (Sprint 29):**

1. **Charts over time.** Burn-rate and velocity trends belong on a line chart.
   The Query UI returns tables.
2. **Cross-filtering and drill-down.** Executive → project → pay unit →
   record, interactively. Each step here is a separate report with a `params`
   filter.
3. **Point-in-time history.** Record history is not queryable, so "what did
   this report say at month end?" needs a stored snapshot. That is the same
   reason `audit-history-fingerprint` snapshots are saved to the repo.
4. **Holiday calendars** for working days. No calendar exists in Fulcrum; Power
   BI can join one.

**Clean data for that** (the hand-off to Sprint 29). These six reports already
are clean, typed, one-grain-per-report extracts: stable column names, explicit
units, no blended quantities, status rules applied once. Power BI should
read them, or the fact table below, through the Query API on a schedule. It
should **never** read the apps' raw tables and re-derive status rules itself.

| Proposed fact / dimension | Built from |
|---|---|
| `fact_production` (one row per non-VOID record) | production-audit-trail columns |
| `fact_daily_project` | analytics-daily-burn-rate |
| `fact_weekly_payunit` | analytics-production-velocity |
| `dim_project`, `dim_contractor`, `dim_pay_unit` (with unit), `dim_date` (with working-day and holiday flags) | Project Master, Contractor Master, rate master + choice list, calendar |

## 4. Known limits

- **No approved production exists yet**, so every value metric reads 0 today.
  The SQL is proven to run; the numbers are proven only once
  `docs/uat/chain-demonstration.md` is done.
- Correction rate is a floor (see the dictionary).
- Turnaround counts calendar days, not working days.
- The required-completion pace check needs `required_completion_date` on the
  Project Master. No project has one today, so every row reads *NO REQUIRED
  COMPLETION DATE* or *NO BASELINE*.
