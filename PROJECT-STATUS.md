# EA Audit Tool — Live Project Status

Updated after every completed step. See `PROJECT-PLAN.md` for step definitions and `EA-Audit-Tool_Master-Build-Prompt.md` for the spec.

**Current phase:** 🏁 **ALL BUILD PHASES 0–9 COMPLETE** (103 of 103 steps; 116 unit + 15 E2E green). One external follow-up: enable GitHub Actions billing (see CI note under 0.8).

**Last updated:** 2026-07-10

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

## Phase 3 — TB, groupings & lead schedules — COMPLETE ✅

All 10 steps done. Per user direction the TB workstream (3.1–3.3, 3.5–3.6) was rebuilt by Claude, replacing the in-progress Codex implementation: import with EN/FR column-mapping inference (balance générale or closing-only), validation engine (balance checks, codification, unknown accounts, opening-ties-to-prior → E370), versions + balanced adjusting journals (FINAL = initial + journals, reproducibly linked, per-account diff), 94-rule SYSCOHADA grouping seed transcribed faithfully from Appendix A/B (fixes the earlier 63/64/65/66/77 mislabels), and client overrides with precedence. Phase 3 E2E runs the REAL import path end-to-end.

## Phase 4 — Execution / fieldwork — COMPLETE ✅

All 12 steps done: program-step execution with mandatory conclusions + evidence (files/datasets/documents); one-destination findings routing (B4/C1/B5/revise-approach) with backlinks; ISA 450 misstatements — below-trivial refused unless confirmed, live corrected/uncorrected totals vs final materiality with exceeds/within verdict; control deviations force extend/abandon/deficiency (extension steps auto-appended, deficiencies → C1, abandon clears controls-reliance); revise-approach adds dated risks requiring partner approval with a section revise log; section conclusions with preparer → reviewer → (partner when significant risk) chain that voids on re-save.

## Phase 5 — Automation engines — COMPLETE ✅

All 10 steps done: reproducible run framework (params + dataset + user recorded; HMAC-seeded deterministic sampling; Excel outputs indexed as engine_output documents); sampling random/systematic/MUS/criteria with projected misstatements auto-raised to B5; sub-ledger/FAR/bank reconciliations vs the TB with unreconciled-difference findings + stale-item aging; supplier-statement comparison; JE testing (round/weekend/period-end/large scoring); substantive analytics with unexplained variance → B5.

## Phase 6 — Circularisations — COMPLETE ✅

All 8 steps done: dataset-driven selection (threshold / top-N / nil balances, idempotent per party), bilingual letters for all seven confirmation types (negative letters carry the ISA 505 conditions warning) stored as versioned documents with unique reply tokens, prepared→approved→sent lifecycle with reminders, reply evaluation (auto difference; zero reconciles, else exception), dispositions (client error auto-raises the difference into B5), non-reply → alternative procedures, and an auto-produced coverage summary working paper. Outstanding confirmations are queryable for the Phase 7 B6 feed.

## Phase 7 — Conclusion & reporting — COMPLETE ✅

All 12 steps done: B1 completion gates that BLOCK issuance (sections concluded+reviewed, risks concluded, B5 within final materiality, final analytical review, FS tie-out, SYSCOHADA disclosure checklist 1–36, subsequent events to report date, both OHADA rep letters, B4 cleared, B6 confirmations closed, partner conclusion with independence reconfirmation); FS tie-out recomputing the full Appendix B.3 SIG cascade (TA→XI) + bilan equilibrium from the current TB; OHADA double representation-letter layering under B8 (affirmation pre-arrêté DG+chef comptable; complementary post-arrêté PCA+DG) plus the final management letter pulling C1 points; ISA 700/705 opinion decision tree; FR statutory report ("réguliers et sincères… image fidèle", arts. 710–716, EoM going concern, KAM for listed) filed under A1 as kind='report'; issuance in one gated transaction starting the 60-day assembly clock; immutable archive (JSON manifest snapshot; checkout/checkin refused post-archive); rollforward N→N+1 injecting the B10 points forward. Suite: 92 unit + 13 E2E green.

## Phase 8 — OHADA legal module — COMPLETE ✅

All 9 steps done: F1 statutory deadlines auto-generated from period-end/AGM/mandate (arrêté ≤4 months clamped to month-end, docs to CAC ≥45d, AGO ≤6 months, rapport spécial deposit ≥15d, 60-day assembly, mandate expiry 2/6 years) with countdowns, done-marks and overdue escalation to partners; F2 legal-form-aware conventions register (SA conventions without board authorization flagged per art. 447) + rapport spécial generator (FR, "néant" wording when empty); F3 article 715 report built from live data (program stats, section conclusions, uncorrected B5 adjustments, C1 points, current-vs-prior result); F4 procédure d'alerte state machine with SA (arts. 153-156, board deliberation path) and non-SA (arts. 150-152) variants — registered-letter/rapport documents filed under F4 at each transition, stage deadline timers (15d reply, 8d associé communication, 15d board convocation), satisfactory-reply discontinuation resumable within 6 months; F5 faits délictueux révélation to the ministère public + irregularities signalement letters, partner-only access; F6 titres nominatifs attestation (art. 746-2) with annexed management declaration; F7 equity < ½ capital monitor computed from the final TB (raises the statutory EGM deadline per arts. 664-669/371-373 and notifies partners); F8 co-CAC work-split/cross-review records with the art. 719 disagreement disclosed in the joint report. Suite: 106 unit + 14 E2E green.

## Phase 9 — Portal, dashboards, polish — COMPLETE ✅

All 8 steps done:
- **9.1/9.2 Client portal + PBC**: portal contacts are `client_user` memberships scoped to ONE client (bcrypt-hashed passwords, min 8 chars, email uniqueness); the proxy walls portal users off from every firm route (pages redirect to /portal, firm APIs return 403) and firm users off the portal; PBC items flow requested → uploaded → accepted with notifications both ways (portal users on request, engagement team on upload); the firm can attach an accepted upload to an E-section as a versioned working-paper document; cross-client uploads are refused at the SQL level.
- **9.3 Engagement dashboard**: live strip on the file page — program-step progress, risks open/concluded/significant, B5 uncorrected vs approved materiality, draft documents, PBC outstanding, next statutory deadlines.
- **9.4 Firm dashboard**: engagements by phase, statutory-deadline heat list (overdue highlighted, linked to each engagement's legal tab), workload by section owner, mandate expiries.
- **9.5 Portfolio risk views**: significant risks across active engagements; uncorrected-B5 exposure per engagement vs materiality with EXCEEDS flag.
- **9.6 Regulator export**: full file index with owners, document status/version, three-stage sign-offs and section-conclusion state as a real .xlsx (`/api/engagements/[id]/export`).
- **9.7 Performance pass**: benchmarked in the suite — a 5,000-row TB imports in well under the 30s budget and lead-schedule regeneration is under 10s; notifications and dashboard queries are LIMIT-capped.
- **9.8 Security review**: verified RLS is enabled AND forced on all 49 tenant-scoped tables (the only non-RLS tables are the intentionally-global four: tenant, app_user, membership, syscohada_grouping_rule); revoked app-role write access to the global SYSCOHADA library (migration 15); audited every SQL interpolation site (all are internal constants — user values are parameterized throughout); no hardcoded secrets, `.env` git-ignored; no `dangerouslySetInnerHTML`; role checks on all sensitive flows (partner: report issuance/archive/faits délictueux; reviewer+: PBC acceptance, portal-contact creation); portal lockout proven in the phase 9 E2E.

Suite: 116 unit + 15 E2E green.
