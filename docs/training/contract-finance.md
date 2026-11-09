# Contract / Finance Training — Mainline Construction

Sprint 25. For contract administration and billing. About 45 minutes.

## 1. How a price gets onto a record

1. The inspector picks the **Applicable Contractor Rate** on the production record.
2. At that moment the rate's **value, labor code, contractor, project scope,
   effective date, expiry and unit are copied onto the record** (D-003). This
   copy is the price, permanently.
3. **Extended Value = Quantity × Contractor Rate**, rounded once, at the end,
   to the cent.
4. Repricing the master **never changes existing production**. A record keeps
   the rate it was entered at. That is the point, and it is what makes a
   billed period reproducible.

The record is then checked, on the device, offline, against the rate it copied:

| Check | Severity |
|---|---|
| No rate linked | CRITICAL |
| Rate value blank or zero | CRITICAL |
| Rate belongs to another contractor | CRITICAL |
| Rate is scoped to another project | CRITICAL |
| Rate prices a different labor code | CRITICAL |
| Work date before the rate's effective date | CRITICAL |
| Work date after the rate's expiry | CRITICAL |

**A CRITICAL record cannot be approved, so it cannot reach billing.**

## 2. Rates and effective dates

- Rates are **versioned, never overwritten**. A price change is a **new rate
  record** with a new effective date; the old one gets an expiry date and
  then Active = No.
- A rate cannot expire before it takes effect, and a rate of 0.00 is refused.
  If a pay unit has no price, leave its rate **inactive**.
- Every rate states a **Unit** (required), a **Currency** (USD) and, from now
  on, a **Contract Reference**: the executed contract or amendment that set
  the price. Without it, a dispute cannot be traced (OI-09).
- Monthly: run `rate-master-audit`. Today it shows 146 rates with no contract
  reference and no currency. Both fields are new, and the rates predate them.

## 3. Approvals

The approval gate refuses APPROVED when:
- the record carries any CRITICAL exception;
- QA Status is **Fail**;
- QA Status is **Not Reviewed** or blank. An approval is a statement that someone looked.

WARNING and INFO never block. **Approval locks Quantity, Labor Code and
Rate.**

> **Segregation of duties is not enforced by the system today** (Sprint 24
> finding P-1). The Contractor role can change status, so it can approve. Until
> that is resolved, check in `production-audit-trail` that `approved_by` is not
> the record's creator, for every record you bill.

## 4. Billing reconciliation

For a billing period (filter on `work_month`, or on dates):

1. `contractor-financial`: approved value per contractor and project. **This
   is the billable figure.**
2. `project-financial`: the same approved value per project, against the
   contract value.
3. **They must agree to the cent.** If they don't, stop and open the audit trail.
4. `rate-audit`: every priced record whose rate is missing, expired,
   ambiguous, from another contractor or project, or has **drifted** from the
   master. A drift is usually a repricing after the work, which is fine. The
   `note` column says what to check.
5. `voided-reversed`: what was taken out of official totals in the period,
   and every Adjustment that went in.

**Pending is never billable.** DRAFT, SUBMITTED, UNDER REVIEW, CORRECTION
REQUIRED and REOPENED are all pending, and every report keeps them in a
separate column.

## 5. Correcting billed or approved production

**Never edit an approved record.** The quantity, labor code and rate are
locked anyway. Use the lifecycle (D-018):

| Situation | Action | Effect on totals |
|---|---|---|
| Wrong, never approved | **VOID** | Excluded |
| Approved, entirely wrong (a duplicate, or not our work) | **REVERSED**, with a reason | Excluded. The approval stamp stays as evidence |
| Approved, wrong by an amount | A new **Adjustment** record naming the original Production ID, with a reason; a negative quantity to take work back | The adjustment counts once approved |
| Approved, needs re-review | **REOPENED**, with a reason | Back to pending; the approval is cleared |

A REVERSED record cannot be one that was never approved. That is refused, and
the message tells you to VOID it.

## 6. Change orders

A change order line is a **signed delta** per labor code, at a stated rate.
Only an **APPROVED** order changes the contract value:
`current_contract_value = original + approved change orders`. Pending orders
show separately, as `pending_change_orders_value`.

## 7. Exceptions and overrides

- `exception-dashboard`: 17 checks across all production. Each finding gives a
  `value_at_risk`.
- There is **no override that approves a CRITICAL record**. The fix is to
  correct the record or send it back. The only override in the system is on
  project closeout, and it **must carry a reason**.

## 8. Exercises

1. Reconcile approved value for the test project across `contractor-financial`
   and `project-financial`.
2. Find a record's rate in `production-audit-trail` and explain its `rate_provenance`.
3. Walk through reversing an approved test record, and find it in `voided-reversed`.
4. Draft the rate record for a repriced pay unit: new effective date, old rate expired.
