/**
 * MC Contractor Rate - Development
 * Data Events - v1.1.0 (2026-11-09), deployed 2026-11-09. v1.0.0 was live from
 * 2026-09-16 (Sprint 2) and is the first commit of this file.
 *
 * CHANGE IN v1.1.0 - THE SAME TWO DEFECTS FIXED EVERYWHERE ELSE ON 2026-09-22
 * This script was live but never committed, so it missed both fixes:
 *   + applyLaborMetadata() parsed unit and description out of the labor code's
 *     choice LABEL. The Data Events runtime exposes no labels, so the parse
 *     always missed and the !m branch CLEARED both fields on every save. The
 *     146 imported rates were never hit because an API import runs no Data
 *     Events - but the first edit of a rate in the app would have blanked its
 *     unit, and the rate is now where production COPIES its unit from
 *     (r010 -> m024). It now only fills a blank, and never clears.
 *   + parseDate() read a UTC-midnight date with the local getters. The
 *     effective/expiry comparison compares two dates shifted alike, so it was
 *     not wrong, but it is normalized like every other script so the rule is
 *     stated once.
 * Also OI-09: Currency and Contract Reference are on the record. A rate with
 * no contract reference cannot be traced to the executed amendment in a
 * dispute; reports/rate-master-audit.sql lists those.
 * Unit (r010) is now an EDITABLE, REQUIRED field: the administrator states the
 * unit of measure on the rate, because no script can derive it and production
 * copies it from here. It was read-only, which made a rate created in the app
 * impossible to complete (D-020).
 *
 * Pricing master. Rates are versioned, never overwritten.
 *
 * This script derives labor metadata and guards the effective period. It
 * deliberately does NOT reprice anything: production transactions snapshot a
 * rate at entry time and are never revisited from here.
 */

function isBlank(v) {
  return v === null || v === undefined || v === '' ||
         (typeof v === 'string' && v.trim() === '');
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

// A date-only field is stored as UTC midnight; re-anchor the calendar date on
// local midnight so the local getters return the date the field holds.
function parseDate(v) {
  if (isBlank(v)) return null;
  var d = new Date(v);
  if (isNaN(d.getTime())) return null;
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

// v1.1.0: a guard, not a derivation. The runtime exposes no labels, so this
// can only ever FILL a blank unit or description when a label happens to be
// present - it must never clear what the import or an administrator set.
function applyLaborMetadata() {
  var label = choiceLabel($labor_code);
  if (isBlank(label)) return;
  var m = /^(.*?)\s*\((FT|EA|HR|SPLICE|SF|EVENT)\)\s*(.*)$/.exec(label);
  if (!m) return;                                  // never clear
  if (isBlank(choiceValue($unit))) setIfChanged('unit', choiceValue($unit), m[2]);
  if (isBlank($labor_description)) setIfChanged('labor_description', $labor_description, m[3]);
}

ON('change', 'labor_code', applyLaborMetadata);

ON('validate-record', function (event) {
  applyLaborMetadata();

  var eff = parseDate($effective_date);
  var exp = parseDate($expiration_date);

  // A backwards effective period would silently price nothing at all.
  if (eff && exp && exp.getTime() < eff.getTime()) {
    INVALID('Expiration Date is before Effective Date. A rate cannot expire before it takes effect.');
    return;
  }

  // Zero is a real number but almost never a real contract rate. Block it in
  // the master rather than letting it reach production silently (Sprint 23.11).
  if (!isBlank($unit_rate) && parseFloat($unit_rate) === 0) {
    INVALID('Unit Rate is zero. If this pay unit genuinely has no price, leave the rate record inactive instead.');
    return;
  }
  // OI-09: a missing Contract Reference is deliberately NOT checked here. This
  // form has no exceptions field to carry a warning, legacy rates predate the
  // field, and blocking would stop an administrator correcting a rate.
  // reports/rate-master-audit.sql lists rates with no reference instead.
});
