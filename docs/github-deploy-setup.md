# Deploying from GitHub Actions (staging → production)

`.github/workflows/deploy.yml` turns the server's gated deploy script into a
two-stage pipeline driven by CI:

```
push to dev ──► CI ──green──► Deploy · staging ──► https://dev.auditisa.com
                                                          │  test it by hand
merge dev → main, push ──► CI ──green──► Deploy · production gate
                                              (the server confirms this exact
                                               commit ran on staging)
                                                          │
                                          Deploy · production  ⏸ waits for a
                                                                 reviewer's approval
                                                          │
                                                          ▼
                                                https://www.auditisa.com
```

Three things hold a release back, in order:

1. **CI must be green.** Nothing deploys from a failed or cancelled run, and
   nothing deploys from a pull-request run — only from a push to `dev` or
   `main`.
2. **The commit must have run on staging.** Before anyone is asked to
   approve, the `production gate` job asks the server (`deploy-ea-audit gate
   <sha>`) whether that exact commit — or a merge commit with the identical
   tree — appears in staging's `deployed-shas.log`. If not, the run fails
   there with the reason. The deploy script asks the same question again
   during the deployment itself, so a GitHub approval can never skip staging.
3. **A reviewer must approve.** The `production` environment carries required
   reviewers; the job pauses until one of them approves it in the Actions UI.
   Approving means "I have checked this on dev.auditisa.com".

A `workflow_run` deploy always ships the exact sha CI tested, never the branch
tip at deploy time — a push racing the deploy cannot smuggle an untested
commit out.

## One-time setup

### 1. On the server

The workflow assumes what `docs/deployment-workflow.md` describes is in
place: `/usr/local/sbin/deploy-ea-audit`, the dev instance, and — for
production — the release layout under `/opt/ea-audit-prod`.

**Re-install the deploy script** from this branch: it gained the `gate`
subcommand the pipeline calls.

```bash
install -m 755 deploy/deploy-ea-audit.sh /usr/local/sbin/deploy-ea-audit
deploy-ea-audit gate main   # should print either "would accept" or the refusal
```

Everything else in this step is one idempotent script, which prints the
secrets to set when it finishes:

```bash
bash deploy/install-github-deploy-key.sh   # on the server as root, or from a workstation with ssh access
```

By hand, the same thing is: create a dedicated SSH identity for GitHub:

```bash
ssh-keygen -t ed25519 -N "" -C github-deploy-ea-audit -f /root/.ssh/github-deploy-ea-audit
```

Append the public key to `/root/.ssh/authorized_keys`, restricted so the key
can run the deploy script and nothing else:

```
restrict,command="/usr/local/sbin/deploy-ea-audit-ssh" ssh-ed25519 AAAA... github-deploy
```

with `/usr/local/sbin/deploy-ea-audit-ssh` (mode 755) validating what arrives
in `SSH_ORIGINAL_COMMAND`:

```bash
#!/usr/bin/env bash
# Forced command for the github-deploy key: only deploy-ea-audit, only with
# arguments a deployment can have (dev|prod|gate|status, a ref, --yes).
set -euo pipefail
read -ra ARGS <<< "${SSH_ORIGINAL_COMMAND:-}"
[ "${ARGS[0]:-}" = "deploy-ea-audit" ] || { echo "refused: ${ARGS[0]:-<empty>}" >&2; exit 1; }
for a in "${ARGS[@]:1}"; do
  [[ "$a" =~ ^([A-Za-z0-9._/-]+|--yes)$ ]] || { echo "refused argument: $a" >&2; exit 1; }
done
exec /usr/local/sbin/deploy-ea-audit "${ARGS[@]:1}"
```

Without the forced command the pipeline still works — the key is then simply
a root key, which is a bigger blast radius if a repository secret ever leaks.
`--hotfix` is deliberately not in the allowed set: the hotfix path stays
server-side, by a person.

Port 22 of the server answers directly from the internet (checked
2026-09-02), so GitHub's runners reach it without the jump host used for
interactive access. If that ever changes, set `DEPLOY_JUMP_HOST` (below) and
authorise the same key on the jump host.

### 2. Repository secrets (Settings → Secrets and variables → Actions)

| secret | value |
|---|---|
| `DEPLOY_HOST` | the server's hostname or IP |
| `DEPLOY_USER` | `root` (or the user carrying the forced-command key) |
| `DEPLOY_SSH_KEY` | contents of `/root/.ssh/github-deploy-ea-audit` (the private key) |
| `DEPLOY_KNOWN_HOSTS` | output of `ssh-keyscan <host>` — optional but recommended; without it the first connection pins the host key unverified and the job prints a warning |
| `DEPLOY_JUMP_HOST` | optional — `user@jump-host`, only if port 22 is not reachable from the internet |

### 3. Environments (Settings → Environments)

- **staging** — URL `https://dev.auditisa.com`. No protection rules: every
  green CI run on `dev` goes straight out.
- **production** — URL `https://www.auditisa.com`. Add **Required
  reviewers** (whoever is allowed to release), and restrict deployment
  branches to `main`. The production job pauses until one of the reviewers
  approves it on the run's page.

### 4. Merge to `main`

`workflow_run` triggers only fire for a workflow file that exists on the
default branch, so the pipeline goes live when `deploy.yml` reaches `main`.
CI also runs on pushes to `dev` from then on (that run's success is what
releases to staging).

## Day-to-day

1. Push (or merge) to `dev`. CI runs; when green, the staging job deploys that
   sha to `dev.auditisa.com` and then curls the public URL. The run's summary
   names the commit.
2. Test on staging.
3. Merge `dev` into `main` (fast-forward keeps the sha identical — the
   production gate then matches trivially) and push.
4. CI runs on `main`; when green, the gate job confirms the commit ran on
   staging and the production job appears **waiting** — approve it under
   Actions → the run → Review deployments.
5. The server backs up the database, builds or reuses the release, migrates,
   switches, health-checks — and rolls back by itself if the health check
   fails (the workflow run then also fails, so you see it).

Manual deploys: Actions → Deploy → Run workflow lets you push any ref to
staging (demo of a feature branch, re-deploy after a server-side rollback) or
re-run a production promotion. Production stays triple-gated: the gate job,
the environment approval, and the server's own staging-first check. Emergency
hotfixes that must skip staging remain on-server only, by design:
`deploy-ea-audit prod <sha> --hotfix "why"`.

## When a run fails

- **Staging, "next build failed"** — the server's build log is
  `/opt/ea-audit-dev/logs/build-<sha7>.log`. The same build passed in CI, so
  look for memory (the build runs in a 2200 MB cgroup) before looking at code.
- **Staging or production, health check failed** — the script already rolled
  back to the previous release; the run's log shows the curl status it got.
  Application log: `journalctl -u ea-audit-dev` / `journalctl -u ea-audit`.
- **Production gate refused** — the commit on `main` is not one that ran on
  staging. Either the merge was not a fast-forward and something else landed
  on `main`, or `dev` was never deployed. Deploy that commit to staging first
  (Run workflow → staging → the sha), test, then re-run the production
  workflow.
- **"deploy-ea-audit: unknown …" / usage printed** — the server still has the
  old script; re-install it (step 1).

## About the subdomain

Staging is the existing `dev.auditisa.com` instance (`ea-audit-dev.service`,
port 3201, database `ea_audit_dev`, mail stubbed, `X-Robots-Tag: noindex`).
To read `staging.auditisa.com` instead, add it as a `ServerAlias` in
`deploy/apache/dev.auditisa.com.conf`, add the DNS record, and change the
`STAGING_URL` at the top of `deploy.yml` — the wildcard certificate for
`*.auditisa.com` already covers it.
