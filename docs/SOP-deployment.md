# Standard operating procedure — development workflow and deployment

AuditISA · valid from 2026-09-02 · owner: the engagement partner who approves
releases · applies to everyone who commits to `Nekoutb/ea-audit-tool`, human or
agent.

This is the procedure. The reasoning behind it is in
`docs/deployment-workflow.md` (the server side) and
`docs/github-deploy-setup.md` (the GitHub side). When the two disagree with
this document, this document is wrong and must be fixed.

---

## 1. The environments

| | staging | production |
|---|---|---|
| URL | https://dev.auditisa.com | https://www.auditisa.com |
| branch | `dev` | `main` |
| who deploys | the pipeline, on every green CI run of `dev` | the pipeline, after a reviewer approves |
| data | a copy of production (cloned 2026-09-02; refreshed on request) | live client data |
| e-mail | never sent — every send is a stub | MailerSend |
| second factor at sign-in | off | on |
| search engines | blocked (`X-Robots-Tag: noindex`) | allowed |
| server | `ea-audit-dev.service`, port 3201, database `ea_audit_dev`, `/opt/ea-audit-dev` | `ea-audit.service`, port 3200, database `ea_audit`, `/opt/ea-audit-prod` |

Both run on the same Vultr server (45.32.150.96, Ubuntu, Apache in front,
PostgreSQL 17). Both serve `GET /api/version`, which reports the commit they
were built from. **That endpoint is the only authoritative answer to "what is
running?"** — not the branch tip, not memory, not the deploy log.

## 2. The rule

**Nothing reaches production that has not run on staging as the same commit,
been checked there by a person, and been approved by that person in GitHub.**

Three independent gates enforce it, and none can be skipped from GitHub:

1. **CI must be green** on the commit. Deploys trigger only from a successful
   CI run of a push to `dev` or `main`; pull-request runs never deploy.
2. **The server confirms the commit ran on staging.** Before anyone is asked to
   approve, the `production gate` job runs `deploy-ea-audit gate <sha>` on the
   server, which looks the commit up in staging's `deployed-shas.log`. The
   deploy script asks the same question again during the production deployment.
3. **A reviewer approves** the `production` environment in the Actions UI.

The only way around gate 2 is the server-side hotfix path (section 9), by a
person, with a logged reason.

## 3. Roles

| role | may |
|---|---|
| developer (human or agent) | push to feature branches and `dev`; open and merge PRs into `dev`; trigger staging deploys; read production logs |
| releaser (currently `frugees89`) | everything above, plus: fast-forward `main`, approve the `production` environment, run `deploy-ea-audit rollback prod` |
| server operator (root on the box) | everything above, plus: hotfix deploys, database restores, changes to units, vhosts, `.env` files |

An agent (Claude Code, Codex) is a developer. It may deploy to staging without
asking. It must ask before anything in the releaser or operator rows.

## 4. Daily development

1. **Branch from `dev`.** `git fetch origin && git checkout -b <topic> origin/dev`.
   Small, self-contained changes may go straight to `dev`; anything that
   touches auth, RLS, migrations or the deploy tooling goes through a PR.
2. **Run the checks locally** before pushing, in `platform/`:
   `npm run typecheck && npm run lint && npm run test`. The E2E suite
   (`npm run test:e2e`) needs a local PostgreSQL; if you have none, CI runs it.
3. **Open a PR against `dev`.** CI runs the same stages it will run on `dev`:
   typecheck, lint, unit tests, a production build, and the Playwright suite
   against that build. A red PR is not merged. If the E2E stage fails, the run
   uploads a `playwright-…` artifact with the trace of every failed attempt:
   download it, `npx playwright show-report <dir>`, and read the trace before
   changing anything.
4. **Merge into `dev`.** Use a merge commit or a fast-forward. Squash is fine
   too; what matters is that the resulting `dev` commit is what will be tested
   and deployed.
5. **Wait for the staging deploy.** CI on `dev` (about 6 minutes) is followed
   automatically by *Deploy › Staging* (about 5 minutes: the server runs
   `npm ci` and `next build` for the commit, migrates `ea_audit_dev`, switches
   atomically, health-checks). The run's summary shows the commit deployed
   and the commit the public site reports — they must match.

## 5. Checking staging

Do this every time, before merging to `main`. It takes five minutes.

1. **Confirm the commit.** Open https://dev.auditisa.com/api/version. The `sha`
   must equal the `dev` commit you merged (`git rev-parse origin/dev`), `ref`
   is `dev`, `target` is `dev`. If it is an older sha, the staging deploy did
   not happen or failed: look at Actions › Deploy for the run and its error.
2. **Sign in** as your own staging account (staging data is a copy of
   production, so your production credentials work; no authenticator code is
   asked). Sign-in itself exercises the proxy, the session guard, the database
   pool and the nav.
3. **Walk the change.** Open the screen(s) the merged work touched and use
   them as a user would. For a change to a working paper, generate the
   document and open it. For a migration, open a page that reads the new
   column.
4. **Walk the three things that break silently:** the firm dashboard, one
   engagement dashboard, one document download. These cover the nav query,
   the RLS wrapper and the file pipeline.
5. **Look at the server log for the deploy window** if anything felt slow or
   odd: `ssh ea-audit 'journalctl -u ea-audit-dev --since "15 min ago" | grep -iE "error|⨯" | tail'`.

What "checked" means: you can say which screens you used and that they
behaved. If you cannot, staging is not checked.

Staging is a clone: data you create there stays there. Refresh it from
production when it has drifted far enough to mislead (procedure in
`docs/deployment-workflow.md`, "Refreshing dev's data").

## 6. Releasing to production

Only the releaser does this.

1. **Fast-forward `main` to `dev`.** From any clone:
   `git fetch origin && git push origin origin/dev:main`. A fast-forward keeps
   the sha identical, so the production gate matches the staging log exactly.
   If the push is refused because `main` has commits `dev` lacks, stop: merge
   `main` into `dev` first, let that go through staging, then release.
2. **Watch CI on `main`** (Actions › CI). It must be green; it is the same
   commit, so it will be unless the runner had a bad day.
3. **Watch Deploy › Production gate.** It asks the server whether the commit
   ran on staging. Green means "it did". Red names the sha and says "has never
   been deployed to dev": the commit on `main` is not the one staging ran. Do
   not force it; go back to step 1 of section 5.
4. **Approve.** Actions › the Deploy run › *Review deployments* › tick
   `production` › *Approve and deploy*. Approving is your signature that you
   did section 5 on this commit. Write one line in the comment box: what was
   checked.
5. **Watch the production job.** The server backs the database up
   (`/opt/ea-audit-backups/ea_audit-<stamp>-pre-<sha7>.dump`), builds the
   commit in its own release directory (the same build that passed on
   staging), migrates `ea_audit`, switches, restarts, health-checks on
   the port and through Apache, and the job then checks
   https://www.auditisa.com/api/version reports the sha. **If the health check
   fails the server rolls back on its own** and the job goes red — read the
   log, do not retry blindly.
6. **Confirm by hand**: open https://www.auditisa.com/api/version and one
   real screen. Note the release in whatever channel the team uses: the sha,
   the time, one line of what changed.

Time to budget: about 15 minutes from the push to `main` to a confirmed
production, of which about 8 is waiting for CI and the server.

## 7. When a deploy fails

| symptom | meaning | what to do |
|---|---|---|
| CI red on `dev` | the commit is broken | fix forward on `dev`; nothing was deployed |
| Deploy › Staging red at "Deploy to staging", log says `next build failed` | the server could not build (memory, disk) | `ssh ea-audit 'tail -50 /opt/ea-audit-dev/logs/build-<sha7>.log'`; free memory (`free -m`) — the build needs 1200 MB free; re-run the job |
| … log says `migration failed` | a migration errored on `ea_audit_dev` | the current release is untouched; fix the migration on `dev`; the dump of staging is not needed |
| … log says `health check failed` and `rolled back` | the new build starts but does not answer | `journalctl -u ea-audit-dev -n 100`; the previous release is running again |
| Deploy › Staging red at "Verify the public site serves this commit" | the server deployed but the public site reports another sha | Apache or Cloudflare is not reaching the new process; `deploy-ea-audit status` and `systemctl status ea-audit-dev` on the server |
| Production gate red | the `main` commit never ran on staging | section 6 step 3 |
| Production job red after approval | same causes as staging, on production | the server rolled back if the health check failed; **migrations are not reverted** — if the schema is inconsistent, restore the pre-deploy dump (section 8) |
| Nothing happens after a push to `dev` | CI was cancelled by a newer push (`cancel-in-progress`), or the push was to a branch, not `dev` | look at Actions › CI; the latest push wins |

## 8. Rollback

Rollback re-points the instance at the previous release without a build or a
migration. It is a server-side command; there is no button in GitHub.

- Staging: `ssh ea-audit 'deploy-ea-audit rollback dev'` — any developer.
- Production: `ssh ea-audit 'deploy-ea-audit rollback prod --yes'` — the
  releaser or the operator, and say so in the team channel first.

Rolling back twice returns to where you started (`current.previous` is always
the release before the last switch). The script refuses to roll back onto a
release that never passed a health check.

**Migrations are never rolled back automatically.** If the release you are
leaving added a migration that the previous release cannot live with, restore
the pre-deploy dump instead:

```
sudo -u postgres pg_restore --clean --if-exists -d ea_audit /opt/ea-audit-backups/ea_audit-<stamp>-pre-<sha7>.dump
```

That loses everything written since the dump. Decide with the partner, not
alone.

## 9. Hotfix (skipping staging)

For a production defect that cannot wait for the staging round-trip:

1. Commit the fix on `dev` and push, so CI runs on it. Do not wait for staging.
2. Fast-forward `main`, and on the server, as root:
   `deploy-ea-audit prod <sha> --hotfix "<what is broken and why it cannot wait>"`.
   The reason is written into `deployed-shas.log` next to the sha.
3. Staging will receive the same commit from its own CI run within minutes,
   so the two instances converge.

The GitHub pipeline cannot do this — the `--hotfix` flag is refused by the
forced command on the GitHub key. That is deliberate.

## 10. Access

| what | who has it | how it was granted |
|---|---|---|
| root on the server, interactively | the operator's workstation key; the agent key `claude-code@vultr` | `deploy/grant-claude-ssh-access.sh`; revoke with `--revoke` |
| the GitHub Actions key | the `Deploy` workflow only | `deploy/install-github-deploy-key.sh`; restricted by a forced command to `deploy-ea-audit dev|prod|gate|status` |
| repository secrets `DEPLOY_*` | the `Deploy` workflow | set by the same script |
| approving production | required reviewers on the `production` environment | Settings › Environments (repository admin) |

Rotating the GitHub key: run `deploy/install-github-deploy-key.sh` again after
deleting `/root/.ssh/github-deploy-ea-audit*` and its line in
`/root/.ssh/authorized_keys`; it regenerates the key and re-sets the secret.

Never paste a private key or a password into a chat, a ticket or a commit.
If one was, treat it as compromised: revoke it and issue a new one.

## 11. Things that must not be done

- Editing code, running `npm run build`, or running migrations by hand on the
  server. Every release is a `git archive` of a pushed commit; uncommitted work
  cannot be deployed, and that is the point.
- Restarting `ea-audit.service` outside a deployment or a rollback.
- Running statements against `ea_audit` other than read-only inspection and
  backups.
- Putting `MAILERSEND_API_KEY` into staging's `.env`. The setup script refuses;
  do not work around it.
- Approving a production deployment for a commit you did not check on staging.
- Force-pushing `dev` or `main`.

## 12. Weekly and monthly

- **Weekly**: glance at Actions for any red run that was not followed by a
  green one; check `ls -t /opt/ea-audit-backups | head` shows last night's
  dump; `df -h /` under 80 %.
- **Monthly**: refresh staging's data from production if the team wants
  realistic data; prune `deployed-shas.log` is not needed (it is small);
  review who holds the keys in section 10 and revoke what is no longer used.
- **After any change to `deploy/deploy-ea-audit.sh`**: re-install it on the
  server (`install -m 755 deploy/deploy-ea-audit.sh /usr/local/sbin/deploy-ea-audit`)
  — the pipeline uses the installed copy, not the repository's.

## 13. Onboarding a new developer in ten minutes

1. GitHub: write access to `Nekoutb/ea-audit-tool`.
2. Clone; `cd platform && npm ci`; ask
   for a local `.env` (a local PostgreSQL 16, `npm run db:setup`, `npm run seed`).
3. Read this document, then `platform/ARCHITECTURE.md` and `platform/DECISIONS.md`.
4. First task: a one-line change on a branch, PR to `dev`, watch it reach
   staging, open `/api/version` there. That is the whole loop.
