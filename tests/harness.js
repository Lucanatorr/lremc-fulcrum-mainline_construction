/**
 * Loads the DEPLOYED Data Events source and exposes its functions for testing.
 *
 * Earlier suites re-typed each function into the test file. That worked until
 * v5.0.0 changed the conduit multiplier and left the copies asserting the old
 * behaviour - a test suite that passes while the shipped script disagrees with
 * it is worse than no suite. This loads fulcrum/data-events/*.js directly, so
 * there is exactly one copy of every rule and the tests cannot drift from it.
 *
 * Fulcrum's runtime globals (ON, SETVALUE, $field ...) are stubbed. The $field
 * identifiers are defined as getters over a mutable record, so a handler that
 * calls SETVALUE sees its own write on the next read, as it would on a device.
 */

const fs = require('fs');
const path = require('path');

/**
 * @param scriptName  file under fulcrum/data-events/
 * @param options.omitGlobals  platform globals to leave UNDEFINED, simulating a
 *   runtime that does not expose them. The Data Events runtime and the
 *   CalculatedField expression runtime do not share a global set, and the web
 *   record editor exposes fewer than the mobile app - USEREMAIL is absent from
 *   the web editor while USERFULLNAME is present. Stubbing every global
 *   unconditionally is what let a bare USEREMAIL() ship: see
 *   tests/runtime-globals.test.js.
 */
function load(scriptName, options = {}) {
  const file = path.join(__dirname, '..', 'fulcrum', 'data-events', scriptName);
  const src = fs.readFileSync(file, 'utf8');

  const record = {};
  const writes = [];
  const invalids = [];
  const alerts = [];
  const handlers = {};
  const fields = {};
  let status = 'DRAFT';
  let statusFilter = null;

  const fieldState = (dataName) => (fields[dataName] = fields[dataName] || {});

  const names = new Set(src.match(/\$[A-Za-z_][A-Za-z0-9_]*/g) || []);
  for (const name of names) {
    const key = name.slice(1);
    Object.defineProperty(globalThis, name, {
      configurable: true,
      get: () => (key in record ? record[key] : null),
    });
  }

  globalThis.ON = (event, a, b) => {
    const fn = typeof b === 'function' ? b : a;
    const key = typeof b === 'function' ? `${event}:${a}` : event;
    (handlers[key] = handlers[key] || []).push(fn);
  };
  globalThis.SETVALUE = (dataName, value) => {
    record[dataName] = value;
    writes.push([dataName, value]);
  };
  globalThis.INVALID = (message) => { invalids.push(message); };
  // Field-state calls. Recorded rather than ignored, so a test can assert that
  // a script locked or required a field and not merely that it meant to.
  globalThis.SETREADONLY = (dataName, value) => { fieldState(dataName).readonly = !!value; };
  globalThis.SETREQUIRED = (dataName, value) => { fieldState(dataName).required = !!value; };
  globalThis.SETHIDDEN = (dataName, value) => { fieldState(dataName).hidden = !!value; };
  globalThis.SETDESCRIPTION = (dataName, value) => { fieldState(dataName).description = value; };
  globalThis.SETLABEL = (dataName, value) => { fieldState(dataName).label = value; };
  globalThis.SETCHOICES = (dataName, value) => { fieldState(dataName).choices = value; };
  globalThis.SETCHOICEFILTER = (dataName, value) => { fieldState(dataName).choiceFilter = value; };
  globalThis.SETSTATUSFILTER = (value) => { statusFilter = value; };
  globalThis.SETMINLENGTH = (dataName, value) => { fieldState(dataName).minLength = value; };
  globalThis.SETMAXLENGTH = (dataName, value) => { fieldState(dataName).maxLength = value; };
  globalThis.ALERT = (title, message) => { alerts.push([title, message]); };
  globalThis.CONFIRM = (title, message, cb) => { alerts.push([title, message]); };
  globalThis.PROGRESS = () => {};
  globalThis.VALUE = (dataName) => (dataName in record ? record[dataName] : null);
  globalThis.RECORDID = () => record.__record_id || '';
  globalThis.USERFULLNAME = () => record.__user || 'Test User';
  globalThis.USEREMAIL = () => record.__email || 'test@example.com';
  globalThis.STATUS = () => status;
  globalThis.LATITUDE = () => record.__lat || null;
  globalThis.LONGITUDE = () => record.__lon || null;
  globalThis.ACCURACY = () => record.__acc || null;

  // Simulate a runtime missing these accessors. Deleting rather than setting
  // them to undefined matters: the script must survive `typeof X`, and a bare
  // read of a deleted global throws ReferenceError exactly as it does on a
  // device.
  for (const name of options.omitGlobals || []) delete globalThis[name];

  // Indirect eval so the script's function declarations land in global scope
  // and can be reached by name, exactly as Fulcrum's own runtime reaches them.
  (0, eval)(src);

  return {
    record,
    writes,
    invalids,
    alerts,
    // Field state a script applied: {readonly, required, hidden, description, ...}
    fields,
    field: (name) => fields[name] || {},
    statusFilter: () => statusFilter,
    fn: (name) => globalThis[name],
    // Reads a field the way the script does: an unset field is null, not
    // undefined, so "derived nothing" and "derived null" assert alike.
    get: (name) => (name in record ? record[name] : null),
    set(values) {
      Object.assign(record, values);
      return this;
    },
    reset(values = {}) {
      for (const k of Object.keys(record)) delete record[k];
      Object.assign(record, values);
      writes.length = 0;
      invalids.length = 0;
      alerts.length = 0;
      for (const k of Object.keys(fields)) delete fields[k];
      statusFilter = null;
      status = 'DRAFT';
      return this;
    },
    setStatus(next) { status = next; return this; },
    fire(key) {
      for (const fn of handlers[key] || []) fn({});
      return this;
    },
    handlerCount(key) { return (handlers[key] || []).length; },
  };
}

module.exports = { load };
