/**
 * MC Structure - Development
 * Data Events - SPRINT 14 v1.0.0 (2026-09-17)
 *
 * The structure master. Structure ID is the permanent key that segments and
 * production records point at, so it is locked once the structure exists in the
 * field: renaming it would silently orphan every reference.
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

function parseDate(v) {
  if (isBlank(v)) return null;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

// Structures that physically live inside another structure. For these, asking
// for a housing structure is reasonable; for a vault it is nonsense.
var HOUSED_TYPES = ['Splice Closure', 'Slack Storage'];

function applyLocks() {
  var s = STATUS();
  // Once a structure is in the ground its ID is a field fact. Everything else
  // stays editable - a pole gets re-rated, an enclosure gets a new lid - but
  // the ID is what every segment and production record resolves through.
  var placed = (s === 'INSTALLED' || s === 'EXISTING' || s === 'REMOVED');
  SETREADONLY('structure_id', placed);
  SETREADONLY('structure_type', placed);
  SETDESCRIPTION('structure_id', placed
    ? 'LOCKED. This structure exists in the field. Segments and production '
      + 'records resolve through this ID, so renaming it would orphan them. '
      + 'Deactivate and create a new structure if the identity really changed.'
    : 'Permanent key, as painted or tagged in the field. Locked once the '
      + 'structure is installed or recorded as existing.');
  SETREQUIRED('removed_date', s === 'REMOVED');
  SETREQUIRED('installed_date', s === 'INSTALLED');
  SETHIDDEN('housed_in_structure_id',
            HOUSED_TYPES.indexOf(choiceValue($structure_type)) === -1);
}

ON('load-record', applyLocks);
ON('edit-record', applyLocks);
ON('change', 'structure_type', applyLocks);
ON('change-status', function (event) {
  var s = STATUS();
  if (s === 'INSTALLED' && isBlank($installed_date)) {
    SETVALUE('installed_date', new Date().toISOString());
  }
  if (s === 'REMOVED' && isBlank($removed_date)) {
    SETVALUE('removed_date', new Date().toISOString());
  }
  if (s === 'REMOVED') {
    SETVALUE('active', 'no');
  }
  applyLocks();
});

function buildExceptions() {
  var ex = [];
  var sev = 'INFO';
  function flag(level, msg) {
    ex.push('[' + level + '] ' + msg);
    if (level === 'CRITICAL') sev = 'CRITICAL';
    else if (level === 'WARNING' && sev !== 'CRITICAL') sev = 'WARNING';
  }

  var type = choiceValue($structure_type);

  // A structure with no coordinates cannot be found, mapped or used to derive a
  // segment length. That is the whole point of the master.
  var lat = null;
  try { lat = LATITUDE(); } catch (e) { lat = null; }
  if (lat === null || lat === 0) {
    flag('WARNING', 'No location captured - this structure cannot be mapped, ' +
                    'and segment lengths through it cannot be derived');
  }

  if (HOUSED_TYPES.indexOf(type) !== -1 && isBlank($housed_in_structure_id)) {
    flag('WARNING', 'A ' + type + ' normally sits inside another structure. ' +
                    'Naming the housing structure keeps it findable');
  }

  // An enclosure in a roadway that nobody rated is a dig-it-up-again risk.
  if (['Handhole', 'Vault'].indexOf(type) !== -1
      && (isBlank(choiceValue($traffic_rating))
          || choiceValue($traffic_rating) === 'Unknown')) {
    flag('WARNING', 'No traffic rating recorded. A structure in a roadway must ' +
                    'meet the rating the authority requires');
  }

  var installed = parseDate($installed_date);
  var removed   = parseDate($removed_date);
  if (installed && removed && removed.getTime() < installed.getTime()) {
    flag('CRITICAL', 'Removed date precedes the installed date');
  }

  if (STATUS() === 'REMOVED' && choiceValue($active) === 'yes') {
    flag('WARNING', 'Marked removed but still flagged active');
  }

  if (isBlank($project_id_snap)) {
    flag('INFO', 'No project linked - the structure will not appear in project ' +
                 'structure counts');
  }

  setIfChanged('exception_flags', $exception_flags, ex.length ? ex.join(' | ') : null);
  setIfChanged('exception_severity', choiceValue($exception_severity), ex.length ? sev : null);
}

ON('validate-record', function (event) {
  // Normalize the key on the way in. 'hh-1 ' and 'HH-1' must not become two
  // structures, because nothing downstream would ever reconcile them.
  if (!isBlank($structure_id)) {
    setIfChanged('structure_id', $structure_id,
                 String($structure_id).trim().toUpperCase().replace(/\s+/g, ' '));
  }
  if (!isBlank($housed_in_structure_id)) {
    setIfChanged('housed_in_structure_id', $housed_in_structure_id,
                 String($housed_in_structure_id).trim().toUpperCase().replace(/\s+/g, ' '));
  }

  buildExceptions();

  if (isBlank($structure_id)) {
    INVALID('A structure needs an ID. Everything that references this structure ' +
            'resolves through it.');
  }
  if (!isBlank($housed_in_structure_id)
      && String($housed_in_structure_id).toUpperCase() === String($structure_id).toUpperCase()) {
    INVALID('A structure cannot be housed inside itself.');
  }
});
