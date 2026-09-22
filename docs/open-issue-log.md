# Open-Issue Log

Required by the master prompt. Items were previously referenced by number
("open item 26") across the implementation log with no register defining them.

Priority: **P1** blocks production · **P2** needed soon after · **P3** accepted for now

| ID | Sprint | Description | Business Impact | Technical Impact | Priority | Recommended Resolution | Status |
|---|---|---|---|---|---|---|---|
| OI-01 | 23 | Two live API credentials (Fulcrum + Smartsheet) are plain string literals in the **production** app's Data Event script | Full account access is readable by anyone who can sync the app; app script syncs to every field device | Rotate both; move any integration server-side | **P1** | Rotate both tokens immediately. The production app has never been modified from here | OPEN |
| OI-02 | — | `forms_update` refuses all writes, including a call with no changes | The unit fix and the timezone fix cannot be deployed; records entered today save with a null unit and, pre-fix, a wrong work date | Deploy is a replay of validated payloads once writes return | **P1** | Retry; precedent is it clears on its own (3 days last time) | OPEN |
| OI-03 | 11 | Production lifecycle has no Reopened / Reversed / Adjusted state | An approved record cannot be reopened as a visible event, which is destructive-change condition 11 | Status choices + gate logic | **P1** | Add the three states and the reopen reason | OPEN |
| OI-04 | 23 | Destructive-change matrix has 62 designed rows and zero recorded results | The prompt's central safety gate is unproven | Execute against the test project | **P1** | Run each scenario, record actual PASS/FAIL, answer the 27 conditions | OPEN |
| OI-05 | 23 | No security or permission testing; no role model recommended | Unknown who can approve, export or void | Fulcrum roles | **P1** | Test representative roles; document platform limits | OPEN |
| OI-06 | 23 | No UAT with real users; no feedback register | UAT sign-off is a stated precondition for production | — | Run the eight role sessions the prompt lists | **P1** | OPEN |
| OI-07 | 12 | No voided/reversed value view | "What was voided this period?" is unanswerable | One report | P2 | Add to contractor-financial or its own report | OPEN |
| OI-08 | 3 | No calculation/Data Event version stamped on production records | After a pricing rule changes, affected records cannot be selected | One disabled TextField | P2 | Stamp once on first save | OPEN |
| OI-09 | 2 | Rate master has no Currency or Contract/amendment reference | A rate dispute cannot be traced to the executed amendment | Two fields | P2 | Add both | OPEN |
| OI-10 | 13 | QA/QC has no QA ID, inspection type, assigned owner, due date, resolution or closed-by | An open deficiency cannot be assigned or chased | Fields on production, or a QA app | P2 | Add owner + due date at minimum | OPEN |
| OI-11 | 8 | 89 of 146 labor codes have no material mapping | Purchasing cannot forecast those units | Detectable by design via exception-dashboard | P2 | Business review, code by code | OPEN |
| OI-12 | 8 | 2" conduit part numbers unknown; 4-pull and 5-pull 1.25" SKUs unknown | Those runs resolve to no stock part | Mapping rows held back rather than guessed | P2 | Business owner supplies part numbers | OPEN |
| OI-13 | 22 | Seven billing gaps: 13,000+ FT already in the ground with no pay unit | Work done that cannot be billed | Rate sheet coverage | P2 | Business owner rules on pricing | OPEN |
| OI-14 | 18 | Forecasting has no named daily burn rate or previous-7-day metric | Two prompt metrics unreported | Report columns | P3 | Add to production-trend | OPEN |
| OI-15 | 20 | No consolidated offline capability matrix | Prompt forbids representing an online-only control as an offline guarantee | Documentation | P3 → now addressed, see `offline-capability-matrix.md` | CLOSED 2026-09-22 |
| OI-16 | — | Sprints 24–32 never started | Deployment, training, governance, analytics, backup and continuous improvement are unbuilt | — | P2 | Resume at Sprint 24 after the Sprint 23 gate closes | OPEN |
| OI-17 | 23 | The organizational reporting timezone has never been stated | Derivation is now timezone-independent, but report consumers may still assume differently | — | P3 | Business owner confirms | OPEN |
