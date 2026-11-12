# Field Dictionary and Field Key Dictionary

**Generated** by `scripts/field_dictionary.py` from `fulcrum/schemas/*.elements.json`.
Do not edit by hand: change the schema, deploy it, then regenerate. Handoff
sections 4 and 5.

- **Key** is Fulcrum's element key, the one `forms_update` preserves. **Never reuse
  or change a key**: the column behind it carries history.
- **data_name** is the field identifier used by Data Events (`$data_name`) and
  the **Query API column** name.
- **Table** is where the column lives: the form ID, or `<form id>/<repeatable>`
  for repeatable rows (joined to the parent on `_parent_id`).
- Every table also has Fulcrum's own columns: `_record_id`, `_status`,
  `_version`, `_created_at`, `_updated_at`, `_server_updated_at`,
  `_created_by_id`, `_updated_by_id`, `_latitude`, `_longitude`. Repeatable
  rows have `_child_record_id` and `_parent_id` too.
- Flags: required · read-only (set by a Data Event or calculation) · hidden ·
  list (a choice list) · links (a record link) · calculated.

| App | Form ID | Fields |
|---|---|---:|
| [Mainline Construction](#mainline-construction) | `06c36c8e-4a88-4cf3-a691-9a792f8374d2` | 140 |
| [MC Project Master](#mc-project-master) | `5ce243d4-9ec1-4fbd-8659-7be9f632b55c` | 19 |
| [MC Contractor Master](#mc-contractor-master) | `d8a368b5-1e19-4f5f-8cf9-ff8fbdd03ab4` | 10 |
| [MC Contractor Rate](#mc-contractor-rate) | `a5529dd0-54fa-4b8d-b595-d0218df0ee97` | 19 |
| [MC Project Scope Line](#mc-project-scope-line) | `aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b` | 22 |
| [MC Change Order](#mc-change-order) | `458ae172-b7b4-43b5-8917-d7a792c9e81a` | 28 |
| [MC Labor-Material Mapping](#mc-labor-material-mapping) | `38e3d7fd-ca78-4016-8018-ec955446c13f` | 15 |
| [MC Material Master](#mc-material-master) | `658143d1-edbd-430b-81bb-1b0bb1092729` | 12 |
| [MC Material Transaction](#mc-material-transaction) | `ee204906-adb3-431b-a1d9-d7427a4c842c` | 19 |
| [MC Fiber Reel](#mc-fiber-reel) | `728477da-5f36-48cb-b3ab-cbc8c38d077f` | 15 |
| [MC Structure](#mc-structure) | `397b52cf-a4f0-4871-b8ea-1fdb592fe2ab` | 26 |
| [MC Segment](#mc-segment) | `7da87588-940a-4b9e-915d-5ec25d5c0ebc` | 23 |
| [MC Project Closeout](#mc-project-closeout) | `351bb1f1-9837-47c8-be5b-bb0727fe93a0` | 39 |
| **Total** | | **387** |

## Mainline Construction

Form `06c36c8e-4a88-4cf3-a691-9a792f8374d2` · schema `fulcrum/schemas/mainline-construction-dev.elements.json`

| Key | data_name | Label | Type | Section | Flags | Description |
|---|---|---|---|---|---|---|
| `m001` | `production_id` | Production ID | TextField |  | read-only | System-assigned, set once on first save and never regenerated (Sprint 13 / 23.27). |
| `m079` | `project_link` | Project | RecordLinkField | PROJECT INFORMATION | required, links | Links to the Project master. ID and name are copied down and snapshotted. Carried forward from the previous record on this device (Sprint 18) - a crew works on… |
| `m010` | `project_id_snapshot` | Project ID (snapshot) | TextField | PROJECT INFORMATION | read-only |  |
| `m072` | `project_name_snapshot` | Project Name (snapshot) | TextField | PROJECT INFORMATION | read-only |  |
| `m080` | `contractor_link` | Contractor | RecordLinkField | PROJECT INFORMATION | required, links | Links to the Contractor master. ID and name are copied down and snapshotted. Carried forward from the previous record on this device (Sprint 18). |
| `m012` | `contractor_id_snapshot` | Contractor ID (snapshot) | TextField | PROJECT INFORMATION | read-only |  |
| `m073` | `contractor_name_snapshot` | Contractor Name (snapshot) | TextField | PROJECT INFORMATION | read-only |  |
| `m002` | `work_date` | Work Date | DateTimeField | PROJECT INFORMATION | required | Deliberately NOT carried forward from the previous record: default_previous_value persists across days on a device, so the first entry of a new shift would sil… |
| `m013` | `inspector` | Inspector | TextField | PROJECT INFORMATION | read-only | The signed-in user at record creation, shown so a field user can see who raised this without running a query. The platform's own _created_by_id is the authorit… |
| `m015` | `crew` | Crew | TextField | PROJECT INFORMATION |  | Carried forward from the previous record on this device (Sprint 18). |
| `m016` | `route` | Route | TextField | PROJECT INFORMATION |  | Carried forward from the previous record on this device (Sprint 18). |
| `m017` | `segment_id` | Segment ID | TextField | PROJECT INFORMATION | read-only | Derived from From/To structure, direction-normalized (Sprint 14). |
| `m003` | `work_year` | Year | TextField | Reporting Period (derived) | read-only |  |
| `m004` | `work_month` | Month | TextField | Reporting Period (derived) | read-only |  |
| `m005` | `work_week` | Week (ISO, Mon start) | TextField | Reporting Period (derived) | read-only |  |
| `m006` | `work_day_of_week` | Day of Week | TextField | Reporting Period (derived) | read-only |  |
| `m007` | `reporting_period` | Reporting Period | TextField | Reporting Period (derived) | read-only |  |
| `m019` | `work_category` | Work Category | ChoiceField | WORK INFORMATION | required, list | Carried forward from the previous record on this device (Sprint 18). |
| `m020` | `construction_method` | Construction Method | ChoiceField | WORK INFORMATION | list | Carried forward from the previous record on this device (Sprint 18). |
| `m021` | `labor_code` | Labor Code | ChoiceField | WORK INFORMATION | required, list | 146 pay units from the River City rate sheet. |
| `m022` | `labor_description` | Labor Description (snapshot) | TextField | WORK INFORMATION | read-only |  |
| `m023` | `quantity` | Quantity | TextField | WORK INFORMATION | required | The quantity this production is billed on, in the unit shown below. For fiber placement measured in FT it fills in from the sequentials as soon as you enter th… |
| `m151` | `production_type` | Production Type | ChoiceField | WORK INFORMATION | required, list | Original for new work. Adjustment corrects APPROVED production without editing it: it names the original Production ID, states why, and is the only place a neg… |
| `m152` | `adjusts_production_id` | Adjusts Production ID | TextField | WORK INFORMATION |  | The Production ID of the approved record this adjustment corrects, e.g. PRD-2026-143C1840. |
| `m153` | `adjustment_reason` | Adjustment Reason | TextField | WORK INFORMATION |  | Why the approved quantity is being corrected. |
| `m024` | `unit` | Unit | ChoiceField | WORK INFORMATION | read-only, list | Copied from the selected Contractor Rate, which is the authority on how a pay unit is measured. The Data Events runtime exposes no choice labels, so this can n… |
| `m026` | `from_location` | From Location / Structure | TextField | LOCATION |  |  |
| `m027` | `to_location` | To Location / Structure | TextField | LOCATION |  |  |
| `m145` | `from_structure_link` | From Structure | RecordLinkField | LOCATION | links | Links the FROM structure in the structure master. Its ID and type are copied down, so the production record still resolves if the master changes. Leave blank a… |
| `m146` | `to_structure_link` | To Structure | RecordLinkField | LOCATION | links | Links the TO structure. Same copy-down as From Structure. |
| `m147` | `from_structure_id_snap` | From Structure ID (snapshot) | TextField | LOCATION | read-only |  |
| `m148` | `from_structure_type_snap` | From Structure Type (snapshot) | TextField | LOCATION | read-only |  |
| `m149` | `to_structure_id_snap` | To Structure ID (snapshot) | TextField | LOCATION | read-only |  |
| `m150` | `to_structure_type_snap` | To Structure Type (snapshot) | TextField | LOCATION | read-only |  |
| `m028` | `gps_latitude` | GPS Latitude | CalculatedField | LOCATION | calculated |  |
| `m029` | `gps_longitude` | GPS Longitude | CalculatedField | LOCATION | calculated |  |
| `m030` | `gps_accuracy_m` | GPS Accuracy (m) | CalculatedField | LOCATION | calculated |  |
| `m032` | `fiber_type` | Fiber Type | ChoiceField | FIBER INFORMATION | list |  |
| `m033` | `fiber_count` | Fiber Count | TextField | FIBER INFORMATION |  |  |
| `m034` | `cable_id` | Cable ID | TextField | FIBER INFORMATION |  |  |
| `m081` | `reel_link` | Fiber Reel | RecordLinkField | FIBER INFORMATION | links | Links the physical reel. Its printed range is copied down so outside-range checks work offline. |
| `m035` | `reel_id` | Reel ID | TextField | FIBER INFORMATION | read-only | Copied from the linked reel record. |
| `m083` | `reel_begin_snap` | Reel Beginning Sequential (snapshot) | TextField | FIBER INFORMATION | read-only |  |
| `m084` | `reel_end_snap` | Reel Ending Sequential (snapshot) | TextField | FIBER INFORMATION | read-only |  |
| `m036` | `starting_sequential` | Starting Sequential | TextField | FIBER INFORMATION |  |  |
| `m037` | `ending_sequential` | Ending Sequential | TextField | FIBER INFORMATION |  |  |
| `m038` | `sequential_footage` | Sequential Footage | CalculatedField | FIBER INFORMATION | calculated | ABS(End - Start). Direction-independent (Sprint 0.7). |
| `m039` | `slack_footage` | Slack Footage | TextField | FIBER INFORMATION |  |  |
| `m040` | `other_added_footage` | Other Added Footage | TextField | FIBER INFORMATION |  |  |
| `m041` | `total_installed_footage` | Total Installed Footage | CalculatedField | FIBER INFORMATION | calculated | Sequential + Slack + Other. Components stay independently auditable (Sprint 0.9). |
| `m086` | `pull_count` | Pull Count (derived) | TextField | UNDERGROUND | read-only | Read from the labor code. BM60(3)(1.25) = a 3-PULL bundled assembly. |
| `m087` | `conduit_diameter` | Conduit Diameter (derived) | TextField | UNDERGROUND | read-only | Read from the labor code, e.g. BM60(3)(1.25) = 1.25". |
| `m088` | `total_duct_footage` | Total Duct Footage (informational) | CalculatedField | UNDERGROUND | calculated | Production footage x pull count = total DUCT feet in the ground. This is NOT the material quantity: a 3-pull package is one bundled assembly consumed at 1 FT p… |
| `m089` | `from_station` | From Station | TextField | UNDERGROUND |  |  |
| `m090` | `to_station` | To Station | TextField | UNDERGROUND |  |  |
| `m091` | `depth_inches` | Depth (inches) | TextField | UNDERGROUND |  | Contract minimum is 36-42 inches for most bore and trench units. |
| `m092` | `surface_type` | Surface Type | ChoiceField | UNDERGROUND | list |  |
| `m093` | `crossing_type` | Crossing Type | ChoiceField | UNDERGROUND | list |  |
| `m094` | `rock_encountered` | Rock Encountered | YesNoField | UNDERGROUND |  | Rock adders BM60-R and BM71 are separately priced pay units - record them as their own production transaction. |
| `m095` | `trace_wire_installed` | Trace Wire / Pull Rope Installed | YesNoField | UNDERGROUND |  | BM90 is a separate pay unit, billable only when no fiber is pulled at the same time. |
| `m096` | `restoration_required` | Restoration Required | YesNoField | UNDERGROUND |  |  |
| `m097` | `restoration_type` | Restoration Type | ChoiceField | UNDERGROUND | list |  |
| `m098` | `restoration_status` | Restoration Status | ChoiceField | UNDERGROUND | list |  |
| `m116` | `conduit_material_code` | Conduit Material Code (derived) | TextField | UNDERGROUND | read-only | Canonical code CONDUIT-<size>-<n>PULL, derived from the labor code. 1.25" names the bundled n-PULL assembly; 2" and 4" always name the single-pipe 1PULL SKU an… |
| `m117` | `conduit_material_quantity` | Conduit Material Quantity | CalculatedField | UNDERGROUND | calculated | Production footage x the material multiplier. 1:1 for bundled 1.25 inch whatever the pull count; pull count x footage for single-pipe 2 inch and 4 inch (ruling… |
| `m100` | `pole_id` | Pole ID | TextField | AERIAL |  |  |
| `m101` | `previous_pole_id` | Previous Pole ID | TextField | AERIAL |  |  |
| `m102` | `next_pole_id` | Next Pole ID | TextField | AERIAL |  |  |
| `m103` | `span_id` | Span ID (derived) | TextField | AERIAL | read-only | Direction-normalized from Pole ID and Previous Pole ID, so reversing them cannot create a second span. |
| `m104` | `span_footage` | Span Footage | TextField | AERIAL |  | Entered manually. Automatic derivation needs a pole/span dataset with coordinates, which does not exist yet - see docs. |
| `m105` | `pole_owner` | Pole Owner | ChoiceField | AERIAL | list |  |
| `m106` | `pole_height` | Pole Height (ft) | TextField | AERIAL |  |  |
| `m107` | `pole_class` | Pole Class | TextField | AERIAL |  |  |
| `m108` | `pole_status` | Pole Status | ChoiceField | AERIAL | list |  |
| `m109` | `attachment_type` | Attachment Type | ChoiceField | AERIAL | list |  |
| `m110` | `anchors_installed` | Anchors Installed | TextField | AERIAL |  | AFO.GAA is a separate pay unit - record the production separately. |
| `m111` | `guys_installed` | Down Guys Installed | TextField | AERIAL |  |  |
| `m112` | `risers_installed` | Risers Installed | TextField | AERIAL |  |  |
| `m113` | `snowshoes_installed` | Snowshoes / Slack Coils | TextField | AERIAL |  |  |
| `m114` | `make_ready_required` | Make-Ready Required | YesNoField | AERIAL |  |  |
| `m115` | `bonding_grounding` | Bonding / Grounding Complete | YesNoField | AERIAL |  |  |
| `m119` | `splice_structure_type` | Structure Type | ChoiceField | SPLICING | list |  |
| `m120` | `splice_structure_id` | Structure ID | TextField | SPLICING |  |  |
| `m121` | `closure_id` | Closure ID | TextField | SPLICING |  |  |
| `m122` | `closure_type` | Closure Type | ChoiceField | SPLICING | list |  |
| `m123` | `incoming_cable_id` | Incoming Cable ID | TextField | SPLICING |  |  |
| `m124` | `outgoing_cable_id` | Outgoing Cable ID | TextField | SPLICING |  |  |
| `m125` | `fiber_count_spliced` | Fiber Count at Location | TextField | SPLICING |  | Total fibers in this closure. This determines WHICH HO-1 band prices the work. |
| `m126` | `splice_band_derived` | Priced Splice Band (derived) | TextField | SPLICING | read-only | Read from the labor code, e.g. HO-1 (25-48) prices 25-48 fibers. |
| `m127` | `splice_quantity` | Splice Quantity | TextField | SPLICING |  | Fusion splices actually performed. This is the production quantity for HO-1 units. |
| `m128` | `express_fibers` | Express Fibers | TextField | SPLICING |  |  |
| `m129` | `cut_fibers` | Cut Fibers | TextField | SPLICING |  |  |
| `m130` | `pass_through_fibers` | Pass-Through Fibers | TextField | SPLICING |  |  |
| `m131` | `splitters_installed` | Splitters Installed | TextField | SPLICING |  |  |
| `m132` | `ports_used` | Ports Used | TextField | SPLICING |  |  |
| `m133` | `splice_test_type` | Test Type | ChoiceField | SPLICING | list |  |
| `m134` | `loss_value_db` | Measured Loss (dB) | TextField | SPLICING |  | Typical fusion splice loss is under 0.10 dB. |
| `m135` | `splice_test_result` | Test Result | ChoiceField | SPLICING | list |  |
| `m074` | `rate_link` | Applicable Contractor Rate | RecordLinkField | PRODUCTION VALUE | links | Selecting a rate copies its price and provenance onto this transaction. The copy is PHYSICAL - later repricing of the master can never rewrite this record (Spr… |
| `m043` | `contractor_rate` | Contractor Rate | TextField | PRODUCTION VALUE | read-only | Snapshot copied from the linked rate record. Read-only: a manual rate would break the audit trail. |
| `m075` | `rate_labor_code_snap` | Rate Labor Code (snapshot) | ChoiceField | PRODUCTION VALUE | read-only, list | Compared against the selected Labor Code to catch a mismatched rate. |
| `m076` | `rate_contractor_id_snap` | Rate Contractor ID (snapshot) | TextField | PRODUCTION VALUE | read-only |  |
| `m077` | `rate_project_id_snap` | Rate Project ID (snapshot) | TextField | PRODUCTION VALUE | read-only | Blank means the rate applies to all projects. |
| `m078` | `rate_expiration_snap` | Rate Expiration (snapshot) | DateTimeField | PRODUCTION VALUE | read-only |  |
| `m044` | `rate_source_id` | Rate Source / Rate Record ID | TextField | PRODUCTION VALUE | read-only |  |
| `m045` | `rate_effective_date` | Rate Effective Date | DateTimeField | PRODUCTION VALUE | read-only |  |
| `m046` | `extended_value` | Extended Value | CalculatedField | PRODUCTION VALUE | calculated | Quantity x Unit Rate (Sprint 0.4). |
| `m055` | `actual_material_used` | Actual Material Used | Repeatable | MATERIALS |  | What the crew reports was actually consumed (Sprint 8). |
| `m053` | `actual_material ⟨actual_material_used⟩` | Material | ClassificationField | Actual Material Used | required, list |  |
| `m054` | `actual_material_quantity ⟨actual_material_used⟩` | Quantity | TextField | Actual Material Used | required |  |
| `m057` | `qa_status` | QA Status | ChoiceField | QA / QC | list | QA/QC outcome. An approval requires a recorded outcome that is not Fail and not Not Reviewed - an approval is a statement that somebody looked. |
| `m058` | `qa_photos` | Photos | PhotoField | QA / QC |  |  |
| `m059` | `qa_notes` | Notes | TextField | QA / QC |  |  |
| `m137` | `correction_detail` | QA Reviewer Outcome Detail | ChoiceField | QA / QC | list | What must be corrected, or the condition attached to a conditional pass. Required when the record is sent back - 'correction required' with no detail sends a c… |
| `m138` | `correction_completed` | Correction Completed | YesNoField | QA / QC |  | Set by the crew once the correction is done. Cleared automatically whenever the record is sent back again. |
| `m154` | `qa_owner` | QA Owner | TextField | QA / QC |  | Who is responsible for closing this deficiency. Flagged when QA is Fail or Conditional Pass and nobody owns it (OI-10). |
| `m155` | `qa_due_date` | QA Due Date | DateTimeField | QA / QC |  | When the deficiency must be corrected by. Flagged once past and not marked corrected. |
| `m139` | `correction_completed_date` | Correction Completed Date | DateTimeField | QA / QC | read-only |  |
| `m140` | `correction_completed_by` | Correction Completed By | TextField | QA / QC | read-only |  |
| `m141` | `attachments` | Attachments | PhotoField | QA / QC |  | Scans and documents supporting the review: permits, locate tickets, markups. Field photographs belong in Photos above. |
| `m060` | `exception_flags` | Exceptions (auto) | TextField | QA / QC | read-only | Auto-populated by validation. Warnings do not block save (Sprint 18). |
| `m061` | `exception_severity` | Exception Severity | ChoiceField | QA / QC | read-only, list |  |
| `m142` | `fingerprint_strict` | Fingerprint - Strict (derived) | TextField | QA / QC | read-only | Canonical signature of the same physical cable pull: project, contractor, date, pay unit, cable ID and the direction-normalized sequential range. Two records s… |
| `m143` | `fingerprint_segment` | Fingerprint - Segment (derived) | TextField | QA / QC | read-only | Canonical signature of the same work claimed twice between two structures, with no sequentials involved. Weaker evidence than the strict fingerprint, but it is… |
| `m144` | `fingerprint_strength` | Fingerprint Strength (derived) | TextField | QA / QC | read-only | How many identifying values this record actually carries. Below 4 the record cannot be reliably duplicate-checked, and reports ignore its fingerprints rather t… |
| `m063` | `submitted_by` | Submitted By | TextField | APPROVAL | read-only |  |
| `m064` | `submitted_date` | Submitted Date | DateTimeField | APPROVAL | read-only |  |
| `m065` | `reviewed_by` | Reviewed By | TextField | APPROVAL | read-only |  |
| `m066` | `reviewed_date` | Reviewed Date | DateTimeField | APPROVAL | read-only |  |
| `m067` | `approved_by` | Approved By | TextField | APPROVAL | read-only |  |
| `m068` | `approved_date` | Approved Date | DateTimeField | APPROVAL | read-only |  |
| `m069` | `rejection_reason` | Rejection / Correction Reason | TextField | APPROVAL |  |  |
| `m070` | `signature` | Signature | SignatureField | APPROVAL |  |  |
| `m156` | `reopen_reason` | Reopen Reason | TextField | APPROVAL |  | Required to reopen APPROVED production. Reopening drops the approval until it is re-approved (D-018). |
| `m157` | `reopened_by` | Reopened By | TextField | APPROVAL | read-only |  |
| `m158` | `reopened_date` | Reopened Date | DateTimeField | APPROVAL | read-only |  |
| `m159` | `reversal_reason` | Reversal Reason | TextField | APPROVAL |  | Required to reverse APPROVED production. A reversed record keeps its approval stamp as evidence and is excluded from official totals (D-018). |
| `m160` | `reversed_by` | Reversed By | TextField | APPROVAL | read-only |  |
| `m161` | `reversed_date` | Reversed Date | DateTimeField | APPROVAL | read-only |  |
| `m162` | `calc_version` | Calculation Version | TextField | APPROVAL | read-only | The Data Events version that last calculated this record's derived fields (OI-08, D-019). Selects the records a rule change affects. |

## MC Project Master

Form `5ce243d4-9ec1-4fbd-8659-7be9f632b55c` · schema `fulcrum/schemas/mc-project-master-dev.elements.json`

| Key | data_name | Label | Type | Section | Flags | Description |
|---|---|---|---|---|---|---|
| `p001` | `project_id` | Project ID | TextField |  | required | Permanent relational key, e.g. PRJ-000123. Never reused, never changed. |
| `p002` | `project_name` | Project Name | TextField |  | required | Display label. Renaming is safe - relationships key on Project ID. |
| `p003` | `customer` | Customer | TextField | PROJECT DETAIL |  |  |
| `p004` | `market` | Market | TextField | PROJECT DETAIL |  |  |
| `p005` | `state` | State | TextField | PROJECT DETAIL |  |  |
| `p006` | `county` | County | TextField | PROJECT DETAIL |  |  |
| `p007` | `project_manager` | Project Manager | TextField | PROJECT DETAIL |  |  |
| `p008` | `construction_manager` | Construction Manager | TextField | PROJECT DETAIL |  |  |
| `p009` | `start_date` | Start Date | DateTimeField | PROJECT DETAIL |  |  |
| `p010` | `required_completion_date` | Required Completion Date | DateTimeField | PROJECT DETAIL |  |  |
| `p011` | `original_contract_value` | Original Contract Value | TextField | FINANCIAL BASELINE |  | IMMUTABLE BASELINE. Never edit this to reflect a scope change - raise an approved change order instead (Sprint 23.47.15). |
| `p012` | `approved_change_orders` | Approved Change Orders | TextField | FINANCIAL BASELINE | read-only | SPRINT 9: sum of APPROVED change orders only. Pending and rejected change orders must not appear here. |
| `p013` | `current_contract_value` | Current Contract Value | CalculatedField | FINANCIAL BASELINE | calculated | Original + Approved Change Orders. |
| `p014` | `route_miles` | Route Miles | TextField | PLANNED SCOPE |  |  |
| `p015` | `planned_fiber_footage` | Planned Fiber Footage | TextField | PLANNED SCOPE |  |  |
| `p016` | `planned_underground_footage` | Planned Underground Footage | TextField | PLANNED SCOPE |  |  |
| `p017` | `planned_aerial_footage` | Planned Aerial Footage | TextField | PLANNED SCOPE |  |  |
| `p018` | `planned_splices` | Planned Splices | TextField | PLANNED SCOPE |  |  |
| `p019` | `notes` | Notes | TextField |  |  |  |

## MC Contractor Master

Form `d8a368b5-1e19-4f5f-8cf9-ff8fbdd03ab4` · schema `fulcrum/schemas/mc-contractor-master-dev.elements.json`

| Key | data_name | Label | Type | Section | Flags | Description |
|---|---|---|---|---|---|---|
| `c001` | `contractor_id` | Contractor ID | TextField |  | required | Permanent key, e.g. CON-0001. Never changes, even if the contractor is renamed. |
| `c002` | `contractor_name` | Contractor Name | TextField |  | required | Display label only. A rename keeps the same Contractor ID; a different legal entity gets a NEW record. |
| `c003` | `contact_name` | Contact Name | TextField |  |  |  |
| `c004` | `phone` | Phone | TextField |  |  |  |
| `c005` | `email` | Email | TextField |  |  |  |
| `c006` | `contract_number` | Contract Number | TextField |  |  |  |
| `c007` | `contract_effective_date` | Contract Effective Date | DateTimeField |  |  |  |
| `c008` | `contract_expiration_date` | Contract Expiration Date | DateTimeField |  |  |  |
| `c009` | `active` | Active | YesNoField |  | required | Inactive contractors must not be selectable for NEW production, but historical production stays attached to them. |
| `c010` | `notes` | Notes | TextField |  |  |  |

## MC Contractor Rate

Form `a5529dd0-54fa-4b8d-b595-d0218df0ee97` · schema `fulcrum/schemas/mc-contractor-rate-dev.elements.json`

| Key | data_name | Label | Type | Section | Flags | Description |
|---|---|---|---|---|---|---|
| `r001` | `rate_id` | Rate ID | TextField |  | required | Permanent key, e.g. RATE-004521. This is what production snapshots as its pricing source. |
| `r002` | `contractor_link` | Contractor | RecordLinkField | APPLIES TO | required, links |  |
| `r003` | `contractor_id_snap` | Contractor ID (snapshot) | TextField | APPLIES TO | read-only |  |
| `r004` | `contractor_name_snap` | Contractor Name (snapshot) | TextField | APPLIES TO | read-only |  |
| `r005` | `project_link` | Project (blank = all projects) | RecordLinkField | APPLIES TO | links |  |
| `r006` | `project_id_snap` | Project ID (snapshot) | TextField | APPLIES TO | read-only |  |
| `r007` | `project_name_snap` | Project Name (snapshot) | TextField | APPLIES TO | read-only |  |
| `r016` | `rate_scope` | Rate Scope | CalculatedField | APPLIES TO | calculated | A project-specific rate takes precedence over an all-projects rate. |
| `r008` | `labor_code` | Labor Code | ChoiceField | PRICING | required, list |  |
| `r009` | `labor_description` | Labor Description | TextField | PRICING |  | The pay unit's description, as on the rate sheet. Snapshotted onto production so a later master reword cannot rewrite history (Sprint 23.47.3). Editable becaus… |
| `r010` | `unit` | Unit | ChoiceField | PRICING | required, list | The unit of measure this rate prices, stated by the rate administrator. It is COPIED onto every production record that uses this rate (r010 -> m024), so it mus… |
| `r011` | `unit_rate` | Unit Rate | TextField | PRICING | required |  |
| `r018` | `currency` | Currency | ChoiceField | PRICING | required, list | Currency of the unit rate (OI-09). Every rate today is USD; stated so a rate can never be read in the wrong currency. |
| `r019` | `contract_reference` | Contract / Amendment Reference | TextField | PRICING |  | The executed contract or amendment this rate comes from, e.g. 'River City MSA Amendment 3, Exhibit B'. A rate dispute is settled against this document (OI-09). |
| `r012` | `effective_date` | Effective Date | DateTimeField | EFFECTIVE PERIOD | required | Inclusive. Production on this date uses this rate. |
| `r013` | `expiration_date` | Expiration Date | DateTimeField | EFFECTIVE PERIOD |  | Inclusive. Blank means open-ended. |
| `r014` | `active` | Active | YesNoField | EFFECTIVE PERIOD | required |  |
| `r015` | `supersedes_rate_id` | Supersedes Rate ID | TextField | EFFECTIVE PERIOD |  | The Rate ID this record replaces. Builds the version trail rather than overwriting history. |
| `r017` | `notes` | Notes | TextField |  |  |  |

## MC Project Scope Line

Form `aa1d8c1e-d0a9-4fd1-8d57-ca90b4555b0b` · schema `fulcrum/schemas/mc-project-scope-line-dev.elements.json`

| Key | data_name | Label | Type | Section | Flags | Description |
|---|---|---|---|---|---|---|
| `s001` | `scope_line_id` | Scope Line ID | TextField |  | read-only | Derived from Project ID and Labor Code. Two lines sharing one ID means a duplicate scope line, which would double-count the budget. |
| `s002` | `project_link` | Project | RecordLinkField | BASELINE | required, links | ID and name are copied down and snapshotted, so the line still resolves if the master is renamed. |
| `s003` | `project_id_snap` | Project ID (snapshot) | TextField | BASELINE | read-only |  |
| `s004` | `project_name_snap` | Project Name (snapshot) | TextField | BASELINE | read-only |  |
| `s005` | `labor_code` | Labor Code | ChoiceField | BASELINE | required, list | The pay unit this scope line budgets. One line per Project + Labor Code. |
| `s006` | `unit` | Unit | ChoiceField | BASELINE | read-only, list | Copied from the Budget Rate Source, which is the authority on how a pay unit is measured. It cannot be parsed from the labor code: the Data Events runtime expo… |
| `s007` | `original_planned_quantity` | Original Planned Quantity | TextField | BASELINE | required | THE BASELINE. Editable only while this line is DRAFT. Once baselined the Data Event locks it read-only - scope changes go through a change order so the origina… |
| `s008` | `rate_link` | Budget Rate Source | RecordLinkField | BASELINE | links | The contract rate this budget was priced at. Copied down PHYSICALLY, so a later reprice cannot silently restate the budget. |
| `s009` | `budget_rate` | Budget Rate (snapshot) | TextField | BASELINE | read-only |  |
| `s010` | `rate_source_id` | Rate Record ID (snapshot) | TextField | BASELINE | read-only |  |
| `s011` | `rate_labor_code_snap` | Rate Labor Code (snapshot) | ChoiceField | BASELINE | read-only, list | Compared against the scope Labor Code to catch a budget priced off the wrong pay unit. |
| `s012` | `rate_project_id_snap` | Rate Project ID (snapshot) | TextField | BASELINE | read-only | Blank means the rate applies to all projects. |
| `s013` | `original_budget_value` | Original Budget Value | CalculatedField | BASELINE | calculated | Original Planned Quantity x Budget Rate (Step 0.10). Quantity and rate stay separate and independently auditable. |
| `s014` | `baseline_set_date` | Baseline Set Date | DateTimeField | BASELINE | read-only | Stamped when the line leaves DRAFT. |
| `s015` | `baseline_set_by` | Baseline Set By | TextField | BASELINE | read-only |  |
| `s016` | `phase_wbs` | Phase / WBS | TextField | SCOPE MANAGEMENT |  | Optional grouping for reporting, e.g. a route, a subdivision or a funding phase. |
| `s017` | `planned_start` | Planned Start | DateTimeField | SCOPE MANAGEMENT |  |  |
| `s018` | `planned_finish` | Planned Finish | DateTimeField | SCOPE MANAGEMENT |  |  |
| `s019` | `active` | Active | YesNoField | SCOPE MANAGEMENT |  | Deactivate rather than delete: a closed scope line must keep resolving for historical reporting. |
| `s020` | `notes` | Notes | TextField | SCOPE MANAGEMENT |  |  |
| `s021` | `exception_flags` | Exceptions (auto) | TextField | SCOPE MANAGEMENT | read-only | Auto-populated by validation. Warnings never block a save. |
| `s022` | `exception_severity` | Exception Severity | ChoiceField | SCOPE MANAGEMENT | read-only, list |  |

## MC Change Order

Form `458ae172-b7b4-43b5-8917-d7a792c9e81a` · schema `fulcrum/schemas/mc-change-order-dev.elements.json`

| Key | data_name | Label | Type | Section | Flags | Description |
|---|---|---|---|---|---|---|
| `o001` | `change_order_number` | Change Order Number | TextField |  | required | As it appears on the contract document. Assigned by the contract administrator, not by this app - the paperwork is the source of truth for the number. |
| `o002` | `change_order_record_id` | Change Order Record ID | TextField |  | read-only | System-assigned once, never regenerated. Distinct from the contract number so two people entering the same paperwork twice is detectable. |
| `o003` | `project_link` | Project | RecordLinkField | CHANGE ORDER | required, links |  |
| `o004` | `project_id_snap` | Project ID (snapshot) | TextField | CHANGE ORDER | read-only |  |
| `o005` | `project_name_snap` | Project Name (snapshot) | TextField | CHANGE ORDER | read-only |  |
| `o006` | `contractor_link` | Contractor | RecordLinkField | CHANGE ORDER | links |  |
| `o007` | `contractor_id_snap` | Contractor ID (snapshot) | TextField | CHANGE ORDER | read-only |  |
| `o008` | `description` | Description | TextField | CHANGE ORDER | required | What is changing and where. This is what a reviewer reads first. |
| `o009` | `reason` | Reason | ChoiceField | CHANGE ORDER | required, list | Why the scope changed. Reporting on this is how repeat causes get found. |
| `o010` | `date_submitted` | Date Submitted | DateTimeField | CHANGE ORDER | read-only |  |
| `o011` | `submitted_by` | Submitted By | TextField | CHANGE ORDER | read-only |  |
| `o012` | `date_approved` | Date Approved | DateTimeField | CHANGE ORDER | read-only | Stamped on approval. This is the date the authorized scope moved - reports use it to reconstruct the scope as at any past date. |
| `o013` | `approved_by` | Approved By | TextField | CHANGE ORDER | read-only |  |
| `o014` | `rejection_reason` | Rejection / Cancellation Reason | TextField | CHANGE ORDER |  | Required when the order is rejected or cancelled - a dead change order with no stated reason is unauditable. |
| `o102` | `quantity_changes` | Quantity Change | Repeatable | QUANTITY CHANGES |  | One line per affected labor code. A negative quantity is a descope and is expected. Lines lock once the order is approved. |
| `o015` | `line_labor_code ⟨quantity_changes⟩` | Labor Code | ChoiceField | Quantity Change | required, list |  |
| `o016` | `line_unit ⟨quantity_changes⟩` | Unit | ChoiceField | Quantity Change | read-only, list | Derived from the Labor Code. |
| `o017` | `line_quantity_change ⟨quantity_changes⟩` | Quantity Change | TextField | Quantity Change | required | Signed. +2000 adds scope, -500 removes it. Never enter an absolute revised quantity - the baseline plus this delta is what makes the change reconstructable. |
| `o018` | `line_rate ⟨quantity_changes⟩` | Rate | TextField | Quantity Change |  | The contract rate this line is priced at, from the rate sheet for this labor code. Entered here rather than linked so the approved order keeps the price it was… |
| `o019` | `line_value ⟨quantity_changes⟩` | Line Value | CalculatedField | Quantity Change | calculated | Quantity Change x Rate. Negative for a descope. |
| `o020` | `line_notes ⟨quantity_changes⟩` | Line Notes | TextField | Quantity Change |  |  |
| `o021` | `change_order_value` | Change Order Value | CalculatedField | QUANTITY CHANGES | calculated | Summed from the lines, never typed. A hand-entered total is the first thing to drift out of step with the detail it claims to summarise. |
| `o022` | `line_count` | Line Count | CalculatedField | QUANTITY CHANGES | calculated |  |
| `o023` | `attachments` | Attachments | PhotoField | SUPPORTING |  | Photographs and scans of the signed order, field sketches and markups. |
| `o024` | `notes` | Notes | TextField | SUPPORTING |  |  |
| `o025` | `approval_signature` | Approval Signature | SignatureField | SUPPORTING |  |  |
| `o026` | `exception_flags` | Exceptions (auto) | TextField | SUPPORTING | read-only | Auto-populated by validation. Warnings never block a save. |
| `o027` | `exception_severity` | Exception Severity | ChoiceField | SUPPORTING | read-only, list |  |

## MC Labor-Material Mapping

Form `38e3d7fd-ca78-4016-8018-ec955446c13f` · schema `fulcrum/schemas/mc-labor-material-mapping-dev.elements.json`

| Key | data_name | Label | Type | Section | Flags | Description |
|---|---|---|---|---|---|---|
| `g001` | `mapping_id` | Mapping ID | TextField |  | required | Permanent key, e.g. MAP-000123. |
| `g002` | `labor_code` | Labor Code | ChoiceField |  | required, list |  |
| `g003` | `material_code` | Material Code / Part Number | TextField | MATERIAL | required |  |
| `g004` | `material_description` | Material Description | TextField | MATERIAL |  |  |
| `g005` | `material_unit` | Material Unit | ChoiceField | MATERIAL | required, list |  |
| `g006` | `calculation_type` | Calculation Type | ChoiceField | CALCULATION | required, list |  |
| `g007` | `multiplier` | Multiplier | TextField | CALCULATION | required | PER_UNIT: material qty = production qty x this. FIXED: material qty = this. |
| `g014` | `waste_factor` | Waste Factor | TextField | CALCULATION |  | Purchasing allowance, as a multiplier. 1.10 means order 10% more than the installed quantity. SEPARATE from the multiplier on purpose (ruling 2026-09-17): the… |
| `g008` | `source` | Source | ChoiceField | CALCULATION | required, list | Provenance. NEEDS REVIEW mappings must not drive production calculations until approved (Sprint 23.67). OBSERVED CONSUMPTION means the ratio was measured from… |
| `g015` | `confidence` | Confidence | ChoiceField | CALCULATION | list | How this ratio was established. Only RULING, CONFIRMED and a whole-number SINGLE SOURCE are approved for use; the rest are proposals awaiting a decision. |
| `g009` | `effective_date` | Effective Date | DateTimeField | EFFECTIVE PERIOD | required |  |
| `g010` | `expiration_date` | Expiration Date | DateTimeField | EFFECTIVE PERIOD |  | Blank means open-ended. |
| `g011` | `active` | Active | YesNoField | EFFECTIVE PERIOD | required |  |
| `g012` | `supersedes_mapping_id` | Supersedes Mapping ID | TextField | EFFECTIVE PERIOD |  |  |
| `g013` | `notes` | Notes | TextField |  |  |  |

## MC Material Master

Form `658143d1-edbd-430b-81bb-1b0bb1092729` · schema `fulcrum/schemas/mc-material-master-dev.elements.json`

| Key | data_name | Label | Type | Section | Flags | Description |
|---|---|---|---|---|---|---|
| `t001` | `material_code` | Material Code | TextField |  | required | Permanent key. Use the manufacturer part number where one exists, e.g. 114-11-3-OGB-T. |
| `t002` | `description` | Description | TextField |  | required |  |
| `t003` | `category` | Category | ChoiceField |  | required, list |  |
| `t004` | `unit` | Unit | ChoiceField |  | required, list |  |
| `t005` | `manufacturer` | Manufacturer | TextField |  |  |  |
| `t006` | `part_number` | Manufacturer Part Number | TextField |  |  |  |
| `t012` | `pack_size` | Pack Size | TextField |  |  | Pieces or feet per purchasable pack, where the SKU is a pack: a 100pc box of clamps, a 5000 FT strand reel, an 8000 FT conduit reel. Blank means the SKU is bou… |
| `t007` | `conduit_diameter` | Conduit Diameter (in) | TextField |  |  | Conduit only. In scope per ruling: 1.25, 2 and 4. |
| `t008` | `pull_count` | Pull Count | TextField |  |  | Conduit only. A 3-PULL 1.25 inch SKU is ONE bundled assembly containing three ducts, consumed at 1 FT per production FT. 2 inch and 4 inch are always single pi… |
| `t009` | `standard_cost` | Standard Cost | TextField |  |  | Optional. Material cost is tracked separately from contractor labor rates - never combine them. |
| `t010` | `active` | Active | YesNoField |  | required |  |
| `t011` | `notes` | Notes | TextField |  |  |  |

## MC Material Transaction

Form `ee204906-adb3-431b-a1d9-d7427a4c842c` · schema `fulcrum/schemas/mc-material-transaction-dev.elements.json`

| Key | data_name | Label | Type | Section | Flags | Description |
|---|---|---|---|---|---|---|
| `x001` | `transaction_id` | Transaction ID | TextField |  | read-only | System-assigned once, never regenerated. |
| `x002` | `transaction_date` | Transaction Date | DateTimeField |  | required |  |
| `x003` | `transaction_type` | Transaction Type | ChoiceField |  | required, list | Only INSTALLED counts as actual consumption for variance against calculated usage. |
| `x006` | `project_link` | Project | RecordLinkField | CONTEXT | required, links |  |
| `x007` | `project_id_snap` | Project ID (snapshot) | TextField | CONTEXT | read-only |  |
| `x008` | `contractor_link` | Contractor | RecordLinkField | CONTEXT | links |  |
| `x009` | `contractor_id_snap` | Contractor ID (snapshot) | TextField | CONTEXT | read-only |  |
| `x004` | `production_link` | Production Record | RecordLinkField | CONTEXT | links | Links this material movement to the production that caused it. This is what makes material usage auditable back to a labor code. |
| `x005` | `production_id_snap` | Production ID (snapshot) | TextField | CONTEXT | read-only |  |
| `x011` | `associated_labor_code_snap` | Associated Labor Code (snapshot) | ChoiceField | CONTEXT | read-only, list |  |
| `x016` | `crew` | Crew | TextField | CONTEXT |  |  |
| `x017` | `location` | Location | TextField | CONTEXT |  |  |
| `x010` | `material_link` | Material | RecordLinkField | MATERIAL | required, links | Code, description and unit are copied down, so a later master rename cannot rewrite this ledger entry. |
| `x012` | `material_code_snap` | Material Code (snapshot) | TextField | MATERIAL | read-only |  |
| `x013` | `material_description_snap` | Material Description (snapshot) | TextField | MATERIAL | read-only |  |
| `x014` | `material_unit_snap` | Unit (snapshot) | ChoiceField | MATERIAL | read-only, list |  |
| `x015` | `quantity` | Quantity | TextField | MATERIAL | required | Negative quantities are permitted ONLY on an Adjusted transaction (Sprint 23.59). |
| `x019` | `photos` | Photos | PhotoField |  |  |  |
| `x018` | `notes` | Notes | TextField |  |  |  |

## MC Fiber Reel

Form `728477da-5f36-48cb-b3ab-cbc8c38d077f` · schema `fulcrum/schemas/mc-fiber-reel-dev.elements.json`

| Key | data_name | Label | Type | Section | Flags | Description |
|---|---|---|---|---|---|---|
| `f001` | `reel_id` | Reel ID | TextField |  | required | Permanent key, e.g. REEL-TEST-001. |
| `f013` | `project_link` | Project | RecordLinkField | ASSIGNMENT | links | Blank means the reel is not yet assigned to a project. |
| `f014` | `project_id_snap` | Project ID (snapshot) | TextField | ASSIGNMENT | read-only |  |
| `f015` | `project_name_snap` | Project Name (snapshot) | TextField | ASSIGNMENT | read-only |  |
| `f016` | `contractor_link` | Contractor | RecordLinkField | ASSIGNMENT | links | The contractor currently holding the reel. |
| `f017` | `contractor_id_snap` | Contractor ID (snapshot) | TextField | ASSIGNMENT | read-only |  |
| `f018` | `contractor_name_snap` | Contractor Name (snapshot) | TextField | ASSIGNMENT | read-only |  |
| `f002` | `manufacturer` | Manufacturer | TextField | CABLE |  |  |
| `f003` | `cable_type` | Cable Type | ChoiceField | CABLE | list |  |
| `f004` | `fiber_count` | Fiber Count | TextField | CABLE |  |  |
| `f005` | `beginning_sequential` | Beginning Sequential | TextField | PRINTED SEQUENTIAL RANGE | required |  |
| `f006` | `ending_sequential` | Ending Sequential | TextField | PRINTED SEQUENTIAL RANGE | required |  |
| `f007` | `original_reel_footage` | Original Reel Footage | CalculatedField | PRINTED SEQUENTIAL RANGE | calculated | ABS(End - Beginning). Direction-independent, like production sequentials. |
| `f010` | `waste_recorded` | Waste Recorded | TextField | CONSUMPTION |  | Cumulative cable lost to handling, damage or cut-back. Off the reel and installed nowhere, so it is the one figure subtracted separately from the printed range… |
| `f012` | `notes` | Notes | TextField |  |  |  |

## MC Structure

Form `397b52cf-a4f0-4871-b8ea-1fdb592fe2ab` · schema `fulcrum/schemas/mc-structure-dev.elements.json`

| Key | data_name | Label | Type | Section | Flags | Description |
|---|---|---|---|---|---|---|
| `y001` | `structure_id` | Structure ID | TextField |  | required | Permanent key, as painted or tagged in the field. Everything else about a structure can change; this cannot. |
| `y003` | `structure_type` | Structure Type | ChoiceField |  | required, list | Drives which specification fields appear below. |
| `y004` | `project_link` | Project | RecordLinkField | IDENTITY | links | The project that placed or adopted this structure. A structure can outlive the project, which is why the ID is snapshotted. |
| `y005` | `project_id_snap` | Project ID (snapshot) | TextField | IDENTITY | read-only |  |
| `y006` | `route` | Route | TextField | IDENTITY |  |  |
| `y007` | `phase_wbs` | Phase / WBS | TextField | IDENTITY |  |  |
| `y008` | `location_description` | Address / Location Description | TextField | IDENTITY |  | How a crew finds it. The record's own geometry carries the coordinates. |
| `y009` | `ownership` | Ownership | ChoiceField | IDENTITY | list |  |
| `y010` | `pole_height` | Pole Height (ft) | TextField | POLE SPECIFICATION |  |  |
| `y011` | `pole_class` | Pole Class | TextField | POLE SPECIFICATION |  |  |
| `y012` | `pole_material` | Pole Material | ChoiceField | POLE SPECIFICATION | list |  |
| `y013` | `make_ready_required` | Make-Ready Required | YesNoField | POLE SPECIFICATION |  |  |
| `y014` | `size_model` | Size / Model | TextField | ENCLOSURE SPECIFICATION |  | As ordered, e.g. 24x36x36 T-22, or 12X14X41 pedestal. |
| `y015` | `traffic_rating` | Traffic Rating | ChoiceField | ENCLOSURE SPECIFICATION | list | A structure in a roadway needs the rating the authority requires - getting this wrong means digging it up again. |
| `y016` | `material_code` | Material Code | TextField | ENCLOSURE SPECIFICATION |  | The stock item this structure was built from, from MC Material Master. |
| `y017` | `closure_type` | Closure Type | ChoiceField | SPLICE / SLACK SPECIFICATION | list |  |
| `y018` | `fiber_count` | Fiber Count at Structure | TextField | SPLICE / SLACK SPECIFICATION |  |  |
| `y019` | `slack_stored` | Slack Stored (ft) | TextField | SPLICE / SLACK SPECIFICATION |  |  |
| `y020` | `housed_in_structure_id` | Housed In Structure ID | TextField | SPLICE / SLACK SPECIFICATION |  | A splice closure or slack coil usually sits INSIDE another structure. Naming that here keeps the closure findable without pretending it is a separate hole in t… |
| `y021` | `installed_date` | Installed Date | DateTimeField | STATUS |  |  |
| `y022` | `removed_date` | Removed Date | DateTimeField | STATUS |  |  |
| `y023` | `active` | Active | YesNoField | STATUS |  | Deactivate rather than delete. A removed structure must keep resolving for the historical segments and production that reference it. |
| `y024` | `photos` | Photos | PhotoField | STATUS |  |  |
| `y025` | `notes` | Notes | TextField | STATUS |  |  |
| `y026` | `exception_flags` | Exceptions (auto) | TextField | STATUS | read-only |  |
| `y027` | `exception_severity` | Exception Severity | ChoiceField | STATUS | read-only, list |  |

## MC Segment

Form `7da87588-940a-4b9e-915d-5ec25d5c0ebc` · schema `fulcrum/schemas/mc-segment-dev.elements.json`

| Key | data_name | Label | Type | Section | Flags | Description |
|---|---|---|---|---|---|---|
| `z001` | `segment_id` | Segment ID | TextField |  | read-only | DERIVED and direction-normalized from the two structure IDs, sorted. HH-001 -> HH-002 and HH-002 -> HH-001 both produce HH-001_HH-002, so one physical path has… |
| `z010` | `segment_type` | Segment Type | ChoiceField |  | required, list | What runs between the two structures. One physical path can carry several types, each as its own segment record - conduit and the fiber inside it are different… |
| `z002` | `from_structure_link` | From Structure | RecordLinkField | ENDPOINTS | required, links | ID and type are copied down, so this segment still resolves if the structure master changes. |
| `z003` | `from_structure_id` | From Structure ID (snapshot) | TextField | ENDPOINTS | read-only |  |
| `z004` | `from_structure_type` | From Structure Type (snapshot) | TextField | ENDPOINTS | read-only |  |
| `z005` | `to_structure_link` | To Structure | RecordLinkField | ENDPOINTS | required, links |  |
| `z006` | `to_structure_id` | To Structure ID (snapshot) | TextField | ENDPOINTS | read-only |  |
| `z007` | `to_structure_type` | To Structure Type (snapshot) | TextField | ENDPOINTS | read-only |  |
| `z008` | `project_link` | Project | RecordLinkField | SEGMENT DETAIL | links |  |
| `z009` | `project_id_snap` | Project ID (snapshot) | TextField | SEGMENT DETAIL | read-only |  |
| `z011` | `route` | Route | TextField | SEGMENT DETAIL |  |  |
| `z012` | `phase_wbs` | Phase / WBS | TextField | SEGMENT DETAIL |  |  |
| `z016` | `construction_method` | Construction Method | ChoiceField | SEGMENT DETAIL | list |  |
| `z013` | `design_length` | Design Length (ft) | TextField | SEGMENT DETAIL |  | From the design drawing. Kept separate from the as-built length so the two stay independently auditable. |
| `z014` | `as_built_length` | As-Built Length (ft) | TextField | SEGMENT DETAIL |  | What was actually placed. This is NOT the production quantity - production is recorded per transaction against a pay unit, and one segment can take several tra… |
| `z015` | `length_variance` | Length Variance (ft) | CalculatedField | SEGMENT DETAIL | calculated | As-built minus design. Positive means the run was longer than drawn, which is where change-order conversations start. |
| `z021` | `fiber_count` | Fiber Count | TextField | SEGMENT DETAIL |  |  |
| `z022` | `conduit_diameter` | Conduit Diameter (in) | TextField | SEGMENT DETAIL |  | In scope per ruling: 1.25, 2 and 4. |
| `z023` | `pull_count` | Pull Count | TextField | SEGMENT DETAIL |  |  |
| `z018` | `active` | Active | YesNoField | STATUS |  | Deactivate rather than delete: production records reference this segment. |
| `z017` | `notes` | Notes | TextField | STATUS |  |  |
| `z019` | `exception_flags` | Exceptions (auto) | TextField | STATUS | read-only |  |
| `z020` | `exception_severity` | Exception Severity | ChoiceField | STATUS | read-only, list |  |

## MC Project Closeout

Form `351bb1f1-9837-47c8-be5b-bb0727fe93a0` · schema `fulcrum/schemas/mc-project-closeout-dev.elements.json`

| Key | data_name | Label | Type | Section | Flags | Description |
|---|---|---|---|---|---|---|
| `k000` | `closeout_id` | Closeout ID | TextField |  | read-only | System-assigned, set once on first save and never regenerated. |
| `k001` | `project_link` | Project | RecordLinkField |  | required, links | One closeout record per project. ID and name are copied down and snapshotted like every other link in this system. |
| `k002` | `project_id_snap` | Project ID (snapshot) | TextField |  | read-only |  |
| `k003` | `project_name_snap` | Project Name (snapshot) | TextField |  | read-only |  |
| `k010` | `construction_complete` | Construction Complete | YesNoField | CLOSEOUT MILESTONES |  |  |
| `k011` | `construction_complete_date` | Construction Complete Date | DateTimeField | CLOSEOUT MILESTONES | read-only | Stamped automatically when the milestone above is set to Yes, and cleared if it is set back. |
| `k012` | `fiber_placement_complete` | Fiber Placement Complete | YesNoField | CLOSEOUT MILESTONES |  |  |
| `k013` | `fiber_placement_complete_date` | Fiber Placement Complete Date | DateTimeField | CLOSEOUT MILESTONES | read-only | Stamped automatically when the milestone above is set to Yes, and cleared if it is set back. |
| `k014` | `splicing_complete` | Splicing Complete | YesNoField | CLOSEOUT MILESTONES |  |  |
| `k015` | `splicing_complete_date` | Splicing Complete Date | DateTimeField | CLOSEOUT MILESTONES | read-only | Stamped automatically when the milestone above is set to Yes, and cleared if it is set back. |
| `k016` | `testing_complete` | Testing Complete | YesNoField | CLOSEOUT MILESTONES |  |  |
| `k017` | `testing_complete_date` | Testing Complete Date | DateTimeField | CLOSEOUT MILESTONES | read-only | Stamped automatically when the milestone above is set to Yes, and cleared if it is set back. |
| `k018` | `restoration_complete` | Restoration Complete | YesNoField | CLOSEOUT MILESTONES |  |  |
| `k019` | `restoration_complete_date` | Restoration Complete Date | DateTimeField | CLOSEOUT MILESTONES | read-only | Stamped automatically when the milestone above is set to Yes, and cleared if it is set back. |
| `k020` | `qa_complete` | QA Complete | YesNoField | CLOSEOUT MILESTONES |  |  |
| `k021` | `qa_complete_date` | QA Complete Date | DateTimeField | CLOSEOUT MILESTONES | read-only | Stamped automatically when the milestone above is set to Yes, and cleared if it is set back. |
| `k022` | `as_builts_complete` | As-Builts Complete | YesNoField | CLOSEOUT MILESTONES |  |  |
| `k023` | `as_builts_complete_date` | As-Builts Complete Date | DateTimeField | CLOSEOUT MILESTONES | read-only | Stamped automatically when the milestone above is set to Yes, and cleared if it is set back. |
| `k024` | `material_reconciliation_complete` | Material Reconciliation Complete | YesNoField | CLOSEOUT MILESTONES |  |  |
| `k025` | `material_reconciliation_complete_date` | Material Reconciliation Complete Date | DateTimeField | CLOSEOUT MILESTONES | read-only | Stamped automatically when the milestone above is set to Yes, and cleared if it is set back. |
| `k026` | `contractor_production_approved` | Contractor Production Approved | YesNoField | CLOSEOUT MILESTONES |  |  |
| `k027` | `contractor_production_approved_date` | Contractor Production Approved Date | DateTimeField | CLOSEOUT MILESTONES | read-only | Stamped automatically when the milestone above is set to Yes, and cleared if it is set back. |
| `k028` | `final_billing_complete` | Final Billing Complete | YesNoField | CLOSEOUT MILESTONES |  |  |
| `k029` | `final_billing_complete_date` | Final Billing Complete Date | DateTimeField | CLOSEOUT MILESTONES | read-only | Stamped automatically when the milestone above is set to Yes, and cleared if it is set back. |
| `k030` | `closeout_documents_received` | Closeout Documents Received | YesNoField | CLOSEOUT MILESTONES |  |  |
| `k031` | `closeout_documents_received_date` | Closeout Documents Received Date | DateTimeField | CLOSEOUT MILESTONES | read-only | Stamped automatically when the milestone above is set to Yes, and cleared if it is set back. |
| `k040` | `readiness_reviewed` | Readiness Report Reviewed | YesNoField | CLOSEOUT VALIDATION |  | Set to Yes once reports/closeout-readiness.sql has been run for this project and its findings read. Required before CLOSED. |
| `k041` | `readiness_reviewed_date` | Readiness Reviewed Date | DateTimeField | CLOSEOUT VALIDATION | read-only | Stamped automatically when the readiness report is marked reviewed, and cleared if that is unset. |
| `k042` | `readiness_reviewed_by` | Readiness Reviewed By | TextField | CLOSEOUT VALIDATION | read-only |  |
| `k043` | `open_blockers_noted` | Open Blockers Noted | TextField | CLOSEOUT VALIDATION |  | What the readiness report still showed at the time of review. Left blank when it came back clean. |
| `k050` | `closeout_override` | Closeout Override | YesNoField | AUTHORIZED OVERRIDE |  | Closing this project despite outstanding milestones or open blockers. |
| `k051` | `override_reason` | Override Reason | TextField | AUTHORIZED OVERRIDE |  | Required whenever the override is set. A reason is the whole point of the override - without one the override is just a silent close. |
| `k052` | `override_by` | Override Authorized By | TextField | AUTHORIZED OVERRIDE | read-only |  |
| `k053` | `override_date` | Override Date | DateTimeField | AUTHORIZED OVERRIDE | read-only | Stamped automatically when the override is set, and cleared if it is unset. |
| `k060` | `closed_by` | Closed By | TextField | CLOSURE | read-only |  |
| `k061` | `closed_date` | Closed Date | DateTimeField | CLOSURE | read-only | Stamped automatically when the record status becomes CLOSED, and cleared if the project is REOPENED. |
| `k062` | `reopen_reason` | Reopen Reason | TextField | CLOSURE |  | Required when a CLOSED project is reopened. A closeout that can be undone without a reason is not a control. |
| `k063` | `closeout_documents` | Closeout Documents | PhotoField | CLOSURE |  | As-builts, test results, permits, final lien waivers - whatever the closeout package requires. |
| `k070` | `notes` | Notes | TextField |  |  |  |
