# EA Audit Tool — Complete Work Breakdown (all steps)

Every step across all 10 build phases. Each step ends with a tested deliverable + your go-ahead gate (see `PROJECT-PLAN.md` for the protocol).

**Legend:** `E` = estimated effort. `1` = one session, `1–2` = may span two. Total: **103 steps ≈ 120–135 sessions.**

**Status key:** ✅ done · ▶ in progress · ⬜ not started

---

## Phase 0 — Foundations (8 steps)

| # | Step | E | Expected outcome |
|---|---|---|---|
| ✅ 0.1 | Repo scaffold & tooling | 1 | Next.js+TS+Tailwind app, native Postgres, GitHub repo — **DONE** |
| ✅ 0.2 | DB bootstrap + migration runner | 1 | Tenant/User/Membership tables (raw SQL); `withTenant()` helper; GUC test passes |
| ✅ 0.3 | RLS + isolation proof | 1 | Row-Level Security enforced; test proves cross-tenant reads return zero rows |
| ✅ 0.4 | Auth + RBAC (standard login) | 1–2 | Email/password login; role permissions; route guards — **DONE** (2FA descoped) |
| ✅ 0.5 | Two-tenant seed + E2E proof | 1 | Two firms seeded; Playwright proves Firm A can't see Firm B via UI or API |
| ✅ 0.6 | i18n plumbing (EN/FR) | 1 | Every screen renders EN + FR; toggle; missing-translation test |
| ✅ 0.7 | Notification service skeleton | 1 | In-app inbox; notifications tenant/user-scoped |
| ✅ 0.8 | CI + Phase 0 acceptance demo | 1 | GitHub Actions runs typecheck/lint/tests/isolation-proof; live acceptance walkthrough |

## Phase 1 — Engagement & audit file core (12 steps)

| # | Step | E | Expected outcome |
|---|---|---|---|
| ✅ 1.1 | Clients & engagements data model | 1 | Raw-SQL tables + tenant-scoped loaders for clients and engagements |
| ✅ 1.2 | Client management UI | 1 | Create/list/view a firm's audit clients |
| ✅ 1.3 | Engagement management UI | 1 | Create an engagement (one client × one fiscal year); list/open |
| ✅ 1.4 | File Index engine (A–F) | 1 | The exact A/B/C/D/E/F index structure (preserving the numbering gaps) as data + engine |
| ✅ 1.5 | Working-paper object model | 1 | workpaper / version / signoff tables + migration |
| ✅ 1.6 | Word template library + .docx generation | 1–2 | Versioned bilingual templates; merge-field convention; generate a .docx working paper |
| ✅ 1.7 | Document open→edit→close round-trip | 1–2 | Chosen mechanism (WebDAV / OnlyOffice / download-upload fallback) working end-to-end |
| ✅ 1.8 | Versioning + check-in/out locking | 1 | Single-editor lock; full version history with restore |
| ✅ 1.9 | PDF preview per version | 1 | In-browser PDF render of any version (reviewers need no Word) |
| ✅ 1.10 | Sign-off workflow | 1 | Preparer→reviewer; signing freezes version + stores hash; reopen voids sign-off |
| ✅ 1.11 | Review notes (coaching notes) | 1 | Point-by-point notes on docs/steps; must be cleared before sign-off |
| ✅ 1.12 | Phase 1 acceptance E2E | 1 | create engagement → instantiate D3.1 → open → edit → v2 → sign off → locked |

## Phase 2 — Acceptance & planning (14 steps)

| # | Step | E | Expected outcome |
|---|---|---|---|
| ✅ 2.1 | D-form structured-field framework | 1 | Hybrid "structured fields in app + narrative in doc" pattern working |
| ✅ 2.2 | D3.1 acceptance/continuance + partner gate | 1 | New/continuing checklists; engagement can't advance until partner signs |
| ✅ 2.3 | Independence campaign engine | 1–2 | Emails staff unique links; structured independence form; e-signature |
| ✅ 2.4 | Independence dashboard + reminders | 1 | sent/opened/completed/exceptions; auto-reminders; exception→threat record |
| ✅ 2.5 | Engagement letter generator (+ co-CAC) | 1 | Bilingual letter from merge fields; co-commissariat variant |
| ✅ 2.6 | Mandate tracking | 1 | 2/6-year mandate start/expiry; final-year warning |
| ✅ 2.7 | D6.1 job administration | 1 | Team assignment; hours-by-grade budget; PBC request list |
| ✅ 2.8 | D1 Engagement Strategy Driver | 1 | Master planning checklist (status/owner/linked form per step) |
| ✅ 2.9 | Materiality calculator | 1–2 | Benchmark×% → overall; performance materiality; trivial threshold; versioned |
| ✅ 2.10 | Materiality approval gate + propagation | 1 | Partner gate; revision re-flags dependent artifacts |
| ✅ 2.11 | Understanding forms (D4.x) + rollforward | 1–2 | Entity/environment/internal-control forms; carry-forward "confirm or update" |
| ✅ 2.12 | Risk register D7.1→D7.2 lifecycle | 1–2 | Raise/dismiss/promote risks; identified→planned→executed→concluded lifecycle |
| ✅ 2.13 | Significant-risk consequences + planning-close gates | 1 | Significant-risk rules enforced; stand-back; blocks close on uncovered material area |
| ✅ 2.14 | Program library + tailoring; Phase 2 acceptance E2E | 1 | Programs tailored by risk; significant revenue risk appears in E100 header; gates block |

## Phase 3 — TB, groupings, lead schedules (10 steps)

| # | Step | E | Expected outcome |
|---|---|---|---|
| ✅ 3.1 | TB import (column-mapping wizard) | 1 | Excel/CSV import with saved per-client mappings |
| ✅ 3.2 | TB validation | 1 | debits=credits, SYSCOHADA codification, opening-ties-to-prior checks |
| ✅ 3.3 | TB versions + diff + adjusting journals | 1 | initial/adjusted/final versions; reproducible final = initial + adjustments |
| ✅ 3.4 | Sub-ledger imports | 1 | AR/AP/FAR/inventory/payroll/bank as typed datasets attached to sections |
| ✅ 3.5 | SYSCOHADA grouping library | 1–2 | 2-digit map + FS REF codes as seed data (from Appendix B) + loader |
| ✅ 3.6 | Client grouping overrides | 1 | Per-client override/extend; unmapped accounts block lead-schedule gen |
| ✅ 3.7 | Lead schedule generation | 1–2 | Excel (live formulas) + mirrored app tables, per E-section |
| ✅ 3.8 | Lead schedule distribution + regen | 1 | Assign/notify/check-in; regenerate preserving commentary & tickmarks |
| ✅ 3.9 | Preliminary analytical review (D4.3) | 1 | Auto variance table + ratios + threshold flags with "raise risk?" |
| ✅ 3.10 | Phase 3 acceptance E2E | 1 | import demo TB → lead schedules → variance flag → promoted to a risk |

## Phase 4 — Execution / fieldwork (12 steps)

| # | Step | E | Expected outcome |
|---|---|---|---|
| ✅ 4.1 | Section workspace shell | 1 | E-section layout; linked risks pinned at top; program checklist |
| ✅ 4.2 | Program-step execution | 1 | Mark complete + conclusion per step |
| ✅ 4.3 | Evidence attachment | 1 | File upload / PBC link / automation output attached to steps |
| ✅ 4.4 | Matter-arising routing framework | 1 | Route a finding to exactly one of B4/B5/C1/revise-approach with backlink |
| ✅ 4.5 | Misstatements B5 | 1 | Raise misstatements (types); trivial threshold; running total |
| ✅ 4.6 | B5 evaluation vs materiality | 1 | Individual + aggregate vs final materiality; prior-year effects; adjusting-entry table |
| ✅ 4.7 | Control tests + deviations | 1 | Deviation forces extend/abandon/deficiency decision |
| ✅ 4.8 | Findings → B4 significant matters | 1 | Opinion-relevant findings aggregate into B4 |
| ✅ 4.9 | Findings → C1 management letter | 1 | Control deficiencies aggregate into the management letter |
| ✅ 4.10 | Revise-approach loop | 1 | Adds a dated risk to D7.2 after approval; partner re-approval required |
| ✅ 4.11 | Review workflow | 1 | Two-stage review; partner review on significant-risk sections |
| ✅ 4.12 | Phase 4 acceptance E2E | 1 | run execution; raise misstatements; B5 totals live; revise-approach adds dated risk |

## Phase 5 — Automation engines (10 steps)

| # | Step | E | Expected outcome |
|---|---|---|---|
| ✅ 5.1 | Automation-run framework | 1 | Every run records inputs/params/timestamp/user; indexed output doc; reproducible |
| ✅ 5.2 | Sampling engine (methods) | 1–2 | random / systematic / MUS / criteria-based selection |
| ✅ 5.3 | Sampling evaluation | 1 | Projected misstatement auto-computed → B5 |
| ✅ 5.4 | Sub-ledger→GL/TB reconciliation | 1 | AR/AP/inventory/payroll reconciled; differences → findings |
| ✅ 5.5 | Fixed-asset-register→TB reconciliation | 1 | FAR movements schedule + exceptions; ties to depreciation & bilan lines |
| ✅ 5.6 | Bank reconciliation re-performance | 1 | Re-performs client rec; ages/flags stale & window-dressing items |
| ✅ 5.7 | Supplier statement reconciliation | 1 | Statement vs ledger per supplier; timing vs true differences |
| ✅ 5.8 | Journal-entry testing (E350) | 1–2 | Risk-scoring filters + unpredictability; testing worksheet |
| ✅ 5.9 | Analytical procedures engine | 1–2 | 3 modes; ratio library; expectation-vs-actual; unexplained variance → B5 |
| ✅ 5.10 | Phase 5 acceptance E2E | 1 | each engine runs on demo data; a projected misstatement lands in B5 |

## Phase 6 — Circularisations (8 steps)

| # | Step | E | Expected outcome |
|---|---|---|---|
| ⬜ 6.1 | Selection engine | 1 | Criteria-based selection per type (AR/AP/bank/legal) |
| ⬜ 6.2 | Letter generation (all types) | 1–2 | positive open/closed, negative, bank, legal, third-party, related-party — bilingual |
| ⬜ 6.3 | Dispatch (email + print pack) | 1 | Send from tool with unique reply-to tokens; postal pack fallback |
| ⬜ 6.4 | Tracking lifecycle | 1 | prepared→approved→sent→reply per confirmation |
| ⬜ 6.5 | Reminder auto-scheduling | 1 | 1st/2nd reminders on configurable cadence |
| ⬜ 6.6 | Reply evaluation | 1 | confirmed vs book; differences dispositioned → B5 |
| ⬜ 6.7 | Alternative procedures + summary + B6 | 1 | Non-replies → alt-procedures; summary working paper; outstanding → B6 |
| ⬜ 6.8 | Phase 6 acceptance E2E | 1 | full AR + bank cycle incl. one non-reply flowing to alternative procedures |

## Phase 7 — Conclusion & reporting (12 steps)

| # | Step | E | Expected outcome |
|---|---|---|---|
| ⬜ 7.1 | B1 completion checklist framework | 1 | Completion checklist scaffolding + gate registry |
| ⬜ 7.2 | Completion gates enforcement | 1–2 | All numbered completion gates block report issuance until satisfied |
| ⬜ 7.3 | Final analytical review (A1) | 1 | Auto FS-level analytics on final figures; conclusions recorded |
| ⬜ 7.4 | FS tie-out: Bilan | 1–2 | Recompute Bilan (Brut/Amort/Net) from mapped TB; diff vs client FS |
| ⬜ 7.5 | FS tie-out: Compte de résultat | 1–2 | Recompute SIG cascade (XA–XI); diff vs client FS |
| ⬜ 7.6 | Disclosure checklist (Notes 1–36) | 1 | SYSCOHADA annexes checklist |
| ⬜ 7.7 | Subsequent events (B7/E380) | 1 | Review to report date + facts-after-report-date branch |
| ⬜ 7.8 | Representation letters | 1 | OHADA two-letter layering (pre-arrêté + complementary) |
| ⬜ 7.9 | Opinion decision tree | 1 | ISA 700/705/706/570/701 unmodified/qualified/adverse/disclaimer logic |
| ⬜ 7.10 | Report builder (ISA + OHADA pack) | 1–2 | FR statutory report with vérifications spécifiques; KAM for listed |
| ⬜ 7.11 | 60-day assembly clock + archive | 1 | Assembly timer; immutable PDF/A + JSON archive; file locks |
| ⬜ 7.12 | Rollforward N→N+1; Phase 7 acceptance E2E | 1 | issue unmodified OHADA report; archive locks; roll forward carrying understanding |

## Phase 8 — OHADA legal module (9 steps)

| # | Step | E | Expected outcome |
|---|---|---|---|
| ⬜ 8.1 | F1 statutory deadlines calendar | 1 | Auto-generated deadlines from period-end/AGM; countdowns + escalation |
| ⬜ 8.2 | F2 conventions register | 1 | Legal-form-aware register of conventions réglementées |
| ⬜ 8.3 | F2 rapport spécial generator | 1 | Builds the report from the register (FR); 15-day deposit tracked |
| ⬜ 8.4 | F3 article 715 report | 1 | Generated from live engagement data before the board meeting |
| ⬜ 8.5 | F4 procédure d'alerte state machine | 1–2 | Non-SA + SA/SAS variants; letters + deadline timers per transition |
| ⬜ 8.6 | F5 faits délictueux + signalement letters | 1 | Révélation to ministère public + irregularities letters (access-controlled) |
| ⬜ 8.7 | F6 registres attestation + F7 equity monitoring | 1 | Titres attestation; capitaux propres < ½ capital workflow |
| ⬜ 8.8 | F8 co-CAC coordination | 1 | Work-split, cross-review, joint report with disagreement disclosure |
| ⬜ 8.9 | Phase 8 acceptance E2E | 1 | demo SA triggers a conventions rapport spécial + an alerte walkthrough |

## Phase 9 — Portal, dashboards, polish (8 steps)

| # | Step | E | Expected outcome |
|---|---|---|---|
| ⬜ 9.1 | Client portal auth + PBC flow | 1 | External client users receive PBC requests, upload documents |
| ⬜ 9.2 | Portal document-response tracking | 1 | requested→uploaded→accepted per item; attach to working papers |
| ⬜ 9.3 | Engagement dashboard | 1 | Phase progress, forms outstanding, risks by status, B5 vs materiality, deadlines |
| ⬜ 9.4 | Firm dashboard | 1 | Engagements by phase; deadlines heat list; workload; mandate expiries |
| ⬜ 9.5 | Portfolio risk views | 1 | Significant risks + B5 exposure across all engagements |
| ⬜ 9.6 | Exports for regulators | 1 | File index with statuses (Excel/PDF) |
| ⬜ 9.7 | Performance pass | 1 | TB import <30s, lead-schedule regen <10s, pagination everywhere |
| ⬜ 9.8 | Security review + demo polish; final acceptance | 1 | Full security review; polished demo tenant; project acceptance |

---

## Totals

| Phase | Steps |
|---|---|
| 0 Foundations | 8 |
| 1 Engagement & file core | 12 |
| 2 Acceptance & planning | 14 |
| 3 TB & lead schedules | 10 |
| 4 Execution | 12 |
| 5 Automation engines | 10 |
| 6 Circularisations | 8 |
| 7 Conclusion & reporting | 12 |
| 8 OHADA legal | 9 |
| 9 Portal & polish | 8 |
| **Total** | **103 steps (~120–135 sessions)** |

---

## Pace note — 30 steps/day

At 30 steps/day the whole build is **~3.5 days** of steps. That pace is achievable on the *build* side, but the binding constraint is the **test-and-approve gate**: 30 steps/day is roughly one approval every ~16 minutes across an 8-hour day, and several steps (document round-trip 1.7, materiality 2.9, FS tie-out 7.4–7.5, report builder 7.10) need real hands-on testing that takes longer than that.

**To actually hit 30/day, the workflow shifts to batching:** I build a batch of steps back-to-back, run every test myself, then present the batch together — status + preview + combined test results — for you to approve as a group rather than one at a time. Individual gates still exist in the record, but your review happens in batches. Confirm you want the batched workflow and how big a batch you're comfortable approving at once (e.g. a full phase, or 5–10 steps).
