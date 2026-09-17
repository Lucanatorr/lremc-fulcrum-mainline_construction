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
| MC Fiber Reel - Development | `728477da-5f36-48cb-b3ab-cbc8c38d077f` | Sprint 4/17 reel master |
| MC Labor-Material Mapping - Development | `38e3d7fd-ca78-4016-8018-ec955446c13f` | Sprint 5 labor -> material multipliers |
| MC Material Master - Development | `658143d1-edbd-430b-81bb-1b0bb1092729` | Sprint 8 stock item master |
| MC Material Transaction - Development | `ee204906-adb3-431b-a1d9-d7427a4c842c` | Sprint 8 atomic material ledger |
| MC Project Scope Line - Development | `aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b` | Sprint 9 scope baseline, one per project + labor code |
| MC Change Order - Development | `458ae172-b7b4-43b5-8917-d7a792c9e81a` | Sprint 9 scope changes, repeatable line per labor code |
| MC Structure - Development | `397b52cf-a4f0-4871-b8ea-1fdb592fe2ab` | Sprint 14 network structure master, nine types |
| MC Segment - Development | `7da87588-940a-4b9e-915d-5ec25d5c0ebc` | Sprint 14 FROM -> TO segment master, direction-normalized ID |

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
| Mainline Construction - Development | `fulcrum/schemas/mainline-construction-dev.elements.json` | `fulcrum/data-events/mainline-construction-dev.js` (v7.0.0, **pending deploy**) |
| MC Material Master - Development | `fulcrum/schemas/mc-material-master-dev.elements.json` | none |
| MC Material Transaction - Development | `fulcrum/schemas/mc-material-transaction-dev.elements.json` | `fulcrum/data-events/mc-material-transaction-dev.js` (v1.0.0) |
| MC Project Scope Line - Development | `fulcrum/schemas/mc-project-scope-line-dev.elements.json` | `fulcrum/data-events/mc-project-scope-line-dev.js` (v1.0.0) |
| MC Change Order - Development | `fulcrum/schemas/mc-change-order-dev.elements.json` | `fulcrum/data-events/mc-change-order-dev.js` (v1.0.0) |
| MC Structure - Development | `fulcrum/schemas/mc-structure-dev.elements.json` | `fulcrum/data-events/mc-structure-dev.js` (v1.0.0) |
| MC Segment - Development | `fulcrum/schemas/mc-segment-dev.elements.json` | `fulcrum/data-events/mc-segment-dev.js` (v1.0.0) |

The exported scripts are the deployed text, not a paraphrase. Edit here, then
push with `forms_update`.

## OUTAGE 2026-09-17 — `forms_update` is rejecting every form

`forms_update` returns `422 could_not_update_form: Please try again later` for
**every** form on this account. Established by four attempts:

| Attempt | Payload | Result |
|---|---|---|
| Production app, added one field + changed an expression | 132 elements | `could_not_update_form` |
| Production app, same tree with the stored element shapes | 132 elements | `422` on missing booleans — the GET shape is **not round-trippable** |
| Production app, tree shape unchanged, one expression differs | 132 elements | `could_not_update_form` |
| **MC Material Master**, 12 flat elements | tiny | `could_not_update_form` |

`choice_lists_update` succeeds throughout, so this is neither permissions nor
payload shape. A script-only update is not a way round it: `elements` is
mandatory (`422 elements: must not be empty`) even though the tool documents it
as optional.

`forms_create` is UNAFFECTED — both Sprint 9 apps were created during the
outage. So new apps can be built; only changes to existing ones are blocked.

**Do not recreate the form as a workaround while this persists.**
`MC Material Transaction` holds a RecordLink to the production form's ID, and
repointing it requires the same broken endpoint — a recreate would leave a
dangling link with no way to fix it.

Pending deployment when the endpoint recovers — the production app payload is
now **146 elements**, which is a larger single deploy than anyone would choose
and is the direct cost of the outage:

| Sprint | Pending change |
|---|---|
| 8 | size-dependent conduit material quantity (`m117` expression) |
| 12 | approval gate, correction fields `m137`-`m141` |
| 13 | production fingerprints `m142`-`m144` |
| 14 | structure links `m145`-`m150` |

Plus the `MC Material Master` `pack_size` field (`t012`).
Re-probed 2026-09-17 **22:19Z** on a twelve-element form: still failing.

**The reports are unaffected.** Every Sprint 10-12 deliverable is SQL run
through the Query API against whatever is deployed, so the outage delays the
app-side approval gate only.

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
  succeeding server-side. Verify before retrying.
- `CalculatedField` `display.style` must be one of `text`, `number`, `date`,
  `currency`. `string` is rejected.
- The MCP server exposes **no record-creation tool**, so master data must be
  imported through the Fulcrum UI or the Records API.
- **A field's type cannot be changed after creation.** Converting a ChoiceField
  to a RecordLinkField requires a new key; the old field is dropped.
- Deleting fields and adding new ones in the *same* `forms_update` can return an
  opaque `could_not_update_form: Please try again later`. As of 2026-09-17 that
  error is returned for *every* update regardless of payload — see the outage
  note above. Before concluding a payload is at fault, probe with a tiny form.
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
