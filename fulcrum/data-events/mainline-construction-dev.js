/**
 * Mainline Construction - Development
 * Data Events - v5.0.0 (2026-09-17), supersedes v4.0.0.
 *
 * CHANGE IN THIS VERSION
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
 *   BM60-(1.25)DP ($10) plus BM60-(1.25)DPD Dual ($2 per additional pipe) are
 *   replaced by BM60(1)(1.25)DP .. BM60(5)(1.25)DP at 10/12/14/16/18. The pull
 *   count is now a fact of the selected pay unit instead of being implied by
 *   how many transactions someone remembered to raise. Total billing unchanged.
 *
 * WASTE FACTOR IS NOT APPLIED HERE. Conduit carries a 10% purchasing waste
 * factor, but it lives in the Labor-Material Mapping master, not in this
 * script: the installed quantity must stay a clean measurement of what went in
 * the ground. Grossing up for waste is a purchasing step.
 *
 * NO HARD-CODED MASTER DATA. NO SECRETS. NO OUTBOUND CALLS.
 * WEEK DEFINITION: ISO-8601, Monday start, Mon-Fri working week.
 */

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

function parseDate(v) {
  if (isBlank(v)) return null;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
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

function applyLaborMetadata() {
  var label = choiceLabel($labor_code);
  var m = isBlank(label)
    ? null
    : /^(.*?)\s*\((FT|EA|HR|SPLICE|SF|EVENT)\)\s*(.*)$/.exec(label);
  if (!m) {
    setIfChanged('unit', choiceValue($unit), null);
    return;
  }
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
  // CalculatedField that applies it from the derived diameter and pull count,
  // because a Fulcrum forms_update that adds a field to this form fails with an
  // opaque could_not_update_form - see docs/fulcrum-inventory.md. The rule is
  // stated once here in BUNDLED_CONDUIT_SIZES and mirrored in that one
  // expression; tests/conduit-dp-material.test.js asserts the two agree.
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

ON('change', 'labor_code', function (event) {
  applyLaborMetadata();
  deriveConduitPackage();
  deriveSpliceBand();
});

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
  SETVALUE('inspector', USERFULLNAME());
  SETVALUE('inspector_email', USEREMAIL());
});

// ==================== QA/QC and approval workflow (Sprint 12) ====================

var PENDING_STATUSES  = ['DRAFT', 'SUBMITTED', 'UNDER REVIEW', 'CORRECTION REQUIRED'];
var REVIEWED_STATUSES = ['APPROVED', 'REJECTED'];

function applyWorkflowState() {
  var s = STATUS();
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
      SETVALUE('correction_completed_by', USERFULLNAME());
    }
  } else {
    SETVALUE('correction_completed_date', null);
    SETVALUE('correction_completed_by', null);
  }
});

ON('change-status', function (event) {
  var s = STATUS();
  var now = new Date().toISOString();
  if (s === 'SUBMITTED' && isBlank($submitted_by)) {
    SETVALUE('submitted_by', USERFULLNAME());
    SETVALUE('submitted_date', now);
  } else if (s === 'UNDER REVIEW') {
    SETVALUE('reviewed_by', USERFULLNAME());
    SETVALUE('reviewed_date', now);
  } else if (s === 'APPROVED') {
    SETVALUE('approved_by', USERFULLNAME());
    SETVALUE('approved_date', now);
  } else if (s === 'REJECTED' || s === 'CORRECTION REQUIRED') {
    // An approval stamp is what every downstream report reads to decide this
    // production counts. A record sent back must not keep one.
    SETVALUE('approved_by', null);
    SETVALUE('approved_date', null);
    SETVALUE('reviewed_by', USERFULLNAME());
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
  // A record too sparse to fingerprint cannot be duplicate-checked at all,
  // which is worth saying out loud rather than leaving it silently unchecked.
  var fpStrength = toNum($fingerprint_strength);
  if (fpStrength !== null && fpStrength < 4) {
    flag('WARNING', 'Only ' + fpStrength + ' identifying values recorded, so this ' +
                    'record cannot be reliably duplicate-checked. Add the cable ID ' +
                    'and sequentials, or the from/to structures');
  }

  var status = STATUS();
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
  var rid = '';
  try { rid = RECORDID() || ''; } catch (e) { rid = ''; }
  var suffix;
  if (rid) {
    suffix = String(rid).replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase();
  } else {
    // RECORDID can be unavailable before a record's first save. A bare
    // timestamp would let two devices saving in the same millisecond collide,
    // so the user's email is folded in to keep the fallback unique per device.
    var who = '';
    try { who = USEREMAIL() || ''; } catch (e) { who = ''; }
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
  if (STATUS() !== 'APPROVED') return;

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
  buildFingerprints();          // after segment_id, which it reads
  buildExceptions();
  enforceApprovalGate();
});
