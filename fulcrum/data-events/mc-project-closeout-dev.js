/**
 * MC Project Closeout - Development
 * Data Events - v1.0.0 (2026-09-21), Sprint 22.
 *
 * One record per project. Tracks the eleven closeout milestones, the readiness
 * review, and the authorized override that lets a project close with items
 * outstanding.
 *
 * WHAT THIS SCRIPT CAN AND CANNOT CHECK
 * The brief requires eight things to be identified before a project is CLOSED:
 * unapproved production, failed QA, open corrections, remaining planned work,
 * material discrepancies, missing documentation, unresolved change orders and
 * missing test results. Every one of them needs OTHER records, which this
 * record cannot see - the same offline limit that put duplicate detection and
 * sequential overlap into reports. They are computed by
 * reports/closeout-readiness.sql.
 *
 * So this script does not pretend to evaluate them. What it enforces is that
 * somebody states they ran the report, and that closing with milestones
 * outstanding is a deliberate, attributed, reasoned act rather than a status
 * change nobody notices.
 *
 * WHY "PROJECT CLOSED" IS A STATUS AND NOT A TWELFTH CHECKBOX
 * The brief lists twelve items to track and the twelfth is "Project Closed".
 * A checkbox and a record status that both claim to mean closed will
 * eventually disagree, and then no report knows which to believe. The status
 * is the authority; the eleven checkboxes are the things that gate it.
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

// typeof guards, for the reason documented at length in the production app:
// a bare call to a global this runtime does not expose throws a ReferenceError
// that escapes the handler AND the expressions proxy, silently dropping every
// queued write from the same event.
function userFullName() {
  if (typeof USERFULLNAME !== 'function') return '';
  try { return USERFULLNAME() || ''; } catch (e) { return ''; }
}
function recordStatus() {
  if (typeof STATUS !== 'function') return '';
  try { return STATUS() || ''; } catch (e) { return ''; }
}
function recordId() {
  if (typeof RECORDID !== 'function') return '';
  try { return RECORDID() || ''; } catch (e) { return ''; }
}

// data_name -> its companion date field.
var MILESTONES = [
  ['construction_complete',             'construction_complete_date'],
  ['fiber_placement_complete',          'fiber_placement_complete_date'],
  ['splicing_complete',                 'splicing_complete_date'],
  ['testing_complete',                  'testing_complete_date'],
  ['restoration_complete',              'restoration_complete_date'],
  ['qa_complete',                       'qa_complete_date'],
  ['as_builts_complete',                'as_builts_complete_date'],
  ['material_reconciliation_complete',  'material_reconciliation_complete_date'],
  ['contractor_production_approved',    'contractor_production_approved_date'],
  ['final_billing_complete',            'final_billing_complete_date'],
  ['closeout_documents_received',       'closeout_documents_received_date'],
];

var MILESTONE_LABELS = {
  construction_complete:            'Construction Complete',
  fiber_placement_complete:         'Fiber Placement Complete',
  splicing_complete:                'Splicing Complete',
  testing_complete:                 'Testing Complete',
  restoration_complete:             'Restoration Complete',
  qa_complete:                      'QA Complete',
  as_builts_complete:               'As-Builts Complete',
  material_reconciliation_complete: 'Material Reconciliation Complete',
  contractor_production_approved:   'Contractor Production Approved',
  final_billing_complete:           'Final Billing Complete',
  closeout_documents_received:      'Closeout Documents Received'
};

// VALUE() rather than a $field identifier: the list above is data, and reading
// it any other way would mean eleven near-identical handlers.
function milestoneDone(dataName) {
  return choiceValue(VALUE(dataName)) === 'yes';
}

function outstandingMilestones() {
  var out = [];
  for (var i = 0; i < MILESTONES.length; i++) {
    if (!milestoneDone(MILESTONES[i][0])) out.push(MILESTONE_LABELS[MILESTONES[i][0]]);
  }
  return out;
}

// Stamp the date when a milestone is set, clear it when it is unset. An
// un-ticked milestone that keeps its completion date is how a closeout record
// comes to assert two different things at once.
function stampMilestone(flagName, dateName) {
  if (milestoneDone(flagName)) {
    if (isBlank(VALUE(dateName))) SETVALUE(dateName, new Date().toISOString());
  } else {
    SETVALUE(dateName, null);
  }
}

for (var mi = 0; mi < MILESTONES.length; mi++) {
  (function (flagName, dateName) {
    ON('change', flagName, function (event) { stampMilestone(flagName, dateName); });
  })(MILESTONES[mi][0], MILESTONES[mi][1]);
}

ON('change', 'readiness_reviewed', function (event) {
  if (choiceValue($readiness_reviewed) === 'yes') {
    if (isBlank($readiness_reviewed_date)) {
      SETVALUE('readiness_reviewed_date', new Date().toISOString());
      SETVALUE('readiness_reviewed_by', userFullName());
    }
  } else {
    SETVALUE('readiness_reviewed_date', null);
    SETVALUE('readiness_reviewed_by', null);
  }
});

ON('change', 'closeout_override', function (event) {
  if (choiceValue($closeout_override) === 'yes') {
    if (isBlank($override_date)) {
      SETVALUE('override_date', new Date().toISOString());
      SETVALUE('override_by', userFullName());
    }
  } else {
    SETVALUE('override_date', null);
    SETVALUE('override_by', null);
  }
  applyState();
});

function applyState() {
  var overriding = choiceValue($closeout_override) === 'yes';
  // The reason IS the override. Without one it is a silent close.
  SETREQUIRED('override_reason', overriding);
  SETREQUIRED('reopen_reason', recordStatus() === 'REOPENED');
}

ON('load-record', applyState);
ON('edit-record', applyState);

ON('change-status', function (event) {
  var s = recordStatus();
  var now = new Date().toISOString();
  if (s === 'CLOSED') {
    SETVALUE('closed_by', userFullName());
    SETVALUE('closed_date', now);
  } else if (s === 'REOPENED') {
    // A reopened project is not a closed one. Clearing the stamp keeps every
    // report that reads it honest.
    SETVALUE('closed_by', null);
    SETVALUE('closed_date', null);
  }
  applyState();
});

function assignCloseoutId() {
  if (!isBlank($closeout_id)) return;
  var rid = recordId();
  var suffix = rid
    ? String(rid).replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase()
    : String(Date.now()).slice(-8);
  SETVALUE('closeout_id', 'CLO-' + new Date().getFullYear() + '-' + suffix);
}

ON('validate-record', function (event) {
  assignCloseoutId();
  applyState();

  var overriding = choiceValue($closeout_override) === 'yes';
  if (overriding && isBlank($override_reason)) {
    INVALID('An override with no reason is a silent close. State why this ' +
            'project is being closed with items outstanding.');
    return;
  }

  if (recordStatus() !== 'CLOSED') return;

  // ---- everything below applies only to closing ----

  if (choiceValue($readiness_reviewed) !== 'yes') {
    INVALID('Run reports/closeout-readiness.sql for this project and mark the ' +
            'readiness report reviewed before closing. It is the only thing ' +
            'that can see unapproved production, failed QA, open corrections, ' +
            'remaining scope, material discrepancies, unresolved change orders ' +
            'and missing test results - none of which this record can check.');
    return;
  }

  var missing = outstandingMilestones();
  if (missing.length && !overriding) {
    INVALID('Cannot close: ' + missing.length + ' milestone(s) outstanding - ' +
            missing.join(', ') + '. Complete them, or set the closeout ' +
            'override and state why.');
    return;
  }

  // Closing over known blockers is allowed, and is exactly the case the
  // override exists for - but it must be an override, not an oversight.
  if (!isBlank($open_blockers_noted) && !overriding) {
    INVALID('The readiness review recorded open blockers: ' + $open_blockers_noted +
            '. Resolve them, or set the closeout override and state why.');
  }
});
