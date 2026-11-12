# Sprint 30 — Integration and Automation Readiness

**Date:** 2026-11-12. **Prepared, not built.** No integration was connected and
no field was added to any app.

> *"Prepare for possible Smartsheet, Power BI, ERP/accounting, invoice
> reconciliation, GIS/ArcGIS, document storage, contractor portal, and API
> integrations without building unapproved integrations."*

---

## 1. What is already connected (found 2026-11-12)

Read-only inventory with `webhooks_list`, plus the Sprint 0 read of the
production app.

| # | What | State | Concern |
|---|---|---|---|
| W-1 | Fulcrum webhook **"Power Platform Trigger"** (`4caed281…`), to a Power Automate flow | **Active**, created 2026-07-17 | Fulcrum webhooks are **account-wide**: every record event in **every** app is posted to it, including the MC Development apps. Contractor rates, production values and approvals are already leaving Fulcrum to a flow this project did not build |
| W-2 | Second **"Power Platform Trigger"** (`c868c89c…`) | **Active**, created 2026-07-13 | Same. Two flows, possibly a duplicate left from setup |
| L-1 | Smartsheet code in the **production** app's Data Event | Commented out; the Smartsheet API URL and a sheet ID remain | The pattern that put two tokens on every device (OI-01). Never revive it as written |

**The webhook URLs contain signing secrets.** They are deliberately not copied
into this repository: whoever holds the URL can trigger the flow. Logged as
**OI-23**. Owner to confirm: what each flow does with the data, and whether
both are still needed. Neither was changed.

## 2. Stable IDs

Every record an external system will see has a business ID that is **present,
unique and never changes**:

| App | ID | Format | Why it cannot change |
|---|---|---|---|
| Production | `production_id` | `PRD-<year>-<8 chars of Fulcrum record id>` | Set once on first save, never regenerated (Sprint 13). Offline-safe: no counter to collide |
| Project | `project_id` | `PRJ-000001` | Master key |
| Contractor | `contractor_id` | `CON-0001` | Master key |
| Rate | `rate_id` | `RATE-000084` | Rates are versioned; a price change is a new `rate_id` |
| Material | `material_code` | part number | Never edited in place (governance §3) |
| Mapping | `mapping_id` | `MAP-000131` | Superseded, not edited |
| Material transaction | `transaction_id` | derived | Ledger rows are atomic |
| Scope line | `scope_line_id` | derived | Locks at BASELINED |
| Change order | `change_order_number` | — | Lines are signed deltas, so an order is never rewritten |
| Structure | `structure_id` | normalized | Locks once the structure exists |
| Segment | `segment_id` + `segment_type` | `HH-1_HH-2` | Direction-normalized; one path, one ID |
| Fiber reel | `reel_id` | — | Master key |

Every record also has Fulcrum's own `_record_id`, the technical key for the
Fulcrum API.

**Verified live** with `reports/integration-id-integrity.sql`: every app with
records, PASS. That is 0 blank and 0 duplicated IDs across 2 production
records, 146 rates, 135 materials, 125 mappings, 3 projects and 3 contractors.
Run it before switching on any integration, and monthly after that.

> The brief's example is `PRD-000123`. The live format is
> `PRD-2026-FB71F938`, which is deliberately not sequential, because
> sequential numbers collide when two devices save offline. It serves the same
> purpose: a permanent, unique key.

## 3. Idempotency: re-exporting a record never duplicates money

**The trap.** A record keeps only its *latest* approval stamp. Approve →
reopen → re-approve looks like one approval. Any feed of "approval events"
would post both approvals and double the money. A webhook has the same
problem: it fires on **every save**, not once per approval.

**The contract: export state, post deltas.**

1. `reports/integration-export-production.sql` exports every production
   record (VOID included) as its **current financial state**:
   - `idempotency_key` = `production_id`
   - `official_quantity` and `official_value` (non-zero only when APPROVED)
   - `export_hash` = MD5 of the fields that move money: status, project,
     contractor, labor code, period, official quantity, rate, official value
2. The consumer keeps, per `production_id`, the last state it posted.
   `scripts/export_delta.py` is the reference implementation.
3. A posting happens **only** when the hash changed **and** money moved.
   - Amount = current official value − last posted value.
   - `posting_key` = `production_id|export_hash`, deterministic, so a receiver
     that stores keys can discard a repeat.
4. Re-exporting the same state posts **nothing**. Downstream money always
   equals Fulcrum's current approved value.

**Tested** (`tests/export-delta.test.js`, 11 cases, starting from the live
export of 2026-11-12):

| Event | Posts |
|---|---|
| Approve at 500 FT | +5,000 |
| Re-export, twice | nothing |
| Reopen | −5,000 |
| Re-approve at 450 FT | +4,500 (not +9,500 in total) |
| Reverse | −4,500 |
| Adjustment of −50 FT (its own Production ID) | −600, on its own key |
| Status change that moves no money | nothing |
| A record missing from a partial export | reported, **never** reversed automatically |

## 4. Invoice reconciliation (ready to use)

**Inputs:**
- `reports/invoice-reconciliation-basis.sql`: every non-VOID production
  record, with its project, contractor, labor code, period, Production ID,
  status and the **rate Fulcrum priced it at**.
- The contractor's invoice in `data/import/invoice-template.csv` format.
  `production_id` is optional per line.

```
python3 scripts/reconcile_invoice.py invoice.csv basis.json \
        [--previous earlier-invoice.csv ...] [--out findings.csv]
```

Lines with a Production ID match that record. Lines without one match the
approved production for the same project + contractor + labor code + period,
**excluding records already billed by ID**, so nothing is paid twice.

| Finding | Severity |
|---|---|
| UNKNOWN CODE | CRITICAL |
| DUPLICATE ITEM: the same ID twice, an ID from an earlier invoice, or an identical lump line | CRITICAL |
| PRODUCTION ID NOT FOUND | CRITICAL |
| KEY MISMATCH: another contractor's, project's, code's or period's record | CRITICAL |
| UNAPPROVED PRODUCTION BILLED | CRITICAL |
| QUANTITY ABOVE APPROVED | CRITICAL |
| WRONG RATE: not the rate Fulcrum priced at | CRITICAL |
| QUANTITY BELOW APPROVED | WARNING |
| AMOUNT ARITHMETIC: amount ≠ quantity × rate on the line | WARNING |

The script exits 1 on any CRITICAL, so a payment run can be gated on it.
`tests/invoice-reconciliation.test.js` covers each case.

**Live demonstration, 2026-11-12:** a one-line invoice billing the test record
PRD-2026-143C1840 (SUBMITTED, $6,000) returns *UNAPPROVED PRODUCTION BILLED*,
6,000.00 at risk, exit 1.

## 5. Readiness per target

| Target | Direction | Source | Key | Trigger | Prerequisites | Status |
|---|---|---|---|---|---|---|
| **Power BI** | out | `reports/bi/` (Sprint 29) | business keys | scheduled pull | fiscal-year start; gateway token | **Ready** |
| **Invoice reconciliation** | in (invoice) / out (basis) | §4 | Production ID, or project + contractor + code + period | per invoice | contractors agree to put Production IDs on invoices (strongly recommended) | **Ready** |
| **ERP / accounting** | out | §3 export | `production_id` | daily, or at billing close | GL account mapping per labor code / work type; who owns the posting state | Contract defined; nothing built |
| **Smartsheet** | out | §3 export, or a BI dataset | `production_id` | scheduled | which sheet and why. A server-side connector only, **never** from a Data Event (L-1, OI-01) | Not started; needs a stated purpose |
| **GIS / ArcGIS** | out | structures, segments, production locations (`_latitude`, `_longitude`, in `dim_structure` and the record geometry) | `structure_id`, `segment_id`, `production_id` | scheduled | confirm which Fulcrum publishing option the account has (data share or Esri connector) before building anything | Keys ready |
| **Document storage** | out | photos and attachments stay in Fulcrum, referenced by `_record_id` + photo id | `production_id` | at closeout | retention rule (governance §6) | Keys ready |
| **Contractor portal** | out (read-only) | `fact_production` filtered to one contractor | `contractor_id` | on demand | row-level security; contractors must **never** gain status-change rights through it (P-1) | Design only |
| **Webhooks / API** | out | Fulcrum webhooks | `_record_id` + `_version` | per event | a consumer must dedupe on record + version, because a webhook fires on every save | Two live, unreviewed (OI-23) |

## 6. Integration tracking fields: designed, deliberately not added

The brief: *"Add export status, last export date, external ID, error, and
retry fields only when an actual integration needs them."* None is approved,
so none was added. When the first one is:

| Field | On | Written by | Why it lives in Fulcrum |
|---|---|---|---|
| `export_status` (PENDING / EXPORTED / ERROR) | Mainline Construction | the integration, through the API | So a reviewer sees on the record that it reached the ledger |
| `last_export_date` | same | integration | |
| `last_export_hash` | same | integration | The idempotency state of §3, kept with the record |
| `external_id` (e.g. GL journal or invoice line id) | same | integration | The traceability link back from the ERP |
| `export_error`, `export_retry_count` | same | integration | Failures visible in Fulcrum, not only in a log |

They are written by the integration, never by a Data Event: a device must not
believe a record was exported. They go in a hidden "Integration" section, so
field users never see them. Each integration gets its own set, prefixed with its
name, so that two integrations cannot overwrite each other's state.

## 7. Rules for every integration

1. **Credentials are server-side only.** Never in a Data Event, which syncs
   to every device (OI-01), never in a report, never in this repository.
2. **A dedicated integration user**, on a role with exactly the switches it
   needs: read-only for exports, and no delete, ever. A Fulcrum API token
   carries its user's role.
3. **Read from the datasets in this repository**, not from raw tables. The
   status and pricing rules are applied once, in Fulcrum.
4. **No integration writes production quantities, rates or values back** into
   Fulcrum. Fulcrum is the source of truth.
5. **Idempotent by key** (§3), and safe to re-run.

## 8. Decisions needed

| # | Decision | Owner |
|---|---|---|
| 1 | What do the two Power Automate flows do, and are both still needed? (OI-23) | Fulcrum Administrator |
| 2 | Will contractors put Production IDs on invoices? | Contract / Finance |
| 3 | Which integration is first, and who owns its posting state? | Business Owner |
| 4 | GL mapping per labor code, for the ERP | Finance |
