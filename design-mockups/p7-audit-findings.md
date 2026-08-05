# P7 all-pages audit — findings backlog (5 Aug 2026)

Full sweep of the 23 pages outside the already-reworked set. Fix #1 (AppNav stage terminology) implemented in v26; the rest is the queue, Critical first.

## Critical (raw enums / hardcoded English shown to users)
- risks/page.tsx:159-169 — `<option>low/medium/high</option>` hardcoded ×6; :73,:143 raw `status`/`rating` enums.
- findings/page.tsx:127 `<th>Description</th>`; :140 `· trivial`.
- data/page.tsx:230-231 match-type options hardcoded; :166 raw `{journal.status}`.
- conclusion/page.tsx:224 — **issued opinion rendered as raw enum** (most consequential string on the page).
- sections/[itemId]/page.tsx:372 `JSON.stringify(run.summary)` as user-facing engine result; :183 "N/A"; :371 raw engine enum.
- analytics/page.tsx:100 — risk description PERSISTED into the register from an English literal.
- planning/page.tsx:136 + EngagementTabs.tsx:43 — tab/H1 still "Planning", should be stages.planning ("Scope & Strategy").

## High
- 17 lists/tables with NO empty state (collapse to nothing): planning:199,271,314,332,366; data:94,161,208,246; legal:90,183,315; sections:257,322,367; risks:101; findings:121; pbc:62.
- Nameless inputs (no label/aria/placeholder): conclusion:196 textarea; sections:411,431,448; data:229; portal:100 (client-facing file input — fix first).
- Placeholder-only inputs: confirmations (13 controls), sections (19), data:184-234, risks:84,230, acceptance:165, findings:71.
- AppNav.tsx:51 raw role enum de-underscored; :98,:100 hardcoded English fallbacks.
- data/page.tsx:65 re-fetches engagement already loaded at :53; planning/page.tsx:116-125 duplicate file_item query.
- independence/[token] completed state is a dead end (no link back).
- sections/[itemId]/page.tsx:93 EngagementTabs active="planning" while on a section.

## Medium
- Tap targets <24px: planning:278, data:217,340, time:95, templates/[code]:85, confirmations:189; shared `btn` px-2.5 py-1 text-xs in risks/findings/legal/pbc/conclusion/confirmations.
- pbc:92 + sections:383 raw `<a>` instead of `<Link>` (full reloads).
- CONDITIONAL_TRIGGERS duplicated (planning:39-45, considerations:22-28); N+1 inserts (lib/engagements.ts:141-157, lib/programs.ts:73-110); discussion O(n²) repliesOf; templates/[code]:32 loads all overrides to find one.
- Missing metadata titles: independence/[token], portal, templates/[code]. new-engagement lacks back-link. Hardcoded units PM/CT/h/D/C/§ (planning:208-318, data:113-284, time:67).

Verified clean: revalidatePath everywhere (guarded() wrappers), no unused imports, activity/time/discussion/resources/notifications have proper empty states.
