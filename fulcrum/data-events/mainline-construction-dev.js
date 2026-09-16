/**
 * Mainline Construction - Development
 * Data Events - SPRINT 8 v4.0.0 (2026-09-16), supersedes v3.0.0.
 *
 * CHANGE IN THIS VERSION
 *   + Splice band derivation and band-vs-fiber-count validation (Sprint 7).
 *   + Conduit material derivation under the PULL COUNT ruling (Sprint 8).
 *
 * RULING 2026-09-16 - PULL COUNT, AND WHY v3 WAS WRONG
 *   In BM60(n)(size), (n) is the PULL COUNT: BM60(1)(1.25) P is a 1-pull plow,
 *   BM60(2)(1.25) P is 2-pull. A 3-pull package is therefore ONE bundled
 *   conduit assembly, consumed at 1 FT per production FT - NOT three feet of
 *   single conduit. v3.0.0 labelled quantity x count as "Calculated Conduit
 *   Footage", which would have ordered 3x the conduit. It is now
 *   "Total Duct Footage (informational)", and the material quantity is 1:1.
 *   Conduit sizes in scope per the same ruling: 1.25, 2 and 4 inch only.
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

  return {
    pulls: pulls,
    size: size,
    // Canonical code. The Labor-Material Mapping master resolves it to a stock
    // part number - deriving a part number here would hard-code master data.
    materialCode: 'CONDUIT-' + size + '-' + pulls + 'PULL'
  };
}

function deriveConduitPackage() {
  var pkg = parseConduitPackage(choiceValue($labor_code));
  setIfChanged('pull_count',            $pull_count,            pkg ? pkg.pulls : null);
  setIfChanged('conduit_diameter',      $conduit_diameter,      pkg ? pkg.size : null);
  setIfChanged('conduit_material_code', $conduit_material_code, pkg ? pkg.materialCode : null);
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
  }
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

  setIfChanged('exception_flags', $exception_flags, ex.length ? ex.join(' | ') : null);
  setIfChanged('exception_severity', choiceValue($exception_severity), ex.length ? sev : null);
}

function assignProductionId() {
  if (!isBlank($production_id)) return;
  var d = parseDate($work_date) || new Date();
  var rid = '';
  try { rid = RECORDID() || ''; } catch (e) { rid = ''; }
  var suffix = rid
    ? String(rid).replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase()
    : String(Date.now()).slice(-8);
  SETVALUE('production_id', 'PRD-' + d.getFullYear() + '-' + suffix);
}

ON('validate-record', function (event) {
  assignProductionId();
  deriveReportingPeriod();
  applyLaborMetadata();
  deriveConduitPackage();
  deriveSpliceBand();
  deriveSegmentId();
  deriveSpanId();
  buildExceptions();
});
