# Sprints 10–12 — what is NOT complete

Audited 2026-09-17 against the brief, line by line. This is the list of things
someone would be wrong to assume are working.

Grouped by how much it matters, not by sprint.

---

## 1. Nothing has ever been executed

**No report in this repository has returned a single row.** There are **zero
records** in every dev app. The reports were written, reviewed, and tested
against their own text — not against a database.

That distinction already cost something twice:

- Sprint 9 found `sequential-overlap.sql` addressing tables by **form name**
  instead of form ID, and reading `status` instead of `_status`. It would never
  have run.
- This audit found **58 `ROUND(x, 2)` calls across 12 reports** that would have
  failed on first execution. PostgreSQL has `round(double precision)` and
  `round(numeric, integer)` but **not** `round(double precision, integer)`, and
  every Fulcrum numeric column comes back as `double`. Every one is now wrapped
  in `CAST(... AS numeric)`, and `TEST-ROUND-*` guards it.
- Same audit: `duplicate-production.sql` cast a timestamp to `bigint`, which
  Postgres rejects. Now `EXTRACT(EPOCH FROM ...)`, guarded by `TEST-TS-*`.

Two syntax classes found in one review means **more are likely**. The following
constructs are used and remain **unverified against Fulcrum's actual engine**:

| Construct | Used in | Risk |
|---|---|---|
| `GROUPING SETS` / `GROUPING()` | daily, contractor-financial | Standard in Postgres 9.5+. Fails on a non-Postgres engine. |
| `RANGE BETWEEN INTERVAL '6' DAY PRECEDING` | trend | Needs Postgres 11+. Older versions reject a range offset. |
| `SUBSTRING(s, 7, 2)`, `LPAD` | weekly | Fine in Postgres; argument order differs elsewhere. |
| `EXTRACT(EPOCH FROM timestamp)` | duplicate | Postgres-specific. |
| `LEAST` / `GREATEST` | scope, financial, overlap | Postgres; some engines take arrays instead. |
| Window functions with `PARTITION BY` over CTEs | trend, monthly | Widely supported; untested here. |

The evidence says Postgres (the table definitions describe `_geometry` as EWKT
and mention PostGIS), but **that is an inference, not a confirmation**.

**What would close this:** load master data, enter a handful of production
records, and run all thirteen reports. Until then treat every report as
unproven.

## 2. No data is loaded anywhere

The masters exist as import-ready CSVs, not as Fulcrum records:

| File | Rows | Loaded? |
|---|---:|---|
| `data/import/contractor-rates-river-city.csv` | 146 | **No** |
| `data/import/material-master.csv` | 135 | **No** |
| `data/import/labor-material-mapping-proposed.csv` | 135 | **No** |
| `data/import/contractor-master.csv` | 3 | **No** |
| `data/import/project-master.csv` | 3 | **No** |

**The Fulcrum MCP server exposes no record-creation tool.** Records must be
imported through the Fulcrum UI or the Records API. Everything downstream —
every report, every rate validation, every scope figure — depends on this and
cannot be demonstrated without it. This is the single biggest blocker in the
project and it is not a coding task.

## 3. Sprint 12's app-side work is written but not deployed

Data Events **v6.0.0** — the approval gate, the correction fields `m137`–`m141`,
the blank-QA-status fix — **is not live**. Neither is the Sprint 8 size-dependent
conduit quantity from v5.0.0.

`forms_update` has returned `could_not_update_form: Please try again later` for
**every form on the account** since 2026-09-17, including a twelve-element one,
while `forms_create` works normally. Re-probed at 21:50Z. Recreating the
production form is not a workaround: `MC Material Transaction` links to its ID
and repointing that needs the same endpoint.

So today the deployed app **will let a reviewer approve a record carrying a
CRITICAL exception**, and will not prompt for correction detail. The reports
behave correctly either way — they read whatever is there — but the gate that
was meant to stop bad data at source is inert.

---

## 4. Requirements only partly met

### Sprint 10

| Asked | State |
|---|---|
| PROJECT-TO-DATE reporting | **Partial.** PTD exists as running-total columns in `production-monthly.sql` and `production-trend.sql`. There is no standalone project-to-date summary report. Sprint 15's remaining-work report covers much of the intent, but a dedicated PTD report was listed as a period alongside daily/weekly/monthly and is not one. |
| "Build reporting capabilities" | **Partial.** Delivered as SQL for the Query API. **Nothing is wired into Fulcrum's UI**, so a non-SQL user cannot run any of it. See gap 6. |
| Weekly current-vs-previous "where technically practical" | Done, with one limitation: the year-boundary join tries week 52 and 53 of the prior ISO year. That is correct, but if a project's first week of production is week 1, the comparison reads `NO PRIOR WEEK` rather than reaching into the previous calendar year's data — which is the right answer, but worth knowing. |

### Sprint 11

| Asked | State |
|---|---|
| Billed Value | **Not delivered.** No billing app exists. The column is present and `NULL`; `remaining_to_bill` cannot be computed. The brief says "if billing data is available" — it is not. A billing/invoice app is unscoped work. |
| "Production where rate data was manually overridden" | **Cannot be detected reliably.** The app makes the rate read-only, so an override can only arrive via import or API. The report flags `DRIFTED FROM SOURCE` where the snapshot no longer matches the rate record — but the far likelier cause is a *legitimate* reprice after the production was saved, in which case the snapshot is correct. The two are indistinguishable from the data available. Closing this properly needs either an audit-log join (`fulcrum_audit_logs_list` exists but is not wired in) or supersession-versioning on the rate master so repricing never mutates a rate row. |
| Physical Percent Complete | Delivered, but the **definition is mine, not yours**: earned value at budget rates over authorized value at budget rates, value-weighted, capped per line. It is the defensible reading, and the report publishes its spread against financial % so the choice is visible — but it is an assumption pending your confirmation. |

### Sprint 12

| Asked | State |
|---|---|
| "Billing-ready production" in the approval rules | **Not delivered.** There is no billing concept to be ready for. |
| "Unusually high quantity" flag | **Crude.** Two global thresholds only: sequential footage over 50,000 FT, and aerial span over 500 FT. There is **no per-pay-unit plausibility ceiling** — nothing notices 9,000 FT of hand digging or 400 splices in a day. Doing this properly needs either stated limits per pay unit or a statistical baseline from historical production, and there is no historical production. |
| Attachments | **Partial.** `m141 Attachments` is a `PhotoField`. It holds photographs and scans of documents, but Fulcrum offers no generic file attachment, so a PDF permit or an emailed locate ticket cannot be attached as a file. Reference files are per-app, not per-record. |
| Material variance | **Conduit only.** It is the one family whose expected quantity the app derives onto the record. Everything else waits on the Labor-Material Mapping master being loaded, which waits on the 2" part numbers. |
| QA reviewer assignment | **Not delivered.** The brief lists "Reviewer" and the app records who reviewed a record, but there is no way to *assign* a record to a reviewer or to see one reviewer's queue except by filtering `qa-review-queue.sql` on `reviewed_by` — which only works after they have already touched it. |

---

## 5. Thresholds that are guesses, not rulings

Each of these is a number I chose. They are the most likely things to be wrong
in a way that only real data will reveal.

| Threshold | Value | Where | Why this number |
|---|---|---|---|
| Duplicate "entered together" window | 5 minutes | `duplicate-production.sql` | Long enough to catch a double save, short enough to exclude a crew entering two genuine records in sequence. Untested. |
| Material variance tolerance | ±10% | `material-variance.sql` | Matches the conduit waste factor in the source data. Coincidence, not derivation. |
| Material variance critical band | ±25% | `material-variance.sql` | Round number. No basis in observed data. |
| Splice loss guideline | 0.10 dB | Data Events | Industry-typical for a fusion splice. Not from your specification. |
| Sequential footage plausibility | 50,000 FT | Data Events | A reel-length sanity bound, not a contractual one. |
| Aerial span plausibility | 500 FT | Data Events | Long for a distribution span. Varies by conductor and terrain. |
| Depth minimum | 36 in | Data Events | From the rate sheet's own "36 to 42 inches" wording. The firmest of these. |

## 6. Fulcrum-native reporting is untouched

Everything delivered runs through the Query API. Not used at all:

- **`fulcrum_report_templates_*`** — Report Builder templates. These produce
  per-record PDFs, so they suit a printable change order or an inspection
  record, not a cross-project dashboard. A change-order approval PDF is an
  obvious candidate and was not built.
- **`fulcrum_webhooks_*`** — nothing fires on record events. A QA exception
  reaches nobody until a person runs a report.
- **`fulcrum_reference_files_*`** — could carry lookup data onto devices for
  genuinely offline cross-record checks. Not explored.
- **`fulcrum_extensions_*`** — custom HTML views in the app, which could show a
  crew their remaining scope on-device. Not explored.
- **Fulcrum's own dashboards and saved views** — not configured.

## 7. Smaller items

- **`data/source/material-observations.py` is hand-transcribed** from pasted
  tables. It has been cross-checked by the ratio agreement between two projects,
  but a transcription error in a single-source row would not be caught.
- **`unplanned-production.sql` excludes `REJECTED`** production but the
  `qa-review-queue.sql` over-plan check includes pending records by design. Those
  are deliberate but inconsistent-looking; worth a second read once data exists.
- **No report is parameterised for a fiscal calendar.** Months are calendar
  months. If LREMC reports on a fiscal year, the monthly grouping is wrong.
- **Weekend production is reported but never excluded.** Correct as far as I
  know, but it means a "weekly production" figure can include Saturday work
  while "average daily" divides by weekdays only. Both are defensible; together
  they need a note in any packet that shows them side by side.

---

## The security item is still open

From Sprint 0, and unchanged: the **production** `Mainline Construction` app
(`148545bf-b869-454e-a2b9-44a9860f23de`) carries a live Fulcrum API token and a
live Smartsheet API token as plain strings in its Data Event script, which syncs
to every field device. **Both still need rotating.** This is not a Sprint 10–12
gap, but it is the highest-severity open item in the project and does not belong
buried in a sprint log.
