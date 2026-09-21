# Sprints 19, 20 & 21 — scale, auditability, exception reporting

Two new reports, a scale audit that removed five fields, and scale bounds on
the two quadratic queries. **774 tests across thirteen suites.**
Production app **v7.3.0** deployed 2026-09-21T20:31:45Z, 140 elements,
verified element-by-element against this repo.

---

## Sprint 19 — Performance and scale review

Reviewed against the brief's stated target: hundreds of projects and
contractors, thousands of structures and rates, tens of thousands of material
transactions, **hundreds of thousands of production records**.

### Data Events: clean, and clean for a reason

> "Do not create Data Events that cause excessive API/query activity whenever a
> field changes."

| Check | Finding |
|---|---|
| Outbound calls | **None.** `REQUEST` appears nowhere in any of the seven scripts. |
| `ON('change')` cost | **O(1).** Eleven handlers in the production app; each reads a handful of local fields and writes at most three. None iterates a list, none touches a master. |
| Rate lookup | **Zero queries at save.** |
| Material mapping | **Zero queries at save.** |
| Reel range check | **Zero queries at save.** |

The reason the first three cost nothing is the RecordLink `record_defaults`
pattern: selecting a rate, reel or structure physically copies its values onto
the transaction *at selection time*. Every later validation reads local fields.

That design was chosen in Sprint 2 for **offline capability** and again in
Sprint 12 for **historical immutability**. The scale review is the third
independent reason to keep it: a system that looked up a rate on every change
would issue one query per keystroke across hundreds of thousands of records.
A test now asserts no Data Event can ever make an outbound call.

### Five fields removed

`calculated_material_usage` (`m048`–`m052`) was a repeatable declared
"auto-generated from the labor-to-material mapping master."

**Nothing populated it, and nothing could.** Filling it requires reading the
mapping master, which a device cannot do offline — the same impossibility that
took three fields off the reel master in Sprint 17. It was five elements
shipped to every device on every form sync, for a section permanently empty.

`material-variance.sql` never read it; it uses `conduit_material_code` and
`conduit_material_quantity`, which the app genuinely does derive onto the
record. So the report was unaffected and the fields were pure weight.

### The two quadratic queries

Only two reports self-join. Both were already partitioned on an equality key —
the cost is quadratic in the size of a *partition*, not of the table:

| Report | Partition key | Effect at 100k records |
|---|---|---|
| `sequential-overlap.sql` | `reel_id` | tens of records per reel compared, not 100k × 100k |
| `duplicate-production.sql` §3 | project + contractor + work_date + labor_code | a handful of rows per group |

Sections 1, 2 and 4 of the duplicate report are `GROUP BY fingerprint`, i.e.
linear. **That is what the Sprint 13 fingerprints bought** — duplicate
detection stopped being a self-join at all.

What both lacked was a **date window**, so a routine run re-scanned all history.
Both now take one, and it is **one-sided on purpose**:

```sql
AND (p_date_from IS NULL
     OR a.work_date >= p_date_from OR b.work_date >= p_date_from)
```

Bounding *both* sides would hide the case the report exists for: a pull booked
today that overlaps a range from months ago. Requiring only one side of each
pair to be recent keeps that finding and still lets the engine discard most of
the history. `TEST-SCALE-004` asserts the window stays one-sided.

### Project totals and remaining quantity

Already correct and unchanged: no total is stored anywhere. Project totals,
earned value, completed and remaining quantity are all `GROUP BY` aggregates
computed at query time from atomic transactions. This is the standing rule that
also removed the reel and material fields above — three separate sprints have
now arrived at it from three directions.

---

## Sprint 20 — Auditability

`reports/production-audit-trail.sql`. One row per production record, answering
all thirteen questions the brief lists, without a join the reader has to make
themselves.

| The brief asks | The column |
|---|---|
| Who entered this? | `created_by_name` / `created_by_email` / `inspector` |
| When was it entered? | `entered_at` / `synced_at` |
| What project? | `project_id` / `project_name` |
| Which contractor? | `contractor_id` / `contractor_name` / `crew` |
| What labor code? | `labor_code` / `labor_description` |
| What quantity claimed? | `quantity` / `unit` |
| What rate applied? | `rate_applied` |
| Where did the rate originate? | `rate_source_id`, `rate_effective_date`, `rate_expiration`, `rate_scope`, `rate_provenance` |
| Calculated value? | `extended_value` |
| Who approved it? | `approved_by` |
| When approved? | `approved_date` |
| Subsequently changed? | `record_version`, `last_changed_at`, `last_changed_by`, `changed_after_approval` |
| What material? | `material_ledger_codes`, `material_installed_quantity`, `crew_reported_materials` |
| What location/segment? | `segment_id`, from/to, structures, station, reel, sequentials, GPS |

### The rate is shown twice, deliberately

`rate_applied` is the snapshot copied onto the transaction. `rate_master_current_rate`
is what that same master record says **today**. They are allowed to differ —
that is the snapshot doing its job.

`rate_provenance` states which case applies in words:

```
MATCHES MASTER
MASTER REPRICED SINCE - this record kept its original rate
RATE RECORD NO LONGER EXISTS - snapshot is the only evidence
NO RATE LINKED
```

"Why does this record price differently from the rate sheet?" is the single
most common audit question, and the answer is almost always the second line.
A report that showed only one of the two numbers would invite the wrong answer.

### "Was it subsequently changed?" means *after approval*

`_version` counts every edit, but for a financial record the question that
matters is narrower: was it edited after somebody approved it? That is the
change nobody re-reviewed. `changed_after_approval` compares `_updated_at`
against `approved_date` and says so plainly.

### No status is excluded

An audit trail that hid voided or rejected records would be useless for exactly
the cases most likely to be audited. Every row carries `record_status`; the
status filter is an opt-in parameter that defaults to unfiltered. A test
asserts no unconditional status exclusion ever creeps in.

*(A voided **material ledger** row is different — it was retracted — and is
correctly excluded in its own CTE. A separate test pins that distinction.)*

---

## Sprint 21 — Exception reporting

`reports/exception-dashboard.sql`. All **seventeen** exception types the brief
names, one row per finding, ordered by severity then by value at risk.

Missing Rate · Zero Rate · Missing Labor Code · Missing Project · Missing
Contractor · Missing Material Mapping · Production Over Plan · Potential
Duplicate · Sequential Overlap · Sequential Outside Reel Range · QA Failure ·
Correction Required · Material Variance · Expired Contractor Rate · Pending
Approval · Old Pending Production · Missing Required Photos

### Severity never replaces the description

> "Do not allow severity to replace the actual exception description."

Every row carries a severity **and** a `detail` sentence naming the actual
figures — which record, which reel, how many feet, how much money. "CRITICAL"
tells a manager how fast to move; it does not tell them what is wrong. A
dashboard that collapses to a severity count is one nobody can act on.

Severity is value-aware where the brief says it should be. Its own examples are
honoured exactly: a missing photo is **WARNING** (and only INFO before
approval), while an unpriced record is **CRITICAL** regardless of size.
Material variance and old pending production escalate to CRITICAL once the
value at risk crosses `p_high_value`.

### Two design choices worth stating

**Over Plan is anchored to the latest approved record** of the pay unit, not
emitted against every record in the group. Over plan is a condition of the
project + labor code; attaching it to all 500 approved records would bury the
other sixteen exception types under identical CRITICALs.

**The overlap predicate is duplicated, and pinned.** The dashboard has to
*detect* an overlap to be useful; `sequential-overlap.sql` remains the place
that *classifies* one. Two implementations of a rule is how two reports come to
disagree, so `TEST-EXC-DRIFT` normalizes the aliases and asserts the two
predicates are character-identical. If either changes, the build fails.

Every finding names its companion report in `see_also`, so the dashboard is the
management view and the specialist reports stay the place to diagnose.

---

## Still open

- **No report has been executed.** Zero records exist in any dev app and the MCP
  server exposes no record-creation tool. These two join the twenty-one others
  as unproven SQL. Still the project's biggest blocker.
- The exception dashboard's Missing Material Mapping check reads the
  Labor-Material Mapping master, which has **no records loaded** — so today it
  would flag every conduit record. It is correct and will go quiet once the
  master is populated, which waits on the outstanding 2" part numbers.
