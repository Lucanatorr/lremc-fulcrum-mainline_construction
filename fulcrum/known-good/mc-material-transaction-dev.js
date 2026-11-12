/**
 * MC Material Transaction - Development
 * Data Events - SPRINT 8 v1.0.0 (2026-09-16)
 *
 * Atomic material ledger. No totals are stored here - every balance is derived
 * by summing transactions, the same principle the production transactions use.
 *
 * NO SECRETS. NO OUTBOUND CALLS.
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

ON('validate-record', function (event) {
  // Persistent transaction id, set once (same rule as Production ID).
  if (isBlank($transaction_id)) {
    var d = parseDate($transaction_date) || new Date();
    var rid = '';
    try { rid = RECORDID() || ''; } catch (e) { rid = ''; }
    var suffix = rid
      ? String(rid).replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase()
      : String(Date.now()).slice(-8);
    SETVALUE('transaction_id', 'MTX-' + d.getFullYear() + '-' + suffix);
  }

  var qty  = toNum($quantity);
  var type = choiceValue($transaction_type);

  if (qty === null) {
    INVALID('Quantity must be a number.');
    return;
  }
  if (qty === 0) {
    INVALID('Quantity is zero - a zero-quantity movement is not a transaction.');
    return;
  }
  // A negative quantity is a reversal. Allowing it on an ordinary Installed
  // record would let someone quietly erase consumption (Sprint 23.59).
  if (qty < 0 && type !== 'Adjusted') {
    INVALID('Negative quantity is only valid on an Adjusted transaction. ' +
            'To reverse a movement, record an Adjusted transaction instead.');
    return;
  }
});
