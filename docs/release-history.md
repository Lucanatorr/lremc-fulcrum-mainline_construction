# Release History

The system as a whole carries one **semantic version**: MAJOR.MINOR.PATCH.
Each Data Event keeps its own version too (`fulcrum/known-good/registry.json`).

| Part | Bumped when |
|---|---|
| MAJOR | A change that breaks what users, reports or integrations rely on: a status removed, a field's meaning changed, a key format changed |
| MINOR | New capability, added compatibly: a field, a status, a report, an app |
| PATCH | A fix that changes no documented behaviour except the defect |

**The system is pre-1.0.** Nothing in this repository is in production. The
production app `148545bf…` has never been changed by this project. **1.0.0
is reserved for the first production release**, after the twelve
pre-deployment gates pass (`docs/sprint-24-deployment-readiness.md`). Until
then every release goes to **Development** only.

The versions below were assigned retrospectively on 2026-11-12, from the git
history and the implementation log. Every release from 0.10.0 on is versioned
when it is made.

"Deployed" means the date the change went live in the Development apps.
That is not always the commit date. From 2026-09-22 to 2026-11-09,
`forms_update` refused every write (OI-02, INC-0004), so the fixes committed
in that window went live together on 2026-11-09.

---

## 0.10.0 (2026-11-12): Sprints 31–32, continuity and maturity

| | |
|---|---|
| Features | Backup exports and manifest; backup verification with deletion detection; configuration snapshot; known-good Data Event retention and rollback; mass-change control; incident register; enhancement backlog; this release history; data-quality scorecard; final inventories, relationship map and handoff |
| Changes | Backout procedure updated for v7.7.0 |
| Fixes | — |
| Data / Data Event changes | **None.** No app, field, record or script changed |
| Known issues | OI-24: four script headers say v1.0.0 for the deployed v1.1.0 |
| User action | None |

## 0.9.0 (2026-11-12): self-approval guard; Sprints 27–30, audit, analytics, BI and integration readiness

| | |
|---|---|
| Features | No one approves their own production; `approval_independence` audit column. Daily, weekly and monthly audits; history fingerprint; expected-rate audit; six analytics reports; 17 Power BI datasets; integration export with idempotency contract; invoice reconciliation |
| Changes | Material-coverage register; scope-baseline validator; UAT kit; role model |
| Fixes | — |
| Data / Data Event changes | **Mainline 7.6.0 → 7.7.0**, deployed 2026-11-12 16:19, read back byte-identical. Elements unchanged |
| Known issues | OI-22 residual (contractor A approving contractor B) needs the role change; OI-23 webhooks |
| User action | An approver who also entered or submitted the record now sees a refusal, and must leave it for a second person |

## 0.8.0 (2026-11-09): Sprints 24–26, readiness, training, governance

| | |
|---|---|
| Features | Pre-deployment gate, live baseline, pilot plan, backout procedure; role training and quick references; governance |
| Changes | — |
| Fixes | Three report status-filter defects (INC-0006) |
| Data / Data Event changes | None |
| Known issues | — |
| User action | None |

## 0.7.0 (2026-11-09): Sprint 23, lifecycle and traceability

| | |
|---|---|
| Features | REOPENED and REVERSED statuses, Adjustment records (D-018); `calc_version` (D-019); QA owner and due date; rate Currency and Contract Reference, editable Unit (D-020); `voided-reversed` report; burn rate |
| Changes | — |
| Fixes | — |
| Data / Data Event changes | **Mainline 7.5.0 → 7.6.0** (elements 14:22, script 14:26); **Contractor Rate 1.0.0 → 1.1.0** 14:31 (fixes INC-0005) |
| Known issues | Self-approval possible (OI-22, found in 0.8.0) |
| User action | Reviewers have three new correction paths. Training: `docs/training/` |

## 0.6.1 (deployed 2026-11-09, committed 2026-09-22): the held-back fixes

| | |
|---|---|
| Features | — |
| Changes | — |
| Fixes | Unit erased on every save: Mainline, Scope Line, Change Order (INC-0002). Work dates derived a day early: Mainline, Material Transaction, Structure (INC-0003). A mapping join that could never match |
| Data / Data Event changes | **Mainline → 7.5.0** (7.4.0 was committed but never deployed on its own); **Scope Line, Change Order, Material Transaction, Structure → 1.1.0**; Mainline unit copy-down `m024 <- r010` |
| Known issues | Records saved before the fix keep their old values until re-saved (OI-19: PRD-2026-143C1840) |
| User action | Sync devices |

## 0.6.0 (2026-09-21): Sprints 16–23 build

| | |
|---|---|
| Features | Forecasting, productivity, fiber reel master v2 (no stored totals, D-012); field UX; scale review, audit trail, exception dashboard; project closeout app |
| Changes | — |
| Fixes | `USEREMAIL()` crash in the web editor (INC-0001, v7.1.0) |
| Data / Data Event changes | **Mainline 7.0.0 → 7.3.0**, through 7.1.0 and 7.2.0 (7.3.0 deployed 2026-09-21 20:31, 140 elements); **Fiber Reel 2.0.0**; **Closeout 1.0.0** (new app) |
| Known issues | — |
| User action | Field users: new field layout |

## 0.5.0 (2026-09-17; the Mainline part live 2026-09-21): Sprints 9–15

| | |
|---|---|
| Features | Project scope baseline and change orders; production and financial reporting; QA/QC approval gate; fingerprints and duplicate detection; structures and segments |
| Changes | — |
| Fixes | — |
| Data / Data Event changes | Mainline 5.0.0 was committed; `forms_update` refused it (first outage, about 3 days), so it went live as **7.0.0** on 2026-09-21. **Scope Line, Change Order, Structure, Segment 1.0.0** (new apps; per-app dates in `docs/data-event-inventory.md`) |
| Known issues | — |
| User action | — |

## 0.4.0 (2026-09-16/17): Sprints 7–8, splicing and materials

| | |
|---|---|
| Features | Splicing; material master; atomic material ledger; DP pull-count units and size-dependent material (revision) |
| Changes | — |
| Fixes | — |
| Data / Data Event changes | **Mainline 4.0.0**; **Material Transaction 1.0.0** |
| Known issues | — |
| User action | — |

## 0.3.0 (2026-09-16): Sprints 2–6

| | |
|---|---|
| Features | Master data backbone; versioned contractor pricing; fiber reel master; underground, aerial and overlap reporting |
| Changes | — |
| Fixes | — |
| Data / Data Event changes | **Contractor Rate 1.0.0**, live but uncommitted until 2026-11-09 (INC-0005); **Mapping 1.0.0** |
| Known issues | — |
| User action | — |

## 0.1.0 (2026-09-16): Sprints 0–1

| | |
|---|---|
| Features | Discovery; Development production app, rebuilt to the Sprint 1 hierarchy (71 elements) |
| Changes | — |
| Fixes | — |
| Data / Data Event changes | — |
| Known issues | Credentials found in the production app's script (OI-01, INC-0008) |
| User action | — |

---

## Recording a release

Add a section at the top with the fields above: version, date, features,
changes, fixes, data and Data Event changes, known issues, and user action.
Then:
1. Bump the per-app versions in `fulcrum/known-good/registry.json`, using
   `known_good.py promote`.
2. Bump `CALC_VERSION` in the Mainline script, so records show which
   version calculated them.
3. Update `docs/data-event-inventory.md`.
4. Tag the commit `vX.Y.Z`.

The steps before a release is recorded are in
`docs/sprint-32-continuous-improvement.md` §2.
