# Quick-Reference Cards — Mainline Construction

Sprint 25. One card per task; print double-sided.

---

## Card 1 — Core production

1. **Sync** before you leave.
2. **+** New record.
3. Project · Contractor · **Work Date (set it every time)**.
4. Work Category · Labor Code · Quantity.
5. **Applicable Contractor Rate**: the record cannot be approved without it.
6. From / To · Photo.
7. Read **Exceptions (auto)**. A WARNING is fine. A CRITICAL means fix it or phone the office.
8. Status **SUBMITTED** when complete.
9. **Sync** at the end of the day.

---

## Card 2 — Fiber placement

- Pick the **Fiber Reel**.
- **Starting** and **Ending Sequential** from the jacket. Direction doesn't matter.
- Footage is calculated. Don't type it unless you must.
- **Slack** and **Other Added Footage**: their own boxes, never inside the sequentials.
- A warning at more than 5% off installed footage usually means a transposed digit.
- Overlaps with other crews' ranges are caught **after sync**, not on the device.

---

## Card 3 — Underground

- The labor code fills Pull Count and Conduit Diameter. Don't type them.
- Depth under **36 in** → warning.
- A railroad crossing needs a **railroad bore** labor code.
- Disturbed a surface? Record Restoration Required / Type / Status.

---

## Card 4 — Splicing

- **Fiber Count at Location** must fall inside the labor code's band, or it is **CRITICAL**.
- **Splice Quantity** = Quantity.
- Record Test Type · Measured Loss · Test Result.
- Loss **> 0.10 dB**, or a FAIL → warning.

---

## Card 5 — QA

| QA Status | Then |
|---|---|
| Pass | Can be approved |
| Conditional Pass | State the condition, a **QA Owner** and a **QA Due Date** |
| Fail | **Cannot be approved.** Set a QA Owner and a Due Date |
| Not Reviewed | **Cannot be approved** |

Overdue and uncorrected → WARNING, every day, until **Correction Completed = Yes**.

---

## Card 6 — Approval (reviewers)

**Approve only when** there are no CRITICAL exceptions, QA is recorded and
not Fail, and the record is **not your own**.

| To do this | Set status | Required |
|---|---|---|
| Send back for a fix | CORRECTION REQUIRED | QA Reviewer Outcome Detail |
| Refuse | REJECTED | Rejection Reason |
| Entered in error (never approved) | VOID | — |
| Re-review approved work | REOPENED | Reopen Reason (clears the approval) |
| Take approved work out entirely | REVERSED | Reversal Reason (keeps the approval stamp) |
| Correct approved work by an amount | New record, Production Type = **Adjustment** | Original Production ID, Adjustment Reason |

Approved records lock Quantity, Labor Code and Rate. **Never delete.**

---

## Card 7 — Rate maintenance (rate administrator)

1. **Never edit a rate that production has used.** Add a new rate record.
2. New rate: Contractor · Labor Code · **Unit** · Description · Unit Rate ·
   **Currency** · **Contract Reference** · Effective Date · Active = Yes.
3. Old rate: set its **Expiration Date** to the day before, then Active = No.
4. Never 0.00. A unit with no price stays inactive.
5. Run `rate-master-audit`: 0 CRITICAL.
6. Existing production keeps its old rate. `MASTER REPRICED SINCE` in the audit trail is correct.

---

## Card 8 — Mapping maintenance (material administrator)

1. Key: **labor code** → material code, with a **multiplier**, a **waste
   factor** (separate, never folded in) and a **confidence** level.
2. APPROVED only when: both projects agree within 5%, a single-source ratio is
   a whole number, or a ruling settles it.
3. Unsure → **NEEDS REVIEW**. Never guess.
4. A multiplier of 0 is refused. Deactivate the mapping instead.
5. Check `exception-dashboard`: *Missing Material Mapping* should fall.

---

## Card 9 — Project setup (project administrator)

1. **Project Master**: planned fiber, underground and aerial footage, and planned splices. Set it ACTIVE.
2. **Scope Line** per pay unit: planned quantity and budget rate. Set it **BASELINED**; it locks.
3. `project-summary` no longer says *NO BASELINE*.
4. Every scoped pay unit has an active rate for the contractor.
5. Every scoped pay unit has an APPROVED mapping, or "no material" is written down.
6. Scope changes go **only** through a Change Order: signed deltas, and only once APPROVED.
