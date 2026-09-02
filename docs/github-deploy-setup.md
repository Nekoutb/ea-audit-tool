# Deploying from GitHub Actions (staging → production)

`.github/workflows/deploy.yml` turns the server's existing gated deploy script
into a two-stage pipeline:

```
push to dev ──► CI ──green──► Deploy: staging ──► https://dev.auditisa.com
                                                        │ test it by hand
merge dev → main, push ──► CI ──green──► Deploy: production (waits for approval)
                                                        │ approve in Actions UI
                                                        ▼
                                              https://www.auditisa.com
```

Nothing deploys while CI is red, and the server-side script additionally
refuses to put a commit on production that never ran on staging
(`deployed-shas.log` gate) — so a GitHub approval can never skip the staging
step, and a staging deploy always ships the exact sha CI tested, not the
branch tip at deploy time.

## One-time setup

### 1. On the server

The workflow assumes what `docs/deployment-workflow.md` (dev branch) describes
is in place: `/usr/local/sbin/deploy-ea-audit`, the dev instance, and — for
production — the release layout under `/opt/ea-audit-prod`.

Create a dedicated SSH identity for GitHub:

```bash
ssh-keygen -t ed25519 -N "" -C github-deploy -f /root/.ssh/github-deploy
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
# arguments a deployment can have.
set -euo pipefail
read -ra ARGS <<< "${SSH_ORIGINAL_COMMAND:-}"
[ "${ARGS[0]:-}" = "deploy-ea-audit" ] || { echo "refused: ${ARGS[0]:-<empty>}" >&2; exit 1; }
for a in "${ARGS[@]:1}"; do
  [[ "$a" =~ ^([A-Za-z0-9._/-]+|--yes)$ ]] || { echo "refused argument: $a" >&2; exit 1; }
done
exec /usr/local/sbin/deploy-ea-audit "${ARGS[@]:1}"
```

(Without the forced command the pipeline still works — the key is then simply
a root key, which is a bigger blast radius if a repository secret ever leaks.)

### 2. Repository secrets (Settings → Secrets and variables → Actions)

| secret | value |
|---|---|
| `DEPLOY_HOST` | the server's hostname or IP |
| `DEPLOY_USER` | `root` (or the user carrying the forced-command key) |
| `DEPLOY_SSH_KEY` | contents of `/root/.ssh/github-deploy` (the private key) |
| `DEPLOY_KNOWN_HOSTS` | output of `ssh-keyscan <host>` — optional but recommended; without it the first connection pins the host key unverified |

### 3. Environments (Settings → Environments)

- **staging** — URL `https://dev.auditisa.com`. No protection rules: every
  green CI run on `dev` goes straight out.
- **production** — URL `https://www.auditisa.com`. Add **Required
  reviewers** (whoever is allowed to release), and optionally restrict
  deployment branches to `main`. The production job pauses until one of the
  reviewers approves it in the run's page; approving means "I have checked
  this on dev.auditisa.com".

### 4. Merge to `main`

`workflow_run` triggers only fire for a workflow file that exists on the
default branch, so the pipeline goes live when `deploy.yml` reaches `main`.
CI now also runs on pushes to `dev` (that run's success is what releases to
staging).

## Day-to-day

1. Push (or merge) to `dev`. CI runs; when green, the staging job deploys that
   sha to `dev.auditisa.com` and then curls the public URL.
2. Test on staging.
3. Merge `dev` into `main` (fast-forward keeps the sha identical — the
   production gate then matches trivially) and push.
4. CI runs on `main`; when green, the production job appears **waiting** —
   approve it under Actions → the run → Review deployments.
5. The server backs up the database, builds/reuses the release, migrates,
   switches, health-checks — and rolls back by itself if the health check fails
   (the workflow run then also fails, so you see it).

Manual deploys: Actions → Deploy → Run workflow lets you push any ref to
staging (demo of a feature branch, re-deploy after a server-side rollback)
or re-run a production promotion. Production stays double-gated: environment
approval + the server's staging-first check. Emergency hotfixes that must
skip staging remain on-server only, by design:
`deploy-ea-audit prod <sha> --hotfix "why"`.

## About the subdomain

Staging is the existing `dev.auditisa.com` instance (`ea-audit-dev.service`,
port 3201, database `ea_audit_dev`, mail stubbed, `X-Robots-Tag: noindex`).
If you would rather read `staging.auditisa.com`, add it as a `ServerAlias` in
`deploy/apache/dev.auditisa.com.conf` and a DNS record — the wildcard
certificate for `*.auditisa.com` already covers it.
