/**
 * Mainline Construction - Development
 * Data Events - v7.5.0 (2026-09-22). NOT YET DEPLOYED - forms_update is
 * refusing all writes, see docs/sprint-23-known-limitations.md L16.
 *
 * CHANGE IN v7.5.0 - A WORK DATE IS A CALENDAR DATE, NOT AN INSTANT
 * parseDate() read a UTC-midnight date-only field with the LOCAL getters, so
 * every derived reporting field was a day early anywhere west of UTC. In
 * America/New_York the live record's Monday derived as Sunday - and every
 * report filtering weekends out drops Sunday, so a full day of production left
 * productivity and forecasting silently. 1 January booked into the previous
 * year. The duplicate fingerprint moved with it. Normalized once in
 * parseDate(); see tests/date-boundary.test.js, which runs under four
 * timezones because a UTC-only suite is what let this through.
 *
 * CHANGE IN v7.4.0 - THE UNIT COMES FROM THE RATE, NOT FROM A LABEL
 * applyLaborMetadata() parsed the unit out of the labor code's choice LABEL.
 * The Data Events runtime exposes no labels - a ChoiceField arrives as
 * { choice_values, other_values } - so the parse always missed and the
 * fallback branch NULLED the unit on every editor save, for every labor code
 * (found live on PRD-2026-143C1840, which priced correctly at $12/FT but came
 * back with unit = null). The unit is now copied physically from the selected
 * rate by rate_link record_defaults (r010 -> m024), like labor_description
 * already was. The function is now a guard: it fills the unit only when blank
 * and never clears it. See tests/unit-derivation.test.js.
 *
 * CHANGE IN v7.3.0 - SPRINT 19 SCALE REVIEW
 *   No behaviour change in this script. It was audited against the brief's
 *   target scale - hundreds of projects, thousands of rates and structures,
 *   hundreds of thousands of production records - and the findings were:
 *
 *   + NO OUTBOUND CALLS, still. REQUEST is the only way a Data Event can reach
 *     other records, it is online-only, and at scale it would also be a
 *     request per keystroke. Every cross-record check in this system is a
 *     server-side report for exactly that reason.
 *   + Every ON('change') handler is O(1) in this record: it reads a handful of
 *     local fields and writes at most three. None scans a list, and none
 *     touches a master.
 *   + Rate and reel lookups cost NOTHING at save time. RecordLink
 *     record_defaults copy the values physically at selection time, so
 *     validation reads local fields. That was chosen for offline capability
 *     and it is also what makes it scale.
 *   - REMOVED the calculated_material_usage repeatable (m048-m052). Nothing
 *     populated it and nothing could: filling it needs the Labor-Material
 *     Mapping master, which a device cannot read. Five elements that shipped
 *     to every device on every sync, for a section that was always empty. The
 *     expected quantity is derived onto the record for conduit and computed
 *     in reports/material-variance.sql for everything else.
 *
 * CHANGE IN v7.2.0 - SPRINT 18 FIELD USER EXPERIENCE
 *   The brief: "A typical field production entry should ideally require the
 *   user to select Project, Contractor/Crew, Work Type, Labor Code, From/To,
 *   production quantity OR sequentials, and provide required evidence. The
 *   system should derive everything else that can safely be derived."
 *
 *   + QUANTITY IS DERIVED FROM SEQUENTIALS for fiber placement measured in FT,
 *     when the crew left it blank. "Quantity or sequentials" means one entry,
 *     not both: a crew that recorded 1000->4200 has already said 3200 FT.
 *     Only when blank - a typed quantity is never overwritten, because the
 *     billed quantity is the crew's claim, not this script's arithmetic.
 *   + A cross-check WARNING when a typed quantity and the installed footage
 *     disagree by more than 5%, which is how a transposed sequential or a
 *     quantity typed into the wrong unit gets caught at entry instead of in
 *     a billing dispute.
 *
 *   ON DERIVING WORK CATEGORY FROM THE LABOR CODE: NOT DONE, deliberately.
 *   It is the obvious next saving and it contradicts the 2026-09-17 ruling
 *   that installed footage comes from work_category and is never inferred from
 *   a labor-code prefix. Deriving the category from the prefix here would make
 *   that ruling self-referential - the prefix would decide the category that
 *   the ruling says must not come from the prefix.
 *
 * CHANGE IN v7.1.0 - FIX: BARE USEREMAIL() CRASHED THE WEB RECORD EDITOR
 *   Reported from the field: "Uncaught ReferenceError: USEREMAIL is not
 *   defined", thrown from ON('new-record'), and dropdown selections that did
 *   not populate until F12 forced a re-render.
 *
 *   ONE CAUSE, BOTH SYMPTOMS. USEREMAIL is an EXPRESSION function; it is not
 *   in the Data Events runtime in the web editor. USERFULLNAME, one line
 *   above it, is. The ReferenceError escaped the handler, Runtime.trigger and
 *   the expressions proxy's onMessage, so the host never got the reply
 *   carrying that event's queued SETVALUEs - which is why unrelated derived
 *   fields stopped appearing too.
 *
 *   + Every platform accessor now goes through a typeof guard. Never bare.
 *   + inspector_email is GONE. USEREMAIL reached neither runtime here, and the
 *     value was already being stored twice: Fulcrum stamps _created_by_id on
 *     every record, which joins to memberships.user_id for the name, email and
 *     role. Reports read it from there - see reports/_conventions.md. Copying
 *     it onto the record would have duplicated platform metadata and gone
 *     stale the moment somebody's address changed.
 *
 * CHANGE IN v7.0.0 - SPRINT 13 DUPLICATE AND DATA-INTEGRITY CONTROLS
 *   + Two derived production FINGERPRINTS, computed on the device.
 *   + Fingerprint strength, so a mostly-blank record cannot look like a match.
 *   + Production ID hardened against cross-device collision on its fallback.
 *
 *   WHY A FINGERPRINT FIELD IS THE RIGHT FULCRUM MECHANISM
 *   Comparing records needs other records, which a device cannot reach
 *   offline. But COMPUTING a canonical signature needs only this record, so
 *   the device does that part every time. Duplicate detection then collapses
 *   from a heuristic self-join into GROUP BY fingerprint HAVING COUNT(*) > 1,
 *   and the value is visible on the record so a reviewer can see WHY two
 *   records matched. No hashing: Fulcrum exposes no crypto, and a readable
 *   delimited string is better here anyway.
 *
 * CHANGE IN v6.0.0 - SPRINT 12 QA/QC AND APPROVAL WORKFLOW
 *   + An approval GATE: a record carrying a CRITICAL exception, a failed QA
 *     review, or no recorded QA outcome cannot be set to APPROVED.
 *   + Correction tracking: detail, completion, and who completed it when.
 *   + Review stamps hardened - a record sent back does not keep an approval.
 *
 *   WHY THE GATE IS CRITICAL-ONLY
 *   The brief: "Do not automatically reject records solely because of a
 *   warning unless there is a clear business rule requiring rejection."
 *   Warnings are judgement calls - a 600 FT span may be real, a missing photo
 *   may be unavoidable - so a reviewer decides. A CRITICAL is different in
 *   kind: an unpriced or mispriced record cannot count toward earned value,
 *   billing or remaining scope without corrupting all three.
 *
 * CHANGE IN v5.0.0
 *   + Conduit material multiplier is now SIZE DEPENDENT (ruling below).
 *   + Directional bore codes BM60(n)(1.25)DP parse like the plow units.
 *   + Retired pay units raise a flag instead of silently deriving nothing.
 *
 * RULING 2026-09-16 - (n) IS THE PULL COUNT
 *   In BM60(n)(size), (n) is the PULL COUNT: BM60(1)(1.25) P is a 1-pull plow,
 *   BM60(2)(1.25) P is 2-pull.
 *
 * RULING 2026-09-17 - MATERIAL CONSUMPTION DEPENDS ON THE SIZE
 *   1.25"  bundled multi-duct SKUs exist (1-, 2- and 3-PULL). An n-pull run is
 *          ONE bundled assembly, consumed at 1 FT per production FT.
 *   2", 4" always a single-duct pipe - there is no bundled product - so an
 *          n-pull run consumes n FT of the single-pipe SKU per production FT.
 *   So the multiplier is 1 for 1.25" and the pull count for 2" and 4". v4.0.0
 *   applied 1:1 to every size, which under-ordered 2" and 4" multi-pull runs.
 *   Conduit sizes in scope: 1.25, 2 and 4 inch only.
 *
 * RULING 2026-09-17 - DIRECTIONAL BORE RESTRUCTURED
 *   BM60-(1.25)DP plus BM60-(1.25)DPD Dual are replaced by BM60(1)(1.25)DP ..
 *   BM60(5)(1.25)DP. The pull count is now a fact of the selected pay unit
 *   instead of being implied by how many transactions someone remembered
 *   to raise.
 *
 * RULING 2026-09-18 - THE DP RATE SCHEDULE IS BANDED, NOT ADDITIVE
 *   1 pull $10; 2 and 3 pulls $12; 4 and 5 pulls $14. Reading the contract's
 *   "second or more" wording as a per-pipe adder gives 10/12/14/16/18 and
 *   overbills a 5-pull bore by 29%. The schedule is master data and lives in
 *   the rate master - this script never prices anything.
 *
 * WASTE FACTOR IS NOT APPLIED HERE. Conduit carries a 10% purchasing waste
 * factor, but it lives in the Labor-Material Mapping master, not in this
 * script: the installed quantity must stay a clean measurement of what went in
 * the ground. Grossing up for waste is a purchasing step.
 *
 * NO HARD-CODED MASTER DATA. NO SECRETS. NO OUTBOUND CALLS.
 * WEEK DEFINITION: ISO-8601, Monday start, Mon-Fri working week.
 */

// ==================== platform accessor guards (v7.1.0) ====================
// The Data Events JavaScript runtime and the CalculatedField expression
// runtime do NOT expose the same globals, and the web record editor does not
// expose the same set as the mobile app.
//
// USEREMAIL is the case that bit us on 2026-09-21. It is documented as an
// expression function (context category); it is NOT in the Data Events
// function catalogue; and calling it bare in the Chrome record editor threw
// "Uncaught ReferenceError: USEREMAIL is not defined" out of ON('new-record').
// USERFULLNAME on the line directly above it worked. The two look
// interchangeable and are not.
//
// A ReferenceError here is NOT contained to the handler that raised it. It
// escapes Runtime.trigger and the expressions proxy's onMessage, so the host
// never receives the reply carrying that event's queued SETVALUE mutations -
// they are computed and then silently dropped. That is why a broken
// new-record handler ALSO stopped dropdown selections from populating until
// opening devtools forced a re-render. One missing global, two symptoms.
//
// typeof is the ONLY safe test for an undeclared identifier: reading one
// throws, typeof on one returns 'undefined'. Every platform accessor goes
// through a guard from here on. Never call one bare.

function platformString(fn) {
  try {
    var v = fn();
    return (v === null || v === undefined) ? '' : String(v);
  } catch (e) {
    return '';
  }
}

function userFullName() {
  if (typeof USERFULLNAME !== 'function') return '';
  return platformString(function () { return USERFULLNAME(); });
}

// Absent from the Data Events runtime in the web record editor, and it did
// not resolve in a CalculatedField either. Kept only as the last-resort
// uniqueness salt in assignProductionId's fallback, where '' is acceptable.
// Nothing user-visible depends on it: creator identity comes from
// _created_by_id, which the platform stamps on every record.
function userEmail() {
  if (typeof USEREMAIL !== 'function') return '';
  return platformString(function () { return USEREMAIL(); });
}

function recordId() {
  if (typeof RECORDID !== 'function') return '';
  return platformString(function () { return RECORDID(); });
}

function recordStatus() {
  if (typeof STATUS !== 'function') return '';
  return platformString(function () { return STATUS(); });
}

function isBlank(v) {
  return v === null || v === undefined || v === '' ||
         (typeof v === 'string' && v.trim() === '');
}

function toNum(v) {
  if (isBlank(v)) return null;
  var n = parseFloat(String(v).replace(/,/g, ''));
  if (isNaN(n) || !isFinite(n)) return null;
  return n;
}

function choiceValue(f) {
  if (!f) return '';
  if (typeof f === 'string') return f;
  if (f.choice_values && f.choice_values.length) return f.choice_values[0];
  if (f.other_values && f.other_values.length) return f.other_values[0];
  return '';
}

// NOTE: the Data Events runtime does NOT expose choice labels. A ChoiceField
// arrives as { choice_values, other_values } only, so this returns the VALUE in
// practice. The choice_labels branch is kept solely because the web editor has
// been observed to pass it on some builds; nothing may DEPEND on a label being
// available. Anything that needs the label's content must snapshot it from the
// master record instead (see applyLaborMetadata).
function choiceLabel(f) {
  if (!f) return '';
  if (typeof f === 'string') return f;
  if (f.choice_labels && f.choice_labels.length) return f.choice_labels[0];
  return choiceValue(f);
}

function setIfChanged(dataName, current, next) {
  var a = isBlank(current) ? '' : String(current);
  var b = isBlank(next) ? '' : String(next);
  if (a !== b) SETVALUE(dataName, isBlank(next) ? null : next);
}

// RULING 2026-09-22 - A WORK DATE IS A CALENDAR DATE, NOT AN INSTANT
//
// Fulcrum stores a date-only field as UTC midnight: the live record
// PRD-2026-143C1840 carries work_date = 2026-09-21T00:00:00.000Z. Reading that
// back with the LOCAL getters - getFullYear/getMonth/getDate/getDay - returns
// the PREVIOUS day anywhere west of UTC, which is everywhere LREMC operates.
// Measured in America/New_York before this fix:
//
//   2026-09-21T00:00:00Z  ->  Sunday 2026-09-20, week 2026-W38   (truly Monday, W39)
//   2026-01-01T00:00:00Z  ->  year 2025, month 2025-12           (truly 2026-01)
//
// The damage was not cosmetic. A Monday derived as Sunday is dropped by every
// report filtering `work_day_of_week NOT IN ('Saturday','Sunday')` -
// productivity and forecasting both do - so a whole day's production silently
// left the numbers. A 1 January record booked into the previous financial
// year. The duplicate fingerprint shifted by a day, so the same record saved
// in two timezones produced two different fingerprints and stopped matching.
//
// Normalizing here rather than at each call site fixes all of them at once:
// reporting period, the rate effective/expiry comparison, the weekend flag,
// the fingerprint and the production-ID year. Every caller passes a date-only
// value, so re-anchoring the UTC calendar date onto local midnight is safe and
// makes the local getters return the date the field actually holds.
function parseDate(v) {
  if (isBlank(v)) return null;
  var d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function dayOnly(d) { return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()); }

function normalizedPair(a, b) {
  a = isBlank(a) ? '' : String(a).trim().toUpperCase();
  b = isBlank(b) ? '' : String(b).trim().toUpperCase();
  if (!a || !b) return null;
  return (a <= b) ? (a + '_' + b) : (b + '_' + a);
}

var DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function isoWeek(d) {
  var t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  var dayNum = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - dayNum);
  var yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return { year: t.getUTCFullYear(), week: Math.ceil((((t - yearStart) / 86400000) + 1) / 7) };
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }

function deriveReportingPeriod() {
  var d = parseDate($work_date);
  if (!d) {
    setIfChanged('work_year',        $work_year,        null);
    setIfChanged('work_month',       $work_month,       null);
    setIfChanged('work_week',        $work_week,        null);
    setIfChanged('work_day_of_week', $work_day_of_week, null);
    setIfChanged('reporting_period', $reporting_period, null);
    return;
  }
  var iso   = isoWeek(d);
  var month = d.getFullYear() + '-' + pad2(d.getMonth() + 1);
  setIfChanged('work_year',        $work_year,        String(d.getFullYear()));
  setIfChanged('work_month',       $work_month,       month);
  setIfChanged('work_week',        $work_week,        iso.year + '-W' + pad2(iso.week));
  setIfChanged('work_day_of_week', $work_day_of_week, DAYS[d.getDay()]);
  setIfChanged('reporting_period', $reporting_period, month);
}

ON('change', 'work_date', deriveReportingPeriod);

// RULING 2026-09-22 - THE UNIT COMES FROM THE RATE, NOT FROM A LABEL
//
// This function used to parse the unit out of the labor code's choice LABEL,
// which reads "BM60(2)(1.25)DP (FT) Labor to install two (2) ...". That cannot
// work: the Data Events runtime hands a ChoiceField over as
// { choice_values: [...], other_values: [...] } and exposes no label at all.
// choiceLabel() therefore fell through to the VALUE, "BM60(2)(1.25)DP", which
// carries no "(FT)" marker, the regex missed, and the !m branch then actively
// NULLED the unit. Every record saved in the editor lost its unit, whatever
// its labor code - confirmed live on PRD-2026-143C1840.
//
// That is not a cosmetic loss. Every financial rollup keys the
// time-and-materials split on the unit ("HR and EVENT must NOT be aggregated
// into physical production totals"), so a null unit silently drops the record
// out of physical value.
//
// The unit is now copied physically from the selected rate by the rate_link
// record_defaults (r010 -> m024), exactly as labor_description already is
// (r009 -> m022). That is better than any label parse: it cannot disagree with
// the rate actually applied, it needs no runtime API that does not exist, and
// being a physical copy it stays correct even if the master is later repriced.
//
// What remains here is a guard, not a derivation: never overwrite or clear the
// snapshot. It only fills the unit when it is blank AND the label happens to
// carry a marker, which covers a record whose unit was cleared by hand.
function applyLaborMetadata() {
  if (!isBlank(choiceValue($unit))) return;      // the snapshot wins, always

  var label = choiceLabel($labor_code);
  if (isBlank(label)) return;

  var m = /^(.*?)\s*\((FT|EA|HR|SPLICE|SF|EVENT)\)\s*(.*)$/.exec(label);
  if (!m) return;                                // never null it out

  setIfChanged('unit', choiceValue($unit), m[2]);
  if (isBlank($labor_description)) {
    setIfChanged('labor_description', $labor_description, m[3]);
  }
}

// ============ conduit package - PULL COUNT ruling (Sprint 5/8) ============
// Sizes in scope: 1.25, 2, 4. Anything else derives nothing rather than
// guessing at a SKU that does not exist.

var CONDUIT_SIZES_IN_SCOPE = ['1.25', '2', '4'];

// Sizes that ship as a bundled multi-duct assembly. For these the material
// quantity is 1:1 regardless of pull count. Every other in-scope size is a
// single pipe, so n pulls means n times the footage.
var BUNDLED_CONDUIT_SIZES = ['1.25'];

// Pay units withdrawn by the 2026-09-17 directional bore restructure. A device
// with a stale choice list can still hold them, and they carry no pull count,
// so they are named rather than silently ignored.
var RETIRED_LABOR_CODES = ['BM60-(1.25)DP', 'BM60-(1.25)DPD Dual'];

function parseConduitPackage(code) {
  if (isBlank(code)) return null;
  var c = String(code).trim();
  if (c.indexOf('BM60') !== 0) return null;
  if (c.indexOf('BM60-R') === 0) return null;          // rock adder: no conduit

  var pulls, size;
  var m = /^BM60\((\d+)\)\((\d*\.?\d+)\)/.exec(c);
  if (m) {
    pulls = parseInt(m[1], 10);
    size  = m[2];
  } else {
    m = /^BM60-?\((\d*\.?\d+)\)/.exec(c);
    if (!m) return null;                                // micro duct, BM60-DROP
    pulls = 1;
    size  = m[1];
  }
  size = String(parseFloat(size));                      // 2.0 -> "2"
  if (CONDUIT_SIZES_IN_SCOPE.indexOf(size) === -1) return null;

  var bundled = BUNDLED_CONDUIT_SIZES.indexOf(size) !== -1;

  return {
    pulls: pulls,
    size: size,
    bundled: bundled,
    // FT of SKU per FT of production. One bundled assembly, or one pipe per
    // pull where no bundled product exists.
    materialMultiplier: bundled ? 1 : pulls,
    // Canonical code. The Labor-Material Mapping master resolves it to a stock
    // part number - deriving a part number here would hard-code master data.
    materialCode: bundled
      ? ('CONDUIT-' + size + '-' + pulls + 'PULL')
      : ('CONDUIT-' + size + '-1PULL')
  };
}

function deriveConduitPackage() {
  var pkg = parseConduitPackage(choiceValue($labor_code));
  setIfChanged('pull_count',            $pull_count,            pkg ? pkg.pulls : null);
  setIfChanged('conduit_diameter',      $conduit_diameter,      pkg ? pkg.size : null);
  setIfChanged('conduit_material_code', $conduit_material_code, pkg ? pkg.materialCode : null);
  // The multiplier is NOT written to a field. Conduit Material Quantity is a
  // CalculatedField that applies it from the derived diameter and pull count.
  // That keeps the rule stated once here in BUNDLED_CONDUIT_SIZES and mirrored
  // in that one expression; tests/conduit-dp-material.test.js asserts the two
  // agree, so they cannot drift.
}

// ==================== splice band (Sprint 7) ====================
// HO-1 (25-48) prices 25-48 fibers at one location. The band is a FACT in the
// pay-unit code, so it is parsed rather than hard-coded.

function parseSpliceBand(code) {
  if (isBlank(code)) return null;
  var c = String(code).trim();
  if (c.indexOf('HO-1') !== 0) return null;
  var m = /\((\d+)\s*-\s*(\d+)\)/.exec(c);
  if (m) return { lo: parseInt(m[1], 10), hi: parseInt(m[2], 10) };
  m = /\((\d+)\s*or above\)/i.exec(c);
  if (m) return { lo: parseInt(m[1], 10), hi: null };
  return null;
}

function bandLabel(b) {
  if (b === null) return null;
  return (b.hi === null) ? (b.lo + '+') : (b.lo + '-' + b.hi);
}

function deriveSpliceBand() {
  var b = parseSpliceBand(choiceValue($labor_code));
  setIfChanged('splice_band_derived', $splice_band_derived, bandLabel(b));
}

// ==================== quantity from sequentials (Sprint 18) ====================
// Computed from the components rather than read from $total_installed_footage:
// that field is a CalculatedField evaluated by the expression runtime, and this
// runs in the Data Events runtime during validate-record, where its value may
// not yet reflect this save. The components are plain fields and are current.

function installedFootage() {
  var ss = toNum($starting_sequential);
  var es = toNum($ending_sequential);
  if (ss === null || es === null) return null;
  return Math.abs(es - ss) + (toNum($slack_footage) || 0) + (toNum($other_added_footage) || 0);
}

function deriveQuantityFromSequentials() {
  if (!isBlank($quantity)) return;                 // never overwrite a claim
  if (choiceValue($work_category) !== 'Fiber Placement') return;
  if (choiceValue($unit) !== 'FT') return;
  var ft = installedFootage();
  if (ft === null || ft <= 0) return;
  SETVALUE('quantity', Math.round(ft * 100) / 100);
}

ON('change', 'labor_code', function (event) {
  applyLaborMetadata();
  deriveConduitPackage();
  deriveSpliceBand();
});

ON('change', 'starting_sequential', deriveQuantityFromSequentials);
ON('change', 'ending_sequential', deriveQuantityFromSequentials);
ON('change', 'slack_footage', deriveQuantityFromSequentials);
ON('change', 'other_added_footage', deriveQuantityFromSequentials);

function deriveSegmentId() {
  setIfChanged('segment_id', $segment_id, normalizedPair($from_location, $to_location));
}
function deriveSpanId() {
  setIfChanged('span_id', $span_id, normalizedPair($pole_id, $previous_pole_id));
}

ON('change', 'from_location', deriveSegmentId);
ON('change', 'to_location', deriveSegmentId);
ON('change', 'pole_id', deriveSpanId);
ON('change', 'previous_pole_id', deriveSpanId);

ON('new-record', function (event) {
  // No email is captured here. USEREMAIL is absent from the Data Events
  // runtime AND did not resolve in a CalculatedField either, and the platform
  // already records who created this: _created_by_id, which joins to
  // memberships.user_id for name, email and role. A copy on the record would
  // duplicate platform metadata and go stale when an address changes.
  //
  // 'inspector' stays because it is the one identity a FIELD user can see
  // without running SQL. It is a display convenience; _created_by_id is the
  // authority, and reports use that.
  var who = userFullName();
  if (who) SETVALUE('inspector', who);
});

// ==================== QA/QC and approval workflow (Sprint 12) ====================

var PENDING_STATUSES  = ['DRAFT', 'SUBMITTED', 'UNDER REVIEW', 'CORRECTION REQUIRED'];
var REVIEWED_STATUSES = ['APPROVED', 'REJECTED'];

function applyWorkflowState() {
  var s = recordStatus();
  // A reviewer must say what needs fixing. "Correction required" with no detail
  // sends a crew back to site to guess.
  SETREQUIRED('correction_detail', s === 'CORRECTION REQUIRED');
  SETREQUIRED('rejection_reason', s === 'REJECTED');
  // Once reviewed, the production figures are what downstream money is computed
  // from, so they stop being editable in place. A correction cycle reopens them.
  var locked = REVIEWED_STATUSES.indexOf(s) !== -1;
  SETREADONLY('quantity', locked);
  SETREADONLY('labor_code', locked);
  SETREADONLY('rate_link', locked);
}

ON('load-record', applyWorkflowState);
ON('edit-record', applyWorkflowState);

ON('change', 'correction_completed', function (event) {
  if (choiceValue($correction_completed) === 'yes') {
    if (isBlank($correction_completed_date)) {
      SETVALUE('correction_completed_date', new Date().toISOString());
      SETVALUE('correction_completed_by', userFullName());
    }
  } else {
    SETVALUE('correction_completed_date', null);
    SETVALUE('correction_completed_by', null);
  }
});

ON('change-status', function (event) {
  var s = recordStatus();
  var now = new Date().toISOString();
  if (s === 'SUBMITTED' && isBlank($submitted_by)) {
    SETVALUE('submitted_by', userFullName());
    SETVALUE('submitted_date', now);
  } else if (s === 'UNDER REVIEW') {
    SETVALUE('reviewed_by', userFullName());
    SETVALUE('reviewed_date', now);
  } else if (s === 'APPROVED') {
    SETVALUE('approved_by', userFullName());
    SETVALUE('approved_date', now);
  } else if (s === 'REJECTED' || s === 'CORRECTION REQUIRED') {
    // An approval stamp is what every downstream report reads to decide this
    // production counts. A record sent back must not keep one.
    SETVALUE('approved_by', null);
    SETVALUE('approved_date', null);
    SETVALUE('reviewed_by', userFullName());
    SETVALUE('reviewed_date', now);
    if (s === 'CORRECTION REQUIRED') {
      SETVALUE('correction_completed', null);
      SETVALUE('correction_completed_date', null);
      SETVALUE('correction_completed_by', null);
    }
  }
  applyWorkflowState();
});

// ==================== rate validation (Sprint 2) ====================

function validateRate() {
  var out = [];
  function flag(level, msg) { out.push({ level: level, message: msg }); }

  var rate = toNum($contractor_rate);
  if (isBlank($rate_source_id)) {
    flag('CRITICAL', 'No contractor rate linked - this production cannot be priced');
    return out;
  }
  if (rate === null)   flag('CRITICAL', 'Linked rate has no unit rate');
  else if (rate === 0) flag('CRITICAL', 'Linked rate is zero');

  var myC = isBlank($contractor_id_snapshot)  ? '' : String($contractor_id_snapshot).trim();
  var rC  = isBlank($rate_contractor_id_snap) ? '' : String($rate_contractor_id_snap).trim();
  if (myC && rC && myC !== rC) {
    flag('CRITICAL', 'Rate belongs to contractor ' + rC + ' but this production is for ' + myC);
  }

  var myP = isBlank($project_id_snapshot)  ? '' : String($project_id_snapshot).trim();
  var rP  = isBlank($rate_project_id_snap) ? '' : String($rate_project_id_snap).trim();
  if (rP && myP && rP !== myP) {
    flag('CRITICAL', 'Rate is specific to project ' + rP + ' but this production is for ' + myP);
  }

  var myCode   = choiceValue($labor_code);
  var rateCode = choiceValue($rate_labor_code_snap);
  if (myCode && rateCode && myCode !== rateCode) {
    flag('CRITICAL', 'Rate prices labor code ' + rateCode + ' but this production uses ' + myCode);
  }

  var wd  = parseDate($work_date);
  var eff = parseDate($rate_effective_date);
  var exp = parseDate($rate_expiration_snap);
  if (wd && eff && dayOnly(wd) < dayOnly(eff)) {
    flag('CRITICAL', 'Work date precedes the rate effective date - the rate was not yet in force');
  }
  if (wd && exp && dayOnly(wd) > dayOnly(exp)) {
    flag('CRITICAL', 'Work date is after the rate expiration date - expired rate');
  }
  return out;
}

// ==================== reel range (Sprint 4) ====================
// Offline. NOT overlap detection - that is a server-side report by design,
// because a device check would silently vanish without connectivity.

function validateReelRange() {
  var out = [];
  var ss = toNum($starting_sequential);
  var es = toNum($ending_sequential);
  var rb = toNum($reel_begin_snap);
  var re = toNum($reel_end_snap);
  if (ss === null || es === null || rb === null || re === null) return out;

  var lo = Math.min(rb, re), hi = Math.max(rb, re);
  if (ss < lo || ss > hi) {
    out.push({ level: 'WARNING', message: 'Starting sequential ' + ss +
      ' is outside the reel printed range ' + lo + '-' + hi });
  }
  if (es < lo || es > hi) {
    out.push({ level: 'WARNING', message: 'Ending sequential ' + es +
      ' is outside the reel printed range ' + lo + '-' + hi });
  }
  return out;
}

// ==================== splice validation (Sprint 7) ====================
// The wrong band is a PRICING error: HO-1 (1-24) is $32/splice while
// HO-1 (145 or above) is $15. Getting it wrong more than doubles the money.

function validateSplice() {
  var out = [];
  function flag(level, msg) { out.push({ level: level, message: msg }); }

  var band  = parseSpliceBand(choiceValue($labor_code));
  var count = toNum($fiber_count_spliced);

  if (band && count !== null) {
    if (count < band.lo || (band.hi !== null && count > band.hi)) {
      flag('CRITICAL', 'Fiber count ' + count + ' falls outside the priced band ' +
                       bandLabel(band) + ' - this splice is priced at the wrong rate');
    }
  }

  var splices = toNum($splice_quantity);
  var qty     = toNum($quantity);
  if (splices !== null && qty !== null && choiceValue($unit) === 'SPLICE' && splices !== qty) {
    flag('WARNING', 'Splice Quantity ' + splices + ' does not match the production Quantity ' +
                    qty + ' - the billed quantity is Quantity');
  }

  var loss = toNum($loss_value_db);
  if (loss !== null && loss > 0.1) {
    flag('WARNING', 'Measured loss ' + loss + ' dB exceeds the 0.10 dB fusion splice guideline');
  }
  if (choiceValue($splice_test_result) === 'Fail') {
    flag('WARNING', 'Splice test recorded as FAIL');
  }
  return out;
}

// ==================== exception flagging ====================
// Warnings inform, they never block. A blocked save loses field work.

function buildExceptions() {
  var ex = [];
  var sev = 'INFO';
  function flag(level, msg) {
    ex.push('[' + level + '] ' + msg);
    if (level === 'CRITICAL') sev = 'CRITICAL';
    else if (level === 'WARNING' && sev !== 'CRITICAL') sev = 'WARNING';
  }
  function flagAll(list) {
    for (var i = 0; i < list.length; i++) flag(list[i].level, list[i].message);
  }

  flagAll(validateRate());
  flagAll(validateReelRange());
  flagAll(validateSplice());

  var qty  = toNum($quantity);
  var unit = choiceValue($unit);

  if (qty === null)    flag('WARNING', 'Quantity is blank');
  else if (qty === 0)  flag('WARNING', 'Quantity is zero');
  else if (qty < 0)    flag('CRITICAL', 'Negative quantity - use an adjustment transaction');

  var ss = toNum($starting_sequential);
  var es = toNum($ending_sequential);
  if (ss !== null && es === null) flag('WARNING', 'Starting sequential without an ending sequential');
  if (es !== null && ss === null) flag('WARNING', 'Ending sequential without a starting sequential');
  if (ss !== null && es !== null) {
    var ft = Math.abs(es - ss);
    if (ft === 0)        flag('WARNING', 'Start and end sequential are identical - 0 FT');
    else if (ft > 50000) flag('WARNING', 'Sequential footage ' + ft + ' FT exceeds the 50,000 FT plausibility threshold');
  }

  var selected = choiceValue($labor_code);
  if (RETIRED_LABOR_CODES.indexOf(selected) !== -1) {
    flag('CRITICAL', 'Pay unit ' + selected + ' was retired on 2026-09-17. Use the ' +
                     'pull-count unit BM60(n)(1.25)DP instead, so the record states ' +
                     'how many pipes were pulled');
  }

  var cat = choiceValue($work_category);
  if (cat === 'Underground') {
    var code = choiceValue($labor_code);
    if (isBlank($pull_count) && !isBlank(code) && code.indexOf('BM60') === 0) {
      flag('INFO', 'This conduit code is outside the 1.25/2/4 inch scope, or states no size - ' +
                   'no conduit material can be derived');
    }
    var depth = toNum($depth_inches);
    if (depth !== null && depth < 36) {
      flag('WARNING', 'Depth ' + depth + ' inches is below the 36 inch contract minimum');
    }
    if (choiceValue($crossing_type) === 'Railroad' &&
        String(code).indexOf('Rail') === -1) {
      flag('WARNING', 'Railroad crossing recorded but the labor code is not a railroad bore unit');
    }
  }

  if (cat === 'Aerial') {
    var span = toNum($span_footage);
    if (span !== null && span > 500) {
      flag('WARNING', 'Span footage ' + span + ' FT is unusually long for a distribution span');
    }
    if (isBlank($pole_id)) flag('INFO', 'No Pole ID recorded - span cannot be derived');
  }

  if (cat === 'Splicing') {
    if (isBlank($splice_structure_id)) flag('INFO', 'No splice structure recorded');
    if (isBlank($closure_id))          flag('INFO', 'No closure ID recorded');
  }

  var d = parseDate($work_date);
  if (d) {
    var dow = d.getDay();
    if (dow === 0 || dow === 6) {
      flag('INFO', 'Work date falls on ' + DAYS[dow] + ' - outside the Mon-Fri working week');
    }
    var today = new Date();
    today.setHours(23, 59, 59, 999);
    if (d.getTime() > today.getTime()) flag('WARNING', 'Work date is in the future');
  }

  if (unit === 'HR' || unit === 'EVENT') {
    flag('INFO', 'Time & materials unit (' + unit + ') - excluded from physical production totals');
  }
  if (isBlank($from_location) || isBlank($to_location)) {
    flag('INFO', 'Missing From/To structure - segment cannot be derived');
  }
  if (isBlank($qa_photos)) {
    flag('WARNING', 'No photos attached');
  }

  // Sprint 12 automated QA flags that a device CAN evaluate. Duplicate
  // production, fiber overlap, over-plan production and material variance all
  // need other records, so they live in reports - see docs/sprint-10-12-build.md.
  if (isBlank(choiceValue($labor_code))) {
    flag('CRITICAL', 'No labor code - this production cannot be priced or reported');
  }
  if (cat === 'Fiber Placement' && ss === null && es === null) {
    flag('WARNING', 'Fiber placement with no sequentials recorded - the cable ' +
                    'cannot be traced back to a reel');
  }
  // Sprint 18. A transposed sequential, or a quantity typed in the wrong unit,
  // shows up here as a quantity that disagrees with the footage the crew
  // recorded. 5% absorbs ordinary rounding; anything wider is worth a look
  // before it reaches a billing dispute.
  var installed = installedFootage();
  if (cat === 'Fiber Placement' && unit === 'FT' &&
      installed !== null && installed > 0 && qty !== null && qty > 0) {
    var gap = Math.abs(qty - installed);
    if (gap / installed > 0.05) {
      flag('WARNING', 'Billed quantity ' + qty + ' FT differs from the installed ' +
                      'footage of ' + (Math.round(installed * 100) / 100) + ' FT ' +
                      '(sequential + slack + other) by ' +
                      (Math.round(gap * 100) / 100) + ' FT. Check the sequentials ' +
                      'or the quantity');
    }
  }
  // A record too sparse to fingerprint cannot be duplicate-checked at all,
  // which is worth saying out loud rather than leaving it silently unchecked.
  var fpStrength = toNum($fingerprint_strength);
  if (fpStrength !== null && fpStrength < 4) {
    flag('WARNING', 'Only ' + fpStrength + ' identifying values recorded, so this ' +
                    'record cannot be reliably duplicate-checked. Add the cable ID ' +
                    'and sequentials, or the from/to structures');
  }

  var status = recordStatus();
  if (status === 'CORRECTION REQUIRED' && isBlank($correction_detail)) {
    flag('CRITICAL', 'Correction required but nothing states what to correct');
  }
  if (choiceValue($correction_completed) === 'yes' && status === 'CORRECTION REQUIRED') {
    flag('INFO', 'Correction marked complete - resubmit this record for review');
  }
  if (choiceValue($qa_status) === 'Conditional Pass' && isBlank($correction_detail)) {
    flag('WARNING', 'Conditional pass with no condition stated');
  }

  setIfChanged('exception_flags', $exception_flags, ex.length ? ex.join(' | ') : null);
  setIfChanged('exception_severity', choiceValue($exception_severity), ex.length ? sev : null);
}

// ==================== production fingerprints (Sprint 13) ====================

// A blank component must be distinguishable, not empty. Two records each
// missing a DIFFERENT field would otherwise produce the same string and look
// like duplicates of each other.
var FP_ABSENT = '~';
var FP_SEP = '|';

function fpPart(v) {
  if (isBlank(v)) return FP_ABSENT;
  return String(v).trim().toUpperCase().replace(/\s+/g, ' ').replace(/\|/g, '/');
}

function fpNum(v) {
  var n = toNum(v);
  return n === null ? FP_ABSENT : String(n);
}

function buildFingerprints() {
  var project    = fpPart($project_id_snapshot);
  var contractor = fpPart($contractor_id_snapshot);
  var code       = fpPart(choiceValue($labor_code));

  // Date only. A work date carrying a time would split two records of the same
  // day's work into different fingerprints.
  var d = parseDate($work_date);
  var day = d
    ? (d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()))
    : FP_ABSENT;

  var cable = fpPart($cable_id);
  var lo = FP_ABSENT, hi = FP_ABSENT;
  var ss = toNum($starting_sequential);
  var es = toNum($ending_sequential);
  if (ss !== null && es !== null) {
    // Direction-normalized: a crew pulling the other way records the same
    // physical cable, and must not create a second identity for it.
    lo = String(Math.min(ss, es));
    hi = String(Math.max(ss, es));
  }

  // Already direction-normalized by normalizedPair, so HH-1 -> HH-2 and
  // HH-2 -> HH-1 are one segment (Sprint 14).
  var segment = fpPart(normalizedPair($from_location, $to_location));

  var strict = ['S', project, contractor, day, code, cable, lo, hi].join(FP_SEP);
  var seg    = ['G', project, contractor, day, code, segment].join(FP_SEP);

  // Strength is how many IDENTIFYING components are actually present. A record
  // with only a project and a date matches half the job; without this a report
  // would treat that as a duplicate finding.
  var strictParts = [project, contractor, day, code, cable, lo];
  var segParts    = [project, contractor, day, code, segment];
  var strictStrength = 0, segStrength = 0;
  for (var i = 0; i < strictParts.length; i++) {
    if (strictParts[i] !== FP_ABSENT) strictStrength++;
  }
  for (var j = 0; j < segParts.length; j++) {
    if (segParts[j] !== FP_ABSENT) segStrength++;
  }

  setIfChanged('fingerprint_strict', $fingerprint_strict, strict);
  setIfChanged('fingerprint_segment', $fingerprint_segment, seg);
  setIfChanged('fingerprint_strength', $fingerprint_strength,
               Math.max(strictStrength, segStrength));
}

// ==================== persistent production ID (Sprint 13) ====================
// Set ONCE and never regenerated. The production app this replaces used
// Math.random() on every save, so the same record reported a different ID each
// time it was edited - which makes it useless as a reference in any document.
//
// The brief's example is PRD-2026-000123, a sequential number. Sequential
// numbering is NOT offline-safe: two crews out of service both take 124 and
// collide on sync, and no device can see the counter to avoid it. So the
// suffix comes from Fulcrum's own record ID, which is globally unique, assigned
// by the platform and stable for the life of the record.

function assignProductionId() {
  if (!isBlank($production_id)) return;
  var d = parseDate($work_date) || new Date();
  var rid = recordId();
  var suffix;
  if (rid) {
    suffix = String(rid).replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
  } else {
    // RECORDID can be unavailable before a record's first save. A bare
    // timestamp would let two devices saving in the same millisecond collide,
    // so the user's email is folded in to keep the fallback unique per device.
    var who = userEmail();
    var whoTag = who
      ? String(who).replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase()
      : 'XXX';
    suffix = whoTag + String(Date.now()).slice(-8);
  }
  SETVALUE('production_id', 'PRD-' + d.getFullYear() + '-' + suffix);
}

// The gate. buildExceptions() has just run, so exception_severity reflects this
// save. Only CRITICAL blocks; WARNING and INFO never do.
function enforceApprovalGate() {
  if (recordStatus() !== 'APPROVED') return;

  if (choiceValue($exception_severity) === 'CRITICAL') {
    INVALID('This record carries a CRITICAL exception and cannot be approved: ' +
            (isBlank($exception_flags) ? '' : $exception_flags) +
            ' Approved production is what earned value, billing and remaining ' +
            'scope are computed from. Fix the exception, or send the record ' +
            'back with CORRECTION REQUIRED.');
    return;
  }
  if (choiceValue($qa_status) === 'Fail') {
    INVALID('QA status is Fail. Approving failed work would put it into earned ' +
            'value and billing. Use CORRECTION REQUIRED, or record the QA ' +
            'result that actually applies.');
    return;
  }
  // Blank counts as unreviewed. The field defaults to 'Not Reviewed' in the
  // app, but a record written by an import or the API can arrive with nothing
  // in it, and that is the case this gate exists for.
  var qa = choiceValue($qa_status);
  if (isBlank(qa) || qa === 'Not Reviewed') {
    INVALID('QA status is still Not Reviewed. Record a QA outcome before ' +
            'approving - an approval is a statement that someone looked.');
  }
}

ON('validate-record', function (event) {
  assignProductionId();
  deriveReportingPeriod();
  applyLaborMetadata();
  deriveConduitPackage();
  deriveSpliceBand();
  deriveSegmentId();
  deriveSpanId();
  deriveQuantityFromSequentials();   // before buildExceptions reads quantity
  buildFingerprints();          // after segment_id, which it reads
  buildExceptions();
  enforceApprovalGate();
});
