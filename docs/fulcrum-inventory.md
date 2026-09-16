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

## Choice lists (the account had none before this project)

| Name | ID | Entries |
|---|---|---:|
| MC Labor Code | `ddccba3b-c5b6-4a38-8892-805e916afacd` | 143 |
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
| Mainline Construction - Development | `fulcrum/schemas/mainline-construction-dev.elements.json` | `fulcrum/data-events/mainline-construction-dev.js` (v4.0.0) |
| MC Material Master - Development | `fulcrum/schemas/mc-material-master-dev.elements.json` | none |
| MC Material Transaction - Development | `fulcrum/schemas/mc-material-transaction-dev.elements.json` | `fulcrum/data-events/mc-material-transaction-dev.js` (v1.0.0) |

The exported scripts are the deployed text, not a paraphrase. Edit here, then
push with `forms_update`.

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
  opaque `could_not_update_form: Please try again later`.
- **Large `forms_update` calls fail where the identical payload succeeds as a
  `forms_create`.** Adding ~34 fields and two sections at once failed twice with
  `could_not_update_form`, while the same element tree created cleanly in a
  probe form and then as a fresh form. On a dev app with no records, delete and
  recreate rather than fighting the update path. The form ID changes, so keep it
  in one place (this file) rather than scattered through docs.
