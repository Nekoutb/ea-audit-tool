# EA Audit Tool — Live Project Status

Updated after every completed step. See `PROJECT-PLAN.md` for step definitions and `EA-Audit-Tool_Master-Build-Prompt.md` for the spec.

**Current phase:** Build Phase 0 — Foundations. Steps 0.1–0.7 complete & tested. Step 0.8 next (last of Phase 0).

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
| 0.8 CI + Phase 0 acceptance demo | Not started | — | |

## Phases 1–9

Not started. Detailed step tables will be added here as each phase begins.
