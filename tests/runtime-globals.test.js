/**
 * Runtime-global safety.
 *
 * WHY THIS SUITE EXISTS
 * On 2026-09-21 the deployed app threw, in the Chrome record editor:
 *
 *   Uncaught ReferenceError: USEREMAIL is not defined
 *     at Runtime.eval (<anonymous>:278:3)
 *     at Runtime.trigger ... at e.onMessage (expressions-proxy.js)
 *
 * Line 278 was `SETVALUE('inspector_email', USEREMAIL())` inside
 * ON('new-record'). USERFULLNAME() on line 277 worked: USEREMAIL is an
 * EXPRESSION function and is not in the Data Events runtime in the web editor.
 *
 * Every other suite passed throughout, because tests/harness.js stubbed every
 * platform global unconditionally. A test environment more capable than the
 * real one cannot find a missing-global bug. So these tests run the shipped
 * script with those globals DELETED and assert no handler throws.
 *
 * The blast radius is the point. The ReferenceError escaped the handler,
 * Runtime.trigger and the proxy's onMessage, so the host never received the
 * reply carrying that event's queued SETVALUEs - which is why dropdown
 * selections also stopped populating until devtools forced a re-render.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { load } = require('./harness');

let pass = 0, fail = 0;
function check(id, name, actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    console.log(`PASS  ${id} ${name}`);
    pass++;
  } catch (e) {
    console.log(`FAIL  ${id} ${name}\n      expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
    fail++;
  }
}
function noThrow(id, name, fn) {
  try {
    fn();
    console.log(`PASS  ${id} ${name}`);
    pass++;
  } catch (e) {
    console.log(`FAIL  ${id} ${name}\n      threw ${e && e.name}: ${e && e.message}`);
    fail++;
  }
}

const SCRIPT = 'mainline-construction-dev.js';
const src = fs.readFileSync(
  path.join(__dirname, '..', 'fulcrum', 'data-events', SCRIPT), 'utf8');

// ---- 1. the shipped source must not call a platform accessor bare ----------
// A guard body is `typeof X !== 'function'` followed by the only legal call.
// Anything else calling X() directly is the bug this suite exists for.
const ACCESSORS = ['USEREMAIL', 'USERFULLNAME', 'RECORDID', 'STATUS'];
const codeLines = src
  .split('\n')
  .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l));

for (const name of ACCESSORS) {
  const bare = codeLines.filter((l) => {
    if (!new RegExp(`\\b${name}\\s*\\(`).test(l)) return false;
    // legal: inside the guard function, immediately after its typeof test
    return !new RegExp(`return ${name}\\(\\);`).test(l);
  });
  check(`TEST-GLOBAL-${name}`, `${name}() is never called bare`, bare, []);
  check(
    `TEST-GUARD-${name}`,
    `${name} has a typeof guard`,
    new RegExp(`typeof ${name} !== 'function'`).test(src),
    true
  );
}

// ---- 2. the script must load and run with those globals absent ------------
// omitGlobals DELETES them, so a bare read throws ReferenceError exactly as on
// a device. USERFULLNAME is kept: the web editor does expose it, and this
// mirrors the real asymmetry rather than an imagined one.
noThrow('TEST-RT-001', 'script loads with USEREMAIL absent', () => {
  load(SCRIPT, { omitGlobals: ['USEREMAIL'] });
});

const webish = load(SCRIPT, { omitGlobals: ['USEREMAIL'] });

noThrow('TEST-RT-002', 'new-record survives a missing USEREMAIL', () => {
  webish.reset().fire('new-record');
});
check('TEST-RT-003', 'inspector is still captured', webish.get('inspector'), 'Test User');
check(
  'TEST-RT-004',
  'inspector_email is NOT written by the script (m151 owns it)',
  webish.writes.filter((w) => w[0] === 'inspector_email'),
  []
);

noThrow('TEST-RT-005', 'validate-record survives a missing USEREMAIL', () => {
  webish.reset({ work_date: '2026-09-21', quantity: 10 }).fire('validate-record');
});
check(
  'TEST-RT-006',
  'a production ID is still assigned without USEREMAIL',
  /^PRD-2026-/.test(String(webish.get('production_id'))),
  true
);

// ---- 3. the worst case: every context accessor missing ---------------------
const bare = load(SCRIPT, {
  omitGlobals: ['USEREMAIL', 'USERFULLNAME', 'RECORDID', 'STATUS'],
});
for (const ev of ['new-record', 'load-record', 'edit-record', 'validate-record']) {
  noThrow(`TEST-RT-BARE-${ev}`, `${ev} survives every accessor missing`, () => {
    bare.reset({ work_date: '2026-09-21', quantity: 10 }).fire(ev);
  });
}
noThrow('TEST-RT-BARE-change', 'a dropdown change survives every accessor missing', () => {
  bare.reset({ labor_code: 'BM60(3)(1.25) P', quantity: 100 }).fire('change:labor_code');
});
check(
  'TEST-RT-BARE-derives',
  'and still derives the conduit package',
  [bare.get('pull_count'), bare.get('conduit_diameter'), bare.get('conduit_material_code')],
  [3, '1.25', 'CONDUIT-1.25-3PULL']
);

// ---- 4. guards return '' rather than throwing or leaking undefined --------
check('TEST-RT-007', 'userEmail() returns empty string when absent', bare.fn('userEmail')(), '');
check('TEST-RT-008', 'userFullName() returns empty string when absent', bare.fn('userFullName')(), '');
check('TEST-RT-009', 'recordId() returns empty string when absent', bare.fn('recordId')(), '');
check('TEST-RT-010', 'recordStatus() returns empty string when absent', bare.fn('recordStatus')(), '');

// ---- 5. the approval gate must not block when STATUS is unavailable -------
// Fail-open is deliberate: the gate cannot know the status, and blocking every
// save would lose field work. Section 3 of the QA reports still catches it.
noThrow('TEST-RT-011', 'the approval gate is inert, not fatal, without STATUS', () => {
  bare.reset({ exception_severity: 'CRITICAL' });
  bare.fn('enforceApprovalGate')();
});
check('TEST-RT-012', 'and raises no INVALID', bare.invalids, []);

// ---- 6. the fix is documented in the header --------------------------------
// The version number itself is asserted once, in fingerprint.test.js, against
// the newest CHANGE IN block. Repeating a literal here would mean two edits per
// bump and a suite that fails for a reason it does not own.
check('TEST-RT-VER', 'the header documents the USEREMAIL fix',
      /CHANGE IN v7\.1\.0 - FIX: BARE USEREMAIL/.test(src), true);
// inspector_email is gone entirely: USEREMAIL reached neither runtime, and
// _created_by_id already carries the answer. Assert the script does not write
// the field and does not claim a field that no longer exists.
check('TEST-RT-EMAIL-1', 'the script never writes inspector_email',
      /SETVALUE\(\s*'inspector_email'/.test(src), false);
check('TEST-RT-EMAIL-2', 'and no longer references the removed m151 field',
      /m151/.test(src), false);
check('TEST-RT-EMAIL-3', 'creator identity is documented as _created_by_id',
      /_created_by_id/.test(src), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
