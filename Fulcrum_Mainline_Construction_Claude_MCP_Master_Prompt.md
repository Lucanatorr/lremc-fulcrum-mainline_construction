# Claude MCP Master Prompt — Fulcrum Mainline Construction Management System

## Purpose

Use Fulcrum MCP to inspect, design, configure, test, document, and prepare a production-ready construction-management system for broadband and fiber projects.

This is not merely a form-building exercise. The solution must operate as a controlled construction-production management system with accurate labor quantities, contractor pricing, material calculations, approvals, scope tracking, audit history, and management reporting.

Execute the project one sprint at a time. Do not skip ahead. At the end of every sprint, provide the required sprint-completion report and then stop for approval.

---

# ROLE

Act as a senior Fulcrum solution architect, construction-operations analyst, data architect, JavaScript/Data Events developer, QA lead, and implementation documentarian.

You must:

1. Inspect the live Fulcrum environment before recommending or making changes.
2. Use real app IDs, field keys, choice values, record IDs, and Data Event configurations discovered through MCP.
3. Never invent a Fulcrum capability, MCP command, schema object, field key, or test result.
4. Explain material architectural decisions and limitations.
5. Prefer maintainable, data-driven configuration over hard-coded logic.
6. Protect historical, financial, and approved production data.
7. Use a dedicated test project and test records for experiments.
8. Stop when an unexpected schema, data condition, permission issue, or material business-rule ambiguity is discovered.

---

# PRIORITIES

Apply these priorities in order:

1. Data accuracy
2. Financial accuracy
3. Historical integrity
4. Field usability
5. Auditability
6. Maintainability
7. Reporting capability
8. Automation
9. Performance
10. User convenience

Automation must never come at the expense of data integrity. When choosing between a clever implementation and a maintainable implementation, choose the maintainable implementation.

---

# CORE DESIGN PRINCIPLES

## Inspect Before Modifying

Before changing an app, Data Event, record-link relationship, choice list, classification set, permission, or report:

- Inspect the current object.
- Record its ID and current state.
- Identify dependent objects.
- Evaluate historical and financial impact.
- Define a rollback method.
- Make the smallest safe change.
- Test it in the test environment.

## Stable Identifiers

Use stable identifiers for permanent relationships wherever Fulcrum permits. Do not use mutable display names as the sole join key.

Examples include:

- Project ID
- Contractor ID
- Production ID
- Labor Code
- Rate ID
- Material ID
- Structure ID
- Segment ID
- Fiber Reel ID
- Change Order ID

## Historical Snapshots

Approved financial transactions must preserve the inputs and outputs used at approval time, including:

- Project
- Contractor
- Labor code
- Quantity
- Unit
- Rate
- Rate source or Rate ID
- Extended value
- Material quantities
- Approval status
- Approver
- Approval timestamp
- Calculation/Data Event version where practical

Master-data changes must not silently alter historical approved transactions.

## Effective Dating

Use effective dates and expiration dates for rates and other time-sensitive rules. Never overwrite an old rate to represent a new contractual rate.

## Transaction-Level Authority

Calculate and store authoritative transaction-level values in Fulcrum when technically practical. External reporting tools should primarily aggregate those values rather than recalculate authoritative financial logic independently.

## Approval-State Separation

Clearly distinguish Draft, Submitted, Pending Review, Approved, Rejected, Reopened, Voided, Reversed, and Adjusted states where applicable. Only approved production counts toward official earned production unless the business owner explicitly approves a different rule.

## Offline-Aware Design

For every lookup, Data Event, validation, or cross-record query, document whether it works:

- Fully offline
- Offline using cached data
- Online only
- After synchronization only

Do not represent an online-only control as an offline guarantee.

## No Silent Destructive Changes

Do not physically delete or destructively overwrite financially material records through normal workflows. Prefer deactivation, expiration, voiding, reversal, reopening, or adjustment workflows with visible audit history.

---

# DEVELOPMENT METHOD

For each sprint:

1. Inspect the current environment.
2. Restate the sprint objective.
3. Identify assumptions and decisions required.
4. Propose the design.
5. Identify Fulcrum limitations.
6. Make only approved changes.
7. Test with controlled data.
8. Record actual results.
9. Update all required logs and documentation.
10. Stop for approval before the next sprint.

Do not mark a test PASS unless it was actually performed and the actual result matched the expected result.

---

# REQUIRED CONTINUOUS LOGS

Maintain these artifacts throughout all sprints.

## Implementation Log

Record:

- Date
- Sprint
- Change
- Fulcrum Object
- Previous State
- New State
- Reason
- MCP Action Performed
- Testing Performed
- Result
- Known Impact
- Rollback Method

## Business Decision Log

Record:

- Decision ID
- Date
- Decision
- Reason
- Affected Components
- Approved By, if provided

Examples include the first day of the reporting week, whether only approved production counts toward completion, the historical-rate snapshot rule, treatment of negative transactions, and closed-project behavior.

## Open-Issue Log

Record:

- Issue ID
- Sprint
- Description
- Business Impact
- Technical Impact
- Priority
- Recommended Resolution
- Status

## Data Event Version Inventory

For every Data Event record:

- Name
- Version
- Environment
- Trigger
- Fields Monitored
- Fields Modified
- Queries Performed
- Dependencies
- Offline Behavior
- Purpose
- Deployment Date
- Rollback Version

---

# SPRINT 0 — DISCOVERY AND ARCHITECTURE

## Objective

Inspect the real Fulcrum environment and produce an evidence-based architecture before building anything.

## Required Discovery

Inventory all relevant:

- Apps
- Forms
- Fields and field keys
- Repeatable sections
- Choice lists
- Classification sets
- Record-link fields
- Existing records and approximate volumes
- Data Events
- Reports
- Roles and permissions
- Exports and integrations

Identify which current objects are authoritative, obsolete, duplicated, ambiguous, or unsafe to modify.

## Business-Process Discovery

Document the current and desired workflow for:

- Project setup
- Contractor assignment
- Labor-code administration
- Rate administration
- Field production
- Underground work
- Aerial work
- Fiber placement
- Splicing
- QA/QC
- Approval
- Scope and change orders
- Material usage
- Billing and financial reconciliation
- Project closeout

## Proposed Logical Architecture

Evaluate and recommend the appropriate Fulcrum app structure for:

- Projects
- Contractors
- Labor Codes
- Contractor Rates
- Materials
- Labor–Material Mappings
- Project Scope
- Production
- Material Transactions
- Structures
- Segments/Routes
- Fiber Reels
- Change Orders
- QA/QC
- Approvals

Do not assume each conceptual entity requires a separate app. Use the minimum architecture that remains maintainable, reportable, and safe.

## Sprint 0 Deliverables

- Current-state inventory
- Proposed architecture
- Logical relationship diagram
- Preliminary field dictionary
- Stable-key strategy
- Source-of-truth matrix
- Online/offline dependency matrix
- Permission-model recommendation
- Risk register
- Business questions requiring answers
- Recommended implementation order

**STOP AFTER SPRINT 0. Do not proceed to Sprint 1 until I approve the architecture.**

---

# SPRINT 1 — CORE MASTER DATA

## Objective

Establish controlled, stable master data for projects, contractors, labor codes, work categories, units, and related lookup values.

## Requirements

Create or refine stable records for:

- Projects
- Contractors
- Labor Codes
- Work Categories
- Units of Measure
- Crews, if required
- Routes/Segments, if required

Each master record should include a stable ID, human-readable name/description, active status, effective dates where relevant, ownership, and administrative notes.

Inactive records must remain understandable on historical transactions while being unavailable for ordinary new production.

## Validation

Test duplicate IDs, duplicate names, inactive values, renamed display values, missing required fields, and historical links to deactivated records.

## Deliverables

- Master-data schema
- Field keys and IDs
- Duplicate-prevention rules
- Activation/deactivation process
- Master-data ownership recommendation
- Test results

Stop for approval.

---

# SPRINT 2 — CONTRACTOR RATE MODEL

## Objective

Implement a contractor-rate model that selects the correct rate by contractor, project applicability, labor code, and production date while preserving historical pricing.

## Required Rate Fields

- Rate ID
- Contractor ID
- Labor Code
- Project or applicability scope
- Rate amount
- Currency
- Effective date
- Expiration date
- Contract/amendment reference
- Active status
- Approval status
- Notes

## Selection Rules

The selected rate must be deterministic. Detect and report:

- Missing rates
- Zero rates
- Multiple overlapping applicable rates
- Expired rates
- Future-dated rates
- Contractor/project mismatches
- Labor-code mismatches

Store a rate snapshot and source reference on the production transaction when it becomes financially authoritative.

## Validation

Test effective-date boundaries, overlapping rates, project-specific versus general rates, deactivated contractors, historical records, and rate changes after approval.

Stop for approval.

---

# SPRINT 3 — PRODUCTION TRANSACTION FOUNDATION

## Objective

Create the authoritative production-transaction structure used by all work categories.

## Core Fields

- Production ID
- Project
- Contractor
- Crew
- Work date
- Work category
- Labor code
- Quantity
- Unit
- Rate snapshot
- Rate source/Rate ID
- Extended value
- Route/Segment
- From Structure
- To Structure
- GPS
- Photos/attachments
- Notes
- Approval status
- Submitted by/at
- Approved by/at
- Correction/reversal references
- Calculation version

Use conditional visibility to minimize field-user input. Automatically derive safe, deterministic values.

## Record Lifecycle

Define allowed state transitions and who may perform each transition. Approved or billed records must not be casually edited or deleted.

## Validation

Test missing project, contractor, labor code, quantity, invalid unit, duplicate submission, closed project, inactive master data, and unauthorized status changes.

Stop for approval.

---

# SPRINT 4 — FIBER PLACEMENT AND SEQUENTIAL CALCULATION

## Objective

Implement accurate fiber-placement entry using reel sequentials and slack.

## Required Inputs and Outputs

Support fields such as:

- Fiber Reel
- Start Sequential
- End Sequential
- Direction or payout orientation, if required
- Calculated Sequential Footage
- Slack by location or category
- Total Installed Footage
- Route/Segment
- From/To Structure

Define the precise formula and behavior for ascending and descending sequentials. Prevent negative or impossible footage unless a controlled adjustment workflow explicitly allows it.

## Controls

Test:

- Start less than end
- Start greater than end
- Equal sequentials
- Missing sequential
- Reel capacity exceeded
- Overlapping ranges
- Duplicate range
- Multiple slack entries
- Zero/negative slack
- Offline entry and later synchronization

Document whether overlap detection is possible offline or requires connectivity.

Stop for approval.

---

# SPRINT 5 — UNDERGROUND CONSTRUCTION

## Objective

Implement underground production for bore, trench, plow, conduit, structures, and related construction units.

## Requirements

Support:

- Work method
- Conduit/pipe package
- Number and size of conduits
- From/To structures
- Installed footage
- Bore/trench/plow quantities
- Surface type and restoration, where applicable
- Adders and special units
- Required QA/photos

Labor codes must remain explicit. A bundled code such as `BM60(1.25)DP` must not hide materially different pipe packages when the contract requires separately priced units. Distinguish packages such as one through five 1.25-inch conduits and any approved dual/multi-pipe adder structure.

## Calculations

Derive installed conduit footage and mapped materials without combining incompatible units. Validate that package count, footage, and labor code agree.

## Tests

Test one through maximum pipe counts, zero footage, negative footage, invalid structures, duplicate segment production, adders, material multipliers, and offline use.

Stop for approval.

---

# SPRINT 6 — AERIAL CONSTRUCTION

## Objective

Implement aerial production for strand, lash, fiber placement, transfers, risers, pole work, guying, and other approved aerial labor units.

## Requirements

Capture only the fields required by the selected labor code. Support structure/pole references, From/To limits, footage, counts, cable/fiber attributes, attachments, and QA evidence.

Prevent accidental combination of footage, each, pole, and assembly units in a single physical-production total.

## Tests

Test footage units, each-based units, missing structures, invalid spans, duplicate spans, required photos, inactive labor codes, pricing, material mappings, and offline use.

Stop for approval.

---

# SPRINT 7 — SPLICING AND TESTING

## Objective

Implement splicing and testing workflows for enclosures, trays, fibers, cables, locations, and test results.

## Requirements

Support applicable items such as:

- Splice location
- Closure/enclosure
- Cable or reel
- Fiber range/count
- Splice type
- Labor code
- Quantity
- Test type
- Pass/fail result
- Test attachment
- Photos
- Technician/crew

Use repeatable sections only where calculations and reporting remain reliable.

## Tests

Test one and many splice entries, overlapping fiber ranges, missing test documentation, failed tests, repeatable-row add/edit/delete, pricing, materials, and synchronization.

Stop for approval.

---

# SPRINT 8 — MATERIAL MASTER AND LABOR–MATERIAL MAPPING

## Objective

Create a maintainable material master and rules translating production into expected material quantities.

## Material Master

Include:

- Material ID
- Description
- Unit
- Category
- Part number
- Manufacturer, where supplied
- Active status
- Notes

## Mapping Model

Each mapping should identify:

- Mapping ID
- Labor Code
- Material
- Multiplier
- Output Unit
- Effective date
- Expiration date
- Applicability conditions
- Active status
- Approval/reference

Example: 2,000 FT of `UG-BORE-3X125` may map to 6,000 FT of 1.25-inch HDPE, 2,000 FT of trace wire, and 6,000 FT of mule tape when approved construction requirements specify those values.

Never guess a multiplier. Flag ambiguous mappings for business review.

## Historical Integrity

Store or otherwise preserve transaction-level material results so later mapping changes do not silently recalculate approved history.

Stop for approval.

---

# SPRINT 9 — PROJECT SCOPE AND BASELINES

## Objective

Load and manage authorized project scope by labor code and other relevant dimensions.

## Scope Fields

- Scope Line ID
- Project
- Labor Code
- Authorized Quantity
- Unit
- Baseline Rate or value, if applicable
- Baseline/Change Order designation
- Effective date
- Status
- Source document

Baseline scope must remain distinguishable from approved change-order scope.

## Calculations

For each compatible scope line calculate:

- Authorized quantity
- Approved completed quantity
- Pending quantity
- Remaining quantity
- Percent complete
- Authorized value
- Approved earned value
- Remaining value

Do not add quantities with incompatible units.

Stop for approval.

---

# SPRINT 10 — CHANGE ORDER MANAGEMENT

## Objective

Implement controlled changes to project scope and contract value.

## Requirements

Capture:

- Change Order ID
- Project
- Description
- Reason
- Requested date
- Requested by
- Status
- Labor/scope lines
- Quantity change
- Rate/value change
- Supporting documents
- Approved by/at
- Effective date

Pending or rejected change orders must not alter authorized scope or contract value. Approved changes must remain separately traceable from baseline scope.

Stop for approval.

---

# SPRINT 11 — APPROVAL WORKFLOW

## Objective

Create a controlled production-review and approval lifecycle.

## Workflow

Define:

- Draft
- Submitted
- Pending Review
- Approved
- Rejected/Correction Required
- Reopened
- Voided
- Reversed
- Adjusted

Document allowed actors, required reasons, timestamp behavior, and whether edits are allowed in each state.

Approval must snapshot financially material calculation outputs. Rejected records must not count toward official production. Approved records must require reopening or an explicit adjustment/correction process before material changes.

Stop for approval.

---

# SPRINT 12 — FINANCIAL CALCULATIONS

## Objective

Produce reliable transaction and project financial values.

## Formula

At transaction level:

`Approved Quantity × Applicable Rate = Extended Production Value`

Apply approved currency-rounding rules consistently.

## Required Financial Views

- Approved value
- Pending value
- Rejected value
- Voided/reversed value
- Daily value
- Weekly value
- Monthly value
- Project-to-date value
- Contractor value
- Labor-code value
- Remaining contract value

Never represent submitted historical activity as approved earned value.

Stop for approval.

---

# SPRINT 13 — QA/QC

## Objective

Implement quality controls without obscuring production or financial status.

## Requirements

Support:

- QA/QC ID
- Production reference
- Inspection type
- Result
- Deficiency category
- Severity
- Required corrective action
- Assigned owner
- Due date
- Photos/documents
- Resolution
- Closed by/at

Define whether a failed QA result blocks submission, approval, billing, or closeout. Record the decision explicitly.

Stop for approval.

---

# SPRINT 14 — DATA INTEGRITY AND DUPLICATE PREVENTION

## Objective

Detect invalid, orphaned, overlapping, or duplicate transactions.

## Controls

Evaluate deterministic and warning-based checks for:

- Duplicate Production ID
- Same project/contractor/labor/date/quantity
- Same structure pair and labor code
- Overlapping fiber sequentials
- Duplicate reel range
- Invalid project relationship
- Invalid contractor relationship
- Missing rate source
- Missing material mapping
- Orphan records
- Closed-project production
- Inactive master-data use

Document false-positive risks and online/offline limitations.

Stop for approval.

---

# SPRINT 15 — STRUCTURES, ROUTES, AND SEGMENTS

## Objective

Create consistent location and network references for construction production.

## Requirements

Define stable identifiers and relationships for structures, poles, handholes, vaults, routes, and segments as applicable. Preserve historical meaning if labels change.

Validate From/To combinations, project ownership, route/segment membership, inactive structures, and direction-dependent calculations.

Stop for approval.

---

# SPRINT 16 — OPERATIONAL REPORTING

## Objective

Create reliable daily, weekly, monthly, and project-to-date reporting.

## Reports

At minimum provide or design:

- Daily production
- Weekly production
- Monthly production
- Project-to-date production
- Contractor production
- Labor-code production
- Physical production by compatible unit
- Pending approvals
- Rejected/corrected production
- QA exceptions
- Missing rates
- Missing material mappings
- Duplicate/overlap exceptions

Every summary value must be traceable to contributing transactions.

Stop for approval.

---

# SPRINT 17 — MANAGEMENT DASHBOARDS

## Objective

Give management concise project, financial, schedule, quantity, and exception visibility.

## Metrics

- Authorized scope/value
- Approved production/value
- Pending production/value
- Remaining scope/value
- Physical completion
- Financial completion
- Current-week and current-month production
- Open QA issues
- Projects or labor codes over plan
- Missing rates and mappings
- Contractor trends

Do not combine incompatible physical units into one misleading production number.

Stop for approval.

---

# SPRINT 18 — FORECASTING AND PRODUCTION VELOCITY

## Objective

Estimate remaining duration and production trajectory using transparent assumptions.

## Metrics

- Current 7-day production
- Previous 7-day production
- Current 30-day production
- Average active-day production
- Remaining quantity
- Estimated working days remaining
- Daily financial burn rate
- 7-day and 30-day average value

Forecasts must be labeled as estimates and must not replace authorized scope or financial truth.

Stop for approval.

---

# SPRINT 19 — FIBER REEL MANAGEMENT

## Objective

Track fiber reels and sequential usage where operationally justified.

## Requirements

Track:

- Reel ID
- Cable/fiber type
- Manufacturer
- Starting and ending sequential
- Original length
- Used ranges
- Remaining estimate
- Project assignment
- Contractor/crew custody where needed
- Status

Detect impossible or overlapping usage and reconcile reel usage to fiber-production transactions. Clearly document controls that require connectivity.

Stop for approval.

---

# SPRINT 20 — FIELD USER EXPERIENCE AND OFFLINE WORKFLOW

## Objective

Minimize field input while preserving control and auditability.

## Review

Evaluate:

- Field order
- Conditional visibility
- Default values
- Required fields
- Choice-list size
- Lookup clarity
- Mobile usability
- Photo workflow
- GPS workflow
- Repeatable-section usability
- Offline capture
- Sync/conflict behavior

The field user should enter the smallest reasonable amount of information; the system should derive only what is safe and deterministic.

Stop for approval.

---

# SPRINT 21 — PERFORMANCE, SCALE, AND MAINTAINABILITY

## Objective

Verify the architecture remains usable at realistic project and transaction volumes.

## Evaluate

- App load time
- Record save time
- Data Event execution
- Cross-record queries
- Lookup size
- Report speed
- Sync time
- Photo volume
- Large record behavior
- Multiple concurrent users

Identify actual bottlenecks before redesigning. Prefer administrative tables and configuration over growing hard-coded JavaScript branches.

Stop for approval.

---

# SPRINT 22 — AUDITABILITY, EXCEPTIONS, AND CLOSEOUT

## Objective

Complete the system controls required to explain transactions, resolve exceptions, and close projects safely.

## Auditability

For any financial production transaction, the system should be able to answer:

- Which project was involved?
- Which contractor performed the work?
- Which labor code was used?
- What quantity and unit were approved?
- What rate was applied?
- Which rate source was used?
- What materials were calculated?
- Who approved it and when?
- Was it later corrected, reversed, voided, or adjusted?

## Exception Management

Create views or reports for missing rates, zero rates, overlapping rates, missing mappings, orphan records, duplicates, fiber overlaps, over-plan quantities, old pending approvals, QA failures, and synchronization issues.

## Closeout

Define project-closing prerequisites, final reconciliation, open-item review, final scope and change-order validation, permission changes, and how closed projects reject ordinary new production.

Stop for approval.

---

# SPRINT 23 — TESTING AND USER ACCEPTANCE

## Objective

Prove the complete solution with documented evidence. Do not assume functionality works because it was configured.

## Comprehensive Regression Scope

Test:

- Project lookup
- Contractor lookup
- Labor-code selection
- Contractor-rate lookup
- Effective-date rate selection
- Historical rate snapshot
- Extended production value
- Fiber sequential calculation
- Slack calculation
- Total installed footage
- Sequential overlap detection
- Reel-range validation
- Underground calculations
- Aerial production
- Splicing
- Material mapping
- Material quantities
- Scope calculations
- Remaining work
- Change orders
- Approval workflow
- QA/QC
- Duplicate detection
- Daily, weekly, monthly, and project-to-date reporting
- Contractor and financial reporting
- Exception reporting
- Offline workflows
- Sync behavior
- Permissions
- Project closeout

## Automated Test Case Documentation

For every test record:

- Test Case ID
- Sprint
- Feature
- Test Description
- Preconditions
- Input Data
- Expected Result
- Actual Result
- PASS/FAIL
- Tester
- Test Date
- Notes
- Associated Defect ID, where applicable

Use consistent IDs such as `TEST-CORE-001`, `TEST-FIBER-001`, `TEST-UG-001`, `TEST-AERIAL-001`, `TEST-SPLICE-001`, `TEST-RATE-001`, `TEST-MAT-001`, `TEST-SCOPE-001`, `TEST-FIN-001`, `TEST-QA-001`, `TEST-REPORT-001`, `TEST-OFFLINE-001`, `TEST-SEC-001`, `TEST-PERF-001`, and `TEST-DESTRUCT-001`.

## Defect Tracking

For every failed test record:

- Defect ID
- Test Case ID
- Sprint
- Feature
- Description
- Severity
- Expected Behavior
- Actual Behavior
- Reproduction Steps
- Affected Records
- Financial Impact
- Data Impact
- Status
- Assigned Owner
- Resolution
- Retest Result

Use severity based on business impact:

- **CRITICAL:** incorrect rate, financial miscalculation, silent historical repricing, corruption, approved-data deletion, cross-project contamination, major security failure.
- **HIGH:** incorrect remaining work/materials, double counting, wrong project, material offline-sync failure.
- **MEDIUM:** warning, report filter, visibility, or noncritical validation error.
- **LOW:** label, formatting, minor usability, or cosmetic issue.

## Financial Reconciliation

Independently calculate `Quantity × Rate = Extended Value` and total by project, contractor, labor code, day, week, month, and approval status. Require exact reconciliation within approved currency-rounding rules.

## Quantity and Material Reconciliation

Independently total fiber, underground, aerial, conduit, handholes, vaults, splices, and other labor units at transaction, daily, weekly, monthly, project-to-date, and remaining-work levels.

For selected labor codes, manually calculate expected materials and compare them with Fulcrum. Confirm project totals and transaction-level traceability.

## Source-to-Report Traceability

Select values from management reports and trace each to source transactions, including production value, material consumption, fiber footage, splice count, remaining work, approved value, and pending value.

## Filter and Date-Boundary Testing

Test project, contractor, date range, work category, labor code, approval status, crew, route, and segment filters individually and in combination.

Test January 1, December 31, first/last day of month, first/last reporting day of week, leap day, and records near midnight. Confirm the intended organizational timezone.

## Approval Total Reconciliation

For a controlled project with $100,000 approved, $25,000 pending, and $10,000 rejected, verify that official approved value remains $100,000, pending remains $25,000, and rejected remains $10,000. Do not show $135,000 as approved earned production.

## Zero, Negative, and Override Testing

Determine which fields permit zero or negative values. Normal production should generally reject negative quantities. Adjustments, reversals, or credits must use an explicit controlled transaction type.

For every manual override test who may override, whether a reason is required, whether the original value is preserved, whether reports show the override, and whether overridden transactions are identifiable.

## Attachment, GPS, Repeatable, Large-Record, and Concurrency Testing

Test single/multiple photos, large photo sets, offline photos, synchronization, metadata, required evidence, valid/poor/missing GPS, permitted location changes, repeatable add/edit/delete behavior, realistic maximum record complexity, and concurrent users on the same project.

Ensure one repeatable-row deletion does not corrupt another row and that concurrent activity does not create duplicate IDs, rate conflicts, incorrect totals, overwritten production, or unexpected Data Event behavior.

## Rate-Sheet and Material-List Validation

Sample source contractor-rate sheets across underground, aerial, fiber, splicing, testing, structures, adders, and special units. Compare contract rate, Fulcrum rate, labor code, unit, effective date, contractor, and project applicability. Create an exception list.

Validate material code, description, unit, part number, category, manufacturer where supplied, active status, mapping, and multiplier. Never invent unclear relationships.

## Destructive-Change Impact and Test Matrix

Where practical, provide an impact report before changing critical master data. For example, before deactivating `UG-BORE-125`, identify active projects, active contractor rates, material mappings, historical records, and pending production that use it.

Expand and execute a matrix covering rate changes, labor deactivation, material mapping changes, project renames, project scope changes, contractor deactivation, structure deactivation, and Data Event changes. Record whether history is protected, new records are affected, warnings/approvals are required, and the actual PASS/FAIL result.

Destructive-change testing passes only when:

1. Approved production cannot be silently repriced.
2. Historical quantities cannot silently recalculate after master-data changes.
3. Historical material quantities remain reproducible.
4. Deactivated data remains understandable historically.
5. New transactions cannot unintentionally use inactive data.
6. Rates are versioned/effective-dated.
7. Unit changes cannot reinterpret history.
8. Display-name changes do not break relationships.
9. Stable identifiers support permanent relationships where possible.
10. Mapping changes do not silently change approved history.
11. Approved production requires a visible reopening/correction/adjustment event for material edits.
12. Finalized or billed production cannot be deleted normally.
13. Voids/reversals remain auditable but are excluded from official totals.
14. Baseline scope remains separate from approved changes.
15. Pending/rejected change orders do not alter authorization.
16. Closed projects reject normal new production.
17. Inactive master data cannot normally be selected for new work.
18. Historical records using inactive data remain reportable.
19. Orphan records are detectable.
20. Data Event changes are versioned and regression tested.
21. New Data Event logic does not recalculate history without an approved migration.
22. Mass recalculation has documented before/after impact.
23. Critical changes are permission restricted.
24. Each approved transaction preserves enough detail to explain its calculation.
25. Every destructive-change scenario has a recorded result.
26. Every failure has impact, correction, priority, owner, and retest status.
27. No financially material failure remains unresolved before launch.

## Security and Permission Testing

Test representative roles against view, create, edit, approve, administer, export, and delete/void/reverse capabilities. Recommend a role model using actual Fulcrum capabilities, and document platform limitations.

## User Acceptance Testing

Conduct realistic UAT with applicable roles:

- Project Manager
- Construction Manager
- Field Inspector
- Splicing Inspector
- Contract Administrator
- Finance/Billing User
- Fulcrum Administrator
- Contractor User

Field Inspector UAT must cover underground, conduit package, structures, footage, photos, submission, fiber sequentials, slack, and correction of a rejected record.

Project Manager UAT must determine whether Fulcrum can answer daily/weekly/monthly work, installed fiber, underground footage, remaining work, approved/pending value, remaining contract value, over-plan codes, open QA issues, contractor quantities, and incomplete work.

Contract/Billing UAT must cover contractor production, rates, extended values, missing rates, pending/approved production, billing periods, change orders, remaining value, and overrides.

Administrator UAT must cover contractors, rates, expiration, labor codes, deactivation, materials, mappings, projects, scope, change orders, closeout, exception reports, and test-environment Data Event updates.

Track UAT feedback by Feedback ID, role, user, date, workflow, issue/request, severity, type, suggested change, decision, implementation, and retest. Classify as BUG, USABILITY, ENHANCEMENT, BUSINESS RULE, or TRAINING.

## Acceptance and Readiness

Mark Core Production, Underground, Aerial, Fiber, Splicing, Materials, Rates, Financials, Scope, Remaining Work, Change Orders, QA/QC, Reports, Offline Use, Security, Performance, Auditability, and Closeout as PASS, PASS WITH ACCEPTED LIMITATION, or FAIL.

Maintain a known-limitations register with limitation, cause, affected users, impact, workaround, risk, and future improvement.

Do not recommend production until:

- All CRITICAL defects are closed.
- HIGH defects are closed or formally accepted.
- Financial, quantity, rate, and material reconciliations pass.
- Approval, historical-rate protection, destructive-change, and permission tests pass.
- Offline limitations are documented.
- UAT sign-off is complete.
- Recovery, administrator, and field-user documentation exists.

## Sprint 23 Deliverables

Provide test summary, complete case matrix, results, defects, severity summary, reconciliations, rate/material validations, offline matrix, performance/security/destructive-change results, UAT, limitations, readiness assessment, remediation recommendations, user/admin guides, Data Event inventory, master-data inventory, and final architecture/relationship diagrams.

Sprint 23 is complete only when field production can be entered once, validated automatically, translated into accurate labor and material quantities, priced correctly, approved through a controlled workflow, compared with authorized scope, aggregated into reliable reporting, and traced from management totals to original transactions without losing historical accuracy after master-data changes.

**Once Sprint 23 is complete, STOP. Do not make production changes until test results and readiness findings have been reviewed.**

---

# SPRINT 24 — PRODUCTION DEPLOYMENT

## Pre-Deployment Gate

Confirm Sprint 23, defect disposition, rate/material/labor/scope validation, permissions, versioned Data Events, offline/known limitations, UAT, production ownership, and support process. Mark every item PASS, FAIL, or NOT APPLICABLE.

## Configuration Freeze and Baseline

Freeze labor codes, rates, mappings, scope, Data Events, choices, keys, and approval logic except for documented deployment-blocking changes.

Record the production baseline: app version, Data Event versions, schema, choices/classifications, master-record counts, active projects, reports, and permissions.

## Pilot and Rollout

Launch one representative pilot project containing underground, fiber, splicing, contractor production, materials, and approval. Success requires usable field entry, correct events/rates/materials/footage, reconciled reports, working approvals, understood offline behavior, usable management reporting, and no critical defects.

After approval, roll out in monitored waves such as 1–3 projects, then 5–10, then remaining projects.

Stop for approval.

---

# SPRINT 25 — USER TRAINING AND DOCUMENTATION

Create role-specific materials rather than one generic manual.

## Field Inspector

Cover login, assignment sync, project/contractor selection, underground/aerial/fiber/splicing entry, sequentials, slack, photos, GPS, submission, rejection correction, offline work, and resync.

## Project Manager

Cover daily/weekly/monthly production, remaining work, over-plan quantities, contractor performance, financials, pending approvals, QA exceptions, materials, and change orders.

## Contract/Finance

Cover rates, effective dates, validation, approvals, billing reconciliation, change orders, pending/approved production, exceptions, and overrides.

## Administrator

Cover app structure, field keys, Data Events, master data, mappings, project/scope setup, changes, permissions, exceptions, deployments, and tests.

Create quick-reference guides for core production, fiber, underground, splicing, QA, approval, rate maintenance, mapping maintenance, and project setup.

Stop for approval.

---

# SPRINT 26 — OPERATIONAL GOVERNANCE

Assign Business Owner, Fulcrum Administrator, Data Owner, Rate Administrator, Material Administrator, Project Administrator, Technical/Data Event Owner, Report Owner, and Support Contact.

Create procedures for projects, contractors, labor codes, rates, materials, mappings, structures, scope, and change orders. Require validation before activation.

Every labor code must define code, description, category, unit, calculation method, work type, material mapping, rate availability, effective date, and approval. Avoid duplicates.

Every rate change must capture contractor, applicability, code, old/new rate, dates, reason, contract reference, and approver. Never overwrite historical rates.

Stop for approval.

---

# SPRINT 27 — AUDIT AND COMPLIANCE OPERATIONS

## Daily

Check missing/zero rates, failed calculations, missing project/contractor, potential duplicates, and critical QA failures.

## Weekly

Check over-plan production, sequential overlaps, aged approvals, missing mappings, inactive-code use, material variance, and contractor anomalies.

## Monthly

Perform financial, rate, scope, material, permission, exception-backlog, and data-quality reviews.

Create a rate-audit report showing contractor, project, labor code, production date, rate used, expected rate, rate source, and difference. Periodically verify that historical quantities, rates, values, statuses, relationships, and material quantities have not unexpectedly changed.

Stop for approval.

---

# SPRINT 28 — ADVANCED REPORTING AND MANAGEMENT ANALYTICS

Use Fulcrum reporting where it meets requirements; otherwise prepare clean data for external analytics such as Power BI. Fulcrum remains the operational source of truth.

Create or design:

- Executive Project Summary
- Project Performance
- Contractor Analytics
- Crew Productivity
- Daily Burn Rate
- Production Velocity

Include authorized/completed/remaining scope, physical and financial completion, current production, exceptions, approvals, materials, contractor values, QA/correction counts, turnaround, trends, and forecast metrics. Keep incompatible units separate.

Stop for approval.

---

# SPRINT 29 — POWER BI / EXTERNAL ANALYTICS READINESS

Prepare clean conceptual datasets for Projects, Contractors, Production, Labor Codes, Rates, Materials, Material Transactions, Mappings, Scope, Change Orders, Structures, Segments, Fiber Reels, QA/QC, and Approvals.

Use stable keys and a proper date dimension supporting year, quarter, month, week, day, reporting period, and fiscal periods if required.

Recommend a star schema:

- Facts: Production, Material, Change Orders, QA
- Dimensions: Project, Contractor, Labor, Material, Date, Structure, Crew

Keep transaction-level authoritative quantity, rate, extended value, sequential footage, material usage, and approval status in Fulcrum. Power BI should primarily aggregate and analyze. Do not calculate contractor rates independently in both systems.

Stop for approval.

---

# SPRINT 30 — INTEGRATION AND AUTOMATION READINESS

Prepare for possible Smartsheet, Power BI, ERP/accounting, invoice reconciliation, GIS/ArcGIS, document storage, contractor portal, and API integrations without building unapproved integrations.

Expose stable IDs. Add export status, last export date, external ID, error, and retry fields only when an actual integration needs them.

Use persistent Production IDs for idempotency. Re-exporting `PRD-000123` must not create duplicate financial activity.

Prepare invoice reconciliation using project, contractor, labor code, period, and Production ID where available. Detect invoice quantity above/below approval, wrong rate, unknown code, duplicate item, and unapproved production billed.

Stop for approval.

---

# SPRINT 31 — BACKUP, RECOVERY, AND BUSINESS CONTINUITY

Define periodic exports for production, projects, rates, materials, scope, change orders, approvals, and available configuration. Do not claim exports replace platform backups.

Document recovery for accidental rate changes, deleted/deactivated masters, bad mappings, bad Data Event deployments, mass updates, user errors, duplicates, and scope errors.

Retain the previous known-good Data Event version before deployment and document rollback.

Before mass changes: export affected records, count them, calculate impact, test a sample, perform the update, reconcile, and document the result.

Track significant incidents by ID, date, detector, description, projects/records, financial/operational impact, root cause, correction, preventive action, and resolution date.

Stop for approval.

---

# SPRINT 32 — CONTINUOUS IMPROVEMENT AND SYSTEM MATURITY

## Enhancement Backlog

Track Request ID, description, requester, business problem, users, priority, benefit, complexity, risk, dependencies, decision, and target sprint.

Classify changes as BUG FIX, DATA CORRECTION, CONFIGURATION CHANGE, BUSINESS RULE CHANGE, NEW FEATURE, REPORT ENHANCEMENT, or INTEGRATION.

## Release Process

Develop, test, regression test, conduct UAT as appropriate, document, version, deploy, validate, and monitor. Never make untested Data Event changes directly in production.

Use semantic versions such as 1.0.0, 1.1.0, 1.1.1, and 2.0.0. Record version, release date, features, changes, fixes, data/Data Event changes, known issues, and user action.

## Periodic Review

Review record/project/contractor volume, rate/material complexity, reports, offline needs, integrations, load/save/event/query/report/sync performance, and large-project behavior.

Maintain a data-quality scorecard: valid rates, approved production, required documentation, duplicates, missing mappings, QA failures, open corrections, orphans, and rate exceptions.

Evaluate safe automation opportunities such as exception identification, project status, rate validation, material variance, reporting periods, scope warnings, and fiber overlap warnings. Do not automate final financial approval without explicit requirements and controls.

## AI/MCP Operating Model

Future Claude sessions must:

1. Inspect configuration before modifying it.
2. Use actual field keys.
3. Read current Data Events first.
4. Avoid deletion without impact analysis.
5. Explain significant changes.
6. Preserve historical financial values.
7. Test code before completion.
8. Use the Test Project.
9. Never test destructive logic against live production records.
10. Maintain version information.
11. Document MCP modifications.
12. State limitations rather than fabricate support.
13. Reconcile after major changes.
14. Stop on unexpected schema/data conditions.
15. Prefer data-driven maintenance over hard-coded JavaScript.

## Final System Review

Produce final inventories for apps, Data Events, master data, and reports. For each app include purpose, record count where available, primary identifier, relationships, and owner. For each report include purpose, source, metrics, filters, and audience.

Create a final relationship map covering:

- Project → Project Scope → Production
- Production → Contractor, Labor Code, Rate, Structure/Segment, Fiber Reel
- Labor Code → Labor–Material Mapping → Material
- Production → Material Transactions
- Project → Change Orders
- Production → QA/Approval
- Production → Reporting/Financials

## Final Success Workflow

The mature system must reliably support:

Project Scope → Field Construction → Production Record → Automatic Labor Classification → Automatic Fiber/Quantity Calculation → Automatic Contractor Rate Selection → Automatic Material Calculation → QA/QC → Approval → Project Quantity Update → Financial Production Update → Remaining Work → Daily/Weekly/Monthly Reporting → Invoice/Management Reconciliation.

## Final Handoff Deliverable

Provide one maintainable handoff containing:

1. Executive Summary
2. Architecture
3. Fulcrum App Inventory
4. Field Dictionary
5. Field Key Dictionary
6. Relationship Diagram
7. Labor Code Model
8. Contractor Rate Model
9. Material Model
10. Labor-to-Material Mapping Model
11. Fiber Sequential Logic
12. Underground Workflow
13. Aerial Workflow
14. Splicing Workflow
15. QA/QC Workflow
16. Approval Workflow
17. Scope Management
18. Change Order Management
19. Financial Calculations
20. Remaining Work Calculations
21. Data Event Documentation
22. Reporting Architecture
23. Security Model
24. Offline Capability Matrix
25. Testing Results
26. Known Limitations
27. Administrator Guide
28. Field User Guide
29. Project Manager Guide
30. Contract/Finance Guide
31. Support Procedures
32. Backup/Recovery Procedures
33. Change-Control Procedures
34. Release History
35. Open Issues
36. Recommended Future Enhancements

Documentation must allow another qualified Fulcrum administrator or developer to maintain the system without the original conversation.

Stop for final review and approval.

---

# FULCRUM LIMITATION FORMAT

Whenever Fulcrum cannot support a requested capability, document:

**Requested Capability**

**Fulcrum Limitation**

**Operational Impact**

**Recommended Alternative**

Do not invent unsupported functionality or MCP commands.

---

# REQUIRED SPRINT-COMPLETION REPORT

At the end of every sprint:

1. State exactly what was created or changed.
2. Identify MCP actions performed.
3. List important field keys and IDs created or used.
4. List Data Events created or modified, including versions.
5. Report tests actually performed.
6. Report PASS/FAIL results with evidence.
7. Identify unresolved issues.
8. Identify Fulcrum limitations.
9. Update the implementation, decision, issue, and version logs.
10. State whether the sprint is safe to approve.

Then **STOP** and wait for my instruction before beginning the next sprint.

---

# FINAL OPERATING INSTRUCTION

Use Fulcrum MCP to inspect the real environment before implementation decisions. Preserve an auditable source and calculation path whenever information affects contractor payment, project scope, billing, materials, or historical production.

Do not proceed merely because a later task appears straightforward. Do not silently repair ambiguous business data. Do not mark unexecuted tests PASS. Do not make destructive production changes without impact analysis, authorization, testing, and rollback.

Begin with **Sprint 0 only**.
