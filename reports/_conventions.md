# Report conventions

Every report in this directory follows these rules. They are here rather than
repeated in each file, and the tests in `tests/reporting.test.js` assert them.

## Query API facts (confirmed from live table definitions, 2026-09-17)

- **Tables are named by FORM ID**, not by form name. Each report carries an
  ID-to-name mapping in its header comment so the SQL stays readable.
- **The record status column is `_status`**, not `status`.
- A repeatable is its own table, `"<form_id>/<repeatable_data_name>"`, joined to
  its parent on `_parent_id`. It carries **no status of its own**, so filtering
  by the parent's status needs the join.

## Form IDs

| ID | App |
|---|---|
| `06c36c8e-4a88-4cf3-a691-9a792f8374d2` | Mainline Construction - Development (production) |
| `a5529dd0-54fa-4b8d-b595-d0218df0ee97` | MC Contractor Rate - Development |
| `5ce243d4-9ec1-4fbd-8659-7be9f632b55c` | MC Project Master - Development |
| `d8a368b5-1e19-4f5f-8cf9-ff8fbdd03ab4` | MC Contractor Master - Development |
| `aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b` | MC Project Scope Line - Development |
| `458ae172-b7b4-43b5-8917-d7a792c9e81a` | MC Change Order - Development |
| `ee204906-adb3-431b-a1d9-d7427a4c842c` | MC Material Transaction - Development |
| `658143d1-edbd-430b-81bb-1b0bb1092729` | MC Material Master - Development |
| `728477da-5f36-48cb-b3ab-cbc8c38d077f` | MC Fiber Reel - Development |

## Four rules that decide what a number means

### 1. Approved production is the only official production
Sprint 12: completed quantity, financial completion, earned value, remaining
scope and billing all count **APPROVED** only. Pending stays visible, in its own
column, never folded into an approved figure. `VOID` is excluded from
everything; `REJECTED` is reported but is not work.

### 2. Quantities cannot be summed across units
A project's production is feet of conduit, each of handholes, splices and hours
of flagging. `SUM(quantity)` across those is a meaningless number that looks
authoritative. So **quantity is only ever aggregated within one labor code or
one unit**, and anything that crosses pay units aggregates **value**.

### 3. Time-and-materials units are not physical production
`HR` and `EVENT` are billed for time, not for work in the ground. They carry
real value but no production. Every report that reports "physical production"
excludes them and says so; value figures include them.

### 4. The week is defined once, on the record
The production app derives `work_year`, `work_month`, `work_week` (ISO-8601,
Monday start) and `reporting_period` when the work date is set. Reports **read
those fields** rather than recomputing a week from `work_date`. A second
definition of "week" in SQL is how two reports come to disagree about the same
Monday.

Working week is **Mon-Fri** (ruling 2026-09-16), so average-per-day figures
divide by working days, not calendar days.

## Filters

Reports that take filters open with a `params` CTE of `NULL` literals and use
`(p_x IS NULL OR col = p_x)`. Unedited, the report runs unfiltered; to filter,
edit the one CTE. No report hides a filter in its body.

## 5. Who did it comes from the platform, never from a field

Fulcrum stamps `_created_by_id` and `_updated_by_id` on **every** record. Both
join to `memberships.user_id`, which carries `name`, `first_name`, `last_name`,
`email` and `role_name`.

```sql
LEFT JOIN memberships m ON m.user_id = p._created_by_id
```

So a report never needs a "created by" or "email" field on the form, and the
app must not carry one:

- It cannot be populated reliably. `USEREMAIL()` is documented for the
  expression runtime, is absent from the Data Events runtime, and did not
  resolve in a CalculatedField here either. The app briefly carried an
  `inspector_email` field for exactly this and it was always blank.
- **A copy goes stale.** An address or a surname changes in one place, and every
  record ever written keeps the old value. The join is always current.
- It is duplication. The value is already stored, by the platform, for free.

`memberships.email` is marked *"only to be included in results when explicitly
requested"* — ask for it deliberately, as `qa-review-queue.sql` does, rather
than adding it to every SELECT.

**The one exception on the record itself is `inspector`.** It is the only
identity a field user can read without running SQL, so it stays as a display
convenience set at record creation. `_created_by_id` remains the authority, and
reports read that.

The same rule covers the workflow stamps. `submitted_by`, `reviewed_by` and
`approved_by` are NOT duplication: they record who performed a specific
transition, which the platform does not track. `_updated_by_id` only knows who
touched the record last.


---

## 6. Two query-mcp transport limits (2026-09-22)

These are defects in the MCP client, not in the SQL. Every report here is
correct standard SQL and runs as written in Fulcrum's own Query UI and over
the REST API. Rather than disfigure the canonical SQL to route around a
client, `scripts/flatten_report.py --mcp` translates on the way out.

**The `+` operator is eaten.** The transport form-encodes the statement
without escaping, so every `+` arrives at the engine as a space. Proven:

    SELECT 'a+b' AS s, LENGTH('a+b') AS n   ->   {"s":"a b","n":3}
    SELECT 1 + 1                            ->   syntax error at or near "1"

`--mcp` rewrites `a + b` to `a - -b` outside string literals, which is
arithmetically identical. The space between the minus signs matters: `--`
would start a comment.

**There is a request-size ceiling.** A 6.3 KB statement runs; an 11.9 KB one
returns HTTP 431 (Request Header Fields Too Large). That leaves
`exception-dashboard.sql` unrunnable in one piece through MCP.
`scripts/slice_report.py` splits it into the shared prelude plus subsets of
its UNION ALL branches, so every branch is still executed. It always leads
with branch 0: only the first branch of a UNION carries the column aliases
the final SELECT addresses by name.

## 7. Array-typed columns (2026-09-22)

Fulcrum's PhotoField, AttachmentField and ClassificationField all surface in
Query as `text[]`, not `text`. Comparing one to a string fails the WHOLE
statement, not the row:

    WHERE qa_photos_captions = ''   ->   malformed array literal: ""
    STRING_AGG(actual_material, ', ')
                                    ->   function string_agg(text[], unknown)
                                         does not exist

Use `CARDINALITY(col) = 0` to test for empty and `ARRAY_TO_STRING(col, ', ')`
to flatten one for output. This took down `closeout-readiness.sql` and
`exception-dashboard.sql` entirely, so the missing-photo finding -- the one
that catches production approved into billing with no evidence -- could never
fire.

## 8. Master-data join keys (2026-09-22)

The Labor-Material Mapping master is keyed on **labor_code**, and its
`material_code` is the **stock part number** it resolves to. The material
master and the material ledger are keyed on part numbers as well. The
production record's `conduit_material_code` is the canonical
`CONDUIT-<size>-<n>PULL` derivation: readable, and a key in no master. Join
the mapping master on `labor_code`, never on the canonical code.

Live: `BM60(2)(1.25)DP` -> mapping `MAP-000104` -> part `114-11-2`.

## 9. Reserved words as identifiers

`overlaps` cannot be a CTE name: `OVERLAPS` is the reserved SQL period
operator and the statement fails to parse. `rows` is accepted by this engine
despite also being reserved. Prefer a descriptive name (`sequential_spans`)
over anything in the reserved list.

## 10. `_status` is the only status column

A project's, rate's or scope line's lifecycle state is the record status
column `_status`. No master carries a separate `status` field;
`project-summary.sql` selected `m.status` and failed on exactly this.
