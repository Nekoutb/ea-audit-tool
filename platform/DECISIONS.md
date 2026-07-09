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

## 2026-07-09 — No Docker; native PostgreSQL install (supersedes the MinIO/docker-compose decision)

Docker Desktop's engine would not finish starting on this machine (processes ran but `docker info` never succeeded), and the user asked to drop Docker entirely. `docker-compose.yml` was removed. PostgreSQL 16 is now installed natively via winget (`PostgreSQL.PostgreSQL.16`), running as the `postgresql-x64-16` Windows service on **port 5433** (5432 was already occupied by a pre-existing Postgres 18 service). This also matches the reference project, which ran bare local Postgres with no containers.

Consequence for CI (Step 0.8): GitHub Actions will use a Postgres **service container** (Actions runners have Docker), so CI parity does not depend on the developer running Docker locally.

## 2026-07-09 — Object storage: local filesystem (dev) / S3-compatible (prod), deferred to Phase 1

Supersedes the earlier MinIO-in-docker-compose plan (Docker removed). File storage is not needed until Build Phase 1 (documents), so the concrete dev backend is deferred to then. Application code will still target the S3 API so production can point at a real S3-compatible bucket; in dev this will be either a local-filesystem shim behind the same interface or a standalone MinIO binary (no container) — decided at Phase 1.

## 2026-07-09 — Repo hosting: private GitHub repo `ea-audit-tool` under Nekoutb

Standard for an in-progress commercial product handling audit-firm client data. Created and pushed: https://github.com/Nekoutb/ea-audit-tool
