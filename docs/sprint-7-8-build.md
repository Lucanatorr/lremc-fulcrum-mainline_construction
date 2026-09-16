# Sprints 7 & 8 — Splicing and Materials

Deployed to `Mainline Construction - Development`
(`06c36c8e-4a88-4cf3-a691-9a792f8374d2`), Data Events **v4.0.0**.

The app is now **132 elements across eleven sections**. SPLICING is conditional
on Work Category, so a boring crew never sees a closure field.

Two new apps back Sprint 8:

| App | ID |
|---|---|
| MC Material Master - Development | `658143d1-edbd-430b-81bb-1b0bb1092729` |
| MC Material Transaction - Development | `ee204906-adb3-431b-a1d9-d7427a4c842c` |

---

## The ruling that drove this sprint

> "BM60(1)(1.25) P should be 1 pull plow, bm60(2)(1.25) p would be 2 pull, etc.
> as for the size, 1.25, 2, and 4 is all that should be included."

**`(n)` in `BM60(n)(size)` is the pull count.** That settles open item 6 and it
means v3.0.0 was wrong.

v3.0.0 called `quantity × count` **"Calculated Conduit Footage"**. Under the
ruling a 3-pull package is **one bundled conduit assembly** containing three
ducts — it is consumed at **1 FT per production FT**. Treating it as a material
quantity would have ordered **three times** the conduit for every 3-pull pull.

The fix, deployed in v4.0.0:

| Field | v3.0.0 | v4.0.0 |
|---|---|---|
| `m086` | Conduit Count | **Pull Count** (derived) |
| `m088` | *Calculated Conduit Footage* — `qty × count` | **Total Duct Footage (informational)** — same arithmetic, honest label |
| `m116` | — | **Conduit Material Code (derived)** — `CONDUIT-<size>-<n>PULL` |
| `m117` | — | **Conduit Material Quantity** — `qty`, 1:1 |

`m088` is kept because total duct feet in the ground is a real engineering
number (capacity planning, as-builts). It is simply **not** the purchasing
number, and the label now says so. The purchasing number is `m117`.

**Size scope narrowed to 1.25", 2" and 4".** Micro duct, 0.75" and `BM60-DROP`
now derive *nothing* and raise an INFO flag rather than producing a material
code for a SKU that is out of scope. 7 pay-unit codes fall out this way.

```javascript
var CONDUIT_SIZES_IN_SCOPE = ['1.25', '2', '4'];
// ...
size = String(parseFloat(size));                 // "2.0" -> "2"
if (CONDUIT_SIZES_IN_SCOPE.indexOf(size) === -1) return null;
return { pulls: pulls, size: size,
         materialCode: 'CONDUIT-' + size + '-' + pulls + 'PULL' };
```

The script derives a **canonical** code, never a part number. Which stock item
`CONDUIT-1.25-3PULL` resolves to is master data and lives in the Labor-Material
Mapping app. Hard-coding `114-11-3-OGB-T` into a device script would be exactly
the anti-pattern this build exists to remove.

---

## Sprint 7 — Splicing

### What the field captures

`m118 SPLICING`, visible only when Work Category = Splicing:

Structure Type · Structure ID · Closure ID · Closure Type · Incoming Cable ID ·
Outgoing Cable ID · **Fiber Count at Location** · Priced Splice Band (derived) ·
Splice Quantity · Express / Cut / Pass-Through Fibers · Splitters Installed ·
Ports Used · Test Type · Measured Loss (dB) · Test Result.

### The band derives itself, and the mismatch is CRITICAL

The rate sheet prices splicing in fiber-count bands, and the band is stated in
the pay-unit code. So the code is parsed, not asked about:

```javascript
function parseSpliceBand(code) {
  if (isBlank(code)) return null;
  var c = String(code).trim();
  if (c.indexOf('HO-1') !== 0) return null;
  var m = /\((\d+)\s*-\s*(\d+)\)/.exec(c);
  if (m) return { lo: parseInt(m[1], 10), hi: parseInt(m[2], 10) };
  m = /\((\d+)\s*or above\)/i.exec(c);
  if (m) return { lo: parseInt(m[1], 10), hi: null };   // open-ended top band
  return null;
}
```

`HO-1 (25-48)` → band `25-48`. `HO-1 (145 or above)` → band `145+`, with
`hi === null` so the upper bound is never tested.

**A band that does not contain the fiber count is flagged CRITICAL**, and that
severity is deliberate:

| Band | Rate |
|---|---:|
| `HO-1 (1-24)` | **$32.00** / splice |
| `HO-1 (145 or above)` | **$15.00** / splice |

Picking the wrong band more than doubles the money on the same physical work.
That is not a data-quality nit, it is a pricing error, so it sits at the same
severity as a missing rate. It still does not block the save — a blocked save
loses field work — it flags loudly for review.

### The other splice checks

| Check | Severity | Why |
|---|---|---|
| Fiber count outside the priced band | **CRITICAL** | mispricing, above |
| Splice Quantity ≠ production Quantity, when Unit = SPLICE | WARNING | the billed number is Quantity; a mismatch means one of them is a typo |
| Measured loss > 0.10 dB | WARNING | industry fusion-splice guideline |
| Test Result = Fail | WARNING | rework pending |
| No structure ID / no closure ID | INFO | traceability gap, not an error |

---

## Sprint 8 — Materials

### MC Material Master

One record per stock item. `Material Code` is the permanent key — **deactivate,
never delete**, or historical material transactions stop resolving
(Sprint 23.47.10). Status is `ACTIVE` / `INACTIVE` / `DISCONTINUED`.

Conduit Diameter and Pull Count are **conditional on Category = Conduit**, so a
splice closure record has no meaningless conduit fields.

Standard Cost is present but deliberately separate from contractor labor rates.
Material cost and labor cost are different money and are never summed into one
number by this app.

The pre-existing `Picklist Material Items` classification set stays the field
picker. This app is the *structured* master behind it, carrying unit, part
number and cost, which a classification set cannot hold.

### MC Material Transaction — an atomic ledger

Same discipline as production: **no totals are stored**. Issued, installed,
returned, damaged, lost, transferred and adjusted balances are all derived by
summing transactions.

Seven transaction types. Only **Installed** counts as consumption for variance
against calculated usage — otherwise issuing 5,000 FT to a truck would read as
5,000 FT in the ground.

Everything is copied down at selection time via `record_defaults`:

| Link | Snapshotted onto the transaction |
|---|---|
| Project | Project ID |
| Contractor | Contractor ID |
| **Production Record** | Production ID, **Associated Labor Code** |
| Material | Material Code, Description, Unit |

The Production link is what makes material auditable:
**Project → Production → Labor Code → Material.** An auditor can see *why* the
system believes a quantity was consumed, not merely that it was.

### Two save-blocking rules

These are the only `INVALID()` calls in the whole build, and both are there
because the record would be meaningless or dangerous otherwise:

```javascript
if (qty === 0) {
  INVALID('Quantity is zero - a zero-quantity movement is not a transaction.');
}
if (qty < 0 && type !== 'Adjusted') {
  INVALID('Negative quantity is only valid on an Adjusted transaction. ' +
          'To reverse a movement, record an Adjusted transaction instead.');
}
```

Sprint 23.59: a negative quantity is a reversal. Permitting one on an ordinary
`Installed` row would let someone quietly erase consumption with no audit trail.
Forcing it onto an `Adjusted` row keeps the correction visible as a correction.

---

## Labor → material mapping under the ruling

`data/import/labor-material-mapping-proposed.csv` — regenerated, **36 mappings**:

| Status | Count | Meaning |
|---|---:|---|
| APPROVED | **14** | 1.25" conduit, real SKUs, loadable today |
| NEEDS REVIEW | **22** | multiplier settled at 1:1; **part number still missing** |

Approved SKUs: `114-11-O-8000` (1-pull), `114-11-2` (2-pull),
`114-11-3-OGB-T` (3-pull).

The 22 blocked rows carry a placeholder code `TBD-CONDUIT-<size>-<n>PULL` so the
shape of the mapping is reviewable now and only the identifier is outstanding.

**Every multiplier is now `1`.** The ruling removed the arithmetic ambiguity
entirely; what remains is purely a data-entry task for whoever owns the material
catalogue.

7 further codes are out of scope per the ruling (micro duct, 0.75",
`BM60-DROP`) and are listed in `data/labor-material-needs-review.csv`.

---

## Tests

`tests/splice-material.test.js` — **25 passing**:

- TEST-SPLICE-001..015 — band parsing (`(1-24)`, `(145 or above)`, hyphen
  spacing), open-ended top band, mismatch severity, no-fiber-count case
- TEST-MAT-001..010 — conduit code derivation under the pull-count ruling,
  1:1 material quantity, out-of-scope sizes deriving nothing, ledger quantity
  rules (zero blocked, negative blocked unless Adjusted)

**Whole suite: 112 passing across five files.**

```
tests/data-events.test.js            31
tests/rate-validation.test.js        19
tests/underground-aerial.test.js     28
tests/overlap-classification.test.js  9
tests/splice-material.test.js        25
```

---

## Still blocking

**2" and 4" conduit part numbers.** 22 of 36 mappings cannot be loaded until the
material catalogue supplies them. The multiplier question is closed; this is now
only missing identifiers. Until then those conduit codes derive a canonical
material code and quantity but resolve to no stock item.
