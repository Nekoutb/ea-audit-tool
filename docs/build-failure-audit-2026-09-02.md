# Why CI has never been green — audit, 2026-09-02

Every CI run in this repository's history has failed: every push to `main`,
every pull request, every branch. The word "build" covers three different
things, and only one of them fails:

| stage | state | root cause |
|---|---|---|
| `next build` (compile, types) | **passes** | — |
| lint, typecheck, unit tests (413 on `main`, 467 on `dev`) | **pass** | — |
| Playwright end-to-end suite (16 specs) | **fails, always** | six independent causes, below |

Because the suite has been red since the first run, every new breakage piled
up on the old ones and nobody could tell a fresh regression from the standing
noise. This audit reproduces each failure from the CI logs of run #29 (`main`,
dev server) and run #33 (PR #3 on `dev`, production build), and from the code.
Each finding names the fix, and every fix is in this branch.

## 1. One SQL bug emptied the whole navigation (`main` only)

`recentEngagements()` in `platform/lib/engagement-dashboard.ts` appends a
visibility clause that references `$2` only for roles *without* portfolio
oversight, but always bound `[limit, userId]`. Postgres refused the statement
for every partner and firm admin — 297 times in one CI run:

```
ERROR:  bind message supplies 2 parameters, but prepared statement "" requires 1
```

`AppNav` loads branding, the engagement switcher, the unread count and the
notification list in one `Promise.all` inside a swallow-all `try/catch`, so
the one failed query silently blanked all four: the brand name fell back to
"EA Audit", the unread badge never rendered. That is exactly what the
branding and notification specs assert against (`Received string: "EA Audit"`).

**Fixed on `dev`** (commit 566fdbc, "Restore the nav for partners and firm
admins, and stop it failing silently"). Not yet on `main`; it reaches `main`
when PR #3 merges.

## 2. The suite ran against the dev server (`main` only)

CI started `next dev` for the E2E run. Turbopack compiling every page on demand
on a two-core runner produced navigations that never finished — phase3,
phase5 and phase7 each hit their 300-second test timeout on a plain
`page.goto`, and a run took 25–60 minutes.

**Fixed on `dev`** (commit 1e5ab44): CI runs `next build` once and the suite
targets `next start`. The same page loads now take 3–7 seconds. This branch
keeps that and adds a hard `actionTimeout`/`navigationTimeout` so a hang fails
in seconds instead of eating the spec's whole budget twice.

## 3. The production build hides the panel two specs assert on

With the suite on a production build, the isolation specs (`firm-notes`) and
the notification specs (`send-test-notification`) could never pass: the
dashboard's diagnostics panel rendered only when `NODE_ENV !== "production"`
(`app/dashboard/page.tsx`), and under `next start` NODE_ENV is `production`.
Four specs, plus their retries, failed on every `dev` run.

**Fix:** the panel also renders when `E2E_DIAGNOSTICS=1` is in the environment,
read at request time (never inlined by the build). CI sets it; a deployed
instance shows the panel only if its `.env` says so.

## 4. The client portal threw on every visit (all branches)

`app/portal/page.tsx` loaded the firm's branding through `getBranding()`,
which starts with `requireTenant()` — and `requireTenant()` refuses
`client_user` sessions by design since commit 76a87f3 ("Make role an
authorization boundary, not just a label"). Every portal page render ended in

```
⨯ Error [ForbiddenError]: portal-account
```

so the phase9 spec found no `portal-items`. Not a test problem: a real client
contact signing in to `dev.auditisa.com` or production sees the error page.

**Fix:** `getPortalBranding()` in `lib/branding.ts` reads the same row through
`requirePortalUser()`; the portal page uses it. Nothing else changes — the
firm's name, logo and colours are the one piece of firm data a client is meant
to see.

## 5. Specs drifted from the UI they describe (all branches)

Thirty-plus feature commits landed on `main` after the specs were written and,
with CI permanently red, no spec was ever updated. Each of these reproduced
byte-for-byte in the run #29 and #33 logs:

- **phase2** — an exception answer on the independence form now requires a
  description (`IndependenceQuestionField`, IESBA §120); the spec answered
  "yes", signed and submitted with the required textarea empty, so
  `confirmation-done` never appeared. *Fix:* fill the note.
- **phase5, phase6** — the AR/AP analyzer pages deliberately dropped the
  datasets table (`hideDatasetsTable`: "the aging header already names the
  file"); the specs still expected `analyzer-datasets` to list `ar.csv`.
  *Fix:* assert on the upload confirmation (`dataset-done`, which names the
  file) and the aging grid.
- **phase7** — the risk-register assessment form sits inside a collapsed
  `<details>`; the status `<select>` exists in the DOM but is not visible, so
  `selectOption` waited its full 5-minute timeout, twice — ten minutes of every
  CI run for one line. *Fix:* open the row first, and again after each update
  re-renders the page.
- **branding retry pollution** — the seed (which resets branding) runs once per
  suite in `globalSetup`. When attempt #1 died after saving "Cabinet FOKO &
  Associés", the retry inherited that state and failed its first assertion.
  *Fix:* the branding spec re-seeds before each attempt.

## 6. Switching users by clearing cookies does not work in this app

In run #33 the first attempt of the branding spec spent its whole 180 s
budget on the third sign-in of the test: `/login` rendered without the
e-mail field and nothing was logged server-side. There was no trace to look
at — `trace: "on-first-retry"` records retries only. With traces kept for every
failed attempt (run #34 of this branch), the page snapshot at the moment of
failure was **Bob's dashboard**: the spec had cleared the cookies and asked
for `/login`, and the server still saw Bob's session.

The trace's network log shows why. The proxy wraps every route in Auth.js's
`auth()`, which re-issues the session cookie on every response, and the nav
prefetches its links (`/settings?_rsc=…`, `/notifications?_rsc=…`, …). A
prefetch still in flight when `clearCookies()` ran set Bob's cookie straight
back, so `/login` redirected to `/dashboard` and the e-mail field never
existed. Not a product bug — rolling sessions are the intent — but a rule for
the specs: **a user switch needs a fresh browser context**, never a cookie
clear. The branding spec now opens one context per user.

## 7. Two more drifts surfaced once the others were out of the way

- **E4 accounts became index-per-account working papers** (commit 7796693):
  no risk header, no program generator, no engines panel. phase2 asserted the
  seeded revenue risk in the E4.1 header and generated E4.1's program; it now
  reads the risk off the register, links it through a procedure on E4.20
  (which is what the significant-risks gate counts), and covers E4.2 with a
  procedure row. phase5 ran the sampling/reconciliation/analytics engines on
  E4.1; they live on the execution tasks, so it uses E5.1.
- **A Server Action answers 303**, with `X-Action-Redirect`, never 200. The
  first version of the phase7 fix waited for an `ok()` response to the risk
  update and timed out; it now matches on method and path.

Every finding above was reproduced from a trace or a log line, not inferred;
the action/navigation timeouts turned each remaining stall into a 20-second
failure that names the step, which is what made the second pass a
30-minute job instead of another month of red.

## Also noted, not changed

- `lib/db.ts` throws at import time when neither `APP_DATABASE_URL` nor
  `DATABASE_URL` is set, and Next's page-data collection imports the API
  routes, so a bare `npm run build` fails on a machine with no env even though
  nothing connects. CI and the server deploy script both set the variable; it
  only bites ad-hoc builds. Deferring pool construction to first use would
  remove the trap.
- The E2E specs each carry their own `login()` helper (nine copies). One shared
  helper would have made the branding hang (finding 6) a one-place fix.

## What this branch changes

| file | change |
|---|---|
| `platform/lib/branding.ts`, `app/portal/page.tsx` | finding 4 |
| `platform/app/dashboard/page.tsx` | finding 3 |
| `platform/playwright.config.ts` | findings 2, 6 |
| `platform/tests/e2e/{branding,phase2,phase5,phase6,phase7}.spec.ts` | finding 5 |
| `.github/workflows/ci.yml` | runs on `dev` too, sets `E2E_DIAGNOSTICS`, uploads evidence on failure, cancels superseded runs |
| `.github/workflows/deploy.yml`, `.github/actions/ssh-deploy` | the staging → production pipeline (docs/github-deploy-setup.md) |
| `deploy/deploy-ea-audit.sh` | `gate` subcommand: the production check the pipeline asks before requesting approval |

Findings 1 and 2 are already on `dev`; this branch is based on `dev` and
carries them.
