# Offline Capability Matrix

Required by the master prompt's Core Design Principles ("Offline-Aware
Design"), by the Sprint 23 deliverables, and as item 24 of the Final Handoff.
Offline behaviour was previously described correctly but scattered across
fourteen documents, which is exactly how an online-only control gets described
as an offline guarantee.

Categories are the prompt's own: **Fully offline** · **Offline using cached
data** · **Online only** · **After synchronization only**.

## The rule that explains the whole table

A Fulcrum Data Event can reach another record only through `REQUEST`, which is
online-only. **This system uses `REQUEST` nowhere.** Everything a device needs
in order to validate is physically copied onto the record at selection time by
RecordLink `record_defaults` — the rate, its unit, its effective and expiry
dates, the reel's printed range, the structure IDs. That choice was made for
offline capability and it is also what makes the system scale.

The consequence is a clean split: **everything on one record is fully offline;
everything that needs two records is a server-side report.**

| Control | Category | Why |
|---|---|---|
| Production ID assignment | Fully offline | Uses the platform record ID; a device-local fallback covers first save |
| Reporting period (year/month/ISO week/day) | Fully offline | Derived from `work_date` alone. Timezone-independent since v7.5.0 |
| Sequential footage, slack, total installed footage | Fully offline | CalculatedFields over local fields |
| Quantity derived from sequentials | Fully offline | Local fields only |
| Pull count, conduit diameter, conduit material code/quantity | Fully offline | Parsed from the labor code value on the record |
| Splice band derivation | Fully offline | Parsed from the labor code value |
| Segment ID and span ID (direction-normalized) | Fully offline | Local fields only |
| Rate applied, extended value | **Offline using cached data** | The rate was copied onto the record when the crew selected it. Correct offline; reflects the rate as of selection, which is the intent (D-003) |
| Unit | **Offline using cached data** | Copied from the rate (D-015). Pending deploy — see OI-02 |
| Rate expiry / not-yet-in-force check | **Offline using cached data** | Compares `work_date` against the snapshotted effective and expiry dates |
| Rate/labor-code mismatch check | **Offline using cached data** | Compares the snapshotted rate labor code against the selected one |
| Reel printed-range check | **Offline using cached data** | Reel begin/end copied onto the record at selection |
| Production fingerprints and strength | Fully offline | Computing a signature needs only this record. **Comparing** it does not — see below |
| Exception flags and severity | Fully offline | Every check reads local fields |
| Approval gate (CRITICAL blocks approval) | Fully offline | Reads local exception severity and QA status |
| Baseline immutability lock (scope line) | Fully offline | Reads record status |
| Closeout milestone gates | Fully offline | Reads local milestone rows |
| Negative-quantity rule (material transactions) | Fully offline | Local fields |
| **Duplicate detection** | **After synchronization only** | Needs other records. The device computes the fingerprint offline; the match happens in `duplicate-production.sql` after sync |
| **Sequential overlap across records** | **After synchronization only** | Needs other records on the same reel — `sequential-overlap.sql` |
| **Reel over-consumption** | **After synchronization only** | Sums all production against a reel — `reel-balance.sql` |
| **Production over authorized scope** | **After synchronization only** | Needs scope lines, approved change orders and all prior production |
| **Material variance vs the ledger** | **After synchronization only** | Needs material transactions — `material-variance.sql` |
| **Missing material mapping** | **After synchronization only** | Needs the mapping master, which a device cannot read |
| **Unplanned production (no scope line)** | **After synchronization only** | Needs the scope master |
| **Every report in `reports/`** | **Online only** | Server-side SQL against collected records |
| Choice lists (labor codes, units, categories) | Fully offline | Synced to the device with the app |
| Record link pickers (project, contractor, rate, reel, structure) | **Offline using cached data** | Fulcrum caches linked records for offline selection; a master record created since the last sync is not selectable |

## What this means for a crew with no signal

A crew can complete an entire day's work offline: select project, contractor,
labor code and rate; record sequentials or quantity; capture photos and GPS;
see derived footage, material quantity, pricing and extended value; and get
every single-record exception, including the approval-blocking CRITICAL ones.

What they cannot see until they sync is anything that depends on somebody
else's record: that their range overlaps another crew's, that the reel is now
over-consumed, that this is a duplicate, or that the pay unit has gone over
authorized scope.

**This is not represented to the field user as a guarantee.** The exception
flags on the record say what was checked. The cross-record findings arrive in
the review queue, which is where a reviewer — who is online — sees them before
approval.
