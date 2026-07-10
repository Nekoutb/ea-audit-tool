# EA Audit Tool — Live Project Status

Updated after every completed step. See `PROJECT-PLAN.md` for step definitions and `EA-Audit-Tool_Master-Build-Prompt.md` for the spec.

**Current phase:** ✅ **Build Phases 0, 1 and 2 COMPLETE** (34 of 103 steps, all tested locally). Ready for Build Phase 3 — TB, groupings & lead schedules. One external follow-up: enable GitHub Actions billing (see CI note under 0.8).

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
| 0.8 CI + Phase 0 acceptance demo | **Done** (see CI note) | ✅ Passed locally | `.github/workflows/ci.yml` authored + validated (actionlint clean); `PHASE-0-ACCEPTANCE.md` maps every criterion to its proof; ARCHITECTURE.md updated. **Full CI gate proven green locally** (db:setup → typecheck → lint → 10 unit incl. RLS proof → 6 E2E). ⚠️ GitHub-hosted execution blocked — see note below. |

### ⚠️ CI execution blocker (action needed from you)

The workflow is correct (validated by `actionlint`, exit 0), but GitHub returns a **0-second `startup_failure`** with no logs. That happens when GitHub **can't provision an Actions runner for a private repo** — typically an account **billing / spending-limit** setting, not a code issue. To enable it: GitHub → Settings → Billing → set up a spending limit / payment method for Actions (private repos get 2,000 free min/month but need billing configured), or make the repo public (Actions free) — not done here since it's a commercial codebase. Until then, run the identical gate locally: `npm run db:setup && npm run typecheck && npm run lint && npm run test && npm run test:e2e`.

## Phase 1 — Engagement & audit file core

| Step | Status | Tested | Notes |
|---|---|---|---|
| 1.1 Clients & engagements data model | **Done** | ✅ | Raw-SQL migration (client, engagement, file_item, document, document_version, signoff, review_note — all RLS enabled+forced); tenant-scoped loaders. |
| 1.2 Client management UI | **Done** | ✅ | /clients list + create (name, legal form SA/SARL/SAS/GIE, listed, co-CAC). |
| 1.3 Engagement management UI | **Done** | ✅ | /engagements list; create from client page (fiscal year × period end, unique per client+year). |
| 1.4 File Index engine (A–F) | **Done** | ✅ | 64-item default index, bilingual titles, numbering gaps preserved (no D2/D5.3 — proven by unit test); instantiated transactionally on engagement creation. |
| 1.5 Working-paper object model | **Done** | ✅ | document/version/signoff/review-note tables; immutable versions with sha256. |
| 1.6 Templates + .docx generation | **Done** | ✅ | Bilingual template registry (D3.1 acceptance-specific + generic); merge fields; valid .docx proven by unit test; version stamped `template:id@version`. |
| 1.7 Round-trip (download/upload) | **Done** | ✅ | Download version → edit → upload as next version. Mechanism decision logged in DECISIONS.md (WebDAV/WOPI deferred). |
| 1.8 Versioning + check-out/in locking | **Done** | ✅ | Single-editor lock; full history; restore copies forward (history never rewritten). |
| 1.9 Preview without Word | **Done** | ✅ | In-browser docx rendering (docx-preview); decision logged (PDF/A at Phase 7 archive). |
| 1.10 Sign-off workflow | **Done** | ✅ | Preparer→reviewer two-stage; reviewer sign locks; reopen requires reason, voids sign-offs, notifies signers. |
| 1.11 Review notes | **Done** | ✅ | Notes must be cleared (with response) before reviewer sign-off — enforced and tested. |
| 1.12 Phase 1 acceptance E2E | **Done** | ✅ | Playwright: create engagement → D3.1 from template → download v1 (real ZIP) → upload v2 → note blocks reviewer → clear → sign → **locked** → reopen unlocks. |

**Phase 1 test totals:** 23 unit (file index, docx, full document state machine) + 7 E2E — all green. Typecheck + lint clean.

## Phase 2 — Acceptance & planning

| Step | Status | Tested | Notes |
|---|---|---|---|
| 2.1 D-form structured-field framework | **Done** | ✅ | `form_response` + code-defined bilingual forms (16 D-forms); hybrid app-fields/doc-narrative split; D4.4 enforces documenting BOTH inquiry & inspection for D&I controls. |
| 2.2 D3.1 + partner acceptance gate | **Done** | ✅ | Acceptance→planning blocked until D3.1 complete + concluded "accept" + partner sign-off on the D3.1 paper. |
| 2.3 Independence campaign engine | **Done** | ✅ | Unique tokenized links (auth + user-match), IESBA questionnaire, e-signature; any "yes" → exception. |
| 2.4 Independence dashboard + reminders | **Done** | ✅ | Statuses sent/opened/completed/exception; manual reminders (auto-cadence deferred — needs scheduler); exceptions require partner disposition before acceptance (gated). |
| 2.5 Engagement letter (+ co-CAC) | **Done** | ✅ | Bilingual letter from merge fields incl. art. 704 mandate wording + co-commissariat variant; C1 planning letter too; letters are versioned documents. |
| 2.6 Mandate tracking | **Done** | ✅ | 2 years (statutes) / 6 years (AGO); final-year warning on the acceptance page. |
| 2.7 D6.1 job administration | **Done** | ✅ | Team assignment with EQR-independence block; hours-by-grade budget; PBC list with status flow. |
| 2.8 D1 engagement strategy driver | **Done** | ✅ | Master planning checklist: 20 D-codes with computed status (not started/in progress/complete/signed) + form links; D1 trigger questions for conditional forms. |
| 2.9 Materiality calculator | **Done** | ✅ | Benchmark×% → overall; performance (60–85 %); trivial; versioned; FCFA formatting. |
| 2.10 Materiality approval + propagation | **Done** | ✅ | Partner-only approval; revision supersedes + notifies partners that dependents need review. |
| 2.11 Understanding forms + rollforward | **Done** | ✅ | D4.x/D5.x structured forms; related-party register + estimates inventory; carry-forward marks fields "confirm or update", editing confirms. |
| 2.12 Risk register lifecycle | **Done** | ✅ | D7.1 raise-from-any-form → dismiss-with-rationale/promote → D7.2 with likelihood×magnitude, CEAVP mapping, presumed risks auto-seeded (override not rebuttable; revenue fraud partner-rebuttable). |
| 2.13 Significant-risk consequences + close gates | **Done** | ✅ | 7 planning-close gates BLOCK: materiality approved, D6.1/D7.1/D7.2 partner-signed, significant risks linked, rebuttals approved, material sections covered (stand-back); close takes a planning snapshot → execution. |
| 2.14 Program library + tailoring + E2E | **Done** | ✅ | ~40-step bilingual library across all E-sections; significant risk → extended procedures auto-linked; coverage matrix; full acceptance E2E green. |

**Phase 2 test totals:** 39 unit + 8 E2E (incl. the full Phase 2 acceptance flow) — all green; typecheck + lint clean; adversarial multi-agent review run before commit.

## Phase 3 — TB, groupings & lead schedules (split with Codex)

| Step | Owner | Status | Notes |
|---|---|---|---|
| 3.1 TB import wizard | Codex | In progress | `lib/tb-import.ts` parser landed (WIP) |
| 3.2 TB validation | Codex | In progress | |
| 3.3 Versions + journals | Codex | In progress | Schema landed (migration 0006) |
| 3.4 Sub-ledger imports | Claude | **Done** ✅ | CSV/XLSX typed datasets, amount detection, totals; Data tab |
| 3.5 Grouping library | Codex | In progress | Starter seed landed — ⚠ see note below |
| 3.6 Client overrides | Codex | In progress | Schema landed |
| 3.7 Lead schedules | Claude | **Done** ✅ | Excel per E-section from grouped TB, live totals, materiality flags, versioned leadsheet documents |
| 3.8 Distribution + regen | Claude | **Done** ✅ | Owner assignment + notification; regen preserves tickmarks/commentary by account, reports lost lines |
| 3.9 Preliminary analytical review | Claude | **Done** ✅ | Section variance vs prior flagged against PM; ratio set; raise-into-D7.1 (source D4.3) |
| 3.10 Acceptance E2E | Claude | **Done (my scope)** ▶ | Seeded TB → lead schedule → assignment → flag → risk promoted, green. Import-wizard leg swaps in when 3.1 UI lands |

**⚠ Note for the TB workstream:** the `syscohada_grouping_rule` starter seed has SYSCOHADA inaccuracies vs the master prompt's Appendix A — e.g. 61 is *Transports* (mapped with 60 to purchases: acceptable), but **63/64 are mislabeled** (63 = Autres services extérieurs, 64 = Impôts et taxes), **66 = Charges de personnel** (currently labeled "Financial expenses" → E170; should be payroll → E120; 67 = Frais financiers), and **77 = Revenus financiers** (labeled "Exceptional income"). My analytics deliberately use class prefixes directly so they are unaffected, but lead-schedule grouping quality depends on these rows — recommend correcting the seed against Appendix A.

**Phase 2 post-commit review:** a 45-agent adversarial review confirmed 19 findings (12 distinct defects, 3 high). All fixed and regression-tested in commit `5f851cf`.

## Phases 4–9

Not started. Detailed step tables will be added here as each phase begins.
