@AGENTS.md

# Environments and deployment policy

Two instances of this application run on the same server. Read
`docs/deployment-workflow.md` before touching either.

| | production | dev / staging |
|---|---|---|
| URL | https://www.auditisa.com | https://dev.auditisa.com |
| branch | `main` | `dev` |
| release root · unit · port | `/opt/ea-audit-prod` · `ea-audit` · 3200 | `/opt/ea-audit-dev` · `ea-audit-dev` · 3201 |
| database | `ea_audit` | `ea_audit_dev` |

## Rules for any agent or person working here

1. **Dev first, always.** A commit reaches production only after the same
   commit has been deployed to dev with `deploy-ea-audit dev <ref>` and checked
   there. `deploy-ea-audit prod` enforces this and refuses otherwise. Do not
   work around the gate; if asked to skip it, say so once and point at the
   hotfix path (`--hotfix "<reason>"`, which is logged).
2. **Deploy only through the script** (`deploy/deploy-ea-audit.sh`, installed
   as `/usr/local/sbin/deploy-ea-audit`). Never copy files into a release
   directory, edit code on the server, run `npm run build` or migrations by
   hand, or restart the production unit outside a deployment or rollback.
3. **Production data is off limits.** Never run statements against `ea_audit`
   except read-only inspection and backups. Schema changes travel as
   migrations in `platform/migrations/`, applied by the deploy script.
   Bookkeeping repairs to `pgmigrations` need an explicit go-ahead and a backup
   taken first.
4. **Ask before anything that affects production**: deploying, rolling back,
   changing `ea-audit.service`, the Apache vhosts, DNS/Cloudflare, the
   production `.env`, or `/opt/ea-audit-backups`. Deploying to dev needs no
   approval.
5. **Dev never sends e-mail.** `/opt/ea-audit-dev/shared/.env` must not contain
   `MAILERSEND_API_KEY`; the setup script refuses if it does. Do not add it.
6. **Secrets stay on the server.** Never print `.env` values, tokens or
   connection strings into a conversation, a log or a commit — names only.
7. **Commit only when asked.** Nothing uncommitted can be deployed (`git
   archive` of a pushed commit is the only source), so uncommitted work is
   simply not deployable.
8. **If a health check fails, stop and report.** The script rolls back on its
   own; do not retry blindly.

## Access

The server is reachable only through the jump host:
`ssh -J root@185.92.222.217 root@45.32.150.96`. The banner exchange sometimes
times out; retry. Keep remote scripts short and wrap slow commands in
`timeout`.

## Other projects on the same server

`ealearnings`, `ealedgers`, the finance toolkit, `bp.cm-ea.com` and the
`eaap` accounts-payable app share the box. Leave them alone unless they are
directly affecting this application or the server itself, and then report
rather than act.
