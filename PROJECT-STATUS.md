# EA Audit Tool — Live Project Status

Updated after every completed step. See `PROJECT-PLAN.md` for step definitions and `EA-Audit-Tool_Master-Build-Prompt.md` for the spec.

**Current phase:** Not started — plan and stack confirmed, awaiting go-ahead on open decisions below before Step 0.1 begins.

**Last updated:** 2026-07-09

---

## Open decisions blocking Phase 0 kickoff

| Decision | Options | Status |
|---|---|---|
| Object storage backend | Local disk (dev only) / MinIO (self-host S3-compatible) / cloud S3-compatible | **Awaiting input** |
| Word↔PDF round-trip mechanism | WebDAV + `ms-word:ofe\|u\|` / OnlyOffice-Collabora via WOPI / M365 Graph co-authoring | Not yet needed (Phase 1) — flagged for awareness |

## Phase 0 — Foundations

| Step | Status | Tested | Preview link | Notes |
|---|---|---|---|---|
| 0.1 Repo scaffold & tooling | Not started | — | — | |
| 0.2 DB bootstrap + migration runner | Not started | — | — | |
| 0.3 RLS bootstrap + isolation proof | Not started | — | — | |
| 0.4 Auth core + 2FA + RBAC | Not started | — | — | |
| 0.5 Two-tenant seed + E2E proof | Not started | — | — | |
| 0.6 i18n plumbing (EN/FR) | Not started | — | — | |
| 0.7 Notification service skeleton | Not started | — | — | |
| 0.8 CI + Phase 0 acceptance demo | Not started | — | — | |

## Phases 1–9

Not started. Detailed step tables will be added here as each phase begins.
