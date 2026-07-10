# Claude-to-Codex Project Handoff

**Project:** EA Audit Tool
**Repository:** `https://github.com/Nekoutb/ea-audit-tool` (private)
**Application directory:** `platform/`
**Handoff date:** 2026-07-10

## How to use this handoff

This document is the current operational summary for Codex. The complete historical transcript is in `SESSION-LOG-2026-07-09.md` at the repository root. The transcript contains older snapshots of some documents; the live repository files and this handoff take precedence.

Source-of-truth order:

1. `AGENTS.md` for project instructions.
2. `PROJECT-STATUS.md` for current progress.
3. `platform/DECISIONS.md` for settled architectural decisions.
4. `platform/ARCHITECTURE.md` for the implemented architecture.
5. `PROJECT-PLAN.md`, `WORK-BREAKDOWN.md`, and `EA-Audit-Tool_Master-Build-Prompt.md` for the plan and product specification.
6. `SESSION-LOG-2026-07-09.md` for historical context and rationale.

## Product

EA Audit Tool is a multi-tenant SaaS statutory-audit platform for audit firms working under ISA and OHADA/SYSCOHADA requirements. It is intended to support the full audit lifecycle: acceptance, planning, execution, conclusion, reporting, and related automation. The first-class product requirements include bilingual English/French support, FCFA formatting, tenant isolation, audit-file working papers, review notes, sign-offs, and document version history.

## Current status

- Build Phases 0 and 1 are complete.
- 20 of 103 planned build steps are complete.
- All completed work was tested locally.
- Phase 2, Acceptance and Planning, is the next planned phase.
- GitHub Actions workflow is authored and validated locally, but cloud execution is blocked by the private repository's Actions runner/billing configuration.

## Implemented stack

- Next.js 16 App Router
- React 19
- TypeScript in strict mode
- Tailwind CSS v4
- PostgreSQL 16
- Raw SQL through `pg`/node-postgres; no ORM or query builder
- `node-pg-migrate` with versioned SQL migrations
- NextAuth v5 credentials authentication with bcryptjs and JWT sessions
- Rank-based RBAC
- PostgreSQL Row-Level Security with a non-superuser application role
- Vitest unit/integration tests
- Playwright end-to-end tests
- ESLint and Prettier
- `docx` for Word generation and `docx-preview` for in-browser preview

## Deliberate decisions

1. Raw parameterized SQL is required. Do not introduce Prisma, another ORM, or an unapproved query builder.
2. Next.js 16 is retained. Its `proxy.ts` convention is used instead of the older `middleware.ts` convention.
3. Docker is not required for local development. PostgreSQL runs natively on Windows. GitHub Actions may still use a PostgreSQL service container on hosted runners.
4. Mandatory 2FA was descoped. Current authentication is standard email/password login; TOTP columns remain reserved for a possible future opt-in.
5. Tenant isolation is enforced at the database layer using `FORCE ROW LEVEL SECURITY`, tenant-scoped tables, and the transaction-local `app.tenant_id` setting.
6. Document versions currently store bytes in PostgreSQL. The storage boundary is isolated so an S3-compatible backend can be introduced later.
7. The document round trip is download, edit, upload as a new version, with check-out/check-in locking. In-browser DOCX rendering is used for preview.
8. EN and FR are supported from the beginning. Locale resolution is cookie, then user preference, then French default.

## Completed functionality

### Phase 0 — Foundations

- Repository scaffold and development tooling
- Tenant, user, and membership schema
- Raw-SQL migration runner
- Tenant transaction helper
- PostgreSQL RLS and fail-closed isolation proof
- Standard credentials authentication and RBAC
- Two-tenant seed data and tenant-isolation E2E proof
- EN/FR internationalisation and FCFA formatting
- Tenant/user-scoped notifications with unread badge
- CI workflow and Phase 0 acceptance document

### Phase 1 — Engagement and audit-file core

- Client and engagement management
- A–F bilingual file-index engine, including preserved numbering gaps
- Working-paper, document, version, sign-off, and review-note data model
- Bilingual DOCX templates and generation
- Document download/upload version round trip
- Version history and single-editor locking
- In-browser document preview
- Preparer/reviewer sign-off workflow
- Review-note blocking rules
- Full Phase 1 acceptance E2E flow

## Local setup

Run commands from `platform/`.

Required local configuration is held in `.env`, which must not be committed. Use `.env.example` as the template. The important variables are:

- `DATABASE_URL` for migrations and database administration
- `APP_DATABASE_URL` for the non-superuser application connection
- `AUTH_SECRET` for Auth.js sessions

The local database is PostgreSQL 16 on port `5433`, database `ea_audit`. Credentials are intentionally not recorded in this handoff.

Typical setup:

```powershell
cd platform
npm ci
npm run db:setup
npm run seed
npm run dev -- -p 3100
```

Development accounts are created by `npm run seed`; their passwords are not stored in project documentation.

## Verification commands

```powershell
cd platform
npm run typecheck
npm run lint
npm run test
npm run test:e2e
```

The latest recorded totals are 23 unit tests and 7 E2E tests, with typechecking and linting clean. If the local database is not prepared, run `npm run db:setup` first.

## Security requirements

- Never commit `.env` files, API keys, passwords, tokens, or private credentials.
- Use parameterized SQL for all runtime queries.
- Preserve tenant derivation from the authenticated session; never trust a client-supplied tenant identifier.
- Keep RLS enabled and forced for tenant-scoped tables.
- Maintain server-side authentication and authorization checks in addition to route guards.
- Do not allow AI-generated preparation or summaries to become final professional judgments without human review.

## Known follow-up

GitHub Actions currently fails before runner startup for the private repository. The workflow itself was validated locally and with `actionlint`. The repository owner needs to configure the GitHub Actions billing/spending-limit setting before hosted CI can run.

## Next recommended task

Begin Phase 2, Acceptance and Planning, following the step definitions in `WORK-BREAKDOWN.md`. Before implementation, inspect the current repository, verify the local test gate, and confirm the exact Phase 2 acceptance criteria.

## Working protocol for Codex

Read `AGENTS.md` before changing files. Follow existing patterns. Use type hints on all function signatures, put tests under `/tests` mirroring the source structure, use raw parameterized SQL, and include error handling without bare `except` clauses. Update `PROJECT-STATUS.md` and the session log after completed work.
