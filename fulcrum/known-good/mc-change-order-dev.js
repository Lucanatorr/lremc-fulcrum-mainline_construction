/**
 * MC Change Order - Development
 * Data Events - SPRINT 9 v1.0.0 (2026-09-17)
 *
 * ONLY AN APPROVED CHANGE ORDER MOVES THE AUTHORIZED SCOPE (test 23.21).
 * Draft, Submitted, Rejected and Cancelled orders are captured in full and
 * excluded from every authorized-scope figure. That exclusion is enforced in
 * reports/project-scope-status.sql, not here: a device-side filter would be
 * invisible to the reports that actually pay people.
 *
 * The baseline on MC Project Scope Line is never touched, so
 *   Original Scope + Approved Changes = Current Authorized Scope
 * stays reconstructable, and as at any past date via Date Approved.
 *
 * Lines are signed deltas, never revised absolute quantities. A delta can be
 * replayed against the baseline; an absolute figure loses the history.
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

function isApproved() { return STATUS() === 'APPROVED'; }
function isDead() {
  var s = STATUS();
  return s === 'REJECTED' || s === 'CANCELLED';
}

// ==================== line derivation ====================
// The unit of measure is carried in the pay-unit choice label, as everywhere
// else in this system. Parsed on the line, not restated by the user.

// RULING 2026-09-22 - THE UNIT COMES FROM THE RATE, NOT FROM A LABEL
// This parsed the unit out of the labor code's choice LABEL. The Data Events
// runtime exposes no labels -- a ChoiceField arrives as
// { choice_values, other_values } -- so choiceLabel() returns the VALUE, which
// carries no "(FT)" marker, the parse always missed, and this then cleared the
// unit outright. Same defect as the production app, found live there on
// PRD-2026-143C1840. The unit is copied from the linked rate instead; what is
// left here is a guard that only ever FILLS a blank unit, never clears one.
ON('change', 'line_labor_code', function (event) {
  if (!isBlank(choiceValue($line_unit))) return;     // never overwrite

  var label = choiceLabel($line_labor_code);
  if (isBlank(label)) return;

  var m = /^(.*?)\s*\((FT|EA|HR|SPLICE|SF|EVENT)\)\s*(.*)$/.exec(label);
  if (!m) return;                                    // never clear it

  setIfChanged('line_unit', choiceValue($line_unit), m[2]);
});

ON('validate-repeatable', 'quantity_changes', function (event) {
  var delta = toNum($line_quantity_change);
  if (delta === null) {
    INVALID('Quantity change must be a number.');
    return;
  }
  // Zero is not a change. A line that changes nothing only dilutes the order.
  if (delta === 0) {
    INVALID('Quantity change is zero - that is not a change. Remove the line, ' +
            'or enter the signed delta: positive to add scope, negative to remove it.');
    return;
  }
  var rate = toNum($line_rate);
  if (rate !== null && rate < 0) {
    INVALID('Rate cannot be negative. To remove scope, make the QUANTITY ' +
            'negative and leave the rate positive.');
  }
});

// ==================== approval lifecycle ====================

function applyApprovalLock() {
  var frozen = isApproved() || isDead();
  // An approved order is a contract document. Its lines are what the authorized
  // scope is computed from, so editing them afterwards would silently restate
  // history - a superseding change order is the way to correct one.
  SETREADONLY('quantity_changes', frozen);
  SETREADONLY('project_link', frozen);
  SETREADONLY('change_order_number', frozen);
  SETREQUIRED('rejection_reason', isDead());
}

ON('load-record', applyApprovalLock);
ON('edit-record', applyApprovalLock);

ON('new-record', function (event) {
  SETVALUE('submitted_by', USERFULLNAME());
});

ON('change-status', function (event) {
  var s = STATUS();
  var now = new Date().toISOString();

  if (s === 'SUBMITTED' && isBlank($date_submitted)) {
    SETVALUE('date_submitted', now);
    SETVALUE('submitted_by', USERFULLNAME());
  } else if (s === 'APPROVED') {
    if (isBlank($date_submitted)) SETVALUE('date_submitted', now);
    SETVALUE('date_approved', now);
    SETVALUE('approved_by', USERFULLNAME());
  } else if (isDead()) {
    // A rejected order must not keep an approval stamp: the stamp is what the
    // reports read to decide the order moved the scope.
    SETVALUE('date_approved', null);
    SETVALUE('approved_by', null);
  }
  applyApprovalLock();
});

// ==================== validation ====================

function buildExceptions() {
  var ex = [];
  var sev = 'INFO';
  function flag(level, msg) {
    ex.push('[' + level + '] ' + msg);
    if (level === 'CRITICAL') sev = 'CRITICAL';
    else if (level === 'WARNING' && sev !== 'CRITICAL') sev = 'WARNING';
  }

  var lines = toNum($line_count);
  if (lines === null || lines === 0) {
    flag('CRITICAL', 'No quantity change lines - this order changes no scope. ' +
                     'A change order with no lines cannot be priced or applied');
  }

  var value = toNum($change_order_value);
  if (lines && value === 0) {
    flag('WARNING', 'Change order value is zero. That is legitimate for a ' +
                    'quantity reconciliation where adds and removes cancel out, ' +
                    'but check the rates are filled in');
  }

  if (isApproved()) {
    if (isBlank($date_approved)) {
      flag('CRITICAL', 'Approved with no approval date - reports use that date to ' +
                       'reconstruct the authorized scope as at a point in time');
    }
    if (isBlank($attachments)) {
      flag('WARNING', 'Approved with no attachment - the signed order should be ' +
                      'on the record');
    }
    if (isBlank($approval_signature)) {
      flag('INFO', 'No approval signature captured');
    }
  }

  if (isDead() && isBlank($rejection_reason)) {
    flag('CRITICAL', 'Rejected or cancelled with no reason given');
  }

  if (isBlank($project_id_snap)) {
    flag('CRITICAL', 'No project - the change cannot be applied to any scope');
  }

  var submitted = isBlank($date_submitted) ? null : new Date($date_submitted);
  var approved  = isBlank($date_approved)  ? null : new Date($date_approved);
  if (submitted && approved && approved.getTime() < submitted.getTime()) {
    flag('WARNING', 'Approval date precedes the submission date');
  }

  setIfChanged('exception_flags', $exception_flags, ex.length ? ex.join(' | ') : null);
  setIfChanged('exception_severity', choiceValue($exception_severity), ex.length ? sev : null);
}

function assignRecordId() {
  if (!isBlank($change_order_record_id)) return;
  var rid = '';
  try { rid = RECORDID() || ''; } catch (e) { rid = ''; }
  var suffix = rid
    ? String(rid).replace(/[^A-Za-z0-9]/g, '').slice(-8).toUpperCase()
    : String(Date.now()).slice(-8);
  SETVALUE('change_order_record_id', 'CO-' + new Date().getFullYear() + '-' + suffix);
}

ON('validate-record', function (event) {
  assignRecordId();
  buildExceptions();

  // Approving an order with nothing to apply would move the authorized scope by
  // an undefined amount, so this one blocks rather than warns.
  if (isApproved() && (toNum($line_count) || 0) === 0) {
    INVALID('An approved change order must have at least one quantity change line.');
  }
  if (isDead() && isBlank($rejection_reason)) {
    INVALID('State why this change order was rejected or cancelled.');
  }
});
