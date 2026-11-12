# LREMC Fulcrum Mainline Construction: rules for AI/MCP sessions

This repository is the source of truth for the **MC Development** apps in
Fulcrum: the Data Event scripts, element schemas, SQL reports, tests and
operating documents. Start with `docs/HANDOFF.md`.

## Hard constraints

- **The production app `148545bf-b869-454e-a2b9-44a9860f23de` is read-only.**
  Never write to it. All work targets the Development apps listed in
  `reports/_conventions.md`. No production change until the test results and
  readiness findings have been reviewed and the Business Owner approves.
- **Fulcrum writes go only through `mcp__fulcrum-app__app-mcp_fulcrum_forms_update`**
  (the direct `fulcrum-app` server in `.mcp.json`). Never route a write
  around the tool through a script or raw HTTP. Read-only scripts are fine.
- **Never commit a secret.** No tokens. Webhook URLs contain signing
  secrets: record webhook IDs only.
- **Never mark an unexecuted test PASS.** Never claim a capability Fulcrum
  does not have: use the limitation format (Requested Capability / Fulcrum
  Limitation / Operational Impact / Recommended Alternative).

## The fifteen operating rules

1. Inspect configuration before modifying it: `forms_get`, then
   `python3 scripts/known_good.py preflight <app> <forms_get.json>`.
2. Use actual field keys and data_names (`docs/field-dictionary.md`).
   Preserve every existing key on `forms_update`.
3. Read the current Data Event first. `fulcrum/known-good/<app>.js` holds the
   live bytes.
4. No deletion without impact analysis. Hide an element that holds data;
   never remove it. Never delete a record: VOID / REVERSED / Adjustment (D-018).
5. Explain significant changes: the commit message, `docs/implementation-log.md`
   and `docs/data-event-inventory.md`.
6. Preserve historical financial values. Never re-price approved production
   (D-003). `scripts/mass_change.py` blocks historical records.
7. Test before completion: `for t in tests/*.test.js; do node $t; done` must
   be green. Read every deployment back and compare it byte for byte.
8. Use the Test Project (PRJ-000001, MCP-TEST-001).
9. Never test destructive logic against live production records.
10. Maintain version information: the script header, `CALC_VERSION`,
    `fulcrum/known-good/registry.json` (`known_good.py promote`) and
    `docs/release-history.md`.
11. Document every MCP modification: tool, time, and read-back result.
12. State limitations rather than fabricate support.
13. Reconcile after major changes: `config_snapshot.py --compare`,
    `backup_verify.py`, `mass_change.py reconcile`, and the affected reports
    run live.
14. Stop on unexpected schema or data conditions: a failed preflight, an
    UNREGISTERED script, a DELETED row, a DIFFERS no release explains. Ask.
15. Prefer data-driven maintenance (masters, mappings, choice lists) over
    hard-coded JavaScript.

## Running a report through the MCP query tool

The tool takes one line, turns `+` into a space, and refuses requests over
about 9 KB. Use `python3 scripts/flatten_report.py <file> --mcp`, plus
`scripts/slice_report.py` for `exception-dashboard.sql`. Reports follow
`reports/_conventions.md`: only APPROVED is official, and quantities are
never summed across units.

## Before you commit

- Run the full test suite.
- Run `python3 scripts/field_dictionary.py --check`,
  `python3 scripts/report_inventory.py --check` and
  `python3 scripts/known_good.py check`. Regenerate if stale.
- Update the logs: implementation, decision, open issues, data-event
  inventory, release history.
