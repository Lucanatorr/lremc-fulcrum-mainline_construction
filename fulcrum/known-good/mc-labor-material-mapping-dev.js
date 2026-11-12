/**
 * MC Labor-Material Mapping - Development
 * Data Events - SPRINT 5 v1.0.0 (2026-09-16)
 *
 * Master data for labor-to-material calculation. Contains NO multipliers of its
 * own - they live in the records. Changing a multiplier is a data edit, never a
 * code change.
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
  return '';
}

ON('validate-record', function (event) {
  var mult = toNum($multiplier);

  if (mult === null) {
    INVALID('Multiplier must be a number.');
    return;
  }
  // A zero multiplier silently consumes nothing, which looks identical to a
  // missing mapping in every downstream report. Deactivate instead.
  if (mult === 0) {
    INVALID('Multiplier is zero - this mapping would consume no material. Set Active = No instead.');
    return;
  }

  var eff = isBlank($effective_date) ? null : new Date($effective_date);
  var exp = isBlank($expiration_date) ? null : new Date($expiration_date);
  if (eff && exp && !isNaN(eff.getTime()) && !isNaN(exp.getTime()) &&
      exp.getTime() < eff.getTime()) {
    INVALID('Expiration Date is before Effective Date.');
    return;
  }

  // An unreviewed mapping must never be quietly promoted to approved.
  if (choiceValue($source) === 'NEEDS_REVIEW' && STATUS() === 'APPROVED') {
    INVALID('This mapping is still marked NEEDS REVIEW as its source. Change the Source before approving it.');
    return;
  }
});
