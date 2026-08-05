# Execution Prompt — Canvas-Structure Workspace (unbranded)

**AuditISA · authored 5 Aug 2026 from the six reference screenshots. All EY branding excluded; only the structure, information density and interaction patterns are adopted. Liquid-glass grey theme and green accent are retained. This document is the build order; items ship smallest-risk-first, each deployed and verified.**

## Global rules
- Internal task codes, sign-off engine, gates and RLS are untouched — this is presentation + new read surfaces plus two small write actions (task due dates already exist; evidence upload already exists).
- Every count shown must deep-link to the record it counts. No decorative numbers.
- All new strings EN + FR. All new pages keep `data-testid` hooks and pass typecheck/lint/build + phase2 E2E before deploy.
- Section label rename: **"Planning & Strategy" → "Scope & Strategy"** everywhere (i18n only; slug/keys unchanged).

## P1 — Engagement dashboard, Canvas band structure  *(this release)*
Top band (single row on desktop, stacking on mobile):
1. **Scope & Strategy ring** · 2. **Execution ring** — compact ring cards (%, done/total, deadline). Clicking a ring selects it.
3. **Task Status panel** — the selected section's groups: name, progress bar, done/total, → group page. (Default selection: first incomplete section.)
4. **Conclusion ring**.
5. **Reference Documents panel** — chips to TB/data, PBC, legal, export (existing links; per-engagement uploaded docs later).
Below, left column: **My/All summary toggle + tiles** (exists) · **Findings band** — Misstatements count + Deficiencies count → `/findings` · attention queue (exists).
Right column: **Engagement Feed** — last 8 activity rows (who, what, when) → `/activity`; key-dates panel (exists, trimmed).

## P2 — Team management page  *(this release)*
`/engagements/:id/team` — "Manage Team": Active Members table (status dot, name, initials, role, email), Add member (firm-user select + role), remove (senior+). Data: `listTeam`, `assignTeamMember`, `removeTeamMember` (all exist — today buried in the planning page). Linked from hub meta + settings row. Roles vocabulary: partner, manager, reviewer (EQR), senior, staff — display labels only.

## P3 — My Tasks page  *(next)*
`/engagements/:id/tasks` — the Canvas task list: count chips (Items / Tasks / For my review / To-dos / hide completed), rows: display code badge, short title, due date ("Due in N days" from due_date ?? section deadline), status dot, open-review-note badge; filters: star/mine/overdue (server params). Row → task page. Data: `engagementTasks` + review-note counts per item (one grouped query). "Add Task" maps to the group-page instantiate pattern — custom ad-hoc tasks are a later schema change, excluded here.

## P4 — Task page, Canvas structure  *(next)*
Rework `/forms/:code` (and section workpapers) header to the Bank-reconciliations pattern: title row + meta strip (assignee, period/month, sign-off count, due date), **Hand off** primary button (exists as save-handoff), Description block (template purpose, exists), **Evidence list**: attached documents with per-file sign-off chips (P/R state from the sign-off engine) and review-note count badge; **Add Evidence** = existing upload API. Right rail: Activity (item-scoped activity rows) / Support (prior-year carry-forward docs — `carried` data exists).

## P5 — Document review pane  *(next)*
`/documents/:id` restructure: document preview fills the left (DocxPreview exists), right rail becomes the review pane: sign-off initials chips + **Sign off / Reject** (reject = reopen with reason, exists), tabs (Notes / Versions / Activity), Review Notes thread: add note + clear-with-response (both exist), note count, per-note timestamps. Structure-only rework of an existing page.

## P6 — Combined Risk Assessment  *(next)*
`/engagements/:id/cra` — matrix: rows = E-section accounts/cycles (file items), columns: CRA badges (risk levels from linked risks' assertions via `risk_section`), Risks (significant flag icon), SCOTs/steps count (`program_step`), WCGWs (risk_section assertions count), Controls (`control_test` count), Testing (completed steps). All read-only aggregates of existing tables; each cell links to the section workpaper or risk register. Add to hub reference chips + register row menu later.

## P7 — All-pages audit  *(after P3–P6)*
Sweep every remaining page (acceptance, planning, considerations, risks, data, analytics, confirmations, pbc, legal, conclusion, findings, sections, documents, portal, users, templates, resources, notifications) against: purpose clarity, dead ends, unlabeled inputs, hit targets, empty/loading states, i18n gaps, duplicate CTAs, terminology, and code smells (unused queries, N+1s, missing revalidation). Deliver a findings table with per-page corrections; implement the Critical/High fixes in the same release train.

## Out of scope (needs user)
Entity master-data migration; due-date column on prod (both awaiting the server one-liners); ad-hoc custom tasks (schema); per-engagement uploaded reference documents (schema).
