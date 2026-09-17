/**
 * MC Segment - Development
 * Data Events - SPRINT 14 v1.0.0 (2026-09-17)
 *
 * DIRECTION NORMALIZATION IS THE WHOLE POINT
 *   The brief: "ensure reversing From/To does not accidentally create
 *   uncontrolled duplicate segment identities."
 *
 *   A crew boring from HH-002 back toward HH-001 is working the same physical
 *   path as one boring the other way. If the segment identity were just
 *   from + '_' + to, that single path would acquire two identities, and every
 *   report keyed on segment would then double-count it - quantities, lengths,
 *   percent complete, all of it.
 *
 *   So the ID sorts the two structure IDs before joining them. HH-001_HH-002 is
 *   the only identity that path can have, whichever way a crew drove.
 *
 *   The SAME function derives segment_id on the production app, so a production
 *   record and a segment record agree on the identity of a path without either
 *   knowing about the other.
 *
 * WHAT THIS APP DOES NOT DO
 *   It cannot detect that ANOTHER segment record already claims this identity -
 *   that needs other records, which a device cannot read offline. The
 *   normalized ID is what makes that detectable in a report instead, by a plain
 *   GROUP BY rather than a heuristic. See reports/segment-integrity.sql.
 *
 * NO HARD-CODED MASTER DATA. NO SECRETS. NO OUTBOUND CALLS.
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

function setIfChanged(dataName, current, next) {
  var a = isBlank(current) ? '' : String(current);
  var b = isBlank(next) ? '' : String(next);
  if (a !== b) SETVALUE(dataName, isBlank(next) ? null : next);
}

// Identical to normalizedPair on the production app. Kept character-for-
// character so the two apps cannot disagree about a segment's identity.
function normalizedPair(a, b) {
  a = isBlank(a) ? '' : String(a).trim().toUpperCase();
  b = isBlank(b) ? '' : String(b).trim().toUpperCase();
  if (!a || !b) return null;
  return (a <= b) ? (a + '_' + b) : (b + '_' + a);
}

function deriveSegmentId() {
  setIfChanged('segment_id', $segment_id,
               normalizedPair($from_structure_id, $to_structure_id));
}

ON('change', 'from_structure_link', deriveSegmentId);
ON('change', 'to_structure_link', deriveSegmentId);

function buildExceptions() {
  var ex = [];
  var sev = 'INFO';
  function flag(level, msg) {
    ex.push('[' + level + '] ' + msg);
    if (level === 'CRITICAL') sev = 'CRITICAL';
    else if (level === 'WARNING' && sev !== 'CRITICAL') sev = 'WARNING';
  }

  if (isBlank($segment_id)) {
    flag('CRITICAL', 'Segment ID cannot be derived until both structures are linked');
  }

  var type = choiceValue($segment_type);
  var design  = toNum($design_length);
  var asBuilt = toNum($as_built_length);

  if (design === null) {
    flag('INFO', 'No design length - the as-built cannot be compared to anything');
  }
  if (design !== null && asBuilt !== null && design > 0) {
    var variance = Math.abs(asBuilt - design) / design;
    // A quarter over or under the drawing is either a design problem or a
    // measurement problem, and both want looking at before it is billed.
    if (variance > 0.25) {
      flag('WARNING', 'As-built length differs from design by ' +
                      Math.round(variance * 100) + '% - worth confirming before ' +
                      'this segment is used to check production quantities');
    }
  }

  // Aerial runs between anything other than poles, and underground runs
  // between poles, are usually a mis-selected structure rather than real.
  var fromType = isBlank($from_structure_type) ? '' : String($from_structure_type);
  var toType   = isBlank($to_structure_type) ? '' : String($to_structure_type);
  if (type === 'Aerial Strand' && fromType && toType
      && fromType !== 'Pole' && toType !== 'Pole') {
    flag('WARNING', 'An aerial strand segment normally runs pole to pole, but ' +
                    'neither endpoint is a pole (' + fromType + ' to ' + toType + ')');
  }
  if (type === 'Underground Conduit' && fromType === 'Pole' && toType === 'Pole') {
    flag('INFO', 'Underground conduit between two poles - legitimate for a riser ' +
                 'to riser run, but check the structures are right');
  }

  if (type === 'Underground Conduit') {
    var size = isBlank($conduit_diameter) ? '' : String($conduit_diameter).trim();
    if (size && ['1.25', '2', '4'].indexOf(String(parseFloat(size))) === -1) {
      flag('WARNING', 'Conduit diameter ' + size + ' is outside the 1.25 / 2 / 4 ' +
                      'inch scope, so no material can be derived for it');
    }
  }

  if (STATUS() === 'COMPLETE' && asBuilt === null) {
    flag('WARNING', 'Marked complete with no as-built length recorded');
  }

  setIfChanged('exception_flags', $exception_flags, ex.length ? ex.join(' | ') : null);
  setIfChanged('exception_severity', choiceValue($exception_severity), ex.length ? sev : null);
}

ON('validate-record', function (event) {
  deriveSegmentId();
  buildExceptions();

  var from = isBlank($from_structure_id) ? '' : String($from_structure_id).trim().toUpperCase();
  var to   = isBlank($to_structure_id) ? '' : String($to_structure_id).trim().toUpperCase();

  // A segment from a structure to itself has no length and no direction. It is
  // always a mis-selection, and allowing one would put a zero-length path into
  // every segment report.
  if (from && to && from === to) {
    INVALID('A segment cannot run from a structure to itself. Both endpoints ' +
            'are ' + from + '.');
  }
});
