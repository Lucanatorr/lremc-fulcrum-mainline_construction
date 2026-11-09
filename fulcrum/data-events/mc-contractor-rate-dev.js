/**
 * MC Contractor Rate - Development
 * Data Events - SPRINT 2 v1.0.0 (2026-09-16)
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

function parseDate(v) {
  if (isBlank(v)) return null;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// Unit and description come from the choice list label, so the labor master
// stays the single source of truth (no hard-coded table here).
function applyLaborMetadata() {
  var label = choiceLabel($labor_code);
  var m = isBlank(label)
    ? null
    : /^(.*?)\s*\((FT|EA|HR|SPLICE|SF|EVENT)\)\s*(.*)$/.exec(label);
  if (!m) {
    setIfChanged('unit', choiceValue($unit), null);
    setIfChanged('labor_description', $labor_description, null);
    return;
  }
  setIfChanged('unit', choiceValue($unit), m[2]);
  setIfChanged('labor_description', $labor_description, m[3]);
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
});
