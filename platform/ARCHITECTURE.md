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

Every tenant-scoped table carries a `tenantId` column. `lib/db.ts#withTenant()` checks out a `pg` client, opens a transaction, sets the `app.tenant_id` Postgres GUC for that transaction only, runs the caller's queries, then commits/rolls back and releases the client. Row-Level Security policies (bootstrapped via a plain `.sql` script, see `migrations/`) restrict every query on tenant-scoped tables to `current_setting('app.tenant_id')`. The app's database role is a non-superuser, non-table-owner role so `FORCE ROW LEVEL SECURITY` actually applies. This is the exact isolation pattern used by the reference project, translated from Prisma's `$transaction`/`$executeRawUnsafe` to plain `pg` client calls.

## Local setup

No Docker. PostgreSQL is installed natively on Windows.

1. **PostgreSQL 16** — installed via `winget install PostgreSQL.PostgreSQL.16`. Runs as the Windows service `postgresql-x64-16` on **port 5433** (5432 was already taken by a pre-existing Postgres 18 install; 5433 keeps them separate). Superuser `postgres` / password `postgres` (dev only). Database `ea_audit` created manually.
2. Copy `.env.example` → `.env` and confirm `DATABASE_URL` / `APP_DATABASE_URL` point at `localhost:5433/ea_audit`.
3. `npm install`, then `npm run dev`.

Migrations and the RLS bootstrap (Steps 0.2–0.3) run against this native instance; there is no container to start first.

(Further sections — data model, document engine, linkage engine, automation engines — added as each Build Phase lands.)
