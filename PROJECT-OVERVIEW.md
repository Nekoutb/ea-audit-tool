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
