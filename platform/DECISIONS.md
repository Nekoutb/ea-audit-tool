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
