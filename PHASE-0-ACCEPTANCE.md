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
