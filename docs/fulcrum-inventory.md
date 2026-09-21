# Fulcrum Object Inventory

Everything this project has created or modified. Development objects only —
no production object has been modified.

## Apps

| Name | ID | Purpose |
|---|---|---|
| Mainline Construction - Development | `06c36c8e-4a88-4cf3-a691-9a792f8374d2` | Sprints 1-8 production transaction app |
| MC Contractor Master - Development | `d8a368b5-1e19-4f5f-8cf9-ff8fbdd03ab4` | Sprint 2 contractor master |
| MC Project Master - Development | `5ce243d4-9ec1-4fbd-8659-7be9f632b55c` | Sprint 2 project master |
| MC Contractor Rate - Development | `a5529dd0-54fa-4b8d-b595-d0218df0ee97` | Sprint 2 pricing source of truth |
| MC Fiber Reel - Development | `728477da-5f36-48cb-b3ab-cbc8c38d077f` | Sprint 4/17 reel master; consumed/slack/remaining are NOT stored, see `reports/reel-balance.sql` |
| MC Labor-Material Mapping - Development | `38e3d7fd-ca78-4016-8018-ec955446c13f` | Sprint 5 labor -> material multipliers; `waste_factor` + `confidence` added 2026-09-21 for the import |
| MC Material Master - Development | `658143d1-edbd-430b-81bb-1b0bb1092729` | Sprint 8 stock item master |
| MC Material Transaction - Development | `ee204906-adb3-431b-a1d9-d7427a4c842c` | Sprint 8 atomic material ledger |
| MC Project Scope Line - Development | `aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b` | Sprint 9 scope baseline, one per project + labor code |
| MC Change Order - Development | `458ae172-b7b4-43b5-8917-d7a792c9e81a` | Sprint 9 scope changes, repeatable line per labor code |
| MC Structure - Development | `397b52cf-a4f0-4871-b8ea-1fdb592fe2ab` | Sprint 14 network structure master, nine types |
| MC Segment - Development | `7da87588-940a-4b9e-915d-5ec25d5c0ebc` | Sprint 14 FROM -> TO segment master, direction-normalized ID |
| MC Project Closeout - Development | `351bb1f1-9837-47c8-be5b-bb0727fe93a0` | Sprint 22 closeout: eleven milestones, readiness review, authorized override |

## Choice lists (the account had none before this project)

| Name | ID | Entries |
|---|---|---:|
| MC Labor Code | `ddccba3b-c5b6-4a38-8892-805e916afacd` | 146 |
| MC Work Category | `06cf7fc6-d939-488e-bf53-4f027b603887` | 11 |
| MC Construction Method | `5828393b-b4dc-4545-8db0-921e352c5b8c` | 14 |
| MC Unit of Measure | `8713e0c3-3b5e-40a5-9886-3e5b979b7461` | 6 |
| MC QA Status | `9674b6ec-4e8e-4243-b9a0-f2ffeaadf771` | 4 |

## Pre-existing objects reused (not modified)

| Name | ID | Used for |
|---|---|---|
| Picklist Material Items | `d72ff30a-2368-464c-ab3d-eb02c2f10e8b` | Actual material used (field picker; MC Material Master is the structured master behind it) |
| Bore Set | `ffe5b39c-fd31-44b0-aab8-ebc982c78e7e` | not yet wired |
| MST Unit | `6c35a095-a8ed-4f94-8271-2cf2b9628ceb` | not yet wired |
| Splicing Type | `ec82ac67-62e8-4c47-94cd-8291f38ad7fd` | not yet wired — see open item 4 |

## Referenced, never modified

| Name | ID |
|---|---|
| Mainline Construction (PRODUCTION, 142 records) | `148545bf-b869-454e-a2b9-44a9860f23de` |

## Where each object's definition lives in this repo

| Object | Schema | Data Events |
|---|---|---|
| Mainline Construction - Development | `fulcrum/schemas/mainline-construction-dev.elements.json` | `fulcrum/data-events/mainline-construction-dev.js` (v7.3.0, deployed 2026-09-21) |
| MC Fiber Reel - Development | `fulcrum/schemas/mc-fiber-reel-dev.elements.json` | `fulcrum/data-events/mc-fiber-reel-dev.js` (v2.0.0, deployed 2026-09-21) |
| MC Project Closeout - Development | `fulcrum/schemas/mc-project-closeout-dev.elements.json` | `fulcrum/data-events/mc-project-closeout-dev.js` (v1.0.0, deployed 2026-09-21) |
| MC Labor-Material Mapping - Development | `fulcrum/schemas/mc-labor-material-mapping-dev.elements.json` | (deployed script, not yet exported) |
| MC Material Master - Development | `fulcrum/schemas/mc-material-master-dev.elements.json` | none |
| MC Material Transaction - Development | `fulcrum/schemas/mc-material-transaction-dev.elements.json` | `fulcrum/data-events/mc-material-transaction-dev.js` (v1.0.0) |
| MC Project Scope Line - Development | `fulcrum/schemas/mc-project-scope-line-dev.elements.json` | `fulcrum/data-events/mc-project-scope-line-dev.js` (v1.0.0) |
| MC Change Order - Development | `fulcrum/schemas/mc-change-order-dev.elements.json` | `fulcrum/data-events/mc-change-order-dev.js` (v1.0.0) |
| MC Structure - Development | `fulcrum/schemas/mc-structure-dev.elements.json` | `fulcrum/data-events/mc-structure-dev.js` (v1.0.0) |
| MC Segment - Development | `fulcrum/schemas/mc-segment-dev.elements.json` | `fulcrum/data-events/mc-segment-dev.js` (v1.0.0) |

The exported scripts are the deployed text, not a paraphrase. Edit here, then
push with `forms_update`.

## RESOLVED 2026-09-21 — the `forms_update` outage cleared after ~3 days

`forms_update` returned `422 could_not_update_form: Please try again later` for
**every** form on this account from 2026-09-17 21:41Z. Eight probes over twelve
hours all failed. It cleared on its own: `MC Material Master` updated at
2026-09-21T16:35:30Z and `Mainline Construction - Development` at
2026-09-21T16:45:48Z, with no change to the payload or the procedure.

Nothing on the client side was ever at fault, and the evidence gathered during
the outage is worth keeping because it is the diagnostic path to re-walk if it
recurs:

| Probe | Result | What it ruled out |
|---|---|---|
| Production app, 132 elements, one field added | `could_not_update_form` | — |
| Same tree in the shape a GET returns | `422` on missing booleans | The GET shape is **not round-trippable**; the endpoint does parse the body |
| Production app, tree shape unchanged, one expression differs | `could_not_update_form` | Not caused by adding a field |
| **`MC Material Master`, 12 flat elements** | `could_not_update_form` | Not payload size |
| Same, re-probed at 21:50Z, 22:19Z, 00:00Z, 03:02Z | `could_not_update_form` | Not transient |
| `choice_lists_update`, 146 entries | **succeeds** | Not permissions, not the account, not the token |
| `forms_create`, four new apps incl. 7-section trees | **succeeds** | Not form writes in general |
| **`forms_validate`, the rejected payload** | **`valid: true`** | **Not the payload at all** |
| Fresh `forms_get`, then update with `removed_element_keys: []`, every key and parent path preserved | `could_not_update_form` | Not a stale-read guard, and not a deviation from the tool's prescribed update procedure |

**The lesson: `forms_validate` isolates the fault.** When it returns
`valid: true` and `forms_update` still rejects, the problem is the endpoint, not
the request. Stop editing the payload and wait.

### What deployed on 2026-09-21

One `forms_update` on `06c36c8e-4a88-4cf3-a691-9a792f8374d2`, 146 elements plus
the v7.0.0 script, clearing the whole four-sprint backlog at once:

| Sprint | Change |
|---|---|
| 8 | size-dependent conduit material quantity (`m117` expression) |
| 12 | approval gate, correction fields `m137`-`m141` |
| 13 | production fingerprints `m142`-`m144` |
| 14 | structure links `m145`-`m150` |

Plus the `MC Material Master` `pack_size` field (`t012`) and the `m021` Labor
Code description, corrected from "141 pay units" to 146.

**The call timed out client-side and had still succeeded server-side.** Verified
after the fact rather than retried: 146 elements live, `updated_at`
2026-09-21T16:45:48Z, the deployed script byte-identical to the repo copy, and
the full element tree matching `fulcrum/schemas/mainline-construction-dev.elements.json`
on key path, type, data_name, expression, linked list/form, description, choices,
record_defaults and visible_conditions. A blind retry of a 77 KB payload would
have been the wrong move.

All three defects that were live during the outage are now closed: 2" and 4"
multi-pull conduit material reads pull count x footage, a CRITICAL exception
blocks approval, and fingerprints exist so `duplicate-production.sql` sections 1
and 2 return rows.

## The Data Events runtime is NOT the expression runtime (found 2026-09-21)

They share a function catalogue in the docs and do not share one at runtime,
and the web record editor exposes fewer globals than the mobile app.

| Function | Expression (CalculatedField) | Data Events (web editor) |
|---|---|---|
| `USERFULLNAME()` | yes | **yes** — it is the `new-record` example in Fulcrum's own reference |
| `USEREMAIL()` | yes | **NO** — `ReferenceError: USEREMAIL is not defined` |

`USEREMAIL` is listed under the expression `context` category and is absent
from every Data Events category. The two functions look interchangeable, sit on
adjacent lines in the obvious implementation, and only one of them works.

**A ReferenceError in a Data Event is not contained to its handler.** It
escapes `Runtime.trigger` and the expressions proxy's `onMessage`, so the host
never receives the reply carrying that event's queued `SETVALUE` mutations —
they are computed and then dropped. A crash in `ON('new-record')` therefore
also stopped unrelated dropdown-derived fields from appearing until devtools
forced a re-render. **One missing global presents as two unrelated bugs.**

Rules that follow:

- **Never call a platform accessor bare.** `typeof X !== 'function'` is the only
  safe test — reading an undeclared identifier throws, `typeof` on one does not.
  `fulcrum/data-events/mainline-construction-dev.js` routes `USERFULLNAME`,
  `USEREMAIL`, `RECORDID` and `STATUS` through guards.
- **Never let the test harness be more capable than the device.**
  `tests/harness.js` stubbed every global unconditionally, so 573 tests passed
  over a script that crashed on open. It now takes `omitGlobals`, and
  `tests/runtime-globals.test.js` runs the shipped script with those globals
  deleted.
- **`USEREMAIL()` did not resolve in a CalculatedField either.** Moving
  `inspector_email` to `ONCE(IFERROR(USEREMAIL(), ''))` deployed cleanly and
  still rendered blank, so on this account the function is effectively
  unavailable in both runtimes. The field was removed (`m151`, 2026-09-21).
- **Creator identity is platform metadata, not a field.** Every record carries
  `_created_by_id` and `_updated_by_id`, both joinable to `memberships.user_id`
  for `name`, `email` and `role_name`. Reports read it from there; the app
  stores no copy, which would duplicate it and go stale. `inspector` remains as
  a display convenience only — the one identity a field user can read without
  running SQL. See `reports/_conventions.md` section 5.

## Query API conventions (confirmed 2026-09-17 from real table definitions)

- **Tables are named by FORM ID, not by form name.** `FROM "06c36c8e-..."`, not
  `FROM "Mainline Construction - Development"`. Put the ID-to-name mapping in a
  header comment so the SQL stays readable.
- **The record status column is `_status`, not `status`.** Its values are the
  status field's `value` strings.
- A repeatable is its own table, `"<form_id>/<repeatable_data_name>"`, joined to
  the parent on `_parent_id`. It carries **no status of its own** — filtering a
  repeatable by the parent's status requires the join.
- Photo fields expose `<data_name>_captions`, not the media. A signature exposes
  a hash plus `<data_name>_timestamp`, useful only for "was one captured".
- `reports/sequential-overlap.sql` had both the table-name and the `status`
  mistake and would not have run. Corrected in Sprint 9.

## Fulcrum API gotchas found the hard way

- Every element needs explicit `required` / `disabled` / `hidden` booleans, or
  the API returns a bare 422 — and a large payload returns an opaque **500**.
- `YesNoField` additionally needs `neutral_enabled` plus `positive` / `negative`
  objects, and **rejects `default_value` when those are supplied**.
- `forms_update` and `choice_lists_update` **blank the name** unless `name` is
  resent with every call.
- A large `forms_update` can exceed the MCP client timeout while still
  succeeding server-side. **Confirmed 2026-09-21:** the 146-element v7.0.0
  deploy returned a client timeout and had already applied. Always read the
  form back before retrying — a blind retry of a 77 KB payload is expensive and
  can double-apply.
- `CalculatedField` `display.style` must be one of `text`, `number`, `date`,
  `currency`. `string` is rejected.
- The MCP server exposes **no record-creation tool**, so master data must be
  imported through the Fulcrum UI or the Records API.
- **A field's type cannot be changed after creation.** Converting a ChoiceField
  to a RecordLinkField requires a new key; the old field is dropped.
- Deleting fields and adding new ones in the *same* `forms_update` can return an
  opaque `could_not_update_form: Please try again later`. Between 2026-09-17 and
  2026-09-21 that error was returned for *every* update regardless of payload —
  see the resolved outage note above. Before concluding a payload is at fault,
  probe with a tiny form and run `forms_validate`.
- **A form GET's element shape cannot be sent straight back.** The API omits
  `required` / `disabled` / `hidden` on read but demands them on write, and omits
  `neutral_enabled` / `positive` / `negative` on `YesNoField` for the same reason.
  Round-tripping a GET produces hundreds of validation errors.
- **`elements` is mandatory on every `forms_update`.** The tool documents `script`
  as independently updatable, but omitting `elements` returns
  `422 elements: must not be empty`, so there is no cheap script-only deploy.
- **Large `forms_update` calls fail where the identical payload succeeds as a
  `forms_create`.** Adding ~34 fields and two sections at once failed twice with
  `could_not_update_form`, while the same element tree created cleanly in a
  probe form and then as a fresh form. On a dev app with no records, delete and
  recreate rather than fighting the update path. The form ID changes, so keep it
  in one place (this file) rather than scattered through docs.
