/**
 * MC Fiber Reel - Development
 * Data Events - v2.0.0 (2026-09-21), Sprint 17.
 *
 * Reel master. Its printed sequential range is the reference production
 * records are validated against.
 *
 * CHANGE IN v2.0.0 - SPRINT 17
 *   + Waste cannot exceed the printed reel length.
 *   + Project and contractor assignment (f013-f018), copied down like every
 *     other RecordLink in this system so the reel resolves offline.
 *   - Stored totals REMOVED: printed_sequential_consumed, slack_recorded and
 *     estimated_remaining_footage are gone from the master.
 *
 *   WHY THOSE FIELDS HAD TO GO
 *   All three were sums over production records. Nothing populated them,
 *   because nothing on a device CAN: a record cannot see other records. The
 *   estimated-remaining CalculatedField subtracted a consumed figure that was
 *   permanently null, so it reported original - waste and called it remaining.
 *   A confidently wrong number on the master is worse than no number, because
 *   somebody plans a pull against it. reports/reel-balance.sql computes all
 *   five concepts the brief asks to keep separate.
 *
 * DELIBERATELY NOT DONE HERE: this script never recalculates production.
 * Correcting a reel's printed range after installation records exist must not
 * silently rewrite those records - they are flagged for review by
 * reports/reel-integrity.sql instead (Sprint 23.47.18).
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

ON('validate-record', function (event) {
  var b = toNum($beginning_sequential);
  var e = toNum($ending_sequential);

  if (b !== null && e !== null && b === e) {
    INVALID('Beginning and ending sequential are identical - the reel would have zero footage.');
    return;
  }

  // A reel longer than 40,000 FT is almost certainly a typo. Block it in the
  // master, where one bad range would otherwise mis-validate every production
  // record that references this reel.
  if (b !== null && e !== null && Math.abs(e - b) > 40000) {
    INVALID('Printed reel footage exceeds 40,000 FT. Check the sequential range.');
    return;
  }

  // Sprint 17. Waste is subtracted from the printed length in
  // reports/reel-balance.sql, so waste greater than that length drives the
  // remaining figure negative for every reader of the report.
  var waste = toNum($waste_recorded);
  if (waste !== null && b !== null && e !== null) {
    var printed = Math.abs(e - b);
    if (waste > printed) {
      INVALID('Waste of ' + waste + ' FT exceeds the printed reel length of ' +
              printed + ' FT. Slack is not waste - slack is installed cable ' +
              'inside the consumed sequential range, and belongs on the ' +
              'production record, not here.');
    }
  }
});
