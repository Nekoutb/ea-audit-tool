# MASTER BUILD PROMPT — "EA AUDIT" : Multi-Tenant SaaS Statutory Audit Platform (ISA / OHADA)

> **How to use this prompt:** Paste this entire document into Claude Code as the founding instruction for the project. Work through the Build Plan (Section 17) phase by phase across sessions. Treat every numbered requirement as a requirement, not a suggestion. Where a decision is genuinely open, this document says so explicitly.

---

## 0. BEFORE YOU WRITE ANY CODE

1. **Dev stack:** CONFIRMED (2026-07-09) — see Section 0.1. Reference project: `EA Financial Audit/platform`. Replicate its structure/tooling/conventions, with Prisma swapped for raw SQL per the coding conventions below.
2. **Coding conventions (non-negotiable, stack-independent):**
   - Type hints / static types on all function signatures.
   - No ORM. Raw SQL with parameterized queries only. Migrations as versioned SQL files.
   - Tests live in `/tests` mirroring the `/src` structure. Every module ships with tests.
   - Never commit API keys or credentials; use environment variables and a documented `.env.example`.
   - Error handling everywhere; no bare `except`/catch-all clauses. Errors are logged with context and surfaced to the user in plain language.
   - Follow existing patterns in the codebase before introducing new ones.
3. **Working method:** At the start of each phase, restate the phase's acceptance criteria, propose the data model and API surface for that phase, get my sign-off, then implement. Keep a running `ARCHITECTURE.md` and `DECISIONS.md` in the repo.
4. **If you are unsure about a library, API or standard's requirement — say so explicitly rather than guessing.**

---

## 0.1 DEVELOPMENT STACK (confirmed 2026-07-09)

Derived from a survey of the user's active projects. The strongest, most-repeated recent pattern was **Next.js + TypeScript + Prisma + PostgreSQL + NextAuth + Tailwind** (seen in `EA Financial Audit`, `API Workflow`, `te-saas`). `EA Financial Audit` is the reference project — same domain (multi-tenant ISA audit SaaS), so its folder layout, tenancy pattern and conventions transfer almost directly. One deliberate deviation from that reference: **Prisma is replaced with raw SQL**, per this project's non-negotiable "no ORM" rule (Section 0.2) — the user confirmed raw SQL over Prisma when the conflict was flagged.

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript 5.7 (strict) | Matches reference exactly. Single path alias `@/*` → project root (no `/src`, mirrors reference). |
| Styling | Tailwind CSS v4, CSS-first config (`@theme` in `globals.css`, no `tailwind.config.*`) | No component library (no shadcn/MUI) — hand-rolled components, matches reference. |
| Database | PostgreSQL 16 | Non-superuser, non-owner app role (`ea_app`) required for RLS to bite (`FORCE ROW LEVEL SECURITY`). |
| Data access | **Raw SQL via `pg` (node-postgres)**, parameterized queries only, no ORM/query-builder | Deviation from reference (which used Prisma). `pg.Pool` + a thin `withTenant()` helper (checkout client → `BEGIN` → `SELECT set_config('app.tenant_id', $1, true)` → run queries → `COMMIT`/`ROLLBACK` → release) replaces `prisma.$transaction`. |
| Migrations | Versioned `.sql` files under `/migrations`, applied via `node-pg-migrate` (runner only, no query-building) | Keeps migrations plain SQL, tracked in a `pgmigrations` table. Reference's `prisma/rls.sql` pattern is reused as-is (pure SQL, no Prisma dependency in the policies themselves). |
| Tenant isolation | `tenantId` column + Postgres **Row-Level Security**, enforced at the DB, not just the app | Directly reused from reference: `FORCE ROW LEVEL SECURITY`, `tenant_isolation` policy per table, `Membership`-equivalent table excluded from RLS (read pre-tenant-context during auth). |
| Auth | NextAuth v5 (Auth.js), Credentials provider + `bcryptjs`, JWT session strategy | Same edge-safe two-file split (`auth.config.ts` / `auth.ts`) as reference; `authorize()` rewritten as raw SQL instead of Prisma calls. No `@auth/prisma-adapter` (not needed — JWT strategy, no DB sessions). |
| RBAC | Rank-based `Role` enum (`ADMIN/PARTNER/MANAGER/SENIOR/ASSISTANT`, extended per Section 2 with `eqr_reviewer`, `read_only`, `client_user`) | Same pattern as reference `lib/rbac.ts`. |
| AI features | `@anthropic-ai/sdk` | Used only for preparation/summarization per Section 18 non-goal ("AI-drafted judgments" excluded) — analytics commentary drafts, risk-factor prompts, never final judgmental conclusions. |
| Word documents | `docx` (npm) | Matches reference; generates working papers/letters per Section 9. |
| Excel documents | `exceljs` | **New** — not in reference project (its `StepDocument` model never generated Excel). Needed for live-formula lead schedules (Section 10.3). |
| Word↔PDF preview & round-trip mechanism | **Open decision — confirm at Build Phase 1** per Section 9 item 2/9.3 | Reference project has no Word round-trip or PDF preview built yet. Candidates: (a) WebDAV + `ms-word:ofe|u|` protocol handler, (b) embedded OnlyOffice/Collabora via WOPI, (c) M365 Graph co-authoring. PDF preview likely needs headless LibreOffice (`soffice --headless --convert-to pdf`) regardless of choice. Do not guess — this is called out explicitly in Section 9 as requiring sign-off. |
| File/document storage | **Open decision** | Reference stored file bytes directly in Postgres (`Bytes` column) — won't scale to a full 10-year archive across many firms/tenants (Section 9.6, 15). Recommend object storage: local disk or MinIO (S3-compatible) in dev, S3-compatible bucket in prod, per-tenant prefix + server-side encryption (Section 2). Confirm at Build Phase 1. |
| Testing | **New — not present in reference.** Vitest (unit/integration) + Playwright (E2E: document round-trip, sign-off gates, cross-tenant isolation proof) | Tests mirror `/lib`, `/app/actions`, `/app/api` (adapted from Section 0.2's "`/tests` mirrors `/src`" since this codebase has no `/src`). |
| Linting/formatting | **New.** ESLint (`next/core-web-vitals` + `typescript-eslint` strict) + Prettier | Reference has `next lint` wired but never configured — authoring fresh. |
| CI | **New.** GitHub Actions: typecheck (`tsc --noEmit`, both root and a pure-engine tsconfig per reference's `tsconfig.engine.json` pattern), lint, unit tests, RLS cross-tenant isolation test, on every push/PR | Reference has no CI at all. |
| Local dev environment | **Deviation from reference:** `docker-compose` for Postgres (+ MinIO if object storage is chosen) | Reference ran a bare local Postgres with no containers. Given this project needs reproducible tenant-isolation tests and CI parity, containerizing dev dependencies is worth the deviation — flagging per Section 0.2's "say so if unsure" rule; confirm before Build Phase 0 finalizes. |
| i18n | **New.** Needed from Build Phase 0 per Section 15 (EN/FR from day one) — reference project is English-only; approach (e.g. `next-intl` vs hand-rolled dictionary) to be decided at Build Phase 0. |

**Carried over verbatim from the reference project (pattern, not code):** the tenancy model (`requireTenant()` → `withTenant()` → RLS), the RBAC rank-check helpers, the auth two-file edge/node split, the "pure domain engine typechecked in isolation" pattern (`lib/engagement` + a narrow `tsconfig.engine.json`), and the loader convention (auth → tenant-scoped query → shape result).

---

## 1. PRODUCT VISION

Build **a multi-tenant SaaS audit platform for small and medium audit firms** operating under the **International Standards on Auditing (ISA)**, with first-class support for statutory audits (**commissariat aux comptes**) in the **OHADA** space, where the accounting framework is **SYSCOHADA révisé (AUDCIF)** and the reporting currency is FCFA.

The platform digitalizes the complete statutory audit file across four phases — **Pre-planning (acceptance), Planning, Execution (fieldwork) and Conclusion (completion & reporting)** — as an interactive, linked workflow in which:

- Every audit task is backed by a **Word-document form** (a working paper) generated from a template, completed by the user, opened and saved **directly from the tool**, versioned, reviewed and signed off electronically.
- **Risks, materiality, misstatements and findings flow automatically between phases** (a significant risk raised at planning is visible and addressable in execution and must be cleared at conclusion — see the Linkage Engine, Section 8).
- **Semi-automated engines** remove mechanical work: independence-confirmation email campaigns, trial-balance ingestion, auto-generated lead schedules distributed to the team as Excel files, sample selection, sub-ledger-to-GL reconciliations, fixed-asset-register-to-TB reconciliations, and third-party circularisations (AR, AP, bank, legal) with automatic letter generation, dispatch and reply tracking.
- **OHADA legal obligations of the commissaire aux comptes** (statutory deadlines, rapport spécial on conventions réglementées, article 715 report to the board, procédure d'alerte, révélation des faits délictueux, etc.) are modeled as first-class workflows with deadline timers.

The product is **bilingual English / French**. Every UI string, template, generated letter and generated report exists in both languages; language is selectable per firm (default) and overridable per engagement. All generated statutory deliverables for OHADA engagements default to French.

Target users: audit firms of roughly 2–50 professional staff running statutory and contractual audits of SMEs. Design for low-bandwidth environments (West/Central Africa): fast pages, sensible payloads, resumable file uploads.

---

## 2. TENANCY MODEL

Three-level hierarchy:

1. **Platform (us)** — superadmin console: manage firm tenants, subscriptions/plans, global template library versions, usage metrics. Platform staff can NEVER read engagement content; support access requires firm-granted, time-boxed, fully audit-logged impersonation.
2. **Firm tenant** — an audit firm. Owns: its staff users, its methodology configuration (form templates, account-grouping libraries, materiality benchmark defaults, letterheads/branding, signature blocks, email identity for outbound campaigns), its clients and engagements.
3. **Client sub-tenant** — an audit client of the firm. Owns: entity profile (legal form SA/SARL/SAS/GIE, listed / appel public à l'épargne flag, co-CAC flag, mandate details), fiscal-year engagements, a **client portal** (limited external users: client contacts who can receive PBC requests, upload documents, and view/respond to requests — never the audit file itself).

**Engagement** = one audit of one client for one fiscal year. Engagements roll forward (Section 8.6).

Isolation requirements:
- Hard tenant isolation at the data layer. Choose ONE strategy and document it in `DECISIONS.md` (schema-per-tenant or shared-schema with `tenant_id` on every row + row-level security). Every SQL query must be tenant-scoped by construction; write a test that proves cross-tenant reads are impossible through the API.
- File storage segregated per tenant (per-tenant prefix/bucket, server-side encryption).
- Per-tenant encryption keys for documents at rest are a plus; at minimum, encryption at rest + TLS in transit.

**Roles & permissions (RBAC), per firm:**
`firm_admin`, `partner` (engagement partner), `manager`, `senior`, `staff`, `eqr_reviewer` (engagement quality reviewer — must be independent of the engagement team; the system must block assigning an EQR who is on the team), `read_only` (e.g., inspector/regulator access, time-boxed), `client_user` (portal only). Permissions are engagement-scoped: a user sees only engagements they are assigned to (firm_admin and partners can see all).

---

## 3. THE AUDIT FILE — CORE DOMAIN MODEL

The heart of the product is a digital **audit file** per engagement, using the international-methodology indexing convention below. Model it as a configurable **File Index** (firms may rename/extend, but ship this as the default). The numbering gaps (no D2, no D5.3; D1 jumps to D3.1) are intentional — they follow the methodology's convention — preserve the numbering exactly, do not "normalize" it:

- **A — Financial statements**: `A1` Financial Statements Program (disclosure checklist, final analytical review, agreement of FS to trial balance).
- **B — Completion**: `B1` Completion Checklist · `B2` Engagement Quality Review · `B3` Consultation Record · `B4` Significant Matters/Issues · `B5` Summary of Misstatements · `B6` Points Outstanding · `B7` Subsequent Events Review (ISA 560) · `B8` Management Representation Letter(s) (ISA 580) · `B9` External Confirmation Letter (e.g., legal counsel) · `B10` Points Forward (next year).
- **C — Communication**: `C1` Communications with Those Charged with Governance and Management (ISA 260/265; used at BOTH planning and completion; also feeds the OHADA article 715 report).
- **D — Acceptance & Planning**:
  `D1` Engagement Strategy Driver (the checklist that drives all planning steps) ·
  `D3.1` Engagement Acceptance/Continuance Procedures (+ New Engagement Acceptance Checklist / Continuing Engagement Evaluation Checklist) ·
  `D4.1` Direction from the Engagement Partner · `D4.2` Understanding the Entity, its Environment and the Applicable Financial Reporting Framework (ISA 315) · `D4.3` Analytical Risk Assessment Procedures · `D4.4` Understanding the Components of Internal Control · `D4.5` Control Environment Assessment (optional) · `D4.6` Understanding the IT Environment (optional) · `D4.7` Reliance on Experts (ISA 620, conditional) · `D4.8` Service Organisations (ISA 402, conditional) · `D4.9` Internal Audit (ISA 610, conditional) ·
  `D5.1` Materiality (ISA 320) · `D5.2` Commitments & Contingencies (migrates to E-section at end of planning) · `D5.4` Fraud Risk Assessment (ISA 240) · `D5.5` Going Concern — preliminary (ISA 570) · `D5.6` Related Parties (ISA 550) · `D5.7` Accounting Estimates — planning (ISA 540) ·
  `D6.1` Documentation of Job Arrangements (team, timetable, budget, arrangement letter) · `D7.1` Team Discussion · `D7.2` Risk Assessment (the risk register).
- **E — Execution sections** (one per audit cycle/FSLI, numbered E100, E110, …): each section contains
  `Exxx` **Section Control Sheet** (planning conclusion for the area, risks cross-referenced from D7.2, the tailored audit program with every step mapped to assertions, a "revise approach" log, and the section conclusion) →
  `Exxx.1` **Lead Schedule** (auto-generated — Section 10) →
  `Exxx.2` Control Activities Testing Form(s) →
  `Exxx.3` Estimates & Fair Values procedures form →
  `Exxx.4+` detailed working papers, with children like `Exxx.4.1` sampling worksheet / CAAT evidence.
  Ship these **standard cross-cutting E-sections with pre-built programs**: `E270` Commitments & Contingencies (received from D5.2) · `E280` Equity & Reserves · `E310` Laws & Regulations / NOCLAR (ISA 250) · `E320` Related Parties (ISA 550) · `E330` Going Concern (ISA 570) · `E350` Fraud & Management Override (ISA 240 — journal entry testing lives here) · `E360` Minutes & Statutory Records · `E370` Opening Balances & Comparatives (ISA 510/710) · `E380` Subsequent Events (ISA 560) · `E390` Accounting Estimates (ISA 540).
- **F — OHADA statutory section** (our addition): `F1` Statutory Deadlines Calendar · `F2` Conventions Réglementées Register & Rapport Spécial · `F3` Article 715 Report to the Board · `F4` Procédure d'Alerte file · `F5` Révélation des Faits Délictueux · `F6` Registres de Titres Nominatifs attestation · `F7` Equity vs Half-of-Share-Capital monitoring · `F8` Co-CAC coordination file (joint audits).

**Assertions model** used throughout programs and risk mapping — five combined assertions:
**C** Completeness · **E** Existence/Occurrence · **A** Accuracy/Cut-off/Classification · **V** Valuation/Allocation/Rights & Obligations · **P** Presentation.
Every audit-program step must be tagged with ≥1 assertion; every assertion-level risk must be mapped to assertions; coverage views show, per section, which assertions are addressed by which steps.

**Default audit cycles (E-sections) to ship**, each with a suggested substantive program library derived from the international methodology:
Revenue & Receivables (incl. ECL/provision for doubtful debts) · Purchases & Payables (incl. unrecorded-liability search, supplier statement reconciliations) · Payroll & Personnel costs · Inventories (incl. physical count attendance form, ISA 501) · Property, Plant & Equipment (incl. FAR reconciliation) · Intangibles & Goodwill · Investments & Financial assets · Cash & Bank / Loans & Borrowings (incl. bank reconciliation re-performance) · Taxation (current + deferred; incl. tax-rate reconciliation) · VAT/Sales taxes · Provisions & Employee benefits (incl. pension provisioning — mandatory under SYSCOHADA Art. 48) · Leases / Location-acquisition (class 17) · Equity & Reserves · HAO items (SYSCOHADA classes 8 / accounts 48) · Construction contracts (optional) · Cash Flow Statement (TFT) tie-out.

**Two presumed risks are auto-seeded on every engagement** and cannot be deleted (only rebutted with documented justification, for the first one):
1. Fraud risk in revenue recognition (ISA 240 — rebuttable, rebuttal requires partner sign-off).
2. Management override of controls (ISA 240 — not rebuttable; always linked to E350 journal-entry testing).

---

## 4. AUDIT PHASE 1 — PRE-PLANNING / ACCEPTANCE & CONTINUANCE

> Terminology note: "Audit Phase 1–4" (Sections 4–7) are the phases of an audit engagement inside the product. "Build Phase 0–9" (Section 17) are the software delivery milestones. Never conflate the two.

Model this phase as a gated checklist (`D3.1` + `D6.1` + engagement letter). The engagement cannot move to Planning until the partner signs the acceptance conclusion.

### 4.1 Acceptance / continuance (`D3.1`, ISA 220 / ISQM 1 / IESBA Code)
- New-client flow: New Engagement Acceptance Checklist (client integrity, a firm-configurable client risk-rating scale, competence/resources, conflicts check against the firm's client base, AML/KYC checklist, predecessor-auditor communication log — record client permission; note that NOCLAR information must be shared by a predecessor without client consent).
- Continuing-client flow: Continuing Engagement Evaluation Checklist (changes in circumstances, fee status, independence re-evaluation, mandate expiry check).
- Engagement risk rating (e.g., Low/Moderate/High) drives downstream defaults: High risk suggests EQR assignment and stricter review workflow.

### 4.2 Independence confirmations — SEMI-AUTOMATED CAMPAIGN (flagship feature)
- On engagement creation (or annually firm-wide), the partner/manager launches an **independence confirmation campaign**: the tool emails every selected staff member a personalized link; the staff member completes a short structured form (financial interests, family relationships, loans, business relationships, long association/rotation, gifts & hospitality — per IESBA Code) and signs electronically.
- Dashboard: sent / opened / completed / exceptions. Automatic reminders on a configurable cadence. Exceptions (any "yes" answer) create a threat-and-safeguard record requiring partner disposition before the engagement can be accepted.
- Completed confirmations are archived into `D3.1` as PDF/Word artifacts. Support both firm-level annual campaigns and engagement-specific confirmations.

### 4.3 Terms of engagement (ISA 210 + OHADA)
- Generate the **engagement letter** from a bilingual template with merge fields (entity, framework = SYSCOHADA, deadlines, fees, team). OHADA-aware content: statutory **mandate duration — 2 fiscal years if the CAC is named in the statutes/constitutive meeting, 6 fiscal years if appointed by the ordinary general meeting (AUSCGIE art. 704)**; the tool tracks mandate start/expiry and warns on final year. Include naming of experts/collaborators assisting the CAC (art. 718). Provide a **co-commissariat variant** of the letter when the co-CAC flag is set.
- For continuing engagements, prompt reassessment of whether the letter needs reissuing (triggers checklist).

### 4.4 Job administration (`D6.1`)
- Team assignment (roles above), timetable/milestones, fee & time budget (simple hours-by-grade budget vs actual), **arrangement letter / PBC request list** to the client — the PBC list is sent through the client portal with per-item status tracking (requested → uploaded → accepted), and uploaded PBC documents can be attached as evidence to working papers.
- Group audits: flag "component of a group" / "group audit" (ISA 600). V1 scope: capture group structure, component materiality allocation and component-auditor instructions/confirmations as documents; do not build full multi-file consolidation of audit files yet.

---

## 5. AUDIT PHASE 2 — PLANNING

Planning is driven by `D1` (Engagement Strategy Driver): a master checklist listing every planning step with status, owner, linked form, and completion state. All steps below produce Word-form working papers (Section 9) plus structured data captured in the app where the Linkage Engine needs it.

### 5.1 Materiality (`D5.1`, ISA 320) — CALCULATED, NOT JUST DOCUMENTED
- Compute from the imported trial balance (or prior-year figures pre-TB): user picks a **benchmark** (profit before tax, revenue, total assets, equity, expenses — configurable list with firm-default percentage ranges, e.g. PBT 5–10%, revenue 0.5–2%, total assets 0.5–2%; ship sensible defaults and make ranges firm-configurable since the methodology defers percentages to firm policy), applies a percentage with justification text.
- Derive **performance materiality** (default 60–85% slider with justification) and the **clearly trivial threshold** (default ≤5% of overall materiality, configurable).
- Support **specific materiality** for particular balances/disclosures.
- **Partner approval gate.** Materiality is versioned: it can be **revised during the audit**; a revision re-opens affected items (flags every E-section whose scoping used the old figure, and B5 evaluation always uses FINAL materiality).
- Materiality figures propagate everywhere: lead schedules show them in the header; sampling engine uses performance materiality; B5 compares against final materiality; analytical review flags variances above thresholds.

### 5.2 Understanding & risk-assessment procedures (all feed the risk register)
- `D4.1` Partner direction memo.
- `D4.2` Understanding the entity/environment/FRF (ISA 315 Revised): structured sections (ownership & governance, business model, industry/regulatory factors, performance measures, accounting policies appropriateness, inherent risk factors, IT dependence, significant changes since last year). Rolls forward year-to-year with change-tracking.
- `D4.3` Preliminary analytical review: **auto-computed** from imported TB vs prior year — variance table by account grouping (amount & %), key ratios (margins, liquidity, gearing, activity), with per-line commentary fields; any line flagged above threshold prompts "raise potential risk?".
- `D4.4` Internal control components (control environment, entity risk assessment, monitoring, information system, control activities) + `D4.5`/`D4.6` optional detail forms. Capture **controls requiring Design & Implementation evaluation**: controls over significant risks, journal-entry controls, controls to be relied upon, and record D&I conclusion (inquiry + inspection — the form enforces documenting BOTH).
- `D4.7`/`D4.8`/`D4.9` conditional forms — the tool only instantiates them when the trigger question in `D1` is answered "yes" (expert used / service organisation / internal audit function).
- `D5.2` Commitments & contingencies preliminary assessment → auto-migrates to `E270` when planning closes.
- `D5.4` Fraud risk assessment: fraud-triangle questionnaire, inquiries of management AND those charged with governance, fraud risk factors; links to the two presumed risks.
- `D5.5` Going concern preliminary assessment: events/conditions checklist; if doubt indicators exist, flags the OHADA **procédure d'alerte** module (Section 12.4).
- `D5.6` Related parties: capture the **related-party register** (names, nature of relationship) as structured data — this register also drives the OHADA conventions réglementées workflow (Section 12.2).
- `D5.7` Accounting estimates inventory: each estimate captured as structured data (nature, method, assumptions, data, estimation uncertainty, retrospective-review result) → drives `E390` and the `Exxx.3` forms.

### 5.3 Team discussion & the risk register (`D7.1` → `D7.2`) — THE LINKAGE CORE
- Every planning form has a **"Raise potential risk"** action. Potential risks accumulate in `D7.1` (part 1) with source cross-reference (form + field).
- `D7.1` Team Discussion: record attendees, date, fraud susceptibility discussion; for each potential risk, either **dismiss with documented rationale** or **promote to `D7.2`**. One-person engagements: form adapts (no discussion, partner self-review).
- `D7.2` Risk Assessment — structured risk register, each risk carrying:
  - description, source reference, financial-statement-level vs assertion-level;
  - for assertion-level: affected E-section(s)/FSLI(s) + assertions (C/E/A/V/P);
  - inherent risk rating = **likelihood × magnitude → Low/Medium/High** (spectrum of inherent risk; prompt the inherent risk factors: complexity, subjectivity, change, uncertainty, susceptibility to bias/fraud);
  - **significant risk flag** (consequences enforced by the tool: related controls MUST have a D&I evaluation recorded; if controls are not tested, the planned response cannot be analytics-only — at least one test of detail required; partner must review the section);
  - **"substantive alone insufficient" flag** (consequence: related controls MUST be tested for operating effectiveness);
  - control risk (only assessable below High if reliance on controls is planned and controls will be tested; otherwise RoMM = inherent risk);
  - planned response(s) with mandatory cross-reference to specific program step(s) on the target Section Control Sheet (the tool creates the link both ways);
  - status lifecycle: `identified → response planned → response executed → concluded` — a risk cannot reach `concluded` until every linked program step is completed and the section conclusion is signed.
  - FS-level risks get general responses (skepticism, staffing, unpredictability, performance-materiality change, review-level escalation, EQR) recorded and reflected in engagement settings.
- **"Stand-back" step**: before `D7.2` sign-off, the form requires confirmation that evidence supports the risk assessment for each material FSLI, and shows the list of material TB groupings (from materiality vs lead-schedule totals) that have NO identified risk and NO planned substantive coverage — because **every material class of transactions, balance and disclosure must receive substantive procedures regardless of risk rating**. The tool blocks planning completion while a material area has zero planned coverage.
- Partner sign-off gates: `D7.1`, `D7.2`, `D5.1`, `D6.1`, `D3.1`.

### 5.4 Audit programs (responses to assessed risks, ISA 330)
- Per E-section, generate the **audit program** on the Section Control Sheet from the firm's program library: suggested steps per cycle & assertion (ship a complete default library based on the international methodology's per-cycle procedures), tailored by: risk ratings from `D7.2` (higher risk → extended procedures auto-suggested), controls-reliance decision, and automation availability (steps that the tool can execute are marked "automatable" — Section 11).
- Manager edits/approves programs (partner approval NOT required for detailed programs — partner gates are listed above).
- `C1` planning communication to TCWG (planned scope & timing) generated as a letter.
- Closing planning takes a **planning snapshot** (materiality, risk register, programs) for the archive, then opens Execution. Planning can be re-opened; re-opening is logged and triggers the Revise-Approach workflow (Section 8.4).

---

## 6. AUDIT PHASE 3 — EXECUTION / FIELDWORK

### 6.1 Section workspaces
Each E-section is a workspace showing: lead schedule (live), linked risks (from D7.2, always visible at top), the audit program checklist (each step: assertion tags, owner, status, evidence links, conclusion note), control tests, detailed working papers (uploaded Excel/Word/PDF evidence or tool-generated documents), the sampling worksheets, "matters arising" quick actions, and the section conclusion block (prepared-by / reviewed-by, with an "objectives achieved / not achieved" conclusion).

### 6.2 Program-step execution
- Every step supports: mark complete with conclusion, attach evidence (file upload, PBC document link, or output of an automation run), raise **matter arising** routed to one of: `B4` significant matters, `C1` management letter point / control deficiency, `B5` misstatement, or **Revise approach** (new/changed risk — Section 8.4).
- **Misstatements (`B5`, ISA 450)**: raised from any step with: description, section, account(s), amount, type (factual / judgmental / projected from sample / classification / disclosure), corrected? If below the clearly-trivial threshold, the tool refuses to accumulate it (but logs it as trivial with a "not indicative of pervasive issue" confirm). B5 keeps a live running total against final materiality, individually and in aggregate, including prior-year uncorrected effects; produces the proposed adjusting journal entries table.
- **Control deviations** on control tests force a decision: extend testing / abandon reliance (auto-flags affected program steps for extension) / record deficiency to `C1`.

### 6.3 Review & sign-off workflow
- Two-stage minimum on every working paper: preparer → reviewer (manager/senior); partner review required on sections containing significant risks and on the mandatory partner-gate forms. EQR (B2), when assigned, gets a review layer that must complete **before the audit report date**.
- **Review notes** (coaching notes): reviewers raise point-by-point notes on any document/step; notes must be cleared (with responses) before section sign-off; cleared notes are excluded from the archived file by default (configurable per firm policy).
- Sign-offs are electronic, timestamped, immutable, and shown on the face of each working paper (name/date on the rendered document).

---

## 7. AUDIT PHASE 4 — CONCLUSION / COMPLETION & REPORTING

Driven by `B1` Completion Checklist. Enforce these completion gates before the report can be issued:

1. All E-section conclusions signed; all program steps complete or dispositioned.
2. All `D7.2` risks in status `concluded`.
3. `B5` evaluated against **final materiality** (prompt to reconsider materiality first); management asked to correct all known misstatements; refusals documented with reasons + covered in the representation letter; qualitative evaluation prompts (fraud-related misstatements are qualitatively material regardless of amount).
4. **Final analytical review** (`A1`): auto-computed FS-level analytics on final figures; conclusions recorded.
5. FS agreed to final TB (`A1` includes an automated **FS tie-out**: recompute every SYSCOHADA statement line from the mapped TB and diff against the client's financial statements — Section 10.4).
6. Disclosure checklist (`A1`) completed — ship a SYSCOHADA Notes annexes checklist (Notes 1–36).
7. `B7`/`E380` subsequent events (ISA 560) reviewed up to report date, PLUS a "facts after the report date" branch: events discovered between report date and FS issuance/AGM (and after issuance) get a documented workflow (discuss with management, amended-FS / amended-report decision, re-dating options) tied to the OHADA 15-days-before-AGM communication logic (Section 12).
8. `E330` going concern concluded (12-month minimum horizon; links to procédure d'alerte state).
9. `B8` representation letter(s) (ISA 580) generated and signed — with the **OHADA two-letter layering**: an affirmation letter on the draft FS before the board meeting (signed by DG + head of accounting) and a complementary letter after the board arrête les comptes (signed by PCA/administrateur général + DG), template-driven.
10. `B4` significant matters all cleared; `B3` consultations closed; `B2` EQR complete (mandatory if listed / co-CAC flag / firm policy / high risk).
11. `B6` points outstanding: all opinion-significant points cleared; administrative items must be closed **within 60 days after report signature** (file-assembly clock, ISQM 1) — the tool runs this timer and locks the file at the end of it (Section 9, item 6).
12. `C1` final TCWG/management letter issued (control deficiencies per ISA 265; feeds the OHADA art. 715 report).
13. Partner overall conclusion + independence reconfirmation on `B1`.

### 7.1 Opinion & report builder
- Opinion decision tree per ISA 700/705/706/570/701: unmodified / qualified ("avec réserves") / adverse ("défavorable") / disclaimer ("impossibilité d'exprimer une opinion"), with material-uncertainty-going-concern section, emphasis-of-matter, other-matter, KAM (allowed and expected for listed entities), other-information (ISA 720).
- **OHADA report pack** (French, per AUSCGIE and the OHADA practice guide — see Section 12.5 for full deliverables list and statutory wording requirements).
- `B10` points forward captured for rollforward.

---

## 8. THE LINKAGE ENGINE (CROSS-PHASE INTERACTIVITY)

This is the differentiator. Implement as an explicit, queryable graph of typed links between objects (risk ↔ program step ↔ working paper ↔ misstatement ↔ report item), never as free-text cross-references alone.

### 8.1 Risk propagation (planning → execution → conclusion)
- A risk promoted to `D7.2` immediately appears in the header of every E-section it maps to, with its rating and required-response indicators.
- Section Control Sheets show a **coverage matrix**: risk × program step × assertion. An unlinked significant risk = blocking error at planning close.
- At conclusion, `B1` shows the full risk register with per-risk evidence trail (response steps + results + misstatements raised) — the partner concludes risk-by-risk.

### 8.2 Materiality propagation
Overall/performance/trivial thresholds are read live by: lead schedules (header + "material?" flag per line), analytical review variance flags, sampling engine, B5 evaluation, FS tie-out tolerance. Materiality revision events re-flag dependent artifacts as "computed under prior materiality — review".

### 8.3 Findings routing
Any finding raised anywhere routes to exactly one of: `B4` (opinion-relevant), `B5` (misstatement), `C1` (management letter / control deficiency), Revise-approach (risk change). Each routed item keeps a backlink to its origin (section/step/document). `C1` items aggregate into the management letter AND the OHADA art. 715 report generator.

### 8.4 Revise-approach loop (mid-audit changes)
New information in execution can: add a risk (appended to `D7.2` after its approval signature, dated, requiring partner re-approval of the addition), change a rating, or invalidate planned reliance. The tool then: flags affected sections, suggests program amendments, logs the change in the section's Revise Approach log, and writes continuing-relevance facts back to `D4.2`.

### 8.5 Status rollups
Engagement dashboard: phase progress %, forms outstanding by owner, review notes open, risks by status, B5 total vs materiality, confirmations outstanding, statutory deadline countdowns, budget vs actual hours.

### 8.6 Rollforward (year N → N+1)
Create next year's engagement from the concluded one: `D4.2`/`D4.4`/`D4.6` understanding carried forward in "confirm or update" mode; risk register carried as "prior-year risks" to reassess; `B10` points forward injected into `D1`; account mappings, groupings, related-party register, convention register, contacts, letter templates all carried; prior-year figures become comparatives everywhere; independence campaign auto-proposed.

---

## 9. THE DOCUMENT/FORM SYSTEM (WORD ROUND-TRIP)

Every task's working paper is a **Word document (.docx)** generated from a firm-configurable template, containing the form to be completed: the requirements/actions for compliance with the relevant ISA step, checkboxes/tables/free-text blocks, engagement merge fields (client, period, materiality, preparer), and a sign-off block.

Requirements:
1. **Template library, versioned, bilingual.** Ship the full default library (every A/B/C/D/E/F form named in Section 3, plus all letters in Sections 11–12) in EN and FR. Firms can clone and customize templates; template changes never mutate documents already instantiated in engagements. Use a merge-field convention (e.g., `{{client.name}}`, `{{engagement.period_end}}`, `{{materiality.overall}}`) resolved at instantiation.
2. **Open → edit → close directly from the tool.** The user clicks "Open" on a working paper and edits it in Word (or a Word-compatible editor), then closes it and the saved version lands back in the tool automatically — no manual download/upload as the primary flow. Implement via ONE of (decide with me at build time, keep the storage API pluggable): (a) WebDAV serving + `ms-word:ofe|u|<url>` protocol handler for desktop Word; (b) embedded browser editor (Collabora Online / OnlyOffice) via WOPI; (c) Microsoft 365 co-authoring via Graph API for firms with M365. Always provide download/upload as the fallback path.
3. **Check-out / check-in with locking** (single editor at a time), full **version history** with restore, and a rendered **PDF preview** of every version in-browser (so reviewers never need Word to read).
4. **Hybrid structured data + document.** Fields the Linkage Engine depends on (risk entries, materiality figures, misstatement lines, conclusions, sign-offs) are captured as structured form fields IN THE APP and merged INTO the Word document on render — the Word file is the presentation/archive artifact; the database is the source of truth. Do not attempt to parse hand-edited Word content back into structured fields in v1; free-text narrative lives in the document, structured facts live in the app. Make this split explicit on each form ("complete these fields in the app; write your narrative in the document"). NOTE: this is a deliberate design decision that departs from "everything is completed inside the Word file" — confirm it with me at Build Phase 1 before implementing, per the Section 0 working method.
5. **Sign-off & locking:** signing a working paper freezes the current version (hash stored); any later edit requires "reopen" with reason, which voids the sign-off and notifies the reviewer chain.
6. **Archive & retention:** on report issuance, start the **60-day assembly clock**; at assembly completion, snapshot the entire file (documents as PDF/A + native, structured data as JSON export, index manifest) into an immutable archive, retained **10 years** (SYSCOHADA art. 24 for accounting documents; configurable ≥5 years floor per ISQM). Post-archive modifications are impossible; post-archive additions require a documented ISA 230 addition record.

---

## 10. TRIAL BALANCE ENGINE, ACCOUNT GROUPINGS & LEAD SCHEDULES

### 10.1 TB ingestion
- Import formats: Excel/CSV (column-mapping wizard with saved mappings per client), supporting the statutory **balance générale** structure (per SYSCOHADA art. 19): account number, label, opening balance, cumulative debit movements, cumulative credit movements, closing balance. Also accept simple closing-balance-only TBs.
- Validation on import: debits = credits (opening, movements, closing); closing = opening + movements per account; account numbers conform to SYSCOHADA decimal codification (classes 1–9); flag unknown/non-standard accounts; **opening balances tie to prior-year closing** (bilan d'ouverture intangibility, art. 34) when a prior engagement exists — differences become an exception report feeding `E370` Opening Balances.
- Multiple TB versions per engagement (initial, adjusted, final) with a diff view; client adjusting entries and audit adjustments (from B5) tracked as journals so FINAL TB = initial + client adjustments + booked audit adjustments, reproducibly.
- Sub-ledger imports (AR open items, AP open items, fixed asset register, inventory listing, payroll register, bank statements/recs) as typed datasets attached to sections — used by the automation engines (Section 11).

### 10.2 Account groupings (SYSCOHADA-native)
- Ship a **built-in SYSCOHADA révisé grouping library**: every 2-digit account mapped to (a) an E-section/audit cycle, and (b) the official financial-statement line REF codes — Bilan actif AD–BZ, passif CA–DZ, Compte de résultat TA/RA–XI (soldes intermédiaires de gestion cascade: XA marge commerciale, XB chiffre d'affaires, XC valeur ajoutée, XD EBE, XE résultat d'exploitation, XF résultat financier, XG résultat AO, XH résultat HAO, XI résultat net), and TFT lines ZA–ZH. Encode the official Postes/Comptes correspondence table, including its subtleties: **class-4 accounts split by debit/credit balance** (42/43/44/45/46/47 map to BJ or DK/DM by sign; 52/53/56 split between BS and DR; 409 vs 40, 419 vs 41), amortissement/dépréciation contra columns (28/29/39/49/59 netting), and écarts de conversion 478/479 → BU/DV.
- Firms can override/extend groupings per client (e.g., 3- or 4-digit granularity); overrides are saved per client and roll forward. Unmapped accounts block lead-schedule generation with a "map these accounts" task.
- Framework note: SYSCOHADA is the only mapping library in scope for v1 (no IFRS grouping pack). Keep the grouping library data-driven so other frameworks can be added later without code changes.

### 10.3 Lead schedules — AUTO-GENERATED & DISTRIBUTED (flagship feature)
- One click (or automatically on TB import) generates a **lead schedule per E-section** (`Exxx.1`): grouped accounts with per-line prior-year comparatives, movements, variance amount/%, materiality flags, tickmark column, cross-reference column, commentary field; header shows client, period, materiality, preparer/reviewer, index.
- Generated as native **Excel files** (formatted, with formulas live — totals, variances) so staff work in a familiar medium, AND mirrored as live tables in the app.
- **Distribution:** the manager assigns sections to team members; the tool notifies each member (in-app + email) and delivers the Excel lead schedule to them; completed schedules check back in against the section (same check-out/in mechanics as Word documents). Regenerating after a TB update preserves user-entered commentary/tickmarks by re-merging (map rows by account number; report lines it could not preserve).

### 10.4 Financial statements tie-out
From the mapped final TB, recompute the full **système normal** statements — Bilan (with Brut / Amort-déprec / Net N / Net N-1 columns), Compte de résultat (SIG cascade), TFT (ZA–ZH with the control: ZH = trésorerie actif − trésorerie passif) — and diff them line-by-line against the client's draft FS (entered or imported). Differences above trivial threshold appear as exceptions in `A1`. NOTE: Appendix B gives full account correspondences for the Bilan and Compte de résultat, but only line labels for the TFT — the TFT derivation rules (CAFG formula, which balance-movement deltas feed FB–FQ, reclassifications) are NOT included in this prompt: ask me for the official SYSCOHADA TFT correspondence before building TFT recomputation, and treat the Bilan + Compte de résultat tie-out as the v1 core. Support the **SMT (système minimal de trésorerie)** variant for very small clients (thresholds: 60M FCFA négoce / 40M artisanal / 30M services) as a stretch goal, not v1.

---

## 11. AUTOMATION ENGINES (EXECUTION-PHASE PROCEDURES)

Each engine is invoked from a program step, runs on imported datasets, produces a **working-paper output document** (Excel/Word, indexed under the section, e.g., `Exxx.4.1`) plus structured results, and routes exceptions to the findings system. Every run records: inputs (dataset versions), parameters, timestamp, user — full reproducibility (this IS audit evidence).

### 11.1 Sampling engine (ISA 530)
- Methods: random, systematic (with random start), monetary unit sampling (MUS), haphazard-with-seed documentation, and **criteria-based targeting** (all items > threshold + sample of remainder — "key items + representative sample" pattern).
- Inputs: population dataset (any imported ledger/listing), performance materiality, expected/tolerable misstatement, confidence factor, risk rating of the linked assertion (pre-filled from `D7.2` — higher risk → larger sample).
- Outputs: sampling worksheet documenting method, parameters, population reconciliation (population total ties to the lead schedule/TB line — enforced), selected items list, and an evaluation section where results are entered; **projected misstatement auto-computed** and, if above trivial, auto-raised to `B5` as a projected misstatement.
- **Unpredictability support** for journal-entry testing (E350): vary selection criteria (amount bands, period, account types, users, weekends/after-hours postings, round amounts, manual vs automated source) with a documented rationale; JE dataset imported from the GL export.

### 11.2 Reconciliation engines
- **Sub-ledger → GL/TB:** AR listing vs 41-accounts balance, AP listing vs 40-accounts, inventory listing vs class 3, payroll register vs 42/66 — matching by account/total with an auto-produced reconciliation working paper listing differences; unreconciled difference above trivial → finding.
- **Fixed asset register → TB:** FAR (cost, additions, disposals, depreciation charge, accumulated depreciation, NBV per asset/class) reconciled to accounts 21–24 / 28: opening + additions − disposals = closing per class; depreciation charge ties to 681/68; NBV ties to bilan lines AD–AN. Auto-produce the movements schedule (the classic PPE lead) and exceptions list.
- **Bank reconciliation re-performance:** client bank rec + bank statement + cash book imports; the engine re-performs: statement balance ± outstanding items = book balance, ages outstanding items, flags stale/window-dressing items (outstanding > X days, items clearing after period-end to watch for held-back payments) → exceptions to findings.
- **Supplier statement reconciliation** helper for AP: capture statement balances vs ledger balances per supplier, compute and categorize differences (timing: in-transit invoices/payments vs true differences).

### 11.3 Circularisation engine (ISA 505) — FULL LIFECYCLE (flagship feature)
- **Selection:** from imported AR/AP open-item ledgers or balance listings, apply preset criteria with minimal input: all balances > threshold, top N, MUS/random sample of remainder, all credit-balance debtors / debit-balance creditors, nil balances (for completeness testing on AP), disputed/related-party accounts (auto-flagged from the related-party register). For banks: from the bank/loan account list (all banking relationships — including nil/closed accounts during the period). For legal: from the litigation register in `D5.2`/`E270`.
- **Letter generation:** the correct letter template auto-selected by circularisation type — **positive (open) request** (confirm balance/details, no amount stated OR amount stated), **positive closed** (confirm agreement with stated amount), **negative request** (reply only if disagreement — the tool warns about ISA 505 conditions for negative confirmations: low RoMM + tested controls + small homogeneous items + low expected exception rate); **bank confirmation** (balances, loans, facilities, guarantees, covenants, restrictions, signatories — full standard bank-letter scope); **legal counsel letter** (prepared by management, sent by auditor, counsel replies directly to auditor); **inventory-held-by-third-parties**; **intercompany/related-party**. All bilingual, on client letterhead with management signature block + auditor return address (replies must come directly to the auditor — generate with the firm's dedicated reply email/postal address).
- **Dispatch & tracking:** batch-generate (PDF + Word), send by email from the tool where addresses exist (with unique reply-to tokens per confirmation) or print pack for postal dispatch; tracker per confirmation: prepared → approved by management → sent (date) → 1st/2nd reminder (auto-scheduled) → reply received → reconciled/exception → alternative procedures. Replies uploaded (or received by inbound email) attach to the tracker line.
- **Evaluation:** per reply, record confirmed amount vs book amount; differences auto-computed and dispositioned (timing / client error → B5 / confirmee error); non-replies flow to **alternative procedures** checklist (subsequent cash receipts for AR, supplier statements for AP); summary working paper auto-produced (coverage %, results, conclusions) per population, indexed to the section. Outstanding confirmations at completion appear in `B6` automatically.

### 11.4 Analytical procedures engine
Used at three points (ISA 315 planning / substantive analytics / ISA 520 final review): variance analysis TB-grouping level N vs N-1 (and vs budget if imported), ratio library (margins per SIG cascade — the SYSCOHADA CR gives XA/XB/XC/XD for free —, DSO/DPO/DIO, current ratio, gearing, payroll taxes ≈ one month's payroll-type checks), threshold-based flagging using materiality, expectation-vs-actual documentation for substantive analytics (expectation, tolerance, variance, corroboration, conclusion — unexplained variance above tolerance auto-raises to B5 as unresolved difference).

### 11.5 Journal-entry testing (E350)
GL journal import → automated risk-scoring/filters: postings to unusual account pairs, round amounts, period-end entries, weekend/after-hours, unusual users, entries just below approval thresholds, reversals, entries to revenue near cut-off; select via 11.1 with unpredictability; testing worksheet output.

### 11.6 Independence & PBC campaigns
(Described in 4.2 and 4.4 — same notification/campaign infrastructure: templated emails, unique links, status tracking, reminders, escalation.)

---

## 12. OHADA / CAC LEGAL COMPLIANCE MODULE (Section F)

Audits here run under ISA; the AUSCGIE (revised Uniform Act on commercial companies) layers legal obligations on the **commissaire aux comptes**. Model each as a workflow with documents and deadline timers. (Firm can disable the module for non-OHADA/contractual engagements — in which case plain ISA deliverables only.) Article numbers below come from the OHADA practice guide; before encoding any of them into templates or timers, verify each against the current revised AUSCGIE text and flag any discrepancy to me.

### 12.1 Statutory deadlines calendar (`F1`) — auto-generated per engagement from period-end and AGM date:
- FS must be **arrêtés within 4 months** of year-end (AUDCIF art. 23); documents to the CAC **≥ 45 days before the AGO** (art. 71); **AGO within 6 months** of year-end (art. 72).
- **CAC report communicated to shareholders ≥ 15 days before the AGM**; if FS are late, support the **rapport de carence** mechanism (issue carence report 15 days before AGM; complementary report when accounts arrive).
- **Rapport spécial (conventions) deposited at registered office ≥ 15 days before the AGO** (art. 442).
- Convention notifications from the chairman **within 1 month** of conclusion; continuing conventions notified **within 1 month of year-end**.
- Alerte clocks (below), 60-day file assembly, mandate expiry (2/6 years), equity-loss milestones. Each deadline: countdown, owner, escalating notifications.

### 12.2 Conventions réglementées (`F2`, linked to `E320`/ISA 550)
- **Register of conventions** per client: parties, interested director/gérant/shareholder (≥10% for SA), nature/object, essential terms (prices, rebates, commissions, payment terms, interest, security), amounts paid/received in the year for continuing conventions, board pre-authorization reference (SA), notification date received.
- Legal-form-aware rules: SA (arts. 438–448: prior board authorization, interested party can't vote, CAC notified within 1 month, AGO approves on the CAC's rapport spécial; unauthorized conventions → nullity curable by special AGO vote on an explanatory CAC report, art. 447), SARL (arts. 350–353), SAS (art. 853.14: president/dirigeants/>10% voting associates/controlling company), single-shareholder carve-outs.
- **Rapport spécial generator**: builds the report from the register (the required content mirrors art. 353/440: enumeration, parties, nature/object, essential terms, amounts under continuing conventions), FR template, with the 15-day deposit deadline tracked.

### 12.3 Article 715 report to the board (`F3`)
Generated before the board meeting that arrête les comptes, from live engagement data: (1) controls and verifications performed and sampling done, with results (pull from section conclusions and program completion stats); (2) balance-sheet items and accounting documents the CAC believes need modification, with observations on valuation methods (pull from `B5` proposed adjustments + `C1` points); (3) irregularities and inaccuracies discovered; (4) conclusions on the year's results vs prior year. Timed against the board meeting date; links to the pre-arrêté affirmation letter (Section 7 item 9).

### 12.4 Procédure d'alerte (`F4`, linked to `E330`/ISA 570)
State machine, legal-form-aware, with letter templates and deadline timers at each transition:
- **Non-SA (arts. 150–152):** written request for explanations (registered letter) → gérant must reply within **15 days** → CAC informs the competent court of reply/non-reply → if continuity still compromised: **rapport spécial d'alerte** (copy to court; communication to associés within 8 days or presented at next AG; CAC may convene the AG himself in urgency) → inform court of results if AG measures insufficient.
- **SA/SAS (arts. 153–156):** request for explanations to PCA/PDG/administrateur général → failing satisfactory reply within 15 days, invite the board to deliberate (chairman convenes within 15 days; meeting within 1 month; CAC attends; minutes extract to CAC and court within 1 month) → if still compromised: rapport spécial to the next AG (or CAC convenes AG) → inform court of outcome. Alerte may be **resumed within 6 months** if discontinued.
- Going-concern conclusion in `E330` must record any alerte in progress; the audit report builder pulls the material-uncertainty paragraph accordingly.

### 12.5 Report pack & other statutory deliverables (all FR templates, EN mirror for file purposes)
1. **Rapport du commissaire aux comptes sur les états financiers annuels** — ISA 700-structured, with the statutory opinion wording per arts. 710–711: the FS are "**réguliers et sincères et donnent une image fidèle du résultat des opérations de l'exercice écoulé ainsi que de la situation financière et du patrimoine de la société à la fin de cet exercice**" (per the OHADA practice guide's model reports and the Atelier de Ouagadougou position, use this descriptive arts. 710–711 formula, avoid the term "certifier", and title the report "Rapport du commissaire aux comptes sur les états financiers annuels" rather than "rapport général"); modified opinions: avec réserves / défavorable / impossibilité d'exprimer une opinion. Includes the OHADA-specific final section "**Vérifications et informations spécifiques**": concordance & sincerity of the rapport de gestion (art. 713), respect of **égalité entre actionnaires** (art. 714), director share-ownership violations (art. 417), irregularities signalled to the annual AGM (art. 716). Emphasis-of-matter mandatory on change of accounting method (AUDCIF art. 41/141 cross-ref to the annexe note) and on going-concern uncertainty. KAM section ("Points clés de l'audit") for listed entities.
2. **Rapport sur les états financiers consolidés** — a separate second report when consolidation applies (consolidation mandatory subject to the 500M FCFA two-successive-years group-turnover exemption; listed/APE groups consolidate under IFRS — flag only, full IFRS support out of scope v1).
3. **Rapport spécial sur les conventions réglementées** (12.2).
4. **Rapport article 715** (12.3).
5. **Alerte documents** (12.4).
6. **Signalement letters:** irregularities to the next AG / to the board; **révélation des faits délictueux to the ministère public** (art. 716 — template letter; log with strict confidentiality/access control).
7. **Attestation on the registres de titres nominatifs** (art. 746-2): separate CAC attestation + annexed management declaration templates; task prompts existence & conformity check of the registers.
8. **Rapport de carence** + complementary report.
9. **Equity < half of share capital monitoring (`F7`):** when final TB shows capitaux propres < ½ share capital, raise the statutory workflow (SA arts. 664–669: EGM within 4 months of approval of the loss-making accounts; SARL arts. 371–373) and the ISA 570 linkage; CAC signals non-compliance via the irregularities letters.
10. **Co-CAC support (`F8`):** when the co-CAC flag is set (mandatory ≥2 CACs + 2 alternates for listed/APE companies, art. 702): work-split documentation (balanced split, rotated across the mandate), cross-review questionnaire of the other CAC's work, joint communications, **joint report with disagreement disclosure** (art. 719).

### 12.6 SYSCOHADA audit checkpoints (encode into default programs)
Ship program steps reflecting framework-specific rules the auditor must verify: no charges immobilisées (account 20 abolished; legacy 475 transition released ≤5 years); revaluation only for corporelles/financières, écart to account 106 non-distributable; component depreciation only for the authorized list; mandatory capitalization of borrowing costs on qualifying assets; depreciation obligatory even in loss years; FX monetary differences to 478/479 (not P&L) with provision for probable losses; stocks at FIFO or CMP only; pension obligations must be provisioned (art. 48; note 16B actuarial); HAO vs AO classification testing; provisions réglementées mechanics; prior-year error correction through report à nouveau; offsetting prohibition (art. 34); calendar-year fiscal year; 10-year record retention; livre-journal/grand-livre/balance/livre d'inventaire existence & court-stamping checks (arts. 19, 66); computerized-accounting requirements (art. 22: validated-entry irreversibility, audit trail) — feed the IT-environment form `D4.6`.

---

## 13. NOTIFICATIONS, EMAIL & COLLABORATION

- Central notification service: in-app + email (per-user preferences), used by campaigns (independence, PBC, confirmations, reminders), assignments, review notes, sign-off requests, deadline countdowns, TB-update alerts.
- Outbound email per firm identity (configurable SMTP/provider, SPF/DKIM guidance in docs); ALL outbound tracked (sent/delivered/opened where possible) and archived to the engagement.
- Inbound email capture for confirmation replies (unique reply-to addresses per confirmation) — replies auto-attach to the right tracker line with human verification step.
- Comment threads on any working paper / program step; @mentions notify.
- Activity feed per engagement; immutable audit trail of every action (who/what/when, before/after values) — the platform itself must be auditable.

## 14. DASHBOARDS & REPORTING

- **Engagement dashboard** (Section 8.5).
- **Firm dashboard:** engagements by phase/status, statutory deadlines heat list across all clients, staff workload (assigned sections/steps by person), independence-campaign status, archive/assembly clocks running, mandate expiries.
- **Portfolio risk views:** all significant risks across engagements; B5 exposure vs materiality across engagements.
- Exports: engagement file index with statuses (Excel/PDF) for regulator inspections.

## 15. SECURITY, COMPLIANCE & NON-FUNCTIONALS

- AuthN: email+password with strong hashing, TOTP 2FA (mandatory for partner/firm_admin roles), session management, SSO-ready design (OIDC) but not required v1.
- AuthZ: RBAC per Section 2, enforced server-side on every endpoint; engagement-scoped access checks in one shared middleware, tested.
- Immutable audit log (append-only) for all data mutations and document accesses.
- Backups & disaster recovery documented; point-in-time restore for the DB; object-store versioning for documents.
- Data residency note in docs (OHADA clients may require in-region or EU hosting — make region a deployment parameter).
- Performance: TB import of 10,000 accounts < 30s; lead-schedule regeneration < 10s; documents open within 3s to the editor handoff. Pagination everywhere; no unbounded queries.
- i18n: full string externalization (EN/FR), locale-aware number/date formats (FCFA amounts: space thousands separator, no decimals by default), all templates dual-language, user-level language preference.
- Accessibility: keyboard-navigable forms, semantic HTML on the web client.

## 16. SEED DATA & TEMPLATE LIBRARY (SHIP IN THE BOX)

1. **SYSCOHADA révisé chart of accounts** (full 2-digit map, key 3/4-digit accounts: 409/419/478/479/475/416/408/418, 28x/29x/39/49x/59x contra structure, class 8 odd=charges/even=produits, class 9) + the official **Postes/Comptes REF correspondence** for Bilan (AD–BZ / CA–DZ), Compte de résultat (TA–XI SIG cascade) and TFT (ZA–ZH) as data files (JSON/CSV) with a loader — **the mapping data is given in Appendices A and B of this prompt; transcribe it faithfully, don't invent mappings.**
2. **Default E-section/cycle map**: SYSCOHADA 2-digit account → audit cycle (e.g., 21–24/28/29 → PPE & Intangibles; 31–39 → Inventories; 40/408/409/48x → Payables; 41/416/418/419/49x → Receivables; 42/43/66 → Payroll; 44 → Tax & VAT; 16/17/52/53/56/57/58/59/5x → Cash, Bank & Borrowings; 10–15 → Equity; 19/499/599 → Provisions; 26/27/50 → Investments; 60–65 → Purchases & expenses; 70–75/781/791 → Revenue & other income; 67/77 → Financial items; 8x → HAO; 87/89 → Result appropriation & income tax).
3. **Form templates** (bilingual .docx): every A/B/C/D/E/F form of Section 3 — each containing purpose, the ISA/OHADA requirements as actionable checklist items, completion tables, conclusion + sign-off blocks.
4. **Letter templates** (bilingual .docx): engagement letter (+ co-CAC variant), arrangement/PBC letter, independence confirmation, bank confirmation, AR positive open/closed, AR negative, AP open/closed, inventory-held-by-third-party, legal counsel letter, related-party confirmation, reminder letters, representation letters (pre-arrêté + complementary post-arrêté + consolidation variant), management letter / TCWG letters, and the full OHADA statutory pack of Section 12.5.
5. **Default audit program library** per cycle & assertion, including the standard cross-cutting programs (E270–E390) and the SYSCOHADA checkpoints of 12.6.
6. **Demo tenant** with a fictitious SA client, a realistic SYSCOHADA TB (~300 accounts), AR/AP/FAR sub-ledgers and a bank statement — used by tests and for demos; this is also your end-to-end test fixture.

## 17. BUILD PLAN (WORK THROUGH IN ORDER; EACH PHASE ENDS WITH TESTS + DEMO)

- **Build Phase 0 — Foundations:** stack replication (ask me first — Section 0), repo scaffold, CI, auth, tenancy model + isolation tests, RBAC, audit log, notification service skeleton, i18n plumbing. *Acceptance: two firms, cross-tenant isolation proven by tests, users log in with 2FA, strings render in EN & FR.*
- **Build Phase 1 — Engagement & audit file core:** clients, engagements, file index (A–F), working-paper object model, template library + .docx generation with merge fields, document open/edit/close round-trip (chosen mechanism), versioning/check-in-out/locking, PDF previews, sign-off workflow, review notes. *Acceptance: create engagement → instantiate D3.1 from template → open in Word → edit → close → version 2 visible → sign off → locked.*
- **Build Phase 2 — Acceptance & planning module:** D-forms with structured fields, independence campaign engine, engagement letter generator with mandate tracking, D1 driver, materiality calculator with approval gate, risk register (D7.1/D7.2) with full lifecycle, program library + tailoring, planning-close gates and snapshot. *Acceptance: complete a full planning phase on the demo client; a significant risk on revenue appears in E100 header; planning cannot close with an unlinked significant risk or an uncovered material FSLI.*
- **Build Phase 3 — TB, groupings, lead schedules:** TB import/validation/versions, SYSCOHADA grouping library + client overrides, lead-schedule generation (Excel + live), distribution & check-in, preliminary analytical review auto-computation. *Acceptance: import demo TB → one lead schedule per mapped E-section generated and assigned → variance flags raised → one flag promoted to a risk.*
- **Build Phase 4 — Execution:** section workspaces, program-step execution, evidence attachment, findings routing (B4/B5/C1/revise-approach), misstatement accumulation vs materiality, control tests & deviations, review workflows. *Acceptance: run demo execution; raise misstatements; B5 totals live against materiality; revise-approach adds a dated risk to D7.2.*
- **Build Phase 5 — Automation engines:** sampling, reconciliations (sub-ledger/FAR/bank/supplier statements), JE testing, analytical procedures engine. *Acceptance: each engine runs on demo datasets producing indexed working papers; a projected misstatement lands in B5 automatically.*
- **Build Phase 6 — Circularisations:** selection, letter generation (all types), dispatch & tracking with reminders, reply evaluation, alternative procedures, summary working papers, B6 integration. *Acceptance: full AR + bank confirmation cycle on demo data including one non-reply flowing to alternative procedures.*
- **Build Phase 7 — Conclusion & reporting:** B-forms, completion gates, final analytical review, FS tie-out (statement recomputation from mapped TB), disclosure checklist, representation letters, opinion tree + report builder (ISA + OHADA pack), 60-day assembly clock, immutable archive, rollforward. *Acceptance: issue an unmodified OHADA report on the demo engagement; archive locks; roll forward to N+1 carrying forward understanding and points forward.*
- **Build Phase 8 — OHADA legal module:** F-section workflows (deadlines calendar, conventions register + rapport spécial, art. 715 report, alerte state machine, faits délictueux, registres de titres, equity monitoring, co-CAC). *Acceptance: demo SA triggers a conventions rapport spécial and an alerte walkthrough with correct deadlines.*
- **Build Phase 9 — Portal, dashboards, polish:** client portal (PBC), firm/portfolio dashboards, exports, performance pass, security review, seed/demo polish.

**Definition of done, every phase:** typed code, parameterized SQL, tests in `/tests` mirroring `/src` (unit + at least one end-to-end flow per phase), no secrets in the repo, EN+FR strings, `ARCHITECTURE.md`/`DECISIONS.md` updated, demo script I can follow.

## 18. EXPLICIT NON-GOALS (v1)

Full IFRS statement preparation/mapping · consolidation engine (audit of consolidated FS is supported at file level; we don't consolidate) · time & billing beyond the simple engagement budget · ISRE/ISRS/ISAE review and related-services engagements · bank/insurance/microfinance sector frameworks (excluded from SYSCOHADA scope anyway) · offline desktop mode · mobile apps (responsive web only) · AI-drafted judgments (automation here is deterministic; anything judgmental stays human with the tool doing preparation and follow-up).

## 19. GUIDING PRINCIPLES (READ LAST, REMEMBER ALWAYS)

1. **The database is the audit trail.** Every figure on a generated document must be reproducible from stored structured data + dataset versions + parameters.
2. **Gates, not guidance.** Where the methodology says "must" (partner sign-offs, significant-risk consequences, material-area coverage, completion gates, statutory deadlines), the tool BLOCKS — with a clear explanation and an escalation path — rather than merely warns.
3. **Semi-automation means the human concludes.** Engines prepare, select, reconcile, chase and summarize; a named user always reviews and concludes, and that conclusion is what gets signed.
4. **Bilingual is not an afterthought.** Every template and string ships in EN and FR from phase 0.
5. **Small firms first.** Defaults everywhere, one-person-team mode (forms adapt), no configuration required to run a first engagement out of the box.

---

## APPENDIX A — SYSCOHADA RÉVISÉ CHART OF ACCOUNTS (2-DIGIT REFERENCE)

Codification rules to encode as validation logic: decimal system, classes 1–5 = balance sheet, 6–8 = P&L, 9 = commitments/cost accounting (optional). Terminaison **9** on a 2-digit balance-sheet account = dépréciations/provisions of that class (19, 29, 39, 49, 59). A **9** in 3rd/4th position = contra account with inverted balance vs its parent (409 Fournisseurs débiteurs, 419 Clients créditeurs). Charges/produits parallelism: 60↔70, 65↔75, 697↔797; class 8: odd 2-digit = charges (81, 83, 85), even = produits (82, 84, 86). **Accounts 20, 74 and 76 are unused** (account 20 "charges immobilisées" abolished by the révision; legacy balances transit through 475, released over max 5 years).

**Classe 1 — Ressources durables:** 10 Capital (101 Capital social, 104 Comptes de l'exploitant, 105 Primes liées au capital, 106 Écarts de réévaluation, 109 Apporteurs capital souscrit non appelé) · 11 Réserves · 12 Report à nouveau (121 créditeur / 129 débiteur) · 13 Résultat net de l'exercice (131 bénéfice / 139 perte) · 14 Subventions d'investissement · 15 Provisions réglementées et fonds assimilés · 16 Emprunts et dettes assimilées · 17 Dettes de location acquisition · 18 Dettes liées à des participations et comptes de liaison · 19 Provisions pour risques et charges.

**Classe 2 — Actif immobilisé:** 21 Immobilisations incorporelles (211 Frais de développement, 212 Brevets/licences, 213 Logiciels et sites internet, 214 Marques, 215 Fonds commercial, 216 Droit au bail, 217 Investissements de création, 218 Autres incl. 2181 frais de prospection minérale, 219 en cours) · 22 Terrains · 23 Bâtiments, installations techniques et agencements · 24 Matériel, mobilier et actifs biologiques (245 Matériel de transport) · 25 Avances et acomptes versés sur immobilisations · 26 Titres de participation · 27 Autres immobilisations financières · 28 Amortissements (mirrors 21–24) · 29 Dépréciations des immobilisations (291–297 mirror 21–27).

**Classe 3 — Stocks:** 31 Marchandises · 32 Matières premières et fournitures liées · 33 Autres approvisionnements · 34 Produits en cours · 35 Services en cours · 36 Produits finis · 37 Produits intermédiaires et résiduels · 38 Stocks en cours de route/consignation/dépôt · 39 Dépréciations des stocks.

**Classe 4 — Tiers:** 40 Fournisseurs et comptes rattachés (401 dettes en compte, 402 effets à payer, 404 fournisseurs d'immobilisations, 408 factures non parvenues, 409 fournisseurs débiteurs) · 41 Clients et comptes rattachés (411 clients, 412 effets à recevoir, 416 douteux/litigieux, 418 factures à établir, 419 clients créditeurs) · 42 Personnel · 43 Organismes sociaux · 44 État et collectivités publiques · 45 Organismes internationaux · 46 Apporteurs, associés et groupe · 47 Débiteurs et créditeurs divers (475 compte transitoire révision, 478 Écart de conversion-actif, 479 Écart de conversion-passif) · 48 Créances et dettes HAO (481/482/484 dettes sur immobilisations, 485/488 créances de cession) · 49 Dépréciations et provisions pour risques CT (490–497 dépréciations, 499 provisions).

**Classe 5 — Trésorerie:** 50 Titres de placement · 51 Valeurs à encaisser · 52 Banques · 53 Établissements financiers et assimilés · 54 Instruments de trésorerie · 55 Instruments de monnaie électronique · 56 Banques, crédits de trésorerie et d'escompte (564/565 crédits d'escompte, 561/566 crédits de trésorerie) · 57 Caisse · 58 Régies d'avances, accréditifs et virements internes · 59 Dépréciations et provisions CT (590–594, 599).

**Classe 6 — Charges AO:** 60 Achats et variations de stocks (601 marchandises, 602 MP, 6031/6032/6033 variations de stocks, 604/605/608 autres achats) · 61 Transports · 62 Services extérieurs A · 63 Autres services extérieurs B · 64 Impôts et taxes · 65 Autres charges · 66 Charges de personnel · 67 Frais financiers · 68 Dotations aux amortissements (681 exploitation) · 69 Dotations aux provisions et dépréciations (691 exploitation, 697 financières).

**Classe 7 — Produits AO:** 70 Ventes (701 marchandises, 702 produits finis, 703 produits intermédiaires, 704 produits résiduels, 705 travaux, 706 services vendus, 707 produits accessoires) · 71 Subventions d'exploitation · 72 Production immobilisée · 73 Variations des stocks de biens et services produits · 75 Autres produits · 77 Revenus financiers · 78 Transferts de charges (781 exploitation, 787 financières) · 79 Reprises de provisions et dépréciations (791/798/799 exploitation, 797 financières).

**Classe 8 — HAO:** 81 Valeurs comptables des cessions d'immobilisations · 82 Produits des cessions d'immobilisations · 83 Charges HAO · 84 Produits HAO · 85 Dotations HAO (851 provisions réglementées, 852 amortissements HAO, 853 dépréciations HAO, 854 provisions R&C HAO) · 86 Reprises HAO · 87 Participation des travailleurs · 88 Subventions d'équilibre · 89 Impôts sur le résultat (891 IS, 892 rappel, 895 impôt minimum forfaitaire, 899 dégrèvements).

**Classe 9 — Engagements hors bilan & analytique (optional):** 90 Engagements obtenus/accordés · 91 Contreparties des engagements · 92–98 Comptabilité analytique (free).

## APPENDIX B — OFFICIAL FS LINE (REF) ↔ ACCOUNT CORRESPONDENCE

Legend: a **"p" suffix** (e.g., 2818p, 2919p, 2939p) means "pour partie" — only the portion of that account relating to the line's items is allocated there. Implement by mapping at sub-account level where the client's TB provides the split; where it does not, raise a "manual allocation required" task on the affected account rather than guessing.

### B.1 Bilan — ACTIF (columns Brut / Amort-déprec / Net N / Net N-1)

| REF | Poste | Comptes (brut) | Amort/déprec |
|---|---|---|---|
| AE | Frais de développement et de prospection | 211, 2181, 2191 | 2811, 2818p, 2911, 2918p, 2919p |
| AF | Brevets, licences, logiciels et droits similaires | 212, 213, 214, 2193 | 2812–2814, 2912–2914, 2919p |
| AG | Fonds commercial et droit au bail | 215, 216 | 2815, 2816, 2915, 2916 |
| AH | Autres immobilisations incorporelles | 217, 218 (sauf 2181), 2198 | 2817, 2818p, 2917, 2918p, 2919p |
| AJ | Terrains | 22 | 282, 292 |
| AK | Bâtiments | 231–233, 237, 2391 | 2831–2833, 2837, 2931–2933, 2937, 2939p |
| AL | Aménagements, agencements et installations | 234, 235, 238, 2392, 2393 | 2834, 2835, 2838, 2934, 2935, 2938, 2939p |
| AM | Matériel, mobilier et actifs biologiques | 24 (sauf 245, 2495) | 284 (sauf 2845), 294 (sauf 2945), 2949p |
| AN | Matériel de transport | 245, 2495 | 2845, 2945, 2949p |
| AP | Avances et acomptes versés sur immobilisations | 251, 252 | 2951, 2952 |
| AR | Titres de participation | 26 | 296 |
| AS | Autres immobilisations financières | 27 | 297 |
| **AZ** | **Total actif immobilisé** (AD=AE..AH, AI=AJ..AN sub-totals) | | |
| BA | Actif circulant HAO | 485, 488 | 498 |
| BB | Stocks et encours | 31–38 | 39 |
| BH | Fournisseurs, avances versées | 409 | 490 |
| BI | Clients | 41 (sauf 419) | 491 |
| BJ | Autres créances | soldes DÉBITEURS de 185, 42, 43, 44, 45, 46, 47 (sauf 478) | 492–497 |
| **BK** | **Total actif circulant** | | |
| BQ | Titres de placement | 50 | 590 |
| BR | Valeurs à encaisser | 51 | 591 |
| BS | Banques, chèques postaux, caisse et assimilés | soldes DÉBITEURS de 52, 53, 54, 55, 57, 581, 582 | 592–594 |
| **BT** | **Total trésorerie-actif** | | |
| BU | Écart de conversion-Actif | 478 | |
| **BZ** | **TOTAL GÉNÉRAL** | | |

### B.2 Bilan — PASSIF (net)

| REF | Poste | Comptes |
|---|---|---|
| CA | Capital | 101–104 |
| CB | Apporteurs capital non appelé (−) | 109 |
| CD | Primes liées au capital social | 105 |
| CE | Écarts de réévaluation | 106 |
| CF | Réserves indisponibles | 111–113 |
| CG | Réserves libres | 118 |
| CH | Report à nouveau (±) | 12 |
| CJ | Résultat net de l'exercice (±) | 13 |
| CL | Subventions d'investissement | 14 |
| CM | Provisions réglementées | 15 |
| **CP** | **Total capitaux propres et ressources assimilées** | |
| DA | Emprunts et dettes financières diverses | 16, 181–184 |
| DB | Dettes de location acquisition | 17 |
| DC | Provisions pour risques et charges | 19 |
| **DD / DF** | **Total dettes financières / Total ressources stables** | |
| DH | Dettes circulantes HAO | 481, 482, 484, 4998 |
| DI | Clients, avances reçues | 419 |
| DJ | Fournisseurs d'exploitation | 40 (sauf 409) |
| DK | Dettes fiscales et sociales | soldes CRÉDITEURS de 42, 43, 44 |
| DM | Autres dettes | soldes CRÉDITEURS de 185, 45, 46, 47 (sauf 479) |
| DN | Provisions pour risques à court terme | 499 (sauf 4998), 599 |
| **DP** | **Total passif circulant** | |
| DQ | Banques, crédits d'escompte | 564, 565 |
| DR | Banques, établissements financiers et crédits de trésorerie | soldes CRÉDITEURS de 52, 53, 561, 566 |
| **DT** | **Total trésorerie-passif** | |
| DV | Écart de conversion-Passif | 479 |
| **DZ** | **TOTAL GÉNÉRAL** | |

> NOTE: class-4 and 52/53 accounts appear on BOTH sides split by balance sign — the mapping engine must allocate per-account by debit/credit balance, not by account number alone.

### B.3 Compte de résultat (SIG cascade)

| REF | Libellé | ± | Comptes |
|---|---|---|---|
| TA | Ventes de marchandises | + | 701 |
| RA | Achats de marchandises | − | 601 |
| RB | Variation de stocks de marchandises | ∓ | 6031 |
| **XA** | **MARGE COMMERCIALE** | | |
| TB | Ventes de produits fabriqués | + | 702–704 |
| TC | Travaux, services vendus | + | 705, 706 |
| TD | Produits accessoires | + | 707 |
| **XB** | **CHIFFRE D'AFFAIRES** | | TA+TB+TC+TD |
| TE | Production stockée / déstockage | ± | 73 |
| TF | Production immobilisée | + | 72 |
| TG | Subventions d'exploitation | + | 71 |
| TH | Autres produits | + | 75 |
| TI | Transferts de charges d'exploitation | + | 781 |
| RC | Achats de MP et fournitures liées | − | 602 |
| RD | Variation stocks MP | ∓ | 6032 |
| RE | Autres achats | − | 604, 605, 608 |
| RF | Variation stocks autres approvisionnements | ∓ | 6033 |
| RG | Transports | − | 61 |
| RH | Services extérieurs | − | 62, 63 |
| RI | Impôts et taxes | − | 64 |
| RJ | Autres charges | − | 65 |
| **XC** | **VALEUR AJOUTÉE** | | |
| RK | Charges de personnel | − | 66 |
| **XD** | **EXCÉDENT BRUT D'EXPLOITATION** | | |
| TJ | Reprises d'amortissements, provisions, dépréciations | + | 791, 798, 799 |
| RL | Dotations aux amortissements, provisions, dépréciations | − | 681, 691 |
| **XE** | **RÉSULTAT D'EXPLOITATION** | | |
| TK | Revenus financiers et assimilés | + | 77 |
| TL | Reprises financières | + | 797 |
| TM | Transferts de charges financières | + | 787 |
| RM | Frais financiers | − | 67 |
| RN | Dotations financières | − | 697 |
| **XF** | **RÉSULTAT FINANCIER** | | |
| **XG** | **RÉSULTAT DES ACTIVITÉS ORDINAIRES** | | XE+XF |
| TN | Produits des cessions d'immobilisations | + | 82 |
| TO | Autres produits HAO | + | 84, 86, 88 |
| RO | Valeurs comptables des cessions | − | 81 |
| RP | Autres charges HAO | − | 83, 85 |
| **XH** | **RÉSULTAT HAO** | | |
| RQ | Participation des travailleurs | − | 87 |
| RS | Impôts sur le résultat | − | 89 |
| **XI** | **RÉSULTAT NET** | | XG+XH+RQ+RS |

### B.4 Tableau des flux de trésorerie (REF ZA–ZH)

ZA Trésorerie nette au 1er janvier · FA CAFG (capacité d'autofinancement globale) · FB −variation actif circulant HAO · FC −variation stocks · FD −variation créances · FE +variation passif circulant → **ZB flux opérationnels** · FF/FG/FH −acquisitions d'immobilisations incorporelles/corporelles/financières, FI/FJ +cessions → **ZC flux d'investissement** · FK +augmentations de capital, FL +subventions d'investissement reçues, FM −prélèvements sur capital, FN −dividendes versés → **ZD** · FO +emprunts, FP +autres dettes financières, FQ −remboursements → **ZE**; ZF = ZD+ZE · **ZG variation** = ZB+ZC+ZF · **ZH trésorerie nette au 31/12** = ZG+ZA, with the control ZH = Trésorerie actif N − Trésorerie passif N.

### B.5 Statutory constants (encode as configuration, per engagement)

Currency FCFA; fiscal year = calendar year (first year may be shorter/longer per AUDCIF art. 7) · FS arrêtés ≤ 4 months after close · documents to CAC ≥ 45 days before AGO · AGO ≤ 6 months after close · CAC reports to shareholders ≥ 15 days before AGM · rapport spécial deposited ≥ 15 days before AGO · convention notifications ≤ 1 month · alerte reply window 15 days (see 12.4 for the full state machine) · file assembly ≤ 60 days after report date · record retention 10 years · CAC mandates 2 years (statutes/constitutive) or 6 years (AGO) · consolidation exemption: group turnover ≤ 500M FCFA for two successive years · SMT thresholds: 60M (négoce) / 40M (artisanal) / 30M (services) FCFA · Notes annexes numbered 1–36 with conformity declaration.
