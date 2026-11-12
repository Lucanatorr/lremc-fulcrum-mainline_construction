# User Acceptance Test Plan

Sprint 24 gate 10. **Ready to run; not run.** UAT needs the people who will use
the system, so it cannot be performed from the build toolchain.

**Where:** Development apps, test project **MCP-TEST-001 (PRJ-000001)** only.
**Before the first session:** apply the role model (`role-model.md`), and give
every tester their own account. Two testers in each session need different
accounts, because a record cannot be approved by the person who entered it (v7.7.0).
**Record everything** in `uat-feedback-register.csv`. Classify each item as BUG,
USABILITY, ENHANCEMENT, BUSINESS RULE or TRAINING. Severity is BLOCKER, HIGH,
MEDIUM or LOW.

A case **passes** when the expected result happens with no help from the
facilitator. Anything the tester needed help with is a TRAINING item, even when
the case passes.

---

## 1. Field Inspector (and Splicing Inspector, §2) — 60 min, on a device

| ID | Do | Expected |
|---|---|---|
| UAT-FI-01 | Sync, open the app, create a record: project MCP-TEST-001, contractor, **today's date**, Underground, `BM60(2)(1.25) P`, 500 | Unit FT fills once the rate is picked; Pull Count 2 and Conduit 1.25 fill themselves; Extended Value appears |
| UAT-FI-02 | Pick From/To structures | Segment ID appears, the same in either direction |
| UAT-FI-03 | Save with no photo | Saves; WARNING *No photos attached* |
| UAT-FI-04 | Add a photo; Depth 30 | WARNING *below the 36 inch contract minimum* |
| UAT-FI-05 | Conduit package: `BM60(2)(4) T`, 100 FT | Conduit Material Quantity = 200 (2" and 4" use pull count × footage) |
| UAT-FI-06 | Fiber Placement: pick a reel, sequentials 101250 → 100000, slack 50 | Quantity 1,300 (1,250 + 50 slack) |
| UAT-FI-07 | Type Quantity 1,500 on that record | WARNING: quantity differs from installed footage by more than 5% |
| UAT-FI-08 | Submit the UAT-FI-01 record | Status SUBMITTED; *Submitted By* is your name |
| UAT-FI-09 | Try to approve your own record | **Refused:** *You entered or submitted this record, so you cannot approve it* |
| UAT-FI-10 | Facilitator sends it back as CORRECTION REQUIRED with a detail; correct it, set Correction Completed = Yes, resubmit | Correction date and name stamp; record back to SUBMITTED |
| UAT-FI-11 | Airplane mode: create and save a record; then sync | It saves offline and arrives after sync |
| UAT-FI-12 | Enter −100 as the quantity | Refused: *A negative quantity is not production* |

## 2. Splicing Inspector — 30 min

| ID | Do | Expected |
|---|---|---|
| UAT-SP-01 | Splicing record, `HO-1 (25-48)`, Fiber Count at Location 36, Splice Quantity = Quantity = 36 | No splicing exception |
| UAT-SP-02 | Change the fiber count to 60 | **CRITICAL** *falls outside the priced band 25-48* |
| UAT-SP-03 | Splice Quantity 30 with Quantity 36 | WARNING: the quantities don't match |
| UAT-SP-04 | Measured loss 0.15 dB; Test Result Fail | Two WARNINGs |
| UAT-SP-05 | Leave Structure ID and Closure ID blank | Two INFO flags |

## 3. Project Manager — 45 min, reports

Use `docs/training/project-manager.md` §12. The PM must answer each question
**from reports alone**:

| ID | Question | Report |
|---|---|---|
| UAT-PM-01 | Work done yesterday / this week / this month | production-daily / -weekly / -monthly |
| UAT-PM-02 | Fiber installed to date | project-summary `installed_fiber_footage` |
| UAT-PM-03 | Underground footage this week | production-weekly |
| UAT-PM-04 | Remaining work by pay unit | remaining-work |
| UAT-PM-05 | Approved vs pending value | project-financial |
| UAT-PM-06 | Remaining contract value | project-financial |
| UAT-PM-07 | Pay units over plan | remaining-work `OVER PLAN` |
| UAT-PM-08 | Open QA issues and their owners | qa-review-queue, exception-dashboard |
| UAT-PM-09 | Quantities per contractor | contractor-financial |
| UAT-PM-10 | What blocks closeout | closeout-readiness |

## 4. Construction Manager — 30 min

| ID | Do | Expected |
|---|---|---|
| UAT-CM-01 | Review the queue; approve a clean record **someone else** entered | Approves; *Approved By* is the CM; Quantity, Labor Code and Rate lock |
| UAT-CM-02 | Try to approve a record with QA Not Reviewed | Refused |
| UAT-CM-03 | Set a QA Fail with no owner or due date | Two WARNINGs |
| UAT-CM-04 | Read crew productivity for the week | productivity / crew-productivity |

## 5. Contract Administrator — 45 min

| ID | Do | Expected |
|---|---|---|
| UAT-CA-01 | Find a record's rate, and explain its provenance | production-audit-trail `rate_provenance` |
| UAT-CA-02 | Create a record with no rate | CRITICAL *No contractor rate linked*; cannot be approved |
| UAT-CA-03 | Raise a +100 FT change order; approve it (second person) | project-scope-status authorized qty +100 |
| UAT-CA-04 | REVERSE an approved record with a reason | Leaves the official totals; appears in voided-reversed |
| UAT-CA-05 | Enter an Adjustment of −50 naming the original | Saves; counts once approved |
| UAT-CA-06 | Try to REVERSE a never-approved record | Refused: *use VOID instead* |
| UAT-CA-07 | Find who approved each record, and any self-approval | production-audit-trail `approval_independence` |

## 6. Finance / Billing — 30 min

| ID | Do | Expected |
|---|---|---|
| UAT-FB-01 | Approved value for the month: contractor-financial vs project-financial | Equal to the cent |
| UAT-FB-02 | Pending excluded from the billable figure | Pending shown separately |
| UAT-FB-03 | Rate drift and expired rates | rate-audit; rate-expected-audit |
| UAT-FB-04 | Remaining contract value | project-financial |
| UAT-FB-05 | Closeout override: needs a reason | Refused without one |

## 7. Fulcrum Administrator — 60 min

| ID | Do | Expected |
|---|---|---|
| UAT-AD-01 | Add a contractor (INACTIVE → ACTIVE by a second person) | As governance §3 |
| UAT-AD-02 | Reprice a rate: new record, expire the old one | Existing production keeps its old rate (`MASTER REPRICED SINCE`) |
| UAT-AD-03 | A rate that expires before it takes effect; a 0.00 rate | Both refused |
| UAT-AD-04 | Deactivate a labor code (retire procedure) | CRITICAL on a stale device naming the replacement |
| UAT-AD-05 | Add a material and a mapping (NEEDS REVIEW → APPROVED) | *Missing Material Mapping* clears |
| UAT-AD-06 | Baseline a scope line with `scripts/validate_scope_baseline.py` | Validator clean; line BASELINED and locked |
| UAT-AD-07 | Close a project with an open blocker; then override with a reason | Refused, then accepted with the reason |
| UAT-AD-08 | Run the drift check against the baseline file | No unexplained drift |
| UAT-AD-09 | Roll the Mainline script back and forward (backout §5) | Byte-identical at each step |
| UAT-AD-10 | Run permission matrix `role-model.md` PERM-01..15 | Matches the expected cells |

## 8. Contractor User — 30 min

| ID | Do | Expected |
|---|---|---|
| UAT-CU-01 | Enter production for own crew | Saves as DRAFT |
| UAT-CU-02 | Try to change the status | Not possible once the role model is applied (PERM-04) |
| UAT-CU-03 | Edit own DRAFT after a reviewer's note | Possible |
| UAT-CU-04 | Try to delete a record | Not possible (PERM-10) |

---

## Exit criteria (gate 10 passes when all hold)

1. Every case above has been run and recorded.
2. No open BLOCKER or HIGH item in the feedback register, unless the
   Business Owner has accepted it in writing.
3. Each role's representative signs below.

| Role | Name | Date | Signature |
|---|---|---|---|
| Field Inspector | | | |
| Splicing Inspector | | | |
| Project Manager | | | |
| Construction Manager | | | |
| Contract Administrator | | | |
| Finance / Billing | | | |
| Fulcrum Administrator | | | |
| Contractor User | | | |
