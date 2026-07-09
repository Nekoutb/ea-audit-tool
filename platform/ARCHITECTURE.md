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
