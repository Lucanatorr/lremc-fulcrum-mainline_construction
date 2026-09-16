# Fulcrum Object Inventory

Everything this project has created or modified. Development objects only —
no production object has been modified.

## Apps

| Name | ID | Purpose |
|---|---|---|
| Mainline Construction - Development | `61e3f7b6-f703-4f43-9602-51afb7b7843d` | Sprint 1 production transaction app |

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
| Picklist Material Items | `d72ff30a-2368-464c-ab3d-eb02c2f10e8b` | Actual material used |
| Bore Set | `ffe5b39c-fd31-44b0-aab8-ebc982c78e7e` | not yet wired |
| MST Unit | `6c35a095-a8ed-4f94-8271-2cf2b9628ceb` | not yet wired |
| Splicing Type | `ec82ac67-62e8-4c47-94cd-8291f38ad7fd` | not yet wired — see open item 4 |

## Referenced, never modified

| Name | ID |
|---|---|
| Mainline Construction (PRODUCTION, 142 records) | `148545bf-b869-454e-a2b9-44a9860f23de` |

## Fulcrum API gotchas found the hard way

- Every element needs explicit `required` / `disabled` / `hidden` booleans, or
  the API returns a bare 422 — and a large payload returns an opaque **500**.
- `YesNoField` additionally needs `neutral_enabled` plus `positive` / `negative`
  objects, and **rejects `default_value` when those are supplied**.
- `forms_update` and `choice_lists_update` **blank the name** unless `name` is
  resent with every call.
- A large `forms_update` can exceed the MCP client timeout while still
  succeeding server-side. Verify before retrying.
