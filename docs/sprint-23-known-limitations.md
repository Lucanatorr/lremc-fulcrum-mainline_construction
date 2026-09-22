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


---

## L13 - query-mcp eats the `+` operator (client defect, worked around)

The MCP client form-encodes SQL without escaping, so every `+` reaches the
engine as a space. `SELECT 'a+b'` returns `'a b'` (length 3). Eleven of the
24 reports use `+` arithmetic and none of them could run through MCP.

Not a defect in this project's SQL: all 24 are correct standard SQL and run
as written in Fulcrum's Query UI and over REST. `scripts/flatten_report.py
--mcp` rewrites `a + b` to `a - -b` for MCP execution only; the canonical
files keep `+`.

## L14 - query-mcp has a request-size ceiling of roughly 6 KB

A 6.3 KB statement runs; 11.9 KB returns HTTP 431. `exception-dashboard.sql`
(11.9 KB flattened, 17 exception branches over one shared prelude) therefore
cannot run in one piece through MCP. `scripts/slice_report.py` executes it as
prelude + branch subsets; all 17 branches have been run against the live
schema. The concatenation itself is unexercised through MCP, which is a
UNION ALL of column lists that each already compiled.

Neither limit affects the delivered artefact: Fulcrum runs these reports
itself, not through this client.

## L15 - the unit was erased on every editor save (FIXED, deploy pending)

`applyLaborMetadata()` parsed the unit from the labor code's choice LABEL.
The Data Events runtime exposes no labels -- a ChoiceField arrives as
`{ choice_values, other_values }` -- so the parse always missed and the
fallback branch nulled the unit, on every record saved in the editor, for
every labor code. Found on the first real production record,
PRD-2026-143C1840, which priced correctly at $12/FT and came back with
`unit = null`.

Impact: the financial model splits time-and-materials out of physical
production on the unit, and `unit NOT IN ('HR','EVENT')` over a NULL is NULL
rather than TRUE, so a unit-less record silently left physical value
altogether.

Fixed in the repo at v7.4.0: the unit is copied from the selected rate by
`rate_link` record_defaults (r010 -> m024), as `labor_description` already
was, and the script now only ever fills a blank unit. The four affected
report predicates are NULL-guarded. Covered by
`tests/unit-derivation.test.js` (19 assertions).

**Not yet deployed - forms_update is refusing every write (see L16).**
Until it is deployed, every record entered in the editor still loses its unit.

The same defect was then found in two more scripts and is fixed in the repo
alongside it:

  - `mc-project-scope-line-dev.js` - identical parse, and it cleared the unit
    UNCONDITIONALLY (`m ? m[2] : null`), so every scope line lost its unit too.
    The scope line now also copies the rate's unit down (s006 <- r010).
  - `mc-change-order-dev.js` - same parse on `line_unit` inside the
    quantity_changes repeatable, same unconditional clear.

All three now only ever FILL a blank unit and never clear one.

## L16 - fulcrum_forms_update is refusing all writes (2026-09-22)

Every `forms_update` call is rejected with "Fulcrum could not accept the
requested operation" and no detail. This is not payload-specific. Established
by elimination, smallest test last:

  1. the full 140-element production payload - rejected
  2. the same payload with `removed_element_keys: []` - rejected
  3. a 6 KB form (project scope line), one record_default added - rejected
  4. the rate master, with NO record_default change at all - rejected
  5. `forms_update` with only an `id` and no changes whatsoever - rejected

`fulcrum_forms_validate` returns `{"valid": true}` for the full production
payload, and every read path (`forms_get`, `query_records`,
`choice_lists_get`) works normally. So the schemas are sound and the account
is reachable; writes specifically are refused.

Every affected form was read back afterwards and is byte-for-byte unchanged -
the rejected writes altered nothing. No rejected write was retried unchanged.

### Causes ruled out (2026-09-22, second round)

  6. **Authentication is fine.** Every read on the SAME app-mcp server with the
     SAME credential succeeds: `forms_get`, `roles_list`, `audit_logs_list`,
     `choice_lists_get`, and `forms_validate` (which returns `{"valid": true}`
     for the full production payload). A bad or unsubstituted token would fail
     all of them, not just writes.
  7. **Authorization is fine.** The token acts as Lucas Collins, whose
     membership role is **Owner** - `can_manage_apps: true`, confirmed from
     `roles_list`. Form updates are exactly what that permission governs.
  8. **Not the HTTP header.** The MCP gateway runs out of process; there is no
     Fulcrum environment variable in the session and no gateway config to read,
     so the header cannot be inspected or set from here. It also cannot be the
     cause, per 6: the same credential authenticates every read.

So: valid credential, sufficient role, schema-valid payload, and every read
path working - and yet a call carrying only an `id` and no changes is refused.
That leaves a server-side or account-level condition on form writes
specifically. It is not something that can be fixed from this side.

There is precedent on this account: commit 0cbf0e1 records a forms_update
outage that cleared on its own after three days. Everything needed is
committed and tested, so the deploy is a replay of known-good payloads once
writes come back.

**Pending deploys, in order:**

  1. `mainline-construction-dev` - elements (rate_link gains m024 <- r010)
     plus script v7.4.0
  2. `mc-project-scope-line-dev` - elements (rate_link gains s006 <- r010)
     plus the guarded script
  3. `mc-change-order-dev` - script only

A faster route for any of these: add the copy-down in the Fulcrum app editor
by hand. On the rate record link, map the rate's **Unit** to the form's
**Unit** field.
