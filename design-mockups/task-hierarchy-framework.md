# AuditISA — Task Strategy & Hierarchy Framework

**Version 1.0 · Draft for approval · 19 Jul 2026**

This document defines the target task architecture for the engagement workspace: how every audit task is grouped, coded, rolled up, and disclosed across the interface. It supersedes the current four-phase (Pre-planning / Planning / Execution / Conclusion) flat structure.

---

## 1. Principles

1. **Three sections, not four.** Pre-planning and Planning merge into **Planning & Strategy**. The engagement lifecycle reads: *Planning & Strategy → Execution → Conclusion*.
2. **Four levels, progressive disclosure.** Engagement → Section → Task Group → Detail Task. Each screen shows exactly one level of detail plus roll-up numbers from the level below — never the raw task list two levels down.
3. **The dashboard never shows detail tasks.** It shows the three sections and, on demand, each section's task groups with their completion only. Detail tasks live behind a group click.
4. **Codes follow sections.** `ST` = Planning & Strategy, `E` = Execution, `C` = Conclusion. Format: `<Section><Group>.<Task>` — e.g. `ST3.2`, `E1.4`, `C6.3`.
5. **Nothing is lost in migration.** Every existing task keeps its content, sign-offs, documents and history; only its code and grouping change.

---

## 2. The hierarchy

```
Engagement (SOCAPALM FY2025)
├── 1. Planning & Strategy (ST)          ← 6 groups, 22 tasks
├── 2. Execution (E)                     ← 5 groups, ~25+ tasks (risk-driven)
└── 3. Conclusion (C)                    ← 6 groups, 21 tasks
```

### Level definitions

| Level | Name | Example | Shown on | Click target |
|---|---|---|---|---|
| L0 | Engagement | SOCAPALM FY2025 | Portfolio list | Engagement dashboard |
| L1 | Section | Execution | Dashboard (ring + %) | Groups roll out (same screen) |
| L2 | Task group | Significant Transaction Classes | Dashboard roll-out (name + % only) | Group task page |
| L3 | Detail task | E1.2 Walkthroughs — Revenue | Group task page (table) | Task page (form, sign-off) |

---

## 3. Section 1 — Planning & Strategy (`ST`)

| Group | Code | Detail tasks (migrated from) |
|---|---|---|
| **ST1 Acceptance & Continuance** | ST1.1 | Engagement Acceptance / Continuance Procedures (D3.1) |
| | ST1.2 | Documentation of Job Arrangements (D6.1) |
| **ST2 Strategy & Direction** | ST2.1 | Engagement Strategy Driver (D1) |
| | ST2.2 | Direction from the Engagement Partner (D4.1) |
| | ST2.3 | Team Discussion (D7.1) |
| **ST3 Understanding the Entity** | ST3.1 | Understanding the Entity & its Environment — ISA 315 (D4.2) |
| | ST3.2 | Analytical Risk Assessment Procedures (D4.3) |
| | ST3.3 | Understanding the Components of Internal Control (D4.4) |
| | ST3.4 | Control Environment Assessment (D4.5) |
| **ST4 IT & Reliance** | ST4.1 | Understanding the IT Environment (D4.6) |
| | ST4.2 | Reliance on Experts — ISA 620 (D4.7) |
| | ST4.3 | Service Organisations — ISA 402 (D4.8) |
| | ST4.4 | Internal Audit — ISA 610 (D4.9) |
| **ST5 Materiality & Specific Risks** | ST5.1 | Materiality — ISA 320 (D5.1) |
| | ST5.2 | Commitments & Contingencies (D5.2) |
| | ST5.3 | Fraud Risk Assessment — ISA 240 (D5.4) |
| | ST5.4 | Going Concern — Preliminary — ISA 570 (D5.5) |
| | ST5.5 | Related Parties — ISA 550 (D5.6) |
| | ST5.6 | Accounting Estimates — Planning — ISA 540 (D5.7) |
| **ST6 Risk Register & Response Plan** | ST6.1 | Risk Assessment / Risk Register (D7.2) |

*Conditional tasks (ST4.2–ST4.4 today's D4.7–D4.9) stay conditional: instantiated only when the assessment answers trigger them; they never count in roll-ups unless instantiated.*

---

## 4. Section 2 — Execution (`E`)

| Group | Code | Detail tasks (migrated from) |
|---|---|---|
| **E1 Significant Transaction Classes** | E1.1 | Revenue & Receivables (E100) |
| | E1.2 | Purchases & Payables (E110) |
| | E1.3 | Payroll & Personnel Costs (E120) |
| **E2 IT** | E2.1 | ITGC Testing *(new — seeded from ST4.1 findings)* |
| | E2.2 | Application Controls Testing *(new)* |
| **E3 Accounts** | E3.1–E3.13 | Inventories (E130), PPE (E140), Intangibles (E150), Investments (E160), Cash & Loans (E170), Taxation (E180), VAT (E190), Provisions & Benefits (E200), Leases (E210), HAO Items (E220), TFT Tie-out (E230), Commitments (E270), Equity & Reserves (E280) |
| **E4 General** | E4.1 | Laws & Regulations / NOCLAR — ISA 250 (E310) |
| | E4.2 | Related Parties — ISA 550 (E320) |
| | E4.3 | Going Concern — ISA 570 (E330) |
| | E4.4 | Minutes & Statutory Records (E360) |
| | E4.5 | Opening Balances & Comparatives — ISA 510/710 (E370) |
| | E4.6 | Subsequent Events — ISA 560 (E380) |
| | E4.7 | Accounting Estimates — ISA 540 (E390) |
| **E5 Response Tasks** | E5.1 | Fraud & Management Override — ISA 240 (E350) |
| | E5.2+ | *Auto-created: one response task per significant risk in ST6.1 (risk → response traceability)* |

### Inside a Significant Transaction Class

Each STC task (E1.x) follows a fixed internal methodology — these are **work steps inside one task page**, not separate dashboard entries:

1. Understanding the process
2. Walkthrough
3. Control testing (design & operating effectiveness)
4. Substantive procedures
5. Conclusion on the cycle

---

## 5. Section 3 — Conclusion (`C`)

| Group | Code | Detail tasks (migrated from) |
|---|---|---|
| **C1 Financial Statements & Completion** | C1.1 | Financial Statements Program (A1) |
| | C1.2 | Completion Checklist (B1) |
| | C1.3 | Points Outstanding (B6) |
| | C1.4 | Points Forward — next year (B10) |
| **C2 Misstatements & Significant Matters** | C2.1 | Summary of Misstatements (B5) |
| | C2.2 | Significant Matters / Issues (B4) |
| | C2.3 | Consultation Record (B3) |
| **C3 Subsequent Events & Going Concern** | C3.1 | Subsequent Events Review — ISA 560 (B7) |
| **C4 Representations & Confirmations** | C4.1 | Management Representation Letters — ISA 580 (B8) |
| | C4.2 | External Confirmation Letter (B9) |
| **C5 Quality & Governance** | C5.1 | Engagement Quality Review (B2) |
| | C5.2 | Communications with TCWG — ISA 260/265 (C1) |
| **C6 Legal & Statutory (OHADA)** | C6.1–C6.8 | Statutory Deadlines Calendar (F1), Conventions Réglementées (F2), Article 715 Report (F3), Procédure d'Alerte (F4), Faits Délictueux (F5), Registres de Titres (F6), Equity vs ½ Capital (F7), Co-CAC Coordination (F8) |

---

## 6. Completion roll-up rules

- **Task status** (unchanged engine): `Not started → In progress → In review → Reviewed`. A task counts as complete only when **reviewer-signed**.
- **Group %** = reviewed tasks ÷ instantiated tasks in the group.
- **Section %** = reviewed tasks ÷ instantiated tasks across the whole section (*task-weighted, not group-averaged* — a 13-task group moves the ring more than a 1-task group).
- **Engagement %** = task-weighted across all three sections.
- Conditional tasks not instantiated are excluded from every denominator.
- Sign-off rules are unchanged: preparer signs first; open review notes block reviewer sign-off; reviewer/partner sign-off locks the document.

---

## 7. Disclosure & navigation model

```
Dashboard              Dashboard (section clicked)        Group page                Task page
┌─────────────┐        ┌─────────┬──────────────────┐     ┌──────────────────┐     ┌─────────────┐
│ ○ ST   85%  │  click │ ● ST 85%│ ST1 Acceptance ▓▓│click│ E1 — STC         │click│ E1.2 Walk-  │
│ ○ E     4%  │  ───►  │ ○ E   4%│ ST2 Strategy  ▓▓│───► │ ┌──────────────┐ │───► │ throughs    │
│ ○ C     0%  │        │ ○ C   0%│ ST3 Entity    ▓░│     │ │task table    │ │     │ form + P/R  │
└─────────────┘        └─────────┴──────────────────┘     │ │with P/R boxes│ │     │ sign-off    │
                          groups roll out to the right    └──────────────────┘     └─────────────┘
```

1. **Dashboard at rest** — three section rings + %, summary tiles, findings, feed, reference documents. **No groups, no tasks.**
2. **Section clicked** — its task groups roll out **to the right** of the section: group name, progress bar, x/y count. **No detail tasks.**
3. **Group clicked** — navigates to the **group task page**: the sign-off table (task, preparer, reviewer, deadline, status) scoped to that group. This is the only place detail tasks are listed.
4. **Task clicked** — the task page (form, purpose, sign-off footer, review notes) as rebuilt in the last sprint.

URLs: `/engagements/:id` (dashboard) → `/engagements/:id/groups/st3` (group page) → `/engagements/:id/tasks/ST3.2` (task).

---

## 8. Migration map (summary)

| Today | Target |
|---|---|
| Phases "Pre-planning" + "Planning" | Section **Planning & Strategy** |
| Phase "Execution" | Section **Execution** |
| Phase "Conclusion" | Section **Conclusion** |
| Codes D1–D7.2 | ST1.1–ST6.1 (per §3) |
| Codes E100–E390 | E1.1–E5.x (per §4) |
| Codes A1, B1–B10, C1, F1–F8 | C1.1–C6.8 (per §5) |
| Phase task table | Group task page (same component, scoped to group) |
| 4 dashboard gauges | 3 section rings + roll-out groups |

**Data migration:** a `task_group` column (or lookup table) maps each `file_item` to its group; codes are renamed in place with an old→new alias kept for document references; sign-offs, documents, versions, review notes, activity and time entries are untouched.

---

## 9. Open decisions

| # | Question | Default if unanswered |
|---|---|---|
| 1 | Should E2 (IT) ship with the two new tasks now, or as an empty group until content is authored? | Ship with both tasks, template-stubbed |
| 2 | Are E5 response tasks auto-created per significant risk (recommended, EY-Canvas-style traceability) or added manually? | Auto-created |
| 3 | Do old codes remain visible as a subtitle ("formerly D4.2") during a transition period? | Yes, for one release |
| 4 | Group-level deadlines in addition to per-task due dates? | No — section deadline + task due dates |
