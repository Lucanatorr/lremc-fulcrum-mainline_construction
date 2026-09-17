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

function load(scriptName) {
  const file = path.join(__dirname, '..', 'fulcrum', 'data-events', scriptName);
  const src = fs.readFileSync(file, 'utf8');

  const record = {};
  const writes = [];
  const invalids = [];
  const handlers = {};
  let status = 'DRAFT';

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
  globalThis.RECORDID = () => record.__record_id || '';
  globalThis.USERFULLNAME = () => record.__user || 'Test User';
  globalThis.USEREMAIL = () => record.__email || 'test@example.com';
  globalThis.STATUS = () => status;
  globalThis.LATITUDE = () => record.__lat || null;
  globalThis.LONGITUDE = () => record.__lon || null;
  globalThis.ACCURACY = () => record.__acc || null;

  // Indirect eval so the script's function declarations land in global scope
  // and can be reached by name, exactly as Fulcrum's own runtime reaches them.
  (0, eval)(src);

  return {
    record,
    writes,
    invalids,
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
