# Why CI has never been green — audit, 2026-09-02

Every one of the 29 CI runs in this repository's history has failed, on every
branch, since run #1. The word "build" is doing three different jobs in that
sentence, and they fail for different reasons:

| stage | state | root cause |
|---|---|---|
| `next build` (compile + types) | **passes** | — |
| lint, typecheck, unit tests (467) | **pass** | — |
| Playwright end-to-end suite | **fails, always** | several independent causes, below |

Because the suite has been red since the first run, new breakages piled up
unnoticed on top of old ones — nobody can tell a fresh regression from the
standing noise. The findings, in causal order:

## 1. One SQL bug takes out the whole navigation (main)

`recentEngagements()` (platform/lib/engagement-dashboard.ts) appends a
visibility clause that references `$2` only for roles *without* portfolio
oversight, but always binds `[limit, userId]`. For every partner and firm
admin Postgres rejects the query — `bind message supplies 2 parameters, but
prepared statement "" requires 1` (visible verbatim in CI's service-container
logs).

`AppNav` then loads branding, the engagement switcher, the unread count and
the notification list in a single `Promise.all` inside a swallow-all
`try/catch`, so the one failed query silently empties all four: the brand
name falls back to "EA Audit", the unread badge never renders, the switcher
is empty. That is exactly what the branding and notifications specs assert
against — reproduced locally byte-for-byte ("Received string: `EA Audit`").

**Status: already fixed on the `dev` branch** (566dcfc/dde6950 lineage —
"Restore the nav for partners and firm admins, and stop it failing silently"),
unmerged as of this audit.

## 2. The E2E suite asserts on dev-only UI, and dev-branch CI now runs a production build

The dev branch (PR #3) switched CI's E2E run to `next build` + `next start`
because the dev server compiling pages on demand on a two-core runner
produced 300-second page loads. Correct call — but the isolation and
notification specs depend on the dashboard's diagnostics panel
(`firm-notes`, `send-test-notification`), which renders only when
`process.env.NODE_ENV !== "production"` (app/dashboard/page.tsx). Under
`next start` those elements do not exist, so those tests can never pass in
CI on that branch. Either the test hooks need a dedicated switch (e.g. an
`E2E=1` env read at request time, not NODE_ENV), or the tests need
production-safe fixtures.

## 3. Tests have drifted from the UI they describe

The product moved fast (30+ feature commits on main since the suite was
written); with CI permanently red, spec updates never happened. Confirmed
instances, each reproduced locally and in the CI run #29 logs:

- **phase5 / phase6** — the AR/AP analyzer pages now deliberately hide the
  datasets table (`hideDatasetsTable`, "the aging header already names the
  file") but the specs still `expect(getByTestId("analyzer-datasets"))` to
  list `ar.csv` there.
- **phase2** — the independence form now requires a description when a
  question is answered "Yes"; the spec checks "Yes", signs and submits
  without filling it, so `confirmation-done` never appears.
- **phase7** — the risk-register row's status `<select>` still exists in the
  DOM but is no longer visible (collapsed row); `selectOption` waits its full
  5-minute timeout, twice — this single spec burns ~10 minutes of every CI
  run.
- **branding retry pollution** — the seed (and its branding reset) runs once
  per suite in `globalSetup`, not per test. When attempt #1 dies after saving
  "Cabinet FOKO & Associés", retry #1 inherits that state and fails its very
  first assertion ("expected Cabinet Alpha"). Retries of any branding-mutating
  test are therefore meaningless.

## 4. `next build` needs a database URL at compile time

`lib/db.ts` throws at import time when neither `APP_DATABASE_URL` nor
`DATABASE_URL` is set, and Next's page-data collection imports the API
routes, so a bare `npm run build` fails on a machine with no env even though
nothing connects. CI and the server deploy script both set the variable, so
this only bites ad-hoc builds (a laptop, a container image build). Deferring
pool construction to first use would remove the trap; noted, not urgent.

## What "green" requires, concretely

1. Merge the `dev` branch's nav/SQL fix (finding 1) — or merge PR #3 wholesale.
2. Decide the diagnostics-panel strategy for production-build E2E (finding 2).
3. Update the drifted specs (finding 3): phase2, phase5, phase6, phase7,
   phase9, and make the branding spec reset branding itself (or seed per test).
4. Optional hardening: lazy DB pool (finding 4), and lower phase7-style
   action timeouts so a hidden element fails in seconds, not minutes.

Until then the deploy pipeline (.github/workflows/deploy.yml) will hold
everything back, by design: nothing reaches staging without a green CI run.
