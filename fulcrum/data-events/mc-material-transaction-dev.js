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

function parseDate(v) {
  if (isBlank(v)) return null;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
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
