# UX / IA / Workflow Audit — Dashboard · Clients · Engagements

**AuditISA statutory-audit platform · Audit date 20 Jul 2026 · Auditor: senior product-design review, grounded in the live source code (file:line refs throughout)**

---

# Part 1 — Executive Assessment

**Principal usability problem.** The platform has *two* pages named "Dashboard" (the firm page at `/dashboard` and the engagement hub at `/engagements/:id/dashboard`) and *two* competing portfolio lists (`/clients` and `/engagements`). A user cannot predict which page answers "where is my audit?" — and the page actually labelled Dashboard in the nav is the weakest screen in the product: it still contains Phase-1 developer scaffolding (raw tenant UUID, RLS probe rows, a "Send test notification" button — `app/dashboard/page.tsx:38-82`) shown to every user.

**Principal information-architecture problem.** The engagement is already the true operational object — login even lands users on their last engagement's hub (`app/page.tsx:15`) — but the navigation pretends otherwise: `Clients` and `Engagements` sit as equal peers in the top nav (`components/AppNav.tsx:55-57`), and the client-detail page duplicates the engagement register (`app/clients/[id]/page.tsx:52-70`) with its own "New engagement" CTA. Two sources of truth for the same records.

**Main source of overlap.** The client-detail page is ~70% an engagement list. The clients list's only distinguishing data is legal form + two flags; the "client record" as an entity master barely exists yet (no registration number, no tax ID, no year-end, no framework, no PIE status — none of these fields exist in the schema).

**Recommended structural decision (Part 9 in full): Option 2 — remove Clients from primary navigation; retain the client record as a secondary "Entity record" reached from the engagement and from an administrative directory.** Engagements becomes the single register; the Dashboard is rebuilt as a personalised "My Audit Portfolio" action centre.

**Expected impact.** One obvious answer to "where do I go?" (Engagements), one answer to "what needs me today?" (Dashboard), zero duplicate lists, a creation flow that keeps entity and engagement concepts distinct without forcing users to visit two pages, and a register that finally shows partner/progress/deadline — the columns statutory auditors actually scan.

---

# Part 2 — Current-State Page Audit

## 2A. Dashboard (`/dashboard`, `app/dashboard/page.tsx`)

**Current apparent purpose.** "Firm dashboard" — portfolio analytics.

**What it actually is.** A Phase-1 test harness with four good widgets bolted underneath. It is *not* the homepage: `/` redirects to the last-worked engagement hub, so this page is only reached via the nav — meaning the nav item "Dashboard" takes you somewhere you never land naturally.

**Component inventory & verdicts**

| # | Component (file:line) | Verdict |
|---|---|---|
| 1 | "Signed in as" panel: email, raw role string (`firm_admin` in monospace), **raw tenant UUID** (`:40-55`) | **Remove.** Debug internals. Tenant UUID means nothing to an auditor and looks alarming. Identity belongs in the nav avatar (already there). |
| 2 | "Firm data" list — literally rows from the `rls_probe` test table (`:25-30, 57-69`) | **Remove.** Leftover isolation test. Should never render for users. |
| 3 | "Send test notification" button (`:71-81`) | **Remove** (move to a hidden admin/diagnostics area if needed). |
| 4 | By-phase counts (`:87-98`) | **Keep, make actionable** — each count must link to the register filtered by that stage. Today they are dead text. |
| 5 | Workload (name — open-step count) (`:100-108`) | **Move** to Resources (a workload page already exists at `/resources`) or make rows link somewhere. Today: dead end. |
| 6 | Mandate expiries (`:110-118`) | **Keep** (statutory rotation is a real portfolio concern) but link each row to the entity/engagement. Dead end today. |
| 7 | Deadline heat (`:121-133`) | **Keep** — correctly links to `/engagements/:id/legal`. The best widget on the page. |
| 8 | Portfolio significant risks (`:139-149`) | **Keep** — links to risks pages. |
| 9 | B5 exposure vs materiality (`:151-170`) | **Keep** — links to findings pages. |
| 10 | "Phase 1" footnote (`:173`) | **Remove.** The page admits it is scaffolding. |

**Missing (per the target model):** Priority-action queue (overdue procedures, workpapers awaiting *my* review, open review notes, pending independence, acceptance awaiting approval); "My engagements" strip; personalised review workload (the per-engagement hub already computes exactly these numbers — `dashboardStats` in `lib/engagement-dashboard.ts` even has a firm-wide "all" scope — but the firm dashboard doesn't use it); upcoming report-issuance dates.

**Not personalised.** Nothing on this page changes based on who is signed in except the email string.

**Recommended future purpose.** *"My Audit Portfolio"* — what needs me, which engagements are at risk, what deadlines approach, where do I go next. Firm-wide analytics (workload, mandate expiries) remain as a secondary block or partner-only view.

## 2B. Clients (`/clients` + `/clients/[id]`)

**Current apparent purpose.** Client directory + client creation.

**What it actually does.** Three-column list (name, legal form, engagement count — `app/clients/page.tsx:35-64`) with a permanently-open "New client" form at the bottom (`:68-95`). The detail page (`app/clients/[id]/page.tsx`) is: header with legal form/listed/co-CAC (`:38-45`), **a duplicate engagement list** (`:47-72`), **a second "New engagement" CTA** (`:74-85`), and PBC portal-contact management including client-user password creation (`:87-120`).

**Confusing elements**
- The detail page's engagement list shows *less* information (year + phase only) than `/engagements`, yet is the **only** place engagements are grouped by client — so prior-year lookups force users here, into the weaker view.
- Two "New engagement" buttons exist in the product (register + client page), plus a "New client" form that is disconnected from the engagement-creation wizard: the wizard redirects to `/clients` when no client exists (`app/new-engagement/page.tsx:26`) but after creating one, the user is stranded on `/clients` — the loop never returns to the wizard. **Broken onboarding flow.**
- Portal-contact passwords (a security-sensitive admin task) sit on the same page as portfolio navigation.

**Duplicated information.** Engagement list (vs `/engagements`), New-engagement CTA (vs register), engagement count (vs register).

**Missing information (this is the page's actual justification, and it's absent).** Registration number, tax ID (NIU), registered address, year-end, accounting framework (SYSCOHADA/IFRS), PIE status, group structure, governance contacts, previous auditor, permanent documents, engagement *history* with report outcomes. None exist in `client` table or UI.

**Elements to retain:** legal form, listed, co-CAC flags; portal contacts (relocated); the entity concept itself.
**Elements to remove from this page:** the duplicate engagement list as primary content; the New-engagement CTA.
**Elements to move:** client creation → into the engagement wizard as an inline "new entity" step; portal contacts → the entity record's admin section (or PBC page).

**Recommended future purpose.** *Entity record* — reusable master data + engagement history — reached from within an engagement ("about this entity") and from an administrative Entity Records directory. **Not** a primary-nav peer of Engagements.

## 2C. Engagements (`/engagements`, `app/engagements/page.tsx`)

**Current apparent purpose & reality.** The register of audit assignments — correct concept, under-equipped table.

**Component inventory**

| Component (file:line) | Verdict |
|---|---|
| Title + "New engagement" primary CTA (`:23-30`) | **Keep** — correct single primary action. |
| Table: engagement/client name, fiscal year, period end, phase, "Open" (`:45-88`) | **Keep, extend.** See below. |
| Empty state (`:32-35`) | Adequate ("create the first one"). |

**What the register is missing** (each one is a column statutory auditors scan daily):
1. **Partner / manager** — data exists (`team_member` with `team_role='partner'`; `engagementReviewer()` already queries it).
2. **Progress %** — the hub computes it; the register shows nothing.
3. **Stage vs status** — the phase column conflates lifecycle stage with health; there is no on-track/behind indicator anywhere.
4. **Attention flags** — open review notes, overdue tasks (both computable from existing queries).
5. **Report deadline** — `deadlineHeat` already computes statutory deadlines; absent here.
6. **Search and filters** — none. No year filter, no partner filter, no "my engagements", no stage filter.
7. **Archived separation** — `listEngagements` returns every phase including `archived`, mixed into the active list, undistinguished (`lib/engagements.ts:60-74`).
8. **Roll-forward** — the annual-recurrence action exists (`rollforwardAction`, `app/actions/conclusion.ts:140-145`) but is only discoverable inside a concluded engagement's conclusion page. The register — where a user thinks "create FY2027 like FY2026" — has no trace of it.
9. **Row click** — only the "Open" link navigates; the row itself is not clickable (inconsistent with the group/phase task tables, whose whole row navigates).

**Duplicates:** none internally — this page is the right backbone. Its problem is anaemia, not overlap.

**Recommended future purpose.** *The* operational register and the default landing page when no "last engagement" exists — every audit assignment, identifiable at a glance, filterable, with one obvious route in.

---

# Part 3 — Overlap Matrix

Owner legend: **D** = Dashboard (My Portfolio) · **E** = Engagements register · **EW** = Engagement workspace (hub + inner pages) · **ER** = Entity record · **N** = AppNav (global)

| Information / function | Dashboard today | Clients today | Engagements today | Overlap? | Recommended owner | Reason |
|---|---|---|---|---|---|---|
| Client name | in widgets | list + detail | column | ✔ 3-way | **E** (column), ER (master) | Register identifies; entity record owns the legal identity |
| Engagement name | — | — | column | — | **E** | Register is the naming authority (convention lives in branding) |
| Audit year | widgets | detail list | column | ✔ | **E** | Filterable column; entity record shows history |
| Audit stage (lifecycle) | by-phase counts | detail list | phase column | ✔ 3-way | **E** (column) + D (summary counts linking to E) | One definition (see Part 7) |
| Audit status (health) | — | — | — | missing | **E** (chip) + D (exceptions) | New concept; must not be conflated with stage |
| Engagement progress % | — | — | — | missing | **E** + EW hub | Computed once (hub already does), shown in both |
| Engagement team | — | — | — | missing | **EW** (team panel); partner/manager as E columns | Team managed in workspace; register shows accountable names |
| Partner | — | — | — | missing | **E** column | Scan + filter |
| Deadline (report/statutory) | deadline heat | — | — | ✔ partial | **E** column; D surfaces only *approaching/overdue* | D = exceptions, E = record |
| Latest activity | — | — | — | missing | **E** column (relative time) | Data exists in `activity_log` |
| Outstanding tasks | — | — | — | missing | **EW** (attention queue); D aggregates *mine* | D = my actions across engagements |
| Review notes | — | — | — | missing at portfolio level | **EW**; D shows "awaiting my response/review" | Personalised exception only |
| Client requests (PBC) | — | portal contacts | — | ✔ partial | **EW** `/pbc`; D shows overdue count | Contacts move to ER |
| Findings | B5 exposure | — | — | — | **EW** `/findings`; D keeps exceeds-materiality exceptions | Correct today, keep |
| Materiality | in B5 widget | — | — | — | **EW** planning | Correct |
| Risk rating / significant risks | portfolio risks | — | — | — | **EW** `/risks`; D keeps open-significant exceptions | Correct |
| Contact information | — | portal contacts | — | — | **ER** | Reusable entity data |
| Legal entity details (form, listed, co-CAC) | — | list + detail | — | — | **ER** | Master data |
| Industry / frameworks / registration IDs | — | — (absent) | — | missing | **ER** | To be added to schema |
| Engagement history (multi-year) | — | detail list | mixed into table | ✔ | **ER** (history section) + E (year filter) | Two views, one truth |
| Report status / opinion | — | — | — | missing | **E** column (issued/pending) + EW conclusion | Data exists (`report_date`, `opinion`) |
| Archive status | — | — | mixed in | ✔ | **E** (filter, default hidden) | Stop mixing archived into active |
| Mandate expiries | widget | — | — | — | **D** (partner view) linking to ER | Rotation is entity-level |
| Workload by person | widget (dead) | — | — | ✔ with `/resources` | **/resources** | Already has a page; remove from D |
| Create-client action | — | bottom form | — | — | **Wizard step** (inline "new entity") + ER admin | Kill the standalone form |
| Create-engagement action | — | CTA | CTA | ✔ | **E** (single CTA); ER history offers "new engagement for this entity" deep-link | One primary door, one contextual shortcut |
| Roll-forward | — | — | — | hidden in conclusion | **E** row action (archived/concluded rows) | Where users look for it |
| Search | — | — | — | missing | **N** (global search) | Cross-record, one place |
| Filters | — | — | — | missing | **E** | Owned by the register |
| Notifications | — | — | — | — | **N** (bell) | Correct today |
| Recently accessed | `/` redirect + nav selector | — | — | — | **N** selector + D "My engagements" | Correct; surface visually on D |

---

# Part 4 — Recommended Navigation Structure

```
AppNav (global):
├── Dashboard          → /dashboard        “My Audit Portfolio” (rebuilt)
├── Engagements        → /engagements      THE register (default landing fallback)
├── [Engagement selector ▾]                recent engagements (exists)
├── 🔔 Notifications   → /notifications
└── ⚙ Settings         → /settings
      ├── Users                (exists)
      ├── Templates            (exists)
      ├── Entity records       → /clients   (renamed, admin master-data directory)
      └── Resources / workload (exists)
```

- **Clients leaves the primary nav.** `components/AppNav.tsx:56` drops; `/clients` remains routable as the Entity Records directory under Settings, and each engagement hub links to its entity record ("About SOCAPALM →").
- **No new top-level items.** "My Work" and "Reviews" live as Dashboard sections, not menu entries — the platform is not large enough to justify more chrome.
- Global search (client, engagement, year, partner) is a Phase-2 addition to AppNav; results labelled by record type.

---

# Part 5 — Recommended Page Structures

## 5A. Dashboard — "My Audit Portfolio"

```
┌ AppNav ─────────────────────────────────────────────────────┐
│ H1  My Audit Portfolio          [greeting · role context]   │
│                                                             │
│ ① PRIORITY ACTIONS (queue, max ~8, each row → deep link)    │
│    ▸ 2 workpapers await your review          → group page   │
│    ▸ Review note awaiting your response      → document     │
│    ▸ Independence confirmation pending (You) → /independence│
│    ▸ ZOEDEN FY26: acceptance awaits partner  → acceptance   │
│    ▸ 3 PBC requests overdue — SOCAPALM       → /pbc         │
│                                                             │
│ ② MY ENGAGEMENTS (≤5 cards: name · stage chip · progress    │
│    ring · deadline · “Continue →” to hub)                   │
│                                                             │
│ ③ PORTFOLIO SUMMARY (stage counts as links → register       │
│    filtered: Planning&Strategy 4 · Execution 7 · …)         │
│                                                             │
│ ④ UPCOMING DEADLINES (14/30-day horizon, from deadlineHeat, │
│    row → engagement/legal)   ⑤ REVIEW WORKLOAD (partner/    │
│                                 reviewer roles only)        │
│                                                             │
│ ⑥ FIRM ANALYTICS (collapsed, partner/admin: mandate         │
│    expiries → entity record · portfolio risks · B5)         │
└─────────────────────────────────────────────────────────────┘
Empty state: “No actions waiting — open the register →”
```
Removed entirely: signed-in panel, tenant UUID, RLS probe list, test-notification button, dead workload widget (→ /resources).

## 5B. Engagements — the register

```
│ H1 Engagements                    [＋ New engagement]        │
│ Search ▭▭▭▭   Filters: Year ▾ Stage ▾ Partner ▾ ☑My  ☐Archived│
│ (optional strip: 12 open · 3 behind · 2 reports pending)     │
│ ┌ TABLE (row click opens hub) ──────────────────────────────┐│
│ │ Engagement (name + client sub)  FY  Partner  Stage  Status ││
│ │ Progress ▬▬▬ 64%   Deadline 30 Apr (‼)   Last activity 2h  ││
│ │ Row action: Open · (archived/concluded rows: Roll forward) ││
│ └───────────────────────────────────────────────────────────┘│
```
Stage chips use the three-section labels + Acceptance/Closed/Archived; Status is a separate on-track/behind/blocked chip (defined in Part 7). Archived hidden by default behind the filter.

## 5C. Engagement detail (hub) — already correct, two additions

The existing hub (`/engagements/:id/dashboard` — section rail, tiles, attention queue) **is** the right engagement workspace and stays. Add: **(a)** an "About this entity →" link in the header meta (to the entity record); **(b)** the stage/status chips consistent with the register.

## 5D. Entity record (`/clients/:id`, renamed "Entity record")

```
│ ← Back (context-aware)      H1 SOCAPALM SA     [SA · Listed · Co-CAC]│
│ ① IDENTITY (master data grid: registration nº, NIU, address,        │
│    year-end, framework, PIE status, industry — editable, admin)     │
│ ② ENGAGEMENT HISTORY (table: FY · type · stage · opinion · report   │
│    date · Open)  +  [New engagement for this entity →] (wizard      │
│    prefilled)                                                       │
│ ③ CONTACTS & PORTAL ACCESS (moved portal-contact admin)             │
│ ④ PERMANENT DOCUMENTS (phase 2)                                     │
```
The engagement list here is *history* (read-oriented, includes opinion/report), not a competing register.

---

# Part 6 — User Flows

**F1 · Continue an existing audit.** Login → `/` lands on last engagement hub (0 clicks — already implemented, keep). Different engagement: nav selector (1 click) or Dashboard "My engagements" card (1 click) or register → row click (2 clicks). *Today's gap fixed:* row click + search.

**F2 · Create FY2027 for an existing client.** Register → filter client or find FY2026 row → **Roll forward** → wizard opens prefilled (entity, type, period+1) → assign partner (exists in wizard) → acceptance/independence run inside the new engagement (existing gates) → activate. *Today:* roll-forward is buried in the old engagement's conclusion page; the register never mentions it.

**F3 · New client + first engagement.** Register → New engagement → wizard client dropdown gains **"+ New entity…"** inline step (name, legal form, listed, co-CAC — the 4 fields the current form has) → continue wizard seamlessly. Entity record enriched later from its own page. *Today:* user is bounced to `/clients`, fills a disconnected form, and must find their way back.

**F4 · Review work (partner).** Dashboard → Priority actions "await your review" rows → group page → task/document → sign. Firm-wide review queue = `dashboardStats(all)` numbers turned into links. *Today:* per-engagement tiles only; no cross-engagement review view.

**F5 · Prior-year engagements.** Engagement hub → "About this entity" → history table (FY, opinion, report date, archived files). Or register with ☑Archived + client filter. *Today:* only the thin client-detail list.

**F6 · Close & archive.** Unchanged mechanically (conclusion gates → report → archive). Additions: archived rows visible under the register's Archived filter with Roll-forward as their primary action; entity history shows the issued opinion.

---

# Part 7 — Terminology Recommendations

| Current term | Problem | Recommended | Definition | Used in |
|---|---|---|---|---|
| "Dashboard" (×2 pages) | Two different pages share the label | **My Portfolio** (firm) / **Overview** (engagement hub nav label) | Portfolio = cross-engagement action centre; Overview = one engagement's hub | AppNav, hub |
| "Clients" (nav) | Implies a CRM peer of Engagements | **Entity records** (admin area) | Master data of audited entities | Settings |
| Phase labels ("Pre-Planning", "Planning"…) in register (`t.engagements.phases`) | Contradicts the new 3-section IA shown on the hub | **Stage**: Acceptance → Planning & Strategy → Execution → Conclusion → Closed → Archived | Lifecycle position, from the phase machine | Register, entity history, D summary |
| "Active" chip (hub, hardcoded English — `dashboard/page.tsx` StatCell) | Unlocalised, undefined | **Status**: On track / Behind / Blocked / Closed / Archived | Health, independent of stage; derived from overdue tasks + gate blockers | Register, hub |
| "In progress / Pending" (various chips) | Generic PM language | Stage- or status-specific labels above | — | everywhere |
| "Open" (row action) | Fine | Keep ("Open") | Enter the engagement workspace | Register, history |
| Task/workpaper/review-note states | Already well-defined (Not started/In progress/In review/Reviewed; note open/cleared) | Keep — document in one glossary | — | Group pages, documents |
| "Job Arrangements", "file" vs "engagement" | Mixed metaphors in places | Standardise on **engagement** (assignment) and **audit file** (its documents) | — | copy pass |

---

# Part 8 — Prioritised Recommendations

**Critical**
1. **Strip Phase-1 scaffolding from `/dashboard`** (tenant UUID, RLS probe rows, test-notification). *Why:* actively erodes professional trust; leaks internals. *Complexity: Low.*
2. **Register upgrade — identity columns + archived separation** (partner, progress, deadline, stage/status chips, hide archived). *Why:* the main register cannot answer who/where/when. *Complexity: Medium.*
3. **Remove Clients from primary nav; entity record reached from engagement + Settings.** *Why:* eliminates the two-registers problem at its root. *Complexity: Low (nav) + Medium (entity page rework).*

**High**
4. Dashboard rebuild as My Portfolio (priority actions, my engagements, clickable stage summary). *Complexity: Medium–High.*
5. Inline "+ New entity" step in the wizard; delete the standalone client form. *Complexity: Medium.*
6. Roll-forward surfaced as a register row action. *Complexity: Low (action exists).*
7. Firm-wide review queue for partners (Dashboard section). *Complexity: Medium.*

**Medium**
8. Stage/status terminology unification + localise the "Active" chip. *Complexity: Low.*
9. Register search + filters (year, stage, partner, mine, archived). *Complexity: Medium.*
10. Entity master-data fields (registration nº, NIU, address, year-end, framework, PIE) — migration + form. *Complexity: Medium.*
11. Row-click navigation on the register (match task tables). *Complexity: Low.*

**Low**
12. Global search in AppNav (typed results: entity/engagement/document). *Complexity: High — phase 2.*
13. Consistent page scaffold (title/action/search/summary/table) across the three pages. *Complexity: Low.*
14. Entity history table gains opinion + report date columns. *Complexity: Low.*

---

# Part 9 — Final Proposed Model

**Recommendation: Option 2 — remove Clients from primary navigation; retain client master records as a secondary Entity Record.**

Why this beats the alternatives for a statutory-audit platform:

- *vs Option 1 (merge into Engagements):* the entity is a real, reusable record — year-ends, frameworks, PIE status, portal contacts, and mandate rotation are entity-level facts that must survive across annual engagements. Merging would bury them inside one engagement and break roll-forward reuse.
- *vs Option 3 (keep both pages):* the codebase itself proves users don't need two portfolio doors — login bypasses both and goes straight to an engagement. Keeping two similar lists preserves the exact confusion this audit was asked to remove.
- *vs Option 4 (new structure):* the engagement-centric hub-and-spoke already works (hub → sections → groups → tasks → documents, with hard lifecycle gates). The failure is at the portfolio layer only; replacing the whole structure would discard a sound architecture to fix a navigation problem.

**Mental model shipped to users:** Dashboard = *my work and exceptions*. Engagements = *all assignments and the way in*. Entity record = *background that outlives any one audit*. Nobody ever chooses between Clients and Engagements again, because only one of them is a door.

---

# Implementation Plan (§15)

| # | Change | Files touched | Data/migration | Nav impact | Roles | Acceptance criteria |
|---|---|---|---|---|---|---|
| 1 | Strip scaffolding from firm dashboard | `app/dashboard/page.tsx:24-82,173` (delete blocks); keep widgets | none | none | all | No UUID/probe/test-button rendered; page renders in <1 query less |
| 2 | Register columns + archived filter | `app/engagements/page.tsx`; extend `listEngagements` (`lib/engagements.ts:60-74`) with partner (join `team_member`), progress (reuse signed-doc count query from `engagementPhaseProgress`), next statutory deadline (reuse `deadlineHeat` query), `?archived=1` filter | none (reads) | none | all | Register shows partner, %, deadline, stage+status chips; archived hidden by default; row click opens hub |
| 3 | Clients out of primary nav | `components/AppNav.tsx:56` remove; `app/settings/page.tsx` add "Entity records" link; hub header adds entity link (`app/engagements/[id]/dashboard/page.tsx` meta row) | none | Clients → Settings | all (edit = admin) | Nav shows Dashboard/Engagements only; entity reachable in ≤2 clicks from hub |
| 4 | Dashboard rebuild (My Portfolio) | `app/dashboard/page.tsx` new sections; reuse `engagementAttention` (per recent engagements), `dashboardStats` all-scope (`lib/engagement-dashboard.ts`), `recentEngagements`, `firmDashboard` (`lib/dashboards.ts`) | none | none | partner sees §⑤/⑥ | Every number links somewhere; page differs per user; empty state present |
| 5 | Wizard inline new-entity step | `components/EngagementWizard.tsx` (+ "new entity" option in client select → 4 fields), `createEngagementAction` (`app/actions/audit-file.ts:55`) accepts inline entity; remove form from `app/clients/page.tsx:68-95` | none (uses existing `createClient`) | none | all | F3 flow completes without leaving the wizard; no dead-end redirect |
| 6 | Roll-forward on register | `app/engagements/page.tsx` row action for `phase IN ('conclusion','archived')` posting `rollforwardAction` | none | none | partner (action already guards) | FY+1 engagement created from register in 2 clicks |
| 7 | Entity record rework | `app/clients/[id]/page.tsx` restructure per 5D; history table adds `opinion`,`report_date` (already on `engagement`) | **Migration**: `client` + `registration_number, niu, address, year_end, framework, pie boolean` (nullable, expand-only — same schema-tolerant pattern as due_date) | breadcrumb from hub | edit = firm_admin | Entity page has no New-engagement duplicate register; master grid editable; history shows opinions |
| 8 | Terminology | `messages/en.json`/`fr.json` (nav labels, stage set, status set); fix hardcoded "Active" chip in hub | none | labels only | all | One glossary; register/hub/history use identical stage & status vocab |

**Migration considerations:** all reads stay schema-tolerant (proven pattern from `due_date`); entity-field migration is expand-only, no backfill required. **Permissions:** entity editing = `firm_admin`; roll-forward already partner-gated. **Order:** 1→3→2→6→8 ship together as the "IA release" (all Low/Medium, no migration); 4,5,7 follow.

**Assumptions declared:** single-audit-per-year model today (`UNIQUE(client_id, fiscal_year)` — engagement *types* like interim reviews would need a `type` column before the register's Type column can exist); no office/industry fields yet (filters deferred); screenshots not needed — audit performed on source.
