# EA Audit Tool — Session Log (2026-07-09 → 2026-07-10)

Complete record of the working session: the conversation as it unfolded, every decision taken, and verbatim copies of all documents produced. Repo: https://github.com/Nekoutb/ea-audit-tool · Charter artifact: https://claude.ai/code/artifact/6c14bb71-c4b1-4709-8879-0edbcda805db

---

## Part 1 — The conversation, chronologically

### 1. Opening brief (user)

Pointed at `EA-Audit-Tool_Master-Build-Prompt.md` (the full ISA/OHADA statutory-audit-platform spec) with instructions to:
- Complete the development-stack section by surveying the user's other Claude Code projects and copying the most common stack.
- Develop a detailed execution plan and recommend additional skills.
- Strict rules: run it as a managed project with timelines; project status after each completed step; optimal step breakdown; after each section show status + a testing link; **testing performed and concluded as working before any go-ahead**.
- Conventions: type hints everywhere; tests mirror source; **no ORM — raw SQL with parameterized queries**; no committed secrets; error handling with no bare excepts.

### 2. Stack survey & the ORM conflict

A background agent surveyed ~22 project folders. Findings: the most consistent recent stack is **Next.js (App Router) + TypeScript + Prisma + PostgreSQL + NextAuth v5 + Tailwind** (EA Financial Audit, API Workflow, te-saas). Secondary: Laravel; tertiary: FastAPI.

A real conflict was flagged rather than silently resolved: the user's own convention says **no ORM**, but every strong recent project uses **Prisma**. Asked the user directly.

**User decisions:** Raw SQL (no ORM) wins; **EA Financial Audit** is the literal reference project (same domain — multi-tenant audit SaaS).

### 3. Reference-project deep dive

A second agent inspected `EA Financial Audit/platform` in detail. Key findings carried over: the `tenantId` + Postgres Row-Level-Security isolation pattern (`FORCE ROW LEVEL SECURITY`, transaction-local `app.tenant_id` GUC, non-superuser app role), the NextAuth v5 two-file split, JWT sessions carrying tenant+role, rank-based RBAC, and the pure-domain-engine/isolated-tsconfig pattern. Also noted honestly: the reference had **no tests, no ESLint config, no CI, no Docker** — those would be authored fresh.

### 4. Planning documents created

- Master prompt updated: new **§0.1 Development Stack** (confirmed stack table, deviations flagged, open decisions listed).
- `PROJECT-PLAN.md` — working protocol + Phase 0 step table + Phases 1–9 roadmap + skill recommendations.
- `PROJECT-STATUS.md` — live tracker updated after every step.

### 5. Kickoff decisions

- GitHub repo: **private, `ea-audit-tool`**, under Nekoutb (created & pushed).
- Object storage: MinIO initially chosen — later superseded (see Docker below).

### 6. Step 0.1 — Scaffold (and the Docker detour)

Scaffolded Next.js (create-next-app installed **Next 16**, not 15 — breaking changes read from its bundled docs and logged: `middleware.ts`→`proxy.ts`, `next lint` removed, Turbopack default). ESLint+Prettier configured; `pg` + `node-pg-migrate` installed.

Docker Desktop's engine refused to start. User asked *"what is docker and can we do without it?"* → explained plainly, recommended native Postgres (what the reference project did anyway). **User: "remove docker all together."** Removed `docker-compose.yml`; installed **PostgreSQL 16 natively via winget** (service `postgresql-x64-16`, port **5433** since a pre-existing Postgres 18 held 5432); created `ea_audit` DB. Step 0.1 done: typecheck ✅ lint ✅ dev server 200 ✅.

### 7. Project document requests

- *"give me the overall project document..."* → `PROJECT-OVERVIEW.md` (exec summary, stack, 0.1 status, timelines, expected outcomes per step/phase).
- *"show me all the 135 sessions... I want to approve 30 steps per day"* → `WORK-BREAKDOWN.md`: **all 103 steps** across 10 phases enumerated with effort + expected outcome; clarified 135 = sessions, 103 = steps; proposed batched review to sustain 30/day.
- *"the long list in style of a project document we agree on"* → the **Project Charter** artifact (styled HTML): KPI band, progress bar, the agreement callout, stack table, all 103 steps with status chips, pace scenarios, ground rules, sign-off block. Updated at each phase completion.
- Pace questions: 30 steps/day ≈ **~4 working days** total; 45/day ≈ **~2.5–3 days** — with the honest caveat that steps ≠ sessions and the review gate is the real constraint.

### 8. Step 0.2 — DB bootstrap (user: "continue with step 0.2")

First raw-SQL migration: `tenant`, `app_user`, `membership` + `user_role` enum + shared `updated_at` trigger. `lib/db.ts`: `pg.Pool` singleton + `withTenant()` (transaction + transaction-local GUC). Vitest wired: **3/3** (GUC set inside tx; no leak across pooled connections; rollback+rethrow). Migration proven reversible (down→up). Pushed.

### 9. Step 0.3 — RLS isolation proof (user: auto-approve from here)

`ea_app` non-superuser role script; `db/rls.sql` with `FORCE ROW LEVEL SECURITY` + `tenant_isolation` policy; permanent `rls_probe` fixture table; app pool switched to `ea_app`. **Bug caught by the fail-closed test:** a reset custom GUC reads `''` (not NULL) on pooled connections → `''::uuid` cast error; hardened with `NULLIF(...,'')` so no-context → zero rows. Suite **7/7**.

### 10. Step 0.4 — Auth (user: "ignore 2FA... just standard login")

2FA descoped (decision logged; `totp_*` columns kept reserved). NextAuth v5 credentials + bcrypt; JWT carrying `tenantId`/`role`; `proxy.ts` route guard (Next 16 rename); `rbac.ts` rank helpers; `lib/tenant.ts#requireTenant()`; login page + dashboard; dev seed. **Bug found in negative-path testing:** logged-out redirects went to port 3000 while the app ran on 3100 (hardcoded `NEXTAUTH_URL`) → fixed with `trustHost: true`. Verified: browser login→dashboard; wrong password rejected; unauth `/dashboard`→`/login`.

### 11. Steps 0.5–0.8 (user: "proceed and continue from 0.5 to 0.8... do not request my approvals")

- **0.5** Two-tenant seed (Cabinet Alpha/Beta) + `/api/probe` (tenant derived from session only, never a client param) + Playwright: **4/4** — each firm sees only its own data; a crafted `?tenantId=<other>` request still returns only the caller's rows; unauth API → 401.
- **0.6** i18n: EN/FR dictionaries, `getLocale()` (cookie → user preference → default **fr**), switcher persisting to profile, `<html lang>`, `formatFCFA` (space-grouped). Key-parity test. **Bug caught by E2E:** the switcher's submit buttons collided with the login test's generic selector → stable testids.
- **0.7** Notifications: tenant+user-scoped `notification` table (RLS), inbox page, dashboard unread badge, stubbed email. **2 E2E** — a notification reaches only its addressee; mark-read clears the badge. (Two test-robustness fixes: locale-dependent button text → testid; cross-test leftovers → clear-all loop.)
- **0.8** CI: GitHub Actions workflow (Postgres service container → db:setup → typecheck → lint → unit → E2E) + `PHASE-0-ACCEPTANCE.md`. **External blocker found and reported honestly:** GitHub returns a 0-second `startup_failure`; workflow validated correct with `actionlint` (exit 0) → an account-level **Actions billing/runner-provisioning** issue on the private repo, needing user action (GitHub → Settings → Billing). The identical gate proven green locally.

**Phase 0 complete — 8/8.** Charter updated.

### 12. Phase 1, steps 1.1–1.12 (user: "proceed, complete 1.1 to 1.12")

Built and verified autonomously in one run:

- **Data model** (migration 4): `client`, `engagement`, `file_item`, `document`, `document_version`, `signoff`, `review_note` — all RLS enabled+forced.
- **File Index engine**: 64-item bilingual A–F index, numbering gaps preserved exactly (no D2, no D5.3 — unit-tested); instantiated transactionally with each engagement.
- **Templates + .docx**: bilingual registry (D3.1 acceptance checklist + generic), merge fields, versions stamped `template:id@version`; valid ZIP proven by test.
- **Round-trip / versioning / locking**: download→edit→upload as next version; single-editor check-out; restore-as-new-version; sha256 per version. Three §9 design decisions resolved to reversible defaults under the user's batch authorization and logged in DECISIONS.md (download/upload round-trip first; hybrid data/document split; bytea storage v1; in-browser docx preview instead of server PDF).
- **Sign-off workflow**: preparer-first enforced; open review notes block reviewer sign-off; reviewer sign-off locks; reopen requires reason, voids sign-offs, notifies signers.
- **UI**: /clients, /clients/[id], /engagements, /engagements/[id] (A–F file), /documents/[id] workspace; nav; full EN/FR.
- **Tests**: **23 unit** (index, docx, full state machine via mocked session) + **7 E2E** including the spec's exact acceptance flow (*create engagement → D3.1 → download real docx → upload v2 → note gate → sign → locked → reopen*). Browser-verified live, zero console errors — including a nice accidental proof: an old Demo-Firm session couldn't see firm-a's engagement (RLS working).

**Phases 0–1 complete: 20/103 steps.** All pushed; charter at 20/103.

### 13. This document

User asked for a single markdown file capturing the session's conversation and all session documents — this file.

---

## Part 2 — Key facts reference

| Item | Value |
|---|---|
| Repo | https://github.com/Nekoutb/ea-audit-tool (private) |
| App | `platform/` — Next.js 16, TS strict, Tailwind v4 |
| Database | PostgreSQL 16 native, port **5433**, db `ea_audit` (no Docker) |
| DB roles | `postgres` (migrations/RLS bootstrap) · `ea_app` (app — RLS enforced) |
| Dev logins | `alice@firm-a.test` / `password` · `bob@firm-b.test` / `password` (via `npm run seed`) |
| Dev server | `npm run dev -- -p 3100` → http://localhost:3100 |
| One-shot setup | `npm ci && npm run db:setup && npm run seed` |
| Full test gate | `npm run typecheck && npm run lint && npm run test && npm run test:e2e` |
| Test totals | 23 unit + 7 E2E — all green; typecheck + lint clean |
| Progress | **20 / 103 steps** (Phases 0–1 complete) |
| Open user action | Enable GitHub Actions billing so CI runs in the cloud (workflow verified correct) |
| Next | Build Phase 2 — Acceptance & planning (steps 2.1–2.14) |

### Major decisions this session (full log in `platform/DECISIONS.md`)

1. Raw SQL via `pg`, no ORM (user conviction upheld over Prisma-based reference).
2. Reference project: EA Financial Audit; its RLS/auth/RBAC patterns carried over.
3. Next.js 16 kept (not pinned back to 15); breaking changes handled.
4. **No Docker** — native PostgreSQL 16; CI uses a service container instead.
5. **2FA descoped** — standard email/password login (columns reserved for later opt-in).
6. Phase 1 §9 mechanics: download/upload round-trip first; hybrid structured-data+document; bytea storage v1; in-browser docx preview.

---

# Part 3 — Session documents (verbatim copies)

The documents below are exact copies as at the end of this session. Live versions in the repo are canonical.


---

## 📄 Master Build Prompt — §0.1 Development Stack (added this session)

> The full master prompt (EA-Audit-Tool_Master-Build-Prompt.md, ~550 lines) pre-existed this session; §0.1 below is the section authored this session. See the repo for the complete spec.

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

## 📄 PROJECT-OVERVIEW.md

> Consolidated project overview & status report.

# EA Audit Tool — Project Overview & Status Report

**Product:** Multi-tenant SaaS statutory audit platform (ISA / OHADA — SYSCOHADA révisé)
**Repo:** https://github.com/Nekoutb/ea-audit-tool (private)
**Report date:** 2026-07-09
**Current position:** Build Phase 0 (Foundations) — **Step 0.1 complete & tested.** 1 of ~90–105 steps done.

This is the single master status document. It consolidates:
- `EA-Audit-Tool_Master-Build-Prompt.md` — the full product & technical spec (what we're building)
- `PROJECT-PLAN.md` — the step-by-step execution plan & working protocol (how we build it)
- `PROJECT-STATUS.md` — the live per-step tracker (updated every step)

---

## 1. Executive summary

We are building a digital statutory audit file for small/medium audit firms operating under International Standards on Auditing, with first-class OHADA / SYSCOHADA support (bilingual EN/FR, FCFA, commissaire aux comptes legal workflows). The product spans the full audit lifecycle — acceptance → planning → execution → conclusion & reporting — with a linkage engine that carries risks, materiality and misstatements across phases, plus semi-automation engines (trial-balance ingestion, lead schedules, sampling, reconciliations, circularisations).

**Delivery model:** built in small, independently-testable steps. Every step ends with a working, tested deliverable and a preview; nothing proceeds to the next step without your explicit go-ahead after you've seen it work. This is a genuinely large system, so the plan trades raw speed for a verifiable, auditable build — appropriate for software that itself must be audit-grade.

---

## 2. Confirmed development stack

Chosen by surveying your existing projects; the closest analog (`EA Financial Audit`, a multi-tenant audit SaaS) is the reference. One deliberate deviation: **raw SQL instead of Prisma**, honoring your "no ORM" rule.

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 16 (native local install, port 5433 — **no Docker**) |
| Data access | Raw SQL via `pg` (node-postgres), parameterized queries, **no ORM** |
| Migrations | `node-pg-migrate` (runner only) — versioned `.sql` files |
| Tenant isolation | `tenantId` column + Postgres Row-Level Security (`FORCE ROW LEVEL SECURITY`) |
| Auth | NextAuth v5, Credentials + bcrypt, JWT sessions, TOTP 2FA for partner/admin |
| AI features | Anthropic SDK — preparation/summarization only, never judgmental conclusions |
| Documents | `docx` (Word), `exceljs` (Excel lead schedules) — later phases |
| Testing | Vitest (unit/integration) + Playwright (E2E) |
| CI | GitHub Actions |

Full rationale in `platform/DECISIONS.md`.

---

## 3. Progress update — Step 0.1 ✅ COMPLETE

**Delivered:**
- Next.js 16 + TypeScript + Tailwind v4 app scaffolded at `platform/`
- ESLint + Prettier configured
- Raw-SQL database tooling installed (`pg`, `node-pg-migrate`) — no ORM
- Native PostgreSQL 16 running (port 5433), `ea_audit` database created & reachable
- `ARCHITECTURE.md`, `DECISIONS.md`, `.env.example` written
- Private GitHub repo created and pushed

**Tested — all passing:**

| Check | Result |
|---|---|
| `npm run typecheck` | ✅ clean |
| `npm run lint` | ✅ clean |
| `npm run dev` boots & serves | ✅ 200 OK, page renders |
| PostgreSQL 16 reachable on 5433 | ✅ `ea_audit` created |

**Detour handled:** Docker Desktop would not start on this machine. Rather than block, we removed Docker entirely and installed PostgreSQL natively — matching the reference project, which also ran bare local Postgres.

**Time taken:** ~1 focused work session of build effort. Wall-clock ran longer due to the Docker troubleshooting + PostgreSQL install (~1–2 hours of environment setup that is now a one-time cost — future steps don't repeat it).

---

## 4. Timeline & expected outcomes — the road ahead

### How to read the estimates

- **"Session"** = one focused build unit ending in a tested deliverable + your review. It is not a fixed number of hours; a step is sized to stay coherent in one working pass.
- **Calendar time is gated by YOUR review/approval turnaround**, not build throughput. The build can produce a step quickly; the pace is set by how fast you test-and-approve each one.
- Rule of thumb: **1 approved step/day ≈ the fast lane; 2–3/day ≈ compressed; 1 every few days ≈ relaxed.**

### Remaining Phase 0 — Foundations (7 steps left)

| Step | Est. effort | Expected outcome (what works when it's done) |
|---|---|---|
| **0.2** DB bootstrap + migration runner | ~1 session | First migration creates `Tenant`/`User`/`Membership` tables in raw SQL; `withTenant()` DB helper works; test proves it sets the tenant context. |
| **0.3** RLS + isolation proof | ~1 session | Postgres Row-Level Security enforced; automated test proves one tenant **cannot** read another's rows — the core security guarantee. |
| **0.4** Auth + 2FA + RBAC | ~1–2 sessions | Users log in (email/password), partners/admins forced through TOTP 2FA; role-based permissions; protected routes redirect. |
| **0.5** Two-tenant seed + E2E proof | ~1 session | Two demo firms seeded; a Playwright test drives the browser proving Firm A can't see Firm B's data via UI **or** a crafted API call. |
| **0.6** i18n (EN/FR) | ~1 session | Every screen renders in English and French; language toggle; test catches any missing translation. |
| **0.7** Notification service skeleton | ~1 session | In-app notification inbox; notifications scoped to the right user/tenant. |
| **0.8** CI + Phase 0 acceptance demo | ~1 session | GitHub Actions runs typecheck/lint/tests/isolation-proof on every push; full Phase 0 acceptance criteria demonstrated live. |

**Phase 0 completion: ~7–8 more sessions.** At 1 step/day ≈ **~1.5 weeks**; compressed ≈ **3–4 days**.

**Phase 0 outcome:** a secure, multi-tenant foundation — two firms fully isolated (proven by tests), 2FA login, bilingual UI, CI guarding every change. No audit features yet, but the hard security/tenancy bedrock the whole product stands on is done and verified.

### Phases 1–9 — the product itself

| Phase | Expected outcome | Est. steps | Est. sessions |
|---|---|---|---|
| **1 — Engagement & audit file core** | Create engagements; the A–F audit file index; generate Word working papers from templates; open/edit/version/sign-off a document. | 10–12 | 12–15 |
| **2 — Acceptance & planning** | Independence email campaigns; engagement letters with mandate tracking; **materiality calculator**; the risk register; planning "gates" that block on unlinked risks. | 12–14 | 14–18 |
| **3 — Trial balance & lead schedules** | Import a trial balance; SYSCOHADA account groupings; auto-generate Excel lead schedules per audit area; distribute to the team. | 8–10 | 9–12 |
| **4 — Execution / fieldwork** | Section workspaces; execute program steps; route findings; track misstatements live against materiality. | 10–12 | 12–15 |
| **5 — Automation engines** | Sampling, reconciliations (sub-ledger/fixed-assets/bank), journal-entry testing, analytical procedures — each producing indexed evidence. | 8–10 | 10–13 |
| **6 — Circularisations** | Full confirmation lifecycle: select, generate letters, dispatch, chase, evaluate replies, alternative procedures. | 8 | 9–11 |
| **7 — Conclusion & reporting** | Completion gates; financial-statement tie-out; representation letters; the ISA + OHADA **opinion & report builder**; archive; rollforward to next year. | 10–12 | 13–16 |
| **8 — OHADA legal module** | Statutory deadlines calendar; conventions réglementées; article 715 report; procédure d'alerte state machine; equity-loss monitoring; co-CAC. | 8–9 | 10–12 |
| **9 — Portal, dashboards, polish** | Client portal (document requests); firm & portfolio dashboards; exports; performance & security passes. | 8 | 10–12 |

### Whole-project projection

- **Total scope:** ~90–105 steps, ~110–135 build sessions.
- **Calendar estimate (gated by your review pace):**
  - Fast lane (≈1 step/day): **~5–6.5 months**
  - Compressed (≈2 steps/day): **~3–3.5 months**
- This is a realistic, unpadded estimate for a full ISA + OHADA audit methodology platform. The single biggest lever on calendar time is your test-and-approve turnaround at each step's gate.

---

## 5. Working protocol (unchanged, applied every step)

1. One step = one focused, independently-testable unit.
2. Every step ends with something you can actually use/see, not just code.
3. I test it myself first (run it, drive the feature, run the suite) and report honestly — including failures.
4. After each step: status update + preview link + test results, then **stop and wait for your go-ahead.**
5. Destructive or hard-to-reverse actions are flagged before running.

Conventions enforced throughout: type hints everywhere · raw parameterized SQL, no ORM · tests mirror source · no secrets in the repo · error handling with no bare catches · bilingual EN/FR from day one.

---

## 6. What I need from you now

**Go-ahead to start Step 0.2** (DB bootstrap + migration runner). It's a backend/infrastructure step — the visible proof is a passing migration and a green test, not a new screen. First screens you can click through arrive at Step 0.4 (login) and become substantial from Phase 1 onward.


---

## 📄 PROJECT-PLAN.md

> Execution plan: working protocol, Phase 0 steps, Phases 1–9 roadmap, skills.

# EA Audit Tool — Project Execution Plan

Companion to `EA-Audit-Tool_Master-Build-Prompt.md` (the product/technical spec). This document governs *how* we build it: step sizing, timelines, and the test-before-proceed protocol. Live status lives in `PROJECT-STATUS.md` — update it after every step, not this file.

---

## Working protocol (strict — applies to every step below)

1. **One step = one focused build unit.** Sized so it fits in a single agent session without losing coherence — never bundle unrelated concerns into one step just to save a round trip.
2. **Every step ends with something testable**, not just code written. No step is "done" on typecheck/lint passing alone if it has user-visible behavior.
3. **Before asking for go-ahead, I test it myself**: run the dev server, drive the actual feature (browser for UI, script/curl for API-only), run the automated test suite for that step, and report pass/fail honestly — including partial failures. "I can't test this because X" is an acceptable report; a claim of success without having driven it is not.
4. **After each step: post the status table update + a live preview link** (local dev server via the Preview tool) **+ test results**, then stop and wait for explicit go-ahead before starting the next step. No step starts on an assumed yes.
5. **Steps are additive and reversible where possible.** Destructive migrations, schema drops, or anything hard to undo get called out explicitly before running.
6. **Timelines are given as work-sessions, not calendar promises** — an LLM session is not a human-week, but review/testing turnaround depends on your availability. A rough calendar mapping is given at the end for planning purposes only.

---

## Status legend

`Not started` · `In progress` · `Ready for testing` · `Tested — passed` · `Tested — failed (see notes)` · `Blocked (needs decision)` · `Done`

---

## Build Phase 0 — Foundations (detailed step breakdown)

Reference for all steps: `EA Financial Audit/platform` structure (Section 0.1 of the master prompt), adapted for raw SQL.

| # | Step | Deliverable | Test method | Est. |
|---|---|---|---|---|
| 0.1 | Repo scaffold & tooling | Next.js 16 + TS + Tailwind v4 app at reference layout (no `/src`, `@/*` alias); ESLint + Prettier configured fresh; native PostgreSQL 16 (no Docker); `.env.example`; GitHub repo + first commit | `npm run dev` boots and serves default page; `npm run typecheck` and `npm run lint` clean | 1 session |
| 0.2 | DB bootstrap + migration runner | Native Postgres (port 5433, `ea_audit` db); `node-pg-migrate` wired; first migration creates global tables `Tenant`, `User`, `Membership` (raw SQL DDL, translated from reference `schema.prisma` shape); `lib/db.ts` (`pg.Pool` singleton) + `withTenant()` helper | Migration runs clean on fresh DB; Vitest unit test proving `withTenant()` sets the `app.tenant_id` GUC inside its transaction | 1 session |
| 0.3 | RLS bootstrap + isolation proof | `ea_app` non-superuser role creation script; `rls.sql` policy pattern (reference's `FORCE ROW LEVEL SECURITY` approach) applied to a stub tenant-scoped table; automated test proving cross-tenant reads return zero rows under the wrong `tenant_id` GUC | Test suite green — this is the isolation proof Section 2 and the Phase 0 acceptance criteria require | 1 session |
| 0.4 | Auth core (NextAuth v5) + RBAC | Credentials provider + bcrypt, JWT session carrying `tenantId`/`role`; `proxy.ts` route gate (Next 16 renamed `middleware`→`proxy`); `rbac.ts` rank helpers; `lib/tenant.ts` `requireTenant`; login page + protected dashboard. **2FA descoped** per user (impractical daily friction; columns kept reserved). | Seeded user logs in via the preview browser; wrong password rejected; protected route redirects when unauthenticated | 1–2 sessions |
| 0.5 | Two-tenant seed + cross-tenant E2E proof | Seed script (Tenant A/B, users, roles); minimal protected "Engagements" list page reading through `requireTenant()`→`withTenant()`; Playwright E2E test: logged in as Tenant A, confirm Tenant B data is unreachable via UI *and* a crafted API request | Playwright suite passes; manual click-through in preview | 1 session |
| 0.6 | i18n plumbing (EN/FR) | i18n approach decided (recommend `next-intl`) and wired; dictionary structure; language switcher; login + Engagements page render in both languages; per-user language preference persisted | Manual toggle in preview confirms string swap; automated test asserts EN/FR dictionaries have matching keys (no silently-missing translations) | 1 session |
| 0.7 | Notification service skeleton | In-app notification model + inbox UI (Section 13); email sending stubbed/logged only (real provider wiring deferred) | Dev-only trigger action fires a notification; confirm it appears only for the correct user/tenant | 1 session |
| 0.8 | CI + Phase 0 acceptance demo | GitHub Actions (typecheck incl. reference's isolated-engine-tsconfig pattern, lint, unit, e2e against a service-container Postgres); `ARCHITECTURE.md` + `DECISIONS.md` started, documenting: raw-SQL choice, RLS approach, auth/2FA approach, native-Postgres/no-Docker decision, i18n choice | CI green on a fresh clone; scripted walkthrough of the full Section 17 Phase 0 acceptance criteria, live | 1 session |

**Phase 0 total: 8 steps, ~9–10 sessions.**

**Decisions resolved:** No Docker — native PostgreSQL 16 on port 5433 (see `platform/DECISIONS.md`). Object storage deferred to Phase 1 (not needed for Phase 0).

**One decision still open, needed at Phase 1** (not guessed at):
- Word↔PDF round-trip mechanism (Section 9 item 2) — not needed until Phase 1.

---

## Build Phases 1–9 — condensed roadmap

Full detailed step breakdowns (like Phase 0 above) will be written at the start of each phase, once prior-phase decisions are locked in — writing them all out now would bake in assumptions that earlier phases may overturn. Step counts below are estimates for planning purposes.

| Phase | Headline (see master prompt §17 for full acceptance criteria) | Est. steps | Est. sessions |
|---|---|---|---|
| 1 — Engagement & audit file core | File index (A–F), working-paper model, `.docx` templating, document round-trip, versioning/lock, PDF preview, sign-off | 10–12 | 12–15 |
| 2 — Acceptance & planning | D-forms, independence campaign, engagement letter + mandate tracking, materiality calculator, risk register lifecycle, program tailoring, planning-close gates | 12–14 | 14–18 |
| 3 — TB, groupings, lead schedules | TB import/validation/versions, SYSCOHADA grouping library, lead schedule generation (Excel + live), distribution, analytics | 8–10 | 9–12 |
| 4 — Execution/fieldwork | Section workspaces, program-step execution, findings routing, misstatement tracking, control tests, review workflow | 10–12 | 12–15 |
| 5 — Automation engines | Sampling, reconciliations (sub-ledger/FAR/bank/supplier), JE testing, analytical procedures | 8–10 | 10–13 |
| 6 — Circularisations | Selection, letter generation, dispatch/tracking, reply evaluation, alt. procedures | 8 | 9–11 |
| 7 — Conclusion & reporting | B-forms, completion gates, FS tie-out, disclosure checklist, rep letters, opinion/report builder, archive, rollforward | 10–12 | 13–16 |
| 8 — OHADA legal module | Deadlines calendar, conventions register, art. 715, alerte state machine, faits délictueux, equity monitoring, co-CAC | 8–9 | 10–12 |
| 9 — Portal, dashboards, polish | Client portal, firm/portfolio dashboards, exports, performance, security review | 8 | 10–12 |

**Whole-project estimate: roughly 90–105 steps, 110–135 sessions.** Real calendar time is gated by *your* review/testing turnaround at each stop, not LLM throughput — if you can test and approve one step per working day, that's roughly **5–6.5 months**; two steps a day roughly halves it. This is a genuinely large system (full ISA + OHADA methodology); the estimate is realistic, not padded.

---

## Recommended additional skills for this build

- **`webapp-testing`** — Playwright-based; use for every E2E test gate (document round-trip, sign-off gates, cross-tenant isolation, circularisation dispatch flows). Central to the "test before go-ahead" protocol.
- **`verify`** — run after nontrivial changes to confirm the change actually works end-to-end, not just that types/tests pass.
- **`code-review-and-quality`** — periodic multi-axis review before merging each Build Phase, given the size and compliance sensitivity of this codebase.
- **`security-review`** — run at least at the end of Phase 0 (auth/tenancy) and Phase 9 (final pass); this product handles client financial data and firm credentials under multi-tenant isolation.
- **`anthropic-skills:docx`** — for building/validating the bilingual `.docx` template library and merge-field generation (Phase 1, §9; Phase 6 letters; Phase 7 rep letters).
- **`anthropic-skills:xlsx`** — for the lead-schedule Excel generation with live formulas (Phase 3, §10.3).
- **`anthropic-skills:pdf`** — for the PDF preview pipeline (§9.3) once the Word↔PDF mechanism is chosen.
- **`dataviz`** — for the engagement/firm/portfolio dashboards (§14, Phase 9) so charts read as one coherent system.
- **`impeccable`** or **`frontend-design`** — a UI polish pass once core flows work, given this targets non-technical audit staff who'll live in this tool daily.
- **`claude-api`** — reference when wiring `@anthropic-ai/sdk` for the bounded prep/summarization uses permitted by §18 (never for judgmental conclusions).

Not recommended: any Laravel/PHP skill (stack is Next.js/TypeScript), `artifact-design` (this is a real deployed app, not a claude.ai artifact).


---

## 📄 WORK-BREAKDOWN.md

> All 103 steps across 10 phases with live status markers.

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
| ⬜ 2.1 | D-form structured-field framework | 1 | Hybrid "structured fields in app + narrative in doc" pattern working |
| ⬜ 2.2 | D3.1 acceptance/continuance + partner gate | 1 | New/continuing checklists; engagement can't advance until partner signs |
| ⬜ 2.3 | Independence campaign engine | 1–2 | Emails staff unique links; structured independence form; e-signature |
| ⬜ 2.4 | Independence dashboard + reminders | 1 | sent/opened/completed/exceptions; auto-reminders; exception→threat record |
| ⬜ 2.5 | Engagement letter generator (+ co-CAC) | 1 | Bilingual letter from merge fields; co-commissariat variant |
| ⬜ 2.6 | Mandate tracking | 1 | 2/6-year mandate start/expiry; final-year warning |
| ⬜ 2.7 | D6.1 job administration | 1 | Team assignment; hours-by-grade budget; PBC request list |
| ⬜ 2.8 | D1 Engagement Strategy Driver | 1 | Master planning checklist (status/owner/linked form per step) |
| ⬜ 2.9 | Materiality calculator | 1–2 | Benchmark×% → overall; performance materiality; trivial threshold; versioned |
| ⬜ 2.10 | Materiality approval gate + propagation | 1 | Partner gate; revision re-flags dependent artifacts |
| ⬜ 2.11 | Understanding forms (D4.x) + rollforward | 1–2 | Entity/environment/internal-control forms; carry-forward "confirm or update" |
| ⬜ 2.12 | Risk register D7.1→D7.2 lifecycle | 1–2 | Raise/dismiss/promote risks; identified→planned→executed→concluded lifecycle |
| ⬜ 2.13 | Significant-risk consequences + planning-close gates | 1 | Significant-risk rules enforced; stand-back; blocks close on uncovered material area |
| ⬜ 2.14 | Program library + tailoring; Phase 2 acceptance E2E | 1 | Programs tailored by risk; significant revenue risk appears in E100 header; gates block |

## Phase 3 — TB, groupings, lead schedules (10 steps)

| # | Step | E | Expected outcome |
|---|---|---|---|
| ⬜ 3.1 | TB import (column-mapping wizard) | 1 | Excel/CSV import with saved per-client mappings |
| ⬜ 3.2 | TB validation | 1 | debits=credits, SYSCOHADA codification, opening-ties-to-prior checks |
| ⬜ 3.3 | TB versions + diff + adjusting journals | 1 | initial/adjusted/final versions; reproducible final = initial + adjustments |
| ⬜ 3.4 | Sub-ledger imports | 1 | AR/AP/FAR/inventory/payroll/bank as typed datasets attached to sections |
| ⬜ 3.5 | SYSCOHADA grouping library | 1–2 | 2-digit map + FS REF codes as seed data (from Appendix B) + loader |
| ⬜ 3.6 | Client grouping overrides | 1 | Per-client override/extend; unmapped accounts block lead-schedule gen |
| ⬜ 3.7 | Lead schedule generation | 1–2 | Excel (live formulas) + mirrored app tables, per E-section |
| ⬜ 3.8 | Lead schedule distribution + regen | 1 | Assign/notify/check-in; regenerate preserving commentary & tickmarks |
| ⬜ 3.9 | Preliminary analytical review (D4.3) | 1 | Auto variance table + ratios + threshold flags with "raise risk?" |
| ⬜ 3.10 | Phase 3 acceptance E2E | 1 | import demo TB → lead schedules → variance flag → promoted to a risk |

## Phase 4 — Execution / fieldwork (12 steps)

| # | Step | E | Expected outcome |
|---|---|---|---|
| ⬜ 4.1 | Section workspace shell | 1 | E-section layout; linked risks pinned at top; program checklist |
| ⬜ 4.2 | Program-step execution | 1 | Mark complete + conclusion per step |
| ⬜ 4.3 | Evidence attachment | 1 | File upload / PBC link / automation output attached to steps |
| ⬜ 4.4 | Matter-arising routing framework | 1 | Route a finding to exactly one of B4/B5/C1/revise-approach with backlink |
| ⬜ 4.5 | Misstatements B5 | 1 | Raise misstatements (types); trivial threshold; running total |
| ⬜ 4.6 | B5 evaluation vs materiality | 1 | Individual + aggregate vs final materiality; prior-year effects; adjusting-entry table |
| ⬜ 4.7 | Control tests + deviations | 1 | Deviation forces extend/abandon/deficiency decision |
| ⬜ 4.8 | Findings → B4 significant matters | 1 | Opinion-relevant findings aggregate into B4 |
| ⬜ 4.9 | Findings → C1 management letter | 1 | Control deficiencies aggregate into the management letter |
| ⬜ 4.10 | Revise-approach loop | 1 | Adds a dated risk to D7.2 after approval; partner re-approval required |
| ⬜ 4.11 | Review workflow | 1 | Two-stage review; partner review on significant-risk sections |
| ⬜ 4.12 | Phase 4 acceptance E2E | 1 | run execution; raise misstatements; B5 totals live; revise-approach adds dated risk |

## Phase 5 — Automation engines (10 steps)

| # | Step | E | Expected outcome |
|---|---|---|---|
| ⬜ 5.1 | Automation-run framework | 1 | Every run records inputs/params/timestamp/user; indexed output doc; reproducible |
| ⬜ 5.2 | Sampling engine (methods) | 1–2 | random / systematic / MUS / criteria-based selection |
| ⬜ 5.3 | Sampling evaluation | 1 | Projected misstatement auto-computed → B5 |
| ⬜ 5.4 | Sub-ledger→GL/TB reconciliation | 1 | AR/AP/inventory/payroll reconciled; differences → findings |
| ⬜ 5.5 | Fixed-asset-register→TB reconciliation | 1 | FAR movements schedule + exceptions; ties to depreciation & bilan lines |
| ⬜ 5.6 | Bank reconciliation re-performance | 1 | Re-performs client rec; ages/flags stale & window-dressing items |
| ⬜ 5.7 | Supplier statement reconciliation | 1 | Statement vs ledger per supplier; timing vs true differences |
| ⬜ 5.8 | Journal-entry testing (E350) | 1–2 | Risk-scoring filters + unpredictability; testing worksheet |
| ⬜ 5.9 | Analytical procedures engine | 1–2 | 3 modes; ratio library; expectation-vs-actual; unexplained variance → B5 |
| ⬜ 5.10 | Phase 5 acceptance E2E | 1 | each engine runs on demo data; a projected misstatement lands in B5 |

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


---

## 📄 PROJECT-STATUS.md

> Live per-step status tracker.

# EA Audit Tool — Live Project Status

Updated after every completed step. See `PROJECT-PLAN.md` for step definitions and `EA-Audit-Tool_Master-Build-Prompt.md` for the spec.

**Current phase:** ✅ **Build Phases 0 and 1 COMPLETE** (20 of 103 steps, all tested locally). Ready for Build Phase 2 — Acceptance & planning. One external follow-up: enable GitHub Actions billing (see CI note under 0.8).

**Last updated:** 2026-07-09

**Login (dev):** `npm run seed` → `alice@firm-a.test` or `bob@firm-b.test`, both `/ password`, at `/login`.

**Repo:** https://github.com/Nekoutb/ea-audit-tool (private)

---

## Open decisions

| Decision | Status |
|---|---|
| Database / Docker | **Resolved** — no Docker; native PostgreSQL 16 on port 5433 |
| Object storage backend | **Deferred to Phase 1** — not needed for Phase 0 |
| Word↔PDF round-trip mechanism | Open — needed at Phase 1 |

## Phase 0 — Foundations

| Step | Status | Tested | Notes |
|---|---|---|---|
| 0.1 Repo scaffold & tooling | **Done** | ✅ Passed | Next.js 16 + TS + Tailwind v4; ESLint+Prettier; native Postgres 16 (port 5433, `ea_audit` db created); pushed to GitHub. typecheck + lint clean, dev server serves 200. |
| 0.2 DB bootstrap + migration runner | **Done** | ✅ Passed | Raw-SQL migration creates tenant/app_user/membership (+ user_role enum, updated_at triggers); `lib/db.ts` pool + `withTenant()`; Vitest 3/3 pass; migration reversible (down/up verified); typecheck + lint clean. |
| 0.3 RLS bootstrap + isolation proof | **Done** | ✅ Passed | `ea_app` non-superuser role; `db/rls.sql` FORCE RLS + fail-closed `tenant_isolation` policy (NULLIF hardening); app pool switched to `ea_app`; `rls_probe` fixture + 4 isolation tests prove cross-tenant reads/inserts blocked. Full suite 7/7; typecheck + lint clean. |
| 0.4 Auth core + RBAC (standard login, no 2FA) | **Done** | ✅ Passed | NextAuth v5 credentials + bcrypt, JWT session carrying tenantId/role; `proxy.ts` route guard (Next 16); `rbac.ts` rank helpers; `lib/tenant.ts` requireTenant; login page + dashboard. Verified in browser (login→dashboard) + curl (wrong-pw rejected, unauth→/login). Fixed a redirect-port bug via `trustHost`. 2FA descoped per user. |
| 0.5 Two-tenant seed + E2E proof | **Done** | ✅ Passed | `scripts/seed.mjs` seeds two firms; `/api/probe` + dashboard read tenant-scoped data via session only; Playwright 4/4 pass — Firm A/B each see only own data, crafted `?tenantId=B` request still returns only A, unauth API → 401. |
| 0.6 i18n plumbing (EN/FR) | **Done** | ✅ Passed | EN/FR dictionaries; `getLocale()` (cookie → user pref → default fr); `LanguageSwitcher` sets cookie + persists to profile; `preferred_language` carried in session; `<html lang>` follows locale; `formatFCFA` (space thousands). Verified in browser (FR default, switch→EN persists). Parity test + 10/10 unit + 4/4 E2E. |
| 0.7 Notification service skeleton | **Done** | ✅ Passed | Tenant-scoped `notification` table (RLS enabled+forced); `lib/notifications.ts` (create/list/unreadCount/markRead, user+tenant scoped); stubbed `lib/email.ts`; inbox page + dashboard unread badge + test-notification trigger. E2E 2/2 (notification reaches only its user; mark-read clears badge). Full suite 10 unit + 6 E2E. |
| 0.8 CI + Phase 0 acceptance demo | **Done** (see CI note) | ✅ Passed locally | `.github/workflows/ci.yml` authored + validated (actionlint clean); `PHASE-0-ACCEPTANCE.md` maps every criterion to its proof; ARCHITECTURE.md updated. **Full CI gate proven green locally** (db:setup → typecheck → lint → 10 unit incl. RLS proof → 6 E2E). ⚠️ GitHub-hosted execution blocked — see note below. |

### ⚠️ CI execution blocker (action needed from you)

The workflow is correct (validated by `actionlint`, exit 0), but GitHub returns a **0-second `startup_failure`** with no logs. That happens when GitHub **can't provision an Actions runner for a private repo** — typically an account **billing / spending-limit** setting, not a code issue. To enable it: GitHub → Settings → Billing → set up a spending limit / payment method for Actions (private repos get 2,000 free min/month but need billing configured), or make the repo public (Actions free) — not done here since it's a commercial codebase. Until then, run the identical gate locally: `npm run db:setup && npm run typecheck && npm run lint && npm run test && npm run test:e2e`.

## Phase 1 — Engagement & audit file core

| Step | Status | Tested | Notes |
|---|---|---|---|
| 1.1 Clients & engagements data model | **Done** | ✅ | Raw-SQL migration (client, engagement, file_item, document, document_version, signoff, review_note — all RLS enabled+forced); tenant-scoped loaders. |
| 1.2 Client management UI | **Done** | ✅ | /clients list + create (name, legal form SA/SARL/SAS/GIE, listed, co-CAC). |
| 1.3 Engagement management UI | **Done** | ✅ | /engagements list; create from client page (fiscal year × period end, unique per client+year). |
| 1.4 File Index engine (A–F) | **Done** | ✅ | 64-item default index, bilingual titles, numbering gaps preserved (no D2/D5.3 — proven by unit test); instantiated transactionally on engagement creation. |
| 1.5 Working-paper object model | **Done** | ✅ | document/version/signoff/review-note tables; immutable versions with sha256. |
| 1.6 Templates + .docx generation | **Done** | ✅ | Bilingual template registry (D3.1 acceptance-specific + generic); merge fields; valid .docx proven by unit test; version stamped `template:id@version`. |
| 1.7 Round-trip (download/upload) | **Done** | ✅ | Download version → edit → upload as next version. Mechanism decision logged in DECISIONS.md (WebDAV/WOPI deferred). |
| 1.8 Versioning + check-out/in locking | **Done** | ✅ | Single-editor lock; full history; restore copies forward (history never rewritten). |
| 1.9 Preview without Word | **Done** | ✅ | In-browser docx rendering (docx-preview); decision logged (PDF/A at Phase 7 archive). |
| 1.10 Sign-off workflow | **Done** | ✅ | Preparer→reviewer two-stage; reviewer sign locks; reopen requires reason, voids sign-offs, notifies signers. |
| 1.11 Review notes | **Done** | ✅ | Notes must be cleared (with response) before reviewer sign-off — enforced and tested. |
| 1.12 Phase 1 acceptance E2E | **Done** | ✅ | Playwright: create engagement → D3.1 from template → download v1 (real ZIP) → upload v2 → note blocks reviewer → clear → sign → **locked** → reopen unlocks. |

**Phase 1 test totals:** 23 unit (file index, docx, full document state machine) + 7 E2E — all green. Typecheck + lint clean.

## Phases 2–9

Not started. Detailed step tables will be added here as each phase begins.


---

## 📄 PHASE-0-ACCEPTANCE.md

> Phase 0 acceptance criteria mapped to their proofs.

# Build Phase 0 — Foundations: Acceptance

Maps the master spec's Phase 0 acceptance criteria to what was built and how it is verified. Run everything below from `platform/`.

> **Acceptance (master spec §17, Build Phase 0):** *two firms, cross-tenant isolation proven by tests, users log in [2FA descoped → standard login], strings render in EN & FR.*

## One-time local setup

```bash
cd platform
cp .env.example .env          # then set AUTH_SECRET (npx auth secret)
npm ci
npm run db:setup              # migrate + create ea_app role + apply RLS
npm run seed                  # two firms: Cabinet Alpha & Cabinet Beta
npm run dev -- -p 3100
```

Native PostgreSQL 16 on port 5433 (no Docker). See `platform/ARCHITECTURE.md`.

## Criterion-by-criterion

| # | Criterion | How it's met | How to verify |
|---|---|---|---|
| 1 | **Two firms** | `scripts/seed.mjs` seeds Cabinet Alpha (`alice@firm-a.test`) and Cabinet Beta (`bob@firm-b.test`), password `password`. | `npm run seed` |
| 2 | **Cross-tenant isolation proven by tests** | Postgres RLS (`FORCE ROW LEVEL SECURITY`, fail-closed policy) + app connects as non-superuser `ea_app`. Proven at the DB layer (`tests/lib/rls.test.ts`) and end-to-end incl. a crafted API request (`tests/e2e/isolation.spec.ts`). | `npm run test` (RLS unit proof) · `npm run test:e2e` (browser + API proof) |
| 3 | **Users log in** | NextAuth v5 credentials + bcrypt, JWT session carrying `tenantId`/`role`/`locale`; protected routes via `proxy.ts`. 2FA descoped per decision (see `DECISIONS.md`). | Log in at `/login`; wrong password rejected; unauthenticated `/dashboard` → `/login` |
| 4 | **Strings render in EN & FR** | Full externalisation to `messages/en.json` + `fr.json`; `getLocale()` (cookie → user preference → default `fr`); language switcher persists per user; `<html lang>` follows. | Toggle the switcher on `/login` or `/dashboard`; `tests/lib/i18n.test.ts` proves EN/FR key parity |

## Extras delivered in Phase 0

- **Tenant/data model** — `tenant`, `app_user`, `membership` (+ `user_role` enum) in raw SQL migrations; no ORM.
- **`withTenant()`** transaction helper that sets the `app.tenant_id` GUC RLS keys on.
- **Notification service skeleton** — tenant+user-scoped inbox, unread badge, stubbed email (`tests/e2e/notifications.spec.ts`).
- **CI** — `.github/workflows/ci.yml` runs typecheck, lint, unit (incl. RLS proof) and E2E against a Postgres service container on every push/PR.

## Full local gate (what CI runs)

```bash
npm run db:setup
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm run test             # Vitest: 10 tests (incl. RLS isolation, i18n parity)
npm run test:e2e         # Playwright: 6 tests (isolation, auth, notifications)
```

All green = Phase 0 accepted.


---

## 📄 platform/ARCHITECTURE.md

> Living architecture document.

# Architecture

Living document, updated at the end of each Build Phase. See `../EA-Audit-Tool_Master-Build-Prompt.md` for the product/domain spec and `DECISIONS.md` for why choices were made.

## Stack (Build Phase 0)

| Layer            | Choice                                                                                                                             |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Framework        | Next.js 16 (App Router), React 19, TypeScript 5 (strict)                                                                           |
| Styling          | Tailwind CSS v4 (CSS-first, `@theme` in `app/globals.css`)                                                                         |
| Database         | PostgreSQL 16 (native local install, port 5433), no ORM — raw SQL via `pg` (node-postgres), parameterized queries only            |
| Migrations       | `node-pg-migrate`, versioned `.sql` files under `/migrations`                                                                      |
| Tenant isolation | `tenantId` column + Postgres Row-Level Security (`FORCE ROW LEVEL SECURITY`), app connects as non-superuser role `ea_app`          |
| Auth             | NextAuth v5 (Auth.js), Credentials provider + `bcryptjs`, JWT sessions carrying `tenantId`/`role`, TOTP 2FA for partner/firm_admin |
| Object storage   | Local filesystem (dev) → S3-compatible bucket (prod), via the S3 API — deferred to Build Phase 1                                   |
| AI               | `@anthropic-ai/sdk`, prep/summarization only — never judgmental conclusions (master spec §18)                                      |
| Testing          | Vitest (unit/integration), Playwright (E2E)                                                                                        |
| CI               | GitHub Actions                                                                                                                     |

## Folder layout

Mirrors the reference project (`EA Financial Audit/platform`), no `/src` directory:

```
platform/
├── app/            # Next.js App Router: pages, layouts, api/, actions/
├── components/     # shared .tsx components
├── lib/            # domain logic, db access, auth helpers
│   ├── db.ts        # pg.Pool singleton + withTenant() helper
│   ├── tenant.ts     # requireTenant() session→tenant resolver
│   └── rbac.ts       # Role enum + rank-based permission checks
├── migrations/     # versioned .sql files (node-pg-migrate)
├── tests/          # mirrors lib/, app/actions/, app/api/
├── auth.config.ts  # auth config shared with proxy.ts (route gating)
├── auth.ts         # full NextAuth config incl. Credentials provider
└── proxy.ts        # route-protection (Next 16 renamed middleware.ts → proxy.ts)
```

## Multi-tenancy pattern

Every tenant-scoped table carries a `tenant_id` column. `lib/db.ts#withTenant()` checks out a `pg` client, opens a transaction, sets the `app.tenant_id` Postgres GUC (transaction-local) , runs the caller's queries, then commits/rolls back and releases the client. Row-Level Security policies (bootstrapped by `db/rls.sql`, re-run whenever a new tenant-scoped table is added) restrict every query on tenant-scoped tables to `NULLIF(current_setting('app.tenant_id', true), '')::uuid`. The app connects as `ea_app` — a non-superuser, non-owner role (`db/create-app-role.sql`) — so `FORCE ROW LEVEL SECURITY` actually applies. This is the reference project's isolation pattern, translated from Prisma's `$transaction`/`$executeRawUnsafe` to plain `pg` client calls.

**Fail-closed:** with no tenant context set, the GUC reads as `''` (an undefined custom GUC resets to empty string, not NULL, once touched on a pooled connection); `NULLIF(..., '')` turns that into NULL, so the policy matches zero rows and also avoids a `''::uuid` cast error. A permanent `rls_probe` table + `tests/lib/rls.test.ts` prove isolation on every test run and in CI: one tenant sees only its own rows, cannot read or insert another tenant's rows (`WITH CHECK`), and sees nothing with no context set.

## Local setup

No Docker. PostgreSQL is installed natively on Windows.

1. **PostgreSQL 16** — installed via `winget install PostgreSQL.PostgreSQL.16`. Runs as the Windows service `postgresql-x64-16` on **port 5433** (5432 was already taken by a pre-existing Postgres 18 install; 5433 keeps them separate). Superuser `postgres` / password `postgres` (dev only). Database `ea_audit` created manually.
2. Copy `.env.example` → `.env` and confirm `DATABASE_URL` (owner role) / `APP_DATABASE_URL` (`ea_app`) point at `localhost:5433/ea_audit`.
3. `npm install`, then `npm run db:setup` (runs migrations → creates the `ea_app` role → applies RLS), then `npm run dev`.

`npm run db:setup` = `migrate:up` + `db:role` (`db/create-app-role.sql`) + `db:rls` (`db/rls.sql`). All idempotent; no container to start first. Tests (`npm run test`) run against this same native instance.

## Authentication & RBAC

NextAuth v5 (`auth.ts`), Credentials provider + `bcryptjs`, JWT session strategy. `authorize()` looks the user up with raw SQL, verifies the password, and resolves their tenant + firm role via `membership`. The session carries `id`, `tenantId`, `role`, and `locale` (typed in `types/next-auth.d.ts`). `proxy.ts` (Next 16's renamed middleware, Node runtime) redirects unauthenticated requests on protected routes to `/login`; every protected page also calls `auth()`/`requireTenant()` server-side (defense in depth). `trustHost: true` makes redirects port/host-agnostic. `lib/rbac.ts` holds rank-based role helpers. **2FA was descoped** (see `DECISIONS.md`); the `app_user.totp_*` columns remain reserved.

## Internationalisation (EN/FR)

Strings live in `messages/{en,fr}.json`; `lib/i18n.ts` exposes `getMessages()` and `formatFCFA()` (space-grouped, no decimals). `lib/locale.ts#getLocale()` resolves the active locale as cookie → signed-in user's `preferred_language` → default `fr`. `LanguageSwitcher` + the `setLocale` server action set the cookie and persist the choice to the user's profile; `<html lang>` follows. A key-parity test (`tests/lib/i18n.test.ts`) fails the build if EN and FR drift.

## Notifications

`notification` is tenant-scoped (RLS) and additionally user-scoped. `lib/notifications.ts` create/list/count/mark-read all go through `requireTenant()` + `withTenant()`. The email channel is stubbed (`lib/email.ts` logs) until a later phase. UI: `/notifications` inbox + a dashboard unread badge.

## CI

`.github/workflows/ci.yml` runs on every push/PR against a Postgres 16 service container: `db:setup` → typecheck → lint → unit tests (incl. the RLS isolation proof) → Playwright E2E. Matches the local gate exactly.

(Further sections — document engine, linkage engine, automation engines — added as each Build Phase lands.)


---

## 📄 platform/DECISIONS.md

> Append-only decisions log.

# Decisions Log

Append-only. Each entry: date, decision, why, alternatives considered.

## 2026-07-09 — Phase 1 document mechanics (user pre-authorized batch decisions)

The user directed Phases 1.1–1.12 to run without per-decision approval, so the three open document-system decisions from master spec §9 were resolved to the most reversible defaults and are recorded here:

1. **Round-trip mechanism (spec §9.2): download → edit in Word → upload, with check-out/check-in locking.** This is the fallback path the spec requires in every scenario, so building it first is zero-waste. WebDAV `ms-word:ofe|u|` (option a) or OnlyOffice/WOPI (option b) can be layered on later — the storage API in `lib/documents.ts` is the single integration point.
2. **Hybrid structured-data + document split (spec §9.4): adopted as specified.** Structured facts (sign-offs, statuses, versions) live in the DB; narrative lives in the .docx. No parsing of hand-edited Word content back into fields.
3. **Version bytes stored in Postgres (`bytea`) for v1**, matching the reference project's `StepDocument Bytes` approach. SME-scale volumes make this fine now; all reads/writes go through `lib/documents.ts`, so an S3-compatible swap later touches one module. The 10-year archive requirement (§9.6) lands in Phase 7 and will use object storage.
4. **"PDF preview" (spec §9.3) implemented as in-browser DOCX rendering (`docx-preview`)** — the underlying requirement is "reviewers never need Word to read", which client-side rendering satisfies without a native LibreOffice dependency on Windows dev machines or CI. Server-side PDF/A conversion is deferred to the Phase 7 archive step, where it is genuinely required.

## 2026-07-09 — Drop mandatory TOTP 2FA; standard email/password login only

Master spec §15 called for mandatory TOTP 2FA on partner/firm_admin logins. The user descoped it: a second factor on every login is impractical friction for a tool audit staff live in daily, and it would slow routine operation. Auth is now standard email/password (bcrypt) with JWT sessions. The `app_user.totp_secret` / `totp_enabled` columns are left in place as reserved-for-future (no migration to drop them); 2FA can be reintroduced later as an opt-in, not a hard gate. Security posture otherwise unchanged (RLS tenant isolation, RBAC, server-side authz).

## 2026-07-09 — Stack: Next.js + raw SQL (no ORM) + Postgres RLS

Reference project `EA Financial Audit/platform` uses Next.js 15 + Prisma + Postgres + NextAuth v5 + Tailwind. That stack is replicated here **except Prisma is dropped** in favor of raw SQL via `pg` (node-postgres), per this project's non-negotiable "no ORM" coding convention (master prompt §0.2). Confirmed with the user after flagging the conflict explicitly.

- Migrations: `node-pg-migrate` (a migration _runner_ only — tracks applied migrations in a `pgmigrations` table, does not build queries or introduce an ORM layer). Plain `.sql` files.
- Tenant isolation: `tenantId` column + Postgres Row-Level Security, `FORCE ROW LEVEL SECURITY`, app connects as a non-superuser/non-owner role (`ea_app`). Directly reused pattern from the reference project's `prisma/rls.sql` — pure SQL, no ORM dependency in the policies themselves.

## 2026-07-09 — Next.js version: 16, not 15

`create-next-app@latest` installed Next 16.2 (current latest) rather than 15.x used by the reference project. Kept latest rather than pinning to 15, since `te-saas` (another active project) is already on Next 16 and pinning backward would mean building on a version already superseded elsewhere. Noted breaking changes relevant to this build (from `node_modules/next/dist/docs/01-app/02-guides/upgrading/version-16.md`):

- `middleware.ts` → `proxy.ts`, exported function renamed `middleware` → `proxy`. Runs on the **Node.js runtime**, not Edge (Edge is no longer supported for this file). This actually simplifies the reference project's edge/node auth-config split, since the file gating routes is no longer Edge-constrained — decide at Step 0.4 whether the split is still worth keeping (e.g. for future Edge middleware needs) or can be collapsed.
- `next lint` command removed — lint runs directly via `eslint .` (already reflected in `package.json`).
- Turbopack is now the default bundler for `dev` and `build` (no flag needed).
- Async `params`/`searchParams`/`cookies`/`headers` fully async only (no sync fallback) — was already true in transition in v15, now enforced.

## 2026-07-09 — No Docker; native PostgreSQL install (supersedes the MinIO/docker-compose decision)

Docker Desktop's engine would not finish starting on this machine (processes ran but `docker info` never succeeded), and the user asked to drop Docker entirely. `docker-compose.yml` was removed. PostgreSQL 16 is now installed natively via winget (`PostgreSQL.PostgreSQL.16`), running as the `postgresql-x64-16` Windows service on **port 5433** (5432 was already occupied by a pre-existing Postgres 18 service). This also matches the reference project, which ran bare local Postgres with no containers.

Consequence for CI (Step 0.8): GitHub Actions will use a Postgres **service container** (Actions runners have Docker), so CI parity does not depend on the developer running Docker locally.

## 2026-07-09 — Object storage: local filesystem (dev) / S3-compatible (prod), deferred to Phase 1

Supersedes the earlier MinIO-in-docker-compose plan (Docker removed). File storage is not needed until Build Phase 1 (documents), so the concrete dev backend is deferred to then. Application code will still target the S3 API so production can point at a real S3-compatible bucket; in dev this will be either a local-filesystem shim behind the same interface or a standalone MinIO binary (no container) — decided at Phase 1.

## 2026-07-09 — Repo hosting: private GitHub repo `ea-audit-tool` under Nekoutb

Standard for an in-progress commercial product handling audit-firm client data. Created and pushed: https://github.com/Nekoutb/ea-audit-tool


---

*End of session log — 2026-07-09 → 2026-07-10. The interactive Project Charter (visual companion to WORK-BREAKDOWN.md) lives at https://claude.ai/code/artifact/6c14bb71-c4b1-4709-8879-0edbcda805db*
