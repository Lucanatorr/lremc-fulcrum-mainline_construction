# Master Prompt Conformance Audit

Reviewed: `Fulcrum_Mainline_Construction_Claude_MCP_Master_Prompt.md` (1,519 lines,
uploaded 2026-09-21) against everything built in this repository and deployed to
the `- Development` apps.

Every verdict below was checked against the live environment or the repository,
not against memory. Where a requirement was met by something other than what the
prompt literally describes, the substitution and its reason are stated.

---

## 1. The sprint numbering in this repository is offset from the prompt

This is the first thing to fix, because it makes every other status report
ambiguous.

The prompt defines **Sprints 0–32**. The build treated Sprint 23 as the last one
and renumbered 16 onward. The content mostly exists; the labels do not line up.

| Prompt | Prompt topic | Where it actually lives |
|---|---|---|
| 16 | Operational reporting | Built. Labelled "Sprint 10-12/13-15" reports |
| 17 | Management dashboards | Built. `production-dashboard`, `project-summary` |
| 18 | Forecasting and velocity | Built, but labelled **Sprint 16** |
| 19 | Fiber reel management | Built, but labelled **Sprint 17** |
| 20 | Field UX and offline workflow | Built, but labelled **Sprint 18** |
| 21 | Performance, scale, maintainability | Built, but labelled **Sprint 19** |
| 22 | Auditability, exceptions, closeout | Built, but labelled **Sprints 20–22** |
| 23 | Testing and user acceptance | Labelled Sprint 23 — the one that matches |

**Sprints 24–32 were never started.** The instruction "complete the rest of the
sprints" was carried out as though Sprint 23 ended the programme. It does not:
24 production deployment, 25 training, 26 governance, 27 audit operations,
28 advanced analytics, 29 Power BI readiness, 30 integration, 31 backup and
recovery, 32 continuous improvement all remain outstanding. Sprint 23's own
closing line says to stop and have the results reviewed before production
changes, so stopping there was defensible — but it was never stated as "nine
sprints remain", and it should have been.

---

## 2. Sprint-by-sprint verdict

Legend: **MET** · **MET (CHANGED)** — met via a documented deviation ·
**PARTIAL** — materially built, specific items missing · **NOT STARTED**

| # | Sprint | Verdict | Note |
|---|---|---|---|
| 0 | Discovery and architecture | MET | `docs/sprint-0-discovery.md`; live inventory, risk register, open questions |
| 1 | Core master data | MET | Projects, contractors, labor codes, work categories, units; deactivate-not-delete |
| 2 | Contractor rate model | PARTIAL | See 3.1 — no Currency, no contract/amendment reference |
| 3 | Production transaction foundation | PARTIAL | See 3.2 — no calculation-version stamp |
| 4 | Fiber placement and sequentials | MET | `ABS(end-start)`, slack, total installed, overlap detection |
| 5 | Underground construction | MET (CHANGED) | See 4.1 — banded DP rate schedule |
| 6 | Aerial construction | MET | Units kept separate; span normalization |
| 7 | Splicing and testing | MET | Bands, repeatables, test results |
| 8 | Material master and mapping | MET (CHANGED) | See 4.2 — bundled 1.25" is 1:1, contradicting the prompt's example |
| 9 | Project scope and baselines | MET | Baseline immutable, change orders separate |
| 10 | Change order management | MET | Pending/rejected excluded from authorized scope |
| 11 | Approval workflow | PARTIAL | See 3.3 — no Reopened / Reversed / Adjusted states |
| 12 | Financial calculations | PARTIAL | See 3.4 — no voided/reversed value view |
| 13 | QA/QC | PARTIAL | See 3.5 — inline on production; six specified fields absent |
| 14 | Data integrity and duplicates | MET | Fingerprints, overlaps, orphans, strength scoring |
| 15 | Structures, routes, segments | MET | Direction-normalized segment and span IDs |
| 16 | Operational reporting | MET | All thirteen named reports exist and now execute |
| 17 | Management dashboards | MET | Units kept separate per the prompt's warning |
| 18 | Forecasting and velocity | PARTIAL | See 3.6 — no named burn rate / previous-7-day |
| 19 | Fiber reel management | MET (CHANGED) | See 4.3 — totals derived, not stored |
| 20 | Field UX and offline workflow | PARTIAL | Built; no consolidated offline matrix (3.7) |
| 21 | Performance, scale, maintainability | MET | Scale review recorded; no hard-coded master data |
| 22 | Auditability, exceptions, closeout | MET | 13-question audit trail, exception dashboard, closeout gates |
| 23 | Testing and user acceptance | PARTIAL | See 3.8 — four test families and UAT tracking absent |
| 24 | Production deployment | NOT STARTED | |
| 25 | User training and documentation | NOT STARTED | Partial: `operations-guide.md` |
| 26 | Operational governance | NOT STARTED | |
| 27 | Audit and compliance operations | NOT STARTED | `rate-audit.sql` exists and satisfies part of it |
| 28 | Advanced reporting and analytics | NOT STARTED | |
| 29 | Power BI / external analytics | NOT STARTED | |
| 30 | Integration and automation | NOT STARTED | Production IDs are already stable and idempotent |
| 31 | Backup, recovery, continuity | NOT STARTED | |
| 32 | Continuous improvement | NOT STARTED | |

---

## 3. Requirements that are genuinely missing

### 3.1 Rate model: Currency and contract reference (Sprint 2)

The prompt lists eleven required rate fields. The rate master has nine of them.
Absent: **Currency** and **Contract/amendment reference**.

Currency is low risk today — everything is USD, and `extended_value` is
formatted USD. Contract reference matters more: it is the field that answers
"which executed amendment authorised this price?", which is the first question
in a rate dispute. `supersedes_rate_id` gives the version chain but not the
paper trail.

Approval status is arguably covered by the record status
(DRAFT / ACTIVE / EXPIRED / SUPERSEDED).

### 3.2 No calculation version on the production record (Sprint 3)

The prompt asks for a "Calculation version" field, and Core Design Principles
repeats it: "Calculation/Data Event version where practical".

No production record stores which Data Events version priced it. The script is
at v7.4.0 and the header carries a full changelog, but a record approved under
v6.0.0 is indistinguishable from one approved under v7.4.0. When a calculation
rule changes — and one just did, twice, with the DP banding and the unit fix —
there is no way to select the affected records.

This is the single cheapest gap to close: one disabled TextField, stamped once
on first save.

### 3.3 Production lifecycle is missing three states (Sprint 11)

The prompt names nine: Draft, Submitted, Pending Review, Approved,
Rejected/Correction Required, Reopened, Voided, Reversed, Adjusted.

The production app has seven: DRAFT, SUBMITTED, UNDER REVIEW, APPROVED,
REJECTED, CORRECTION REQUIRED, VOID. **Reopened, Reversed and Adjusted do not
exist.**

`Adjusted` exists on material transactions and `REOPENED` on project closeout,
so the concepts are understood — they were simply never added to the
transaction that carries the money. The consequence is concrete: the prompt
requires that "approved production requires a visible reopening/correction/
adjustment event for material edits" (destructive-change condition 11), and
there is currently no reopen event to make visible. An approved record can only
be corrected by moving it back to CORRECTION REQUIRED, which does not read as
a reopening in the audit trail.

### 3.4 No voided or reversed value view (Sprint 12)

The prompt lists eleven required financial views. Ten exist. The reports
consistently *exclude* VOID (`WHERE _status <> 'VOID'`), which is correct for
earned value, but nothing *reports* voided value. "What was voided this period,
and by whom?" cannot currently be answered from the reports.

### 3.5 QA/QC is inline, and six specified fields are absent (Sprint 13)

The prompt lists twelve QA/QC attributes. QA lives on the production record as
`qa_status`, `qa_photos`, `qa_notes`, `correction_detail`, `correction_completed`
(+date/by) and `exception_severity`.

Absent: **QA/QC ID, Inspection type, Assigned owner, Due date, Resolution text,
Closed by/at** (partly covered by `correction_completed_by`/`_date`).

Keeping QA inline is legitimate — Sprint 0 says "Do not assume each conceptual
entity requires a separate app" — and it keeps the field workflow to one record.
But without an assigned owner and due date there is no way to chase an open
deficiency, which is what a QA register is for. The prompt also requires an
explicit recorded decision on whether a failed QA blocks submission, approval,
billing or closeout: that decision **is** implemented (approval is blocked) and
documented, so that part is met.

### 3.6 Forecasting metrics not named as specified (Sprint 18)

Eight metrics are listed. Built: remaining quantity, average active-day
production, estimated working days remaining, rolling 7-day and 30-day value.
Not built as named metrics: **daily financial burn rate**, **previous 7-day
production** (week-over-week exists in `production-weekly`, which is close but
not the same window), and 7/30-day *average* value as distinct from the rolling
*total*.

### 3.7 No consolidated Offline Capability Matrix

Core Design Principles require, for every lookup, Data Event, validation and
cross-record query, a statement of whether it works fully offline, offline with
cached data, online only, or only after sync. Sprint 23 deliverables list an
"offline matrix"; the Final Handoff lists "Offline Capability Matrix" as item 24.

Offline behaviour is discussed correctly in fourteen documents — the
record-link-snapshot design exists precisely so validation works offline — but
there is no single matrix. The prompt is explicit that an online-only control
must not be represented as an offline guarantee, and a scattered narrative makes
that easy to get wrong.

### 3.8 Sprint 23 gaps

Sprint 23 is the sprint the prompt is strictest about, and it is the one with
the most outstanding items.

- **Four test families named in the prompt do not exist by any name:**
  `TEST-OFFLINE-*`, `TEST-SEC-*`, `TEST-PERF-*`, `TEST-DESTRUCT-*`.
  Eleven of the fifteen named prefixes are present (CORE, FIBER, UG, AERIAL,
  SPLICE, RATE, MAT, SCOPE, FIN, QA, REPORT).
- **The destructive-change matrix is designed but not executed.**
  `docs/destructive-change-matrix.md` has 62 rows and **zero recorded PASS/FAIL
  results**. The prompt requires the actual result for each scenario, and states
  that destructive-change testing passes only when all 27 listed conditions hold.
  Those 27 conditions are not enumerated or individually answered anywhere.
- **No UAT feedback tracking.** The prompt requires feedback tracked by Feedback
  ID, role, user, date, workflow, issue, severity, type, suggested change,
  decision, implementation and retest, classified BUG / USABILITY /
  ENHANCEMENT / BUSINESS RULE / TRAINING. None exists. UAT is described in
  `sprint-23-readiness.md` as a role-by-role walkthrough, not as executed
  sessions with real users — which is honest, but it means UAT sign-off, a
  stated precondition for recommending production, is not met.
- **No date-boundary tests.** The prompt names January 1, December 31,
  first/last day of month, first/last reporting day of week, leap day, and
  records near midnight, and requires the organizational timezone to be
  confirmed. The ISO-week logic has unit tests, but no boundary suite and **no
  timezone confirmation anywhere in the repository.** Given every report groups
  by `work_week` and `work_month`, this is a real exposure.
- **Security and permission testing was never performed.** The prompt requires
  testing representative roles against view/create/edit/approve/administer/
  export/delete capabilities. Nothing was tested; no role model was recommended.

### 3.9 Material mapping coverage

57 of 146 labor codes have a material mapping (125 rows, 81 distinct materials).
The remaining 89 resolve to no material. This is by design detectable —
`exception-dashboard.sql` raises *Missing Material Mapping* — and the prompt's
instruction "Never guess a multiplier. Flag ambiguous mappings for business
review" is being followed rather than violated. Recorded here so the coverage
number is not mistaken for completeness.

The prompt's Sprint 8 example implies several materials per labor code (conduit
+ trace wire + mule tape). The model supports this and uses it — `AFO.SL` maps
32 materials — but conduit codes currently map one material each, and only one
trace/mule material exists in the master.

---

## 4. Deviations from the prompt, and why

These are places where the delivered system deliberately differs from the
prompt's text. Each was a business ruling, not an oversight.

### 4.1 The DP rate schedule is banded, not additive

The prompt (Sprint 5) requires distinguishing one through five 1.25-inch
conduit packages "and any approved dual/multi-pipe adder structure". The
original rate sheet expressed this as a base code plus a "Dual" adder, which
was first read as additive pricing.

**Ruling 2026-09-18 (business owner): the schedule is banded.**
`BM60(1..5)(1.25)DP` are five discrete pay units priced 10 / 12 / 12 / 14 / 14,
not base-plus-adder. Confirmed live: `BM60(2)(1.25)DP` prices at $12.00.
The labor code list was restructured accordingly and the base/adder pair retired.

### 4.2 Bundled 1.25-inch conduit consumes 1:1 — this contradicts the prompt's example

The prompt's Sprint 8 example states that 2,000 FT of a 3×1.25" bore maps to
6,000 FT of 1.25-inch HDPE.

**Ruling 2026-09-17 (business owner): for 1.25 inch, that is wrong.** A
multi-pull 1.25" package is a single bundled assembly consumed at 1 FT per
production FT, whatever the pull count. Only single-pipe 2" and 4" multiply by
pull count. `conduit_material_quantity` implements exactly this, and
`total_duct_footage` is kept alongside as the informational
footage × pull-count figure the prompt was describing.

**This is the most significant departure from the prompt in the build**, it is
deliberate, and it is confirmed live: 500 FT of `BM60(2)(1.25)DP` expects
500 FT of part `114-11-2`, not 1,000.

### 4.3 The reel stores no totals

Sprint 19 lists "Used ranges" and "Remaining estimate" as things to track. They
are not stored on the reel record; `reel-balance.sql` derives them from approved
production. Stored totals were removed in the Sprint 19 revision because a total
on a master record goes stale the moment the next production record syncs, which
the prompt itself warns against elsewhere ("External reporting tools should
primarily aggregate those values"). The reel keeps only what is physically
printed on it plus recorded waste.

### 4.4 QA is inline rather than a separate app

Covered in 3.5. Permitted by Sprint 0's minimum-architecture instruction.

### 4.5 Creator identity comes from platform metadata

An `inspector_email` field was built and then removed. `USEREMAIL` does not
resolve in either the Data Events runtime or the expression runtime on this
account, so the field could never be populated, and a stored copy would go
stale. Reports join `_created_by_id` to `memberships` instead. Verified live:
`created_by_email` resolves to a real address.

### 4.6 The unit comes from the rate, not the labor code label

Changed 2026-09-22 after the first real production record saved with a null
unit. The Data Events runtime exposes no choice labels, so the documented
"derived from the labor code" behaviour was impossible. The unit is now copied
from the selected rate. **Committed and tested; not yet deployed** — see L16.

### 4.7 The mapping master is keyed on labor code

The canonical `CONDUIT-<size>-<n>PULL` string the app derives is a readable
derivation, not a key. The Labor-Material Mapping master resolves
**labor code → stock part number**, which is what the material master and the
ledger are keyed on.

---

## 5. Prompt process requirements not being followed

### 5.1 Three of the four required continuous logs are not maintained

The prompt mandates four logs with specified columns. Only the Implementation
Log exists as a document, and it is a narrative journal rather than the
specified Date / Sprint / Change / Object / Previous State / New State / Reason
/ MCP Action / Testing / Result / Impact / Rollback columns.

- **Business Decision Log** — not maintained. The decisions exist, as `RULING`
  blocks inside scripts and prose in the implementation log, but there is no
  register with Decision ID, date, reason, affected components, approver. The
  prompt names exactly the decisions this project made: first day of the
  reporting week, whether only approved production counts, the historical-rate
  snapshot rule, negative transactions, closed-project behaviour.
- **Open-Issue Log** — not maintained as a document. Open items are referenced
  by number ("open item 26") across the implementation log with no register
  defining them.
- **Data Event Version Inventory** — not maintained. Eight Data Event scripts
  exist; none has a record of trigger, fields monitored, fields modified,
  queries performed, dependencies, offline behaviour, deployment date and
  rollback version. Script header changelogs partly cover this for the
  production app only.

### 5.2 Sprint-completion reports and stop-for-approval

The prompt requires a ten-point completion report and an explicit stop after
every sprint. Sprints were delivered in batches of three ("Sprints 16, 17 & 18")
with a combined narrative rather than per-sprint reports, and did not stop for
approval between them.

---

## 6. What this means for readiness

The prompt's Sprint 23 gate is unambiguous: do not recommend production until
critical defects are closed, reconciliations pass, **approval, destructive-change
and permission tests pass**, offline limitations are documented, and UAT sign-off
is complete.

By that standard the system is **not ready for production**, and the blockers are
process and verification rather than function:

1. Destructive-change matrix has no recorded results (3.8)
2. No permission or security testing at all (3.8)
3. No UAT with real users (3.8)
4. No offline capability matrix (3.7)
5. No date-boundary or timezone confirmation (3.8)
6. The unit fix is committed but undeployed (L16), so records entered today
   still save without a unit

None of these say the calculations are wrong. The financial core reconciles, the
rate snapshot holds, the banded DP schedule is confirmed live, and 24 of 24
reports execute. What is missing is the evidence the prompt requires before
anyone is allowed to rely on that.


---

## 7. Closed during this audit

The review was not read-only. These were found and fixed while checking the
prompt's requirements:

### 7.1 A timezone defect that moved every work date back a day (NEW, fixed)

Writing the date-boundary tests the prompt requires found a live bug on the
first probe. Fulcrum stores a date-only field as UTC midnight; `parseDate()`
read it back with the local getters, returning the previous day anywhere west
of UTC. In `America/New_York` the live record's **Monday derived as Sunday**,
and 1 January derived as the **previous year**.

That is not cosmetic. `productivity.sql` and `forecast-completion.sql` both
filter `work_day_of_week NOT IN ('Saturday','Sunday')`, so every Monday's
production was being dropped from productivity and forecasting with nothing to
show it had gone. The duplicate fingerprint moved with the date, so the same
work saved in two zones produced two fingerprints and stopped matching itself.
The rate expiry comparison shifted too.

Fixed once in `parseDate()` (v7.5.0), same fix applied to the material
transaction and structure scripts. `tests/date-boundary.test.js` now runs 30
assertions under four timezones — with the bug reintroduced, **UTC passes all
30 while New York fails 19**, which is precisely how it survived 914 passing
tests.

### 7.2 The four required continuous logs

Three of the four did not exist. Now created, with real content rather than
empty templates:

- `docs/business-decision-log.md` — 17 decisions with the prompt's columns,
  and an explicit list of the decisions the prompt names that are **still
  open** (negative production transactions, closed-project enforcement, the
  organizational timezone)
- `docs/open-issue-log.md` — 17 issues with priority and impact, including the
  two P1s that were previously only prose: the production app's live API
  credentials, and the `forms_update` outage
- `docs/data-event-inventory.md` — all nine scripts with trigger, fields
  monitored and modified, queries, dependencies, offline behaviour, deployment
  date and rollback version, plus an honest statement of which five are
  **not live**

### 7.3 The offline capability matrix

`docs/offline-capability-matrix.md` now classifies every control using the
prompt's own four categories. The useful outcome is a clean split that was
implicit in the design but never stated: **everything on one record is fully
offline; everything needing two records is a post-sync report**, because no
Data Event in this system uses `REQUEST`.

---

## 8. Revised gap list

After §7, what remains outstanding against the prompt:

**P1 — blocks production**

1. Destructive-change matrix has no recorded results (OI-04)
2. No security or permission testing (OI-05)
3. No UAT with real users, no feedback register (OI-06)
4. Production lifecycle missing Reopened / Reversed / Adjusted (OI-03)
5. `forms_update` outage — five scripts and two schema changes undeployed (OI-02)
6. Live API credentials in the production app's script (OI-01)

**P2**

7. No voided/reversed value view (OI-07)
8. No calculation-version stamp (OI-08)
9. Rate model missing Currency and contract reference (OI-09)
10. QA/QC missing owner, due date, inspection type, QA ID (OI-10)
11. Sprints 24–32 never started (OI-16)

**P3**

12. Forecasting burn-rate and previous-7-day metrics (OI-14)
13. Organizational timezone never stated (OI-17) — derivation is now
    timezone-independent, so this is documentation rather than defect
