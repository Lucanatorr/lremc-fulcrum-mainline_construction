/**
 * MC Project Scope Line - Development
 * Data Events - SPRINT 9 v1.0.0 (2026-09-17)
 *
 * THE BASELINE IS IMMUTABLE. Original Planned Quantity is editable only while
 * the line is DRAFT; from BASELINED onwards it is locked read-only. Scope
 * changes go through MC Change Order so the original stays available for
 * comparison (Sprint 9, test 23.21).
 *
 * NOTHING IS TOTALLED HERE. Completed, Remaining, Percent Complete and Current
 * Authorized Scope are summed from approved production and approved change
 * order lines by reports/project-scope-status.sql. Storing them on this record
 * would put a stale number in front of a field user the moment the next
 * production record synced, and the brief is explicit that the underlying
 * quantities stay authoritative.
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

// The pay-unit code carries its unit of measure in the choice label, exactly as
// it does on the production app. Parsed, not restated.
function applyLaborMetadata() {
  var label = choiceLabel($labor_code);
  var m = isBlank(label)
    ? null
    : /^(.*?)\s*\((FT|EA|HR|SPLICE|SF|EVENT)\)\s*(.*)$/.exec(label);
  setIfChanged('unit', choiceValue($unit), m ? m[2] : null);
}

// Natural key. A second line with the same key would double-count the budget
// for that pay unit, which no amount of reporting could untangle afterwards.
function deriveScopeLineId() {
  var project = isBlank($project_id_snap) ? '' : String($project_id_snap).trim().toUpperCase();
  var code    = choiceValue($labor_code);
  if (!project || !code) {
    setIfChanged('scope_line_id', $scope_line_id, null);
    return;
  }
  setIfChanged('scope_line_id', $scope_line_id,
               'SCOPE-' + project + '-' + String(code).replace(/\s+/g, '').toUpperCase());
}

ON('change', 'labor_code', function (event) {
  applyLaborMetadata();
  deriveScopeLineId();
});
ON('change', 'project_link', deriveScopeLineId);

// ==================== baseline immutability ====================

function isBaselined() {
  var s = STATUS();
  return s === 'BASELINED' || s === 'CLOSED';
}

function applyBaselineLock() {
  var locked = isBaselined();
  SETREADONLY('original_planned_quantity', locked);
  SETREADONLY('rate_link', locked);
  SETDESCRIPTION('original_planned_quantity', locked
    ? 'LOCKED. This line is baselined. Raise a change order to alter the scope - '
      + 'the original planned quantity must stay available for comparison.'
    : 'THE BASELINE. Editable while this line is DRAFT. Once baselined it locks, '
      + 'and scope changes go through a change order.');
}

ON('load-record', applyBaselineLock);
ON('edit-record', applyBaselineLock);

ON('change-status', function (event) {
  applyBaselineLock();
  if (isBaselined() && isBlank($baseline_set_date)) {
    SETVALUE('baseline_set_date', new Date().toISOString());
    SETVALUE('baseline_set_by', USERFULLNAME());
  }
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

  var qty = toNum($original_planned_quantity);
  if (qty === null) {
    flag('CRITICAL', 'Planned quantity is not a number - this line cannot be budgeted');
  } else if (qty === 0) {
    flag('WARNING', 'Planned quantity is zero - a scope line with no planned work ' +
                    'budgets nothing. Deactivate the line instead if it is not in scope');
  }

  if (isBlank($rate_source_id)) {
    flag('CRITICAL', 'No budget rate linked - this scope line has no budget value');
  } else if (toNum($budget_rate) === 0) {
    flag('CRITICAL', 'Budget rate is zero - the budget value would be zero');
  }

  // A budget priced off the wrong pay unit is the scope equivalent of a
  // mispriced production record, so it carries the same severity.
  var myCode   = choiceValue($labor_code);
  var rateCode = choiceValue($rate_labor_code_snap);
  if (myCode && rateCode && myCode !== rateCode) {
    flag('CRITICAL', 'Budget rate prices labor code ' + rateCode +
                     ' but this scope line is for ' + myCode);
  }

  var myProject   = isBlank($project_id_snap) ? '' : String($project_id_snap).trim();
  var rateProject = isBlank($rate_project_id_snap) ? '' : String($rate_project_id_snap).trim();
  if (rateProject && myProject && rateProject !== myProject) {
    flag('CRITICAL', 'Budget rate is specific to project ' + rateProject +
                     ' but this scope line is for ' + myProject);
  }

  var start = isBlank($planned_start) ? null : new Date($planned_start);
  var finish = isBlank($planned_finish) ? null : new Date($planned_finish);
  if (start && finish && finish.getTime() < start.getTime()) {
    flag('WARNING', 'Planned finish is before planned start');
  }

  if (isBlank($scope_line_id)) {
    flag('INFO', 'Scope line ID cannot be derived until both Project and Labor Code are set');
  }

  setIfChanged('exception_flags', $exception_flags, ex.length ? ex.join(' | ') : null);
  setIfChanged('exception_severity', choiceValue($exception_severity), ex.length ? sev : null);
}

ON('validate-record', function (event) {
  applyLaborMetadata();
  deriveScopeLineId();
  buildExceptions();

  // A negative baseline is not a descope - a descope is a change order. Letting
  // one through would make Current Authorized Scope arithmetic meaningless.
  var qty = toNum($original_planned_quantity);
  if (qty !== null && qty < 0) {
    INVALID('Planned quantity cannot be negative. To reduce scope, raise a ' +
            'change order with a negative quantity change.');
  }
});
