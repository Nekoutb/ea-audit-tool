# Decisions Log

Append-only. Each entry: date, decision, why, alternatives considered.

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

## 2026-07-09 — Object storage: MinIO (dev) / S3-compatible (prod)

Chosen over local-disk-only or wiring real cloud storage immediately. MinIO runs in `docker-compose` alongside Postgres, speaks the S3 API, and requires no cloud account to start building — the application code targets the S3 API from day one so swapping to a real bucket in production is a config change, not a rewrite.

## 2026-07-09 — Repo hosting: private GitHub repo `ea-audit-tool` under Nekoutb

Standard for an in-progress commercial product handling audit-firm client data.
