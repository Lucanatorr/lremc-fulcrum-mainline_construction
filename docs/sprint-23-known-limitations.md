# Known Limitations Register  (Sprint 23.75)

> "Do not hide architectural limitations."

Every limitation below is architectural or environmental. Defects — things that
are simply wrong and should be fixed — are tracked separately in the open-items
table in `docs/implementation-log.md`.

---

## L1 — Cross-record checks require connectivity

**What.** Duplicate detection, sequential overlap, over-plan production,
material variance, reel balance and closeout readiness all run as Query API
reports, not on the device.

**Why.** Fulcrum Data Events can read only the record in hand. The one escape,
`REQUEST`, is HTTP and therefore online-only.

**Affected.** Field crews working out of service.

**Impact.** A crew can create a duplicate, or a range overlapping another
crew's, and the device will not say so. It is caught after sync, by report.

**Workaround.** The device computes a *fingerprint* every save — a canonical
signature of the record — so once synced, duplicate detection is a `GROUP BY`
rather than a guess. Reviewers run `duplicate-production.sql` and
`sequential-overlap.sql` before approving.

**Risk.** Medium. Detection is reliable; it is just not immediate.

**Future.** A webhook could push a server-side check back to the record within
seconds of sync. Not built.

---

## L2 — A control that only works online was deliberately not built

**What.** We declined to implement device-side overlap checking via `REQUEST`.

**Why.** It would work in the office and silently stop working in the field —
and people would trust it either way. A control that fails invisibly is worse
than no control.

**Impact.** See L1. This is the conscious trade.

**Risk.** Low, and deliberate.

---

## L3 — `SETREADONLY` is a UI control, not a permission

**What.** Locking quantity, labor code and rate on an approved record stops a
user editing them **in the app**. It does not stop the Records API, a CSV
import, or someone setting the status back to DRAFT first.

**Impact.** Approved financial figures are not tamper-proof at the data layer.

**Workaround.** Detection: `production-audit-trail.sql` reports
`CHANGED AFTER APPROVAL` whenever `_updated_at` is later than `approved_date`.

**Risk.** Medium — depends entirely on who holds API credentials.

**Future.** Fulcrum role permissions, configured outside Data Events. Untested
here (23.45 BLOCKED).

---

## L4 — Records cannot be created from this toolchain

**What.** The Fulcrum MCP server exposes no record-creation tool.

**Impact.** **The largest limitation in the project.** Every dev app has zero
records, so no report has ever returned a row, and 24 of the 113 Sprint 23
sections are BLOCKED. All master data sits as import-ready CSVs in
`data/import/`.

**Workaround.** Import through the Fulcrum UI or the Records API.

**Risk.** **High.** Twenty-four SQL reports are unproven. They pass structural
convention tests, which proves they are well-formed, not that they return
correct numbers.

**Future.** Load the masters, create the 23.1 test project, run every report
once.

---

## L5 — No production adjustment/reversal transaction

**What.** Correcting billed production means editing the record, not posting a
compensating adjustment. The material ledger does support signed adjustments;
production does not.

**Impact.** The original claim is lost when a correction is made.

**Workaround.** The audit trail shows `record_version` and
`CHANGED AFTER APPROVAL`, so a change is visible even though the prior value is
not retained.

**Risk.** Medium, rising once invoicing starts.

**Future.** Open item 29 — a business decision on whether accounting-grade
reversal is wanted.

---

## L6 — VOID is honoured but not attributed

**What.** Every report excludes VOID records, but nothing records who voided a
record, when, or why.

**Risk.** Low. **Future.** Open item 30.

---

## L7 — Reporting is SQL; nothing is wired into Fulcrum's UI

**What.** All 24 reports are Query API SQL. Report Builder templates, webhooks,
reference files and extensions are untouched.

**Affected.** Any manager who does not write SQL — i.e. most of them.

**Workaround.** Someone technical runs them, or they are wired into an external
BI tool.

**Risk.** Medium. Perfect reports nobody can run deliver nothing.

**Future.** Report Builder templates for the daily/weekly/monthly family, or a
BI connection.

---

## L8 — Material mapping is incomplete

**What.** The Labor-Material Mapping master has no records loaded, because 2"
conduit part numbers do not exist in the catalogue.

**Impact.** Only conduit material is derived. `exception-dashboard.sql` would
currently flag Missing Material Mapping on every conduit record.

**Risk.** Medium. **Future.** Open items 7 and 14.

---

## L9 — Seven billing gaps in the source data

**What.** Production was recorded against pay units that do not exist in the
rate sheet: 11,004 FT `BFO.96.I`, 2,008 FT `BFO.96.IE`, 684 FT of 4" railroad
bore, plus four smaller codes.

**Impact.** **Revenue.** This work cannot be billed as recorded.

**Risk.** High — it is real money already in the ground.

**Future.** Open item 11. Needs a contract decision, not code.
`data/labor-billing-gaps.csv` has the detail.

---

## L10 — Span footage is hand-entered

**What.** Aerial span footage is typed, not derived. Automatic derivation needs
a pole dataset with coordinates.

**Risk.** Low. **Future.** Open item 8.

---

## L11 — Plausibility thresholds are global, not per pay unit

**What.** "Unusually high quantity" is two global numbers (50,000 FT sequential;
500 FT span), not per-pay-unit limits.

**Impact.** False positives on large legitimate runs; misses on small units
where a much lower figure would be implausible.

**Risk.** Low. **Future.** Needs a historical baseline, and there is no history.
Open item 24.

---

## L12 — Two live API tokens in the production app's script

**What.** The **production** `Mainline Construction` app
(`148545bf-b869-454e-a2b9-44a9860f23de`) contains a Fulcrum API token and a
Smartsheet API token as plain string literals in its Data Event script.

**Why it matters.** App script syncs to **every field device**. The Fulcrum
token carries full account access.

**This is not a limitation of this build — it is a live finding in the system
this one replaces.** No token value has been reproduced in this repository, and
the production app has never been modified by this project.

**Risk.** **HIGH — unresolved.** Open item 2, raised in Sprint 0 and still open.

**Future.** Rotate both tokens and move them out of app script.
