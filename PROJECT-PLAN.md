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
| 0.4 | Auth core (NextAuth v5) + 2FA + RBAC | Two-file edge/node auth split (`auth.config.ts`/`auth.ts`), Credentials provider + bcrypt, JWT session carrying `tenantId`/`role`; **TOTP 2FA enforced for `partner`/`firm_admin` roles** (Section 15 requirement — not present in reference project, built fresh, likely `otplib` + QR enrollment); `middleware.ts` route gate; `rbac.ts` rank helpers; login page | Two seeded users (different tenants) log in via the preview browser; 2FA challenge required and enforced for the partner-role user; protected route redirects when unauthenticated | 1–2 sessions |
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
