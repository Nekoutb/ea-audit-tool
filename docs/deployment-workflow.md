# Deployment workflow

AuditISA runs on one Vultr server (Ubuntu, Apache in front, PostgreSQL 17,
Node 20) with two instances of the same application:

| | production | dev / staging |
|---|---|---|
| URL | `https://www.auditisa.com` | `https://dev.auditisa.com` (`X-Robots-Tag: noindex`) |
| git ref deployed | `main` | `dev` (any ref on request) |
| release root | `/opt/ea-audit-prod` | `/opt/ea-audit-dev` |
| systemd unit | `ea-audit.service` | `ea-audit-dev.service` |
| port (bound to 127.0.0.1) | 3200 | 3201 |
| database | `ea_audit` | `ea_audit_dev` (a clone of production taken 2026-09-02) |
| application role | `ea_app` | `ea_app` (same role — every migration grants to it by name) |
| e-mail | MailerSend | **no API key** → every send is a stub (`lib/email.ts`) |
| session secret | production | its own — a production cookie is worthless on dev |

Both instances are served through Apache (`/etc/apache2/sites-available/auditisa.com*.conf`
and `dev.auditisa.com.conf`) with the Let's Encrypt wildcard certificate for
`*.auditisa.com`. The units start Next with `-H 127.0.0.1`, so the application
ports exist only on loopback; ufw additionally allows nothing but 22, 80 and 443.

## The rule

**Nothing reaches production that has not run on dev first — as the same commit.**

The deploy script enforces it: `deploy-ea-audit prod <ref>` refuses unless the
commit (or a merge commit with the byte-identical tree) appears in
`/opt/ea-audit-dev/deployed-shas.log`. The only way round is
`--hotfix "<reason>"`, which is logged with the reason next to the sha.

## Day-to-day flow

```
feature work  ──►  dev branch  ──►  deploy-ea-audit dev  ──►  test on dev.auditisa.com
                                                                    │
                   main  ◄──  merge dev (fast-forward when possible) ◄┘
                    │
                    └──►  deploy-ea-audit prod   (gate: sha was on dev)
```

1. Work on `dev` (or a feature branch merged into `dev`). Push it.
2. On the server, as root: `deploy-ea-audit dev` (defaults to the `dev` branch;
   `deploy-ea-audit dev <branch|sha>` for anything else).
3. Test on `https://dev.auditisa.com`. The data is a copy of production as of
   the clone date, so real engagements and users exist there — nothing you do
   on dev touches production, and no e-mail leaves it.
4. Merge `dev` into `main` and push. A fast-forward keeps the sha identical; a
   merge commit is also accepted when its tree is identical to one dev ran
   (i.e. nothing else landed on `main` in between — otherwise deploy the merge
   commit to dev first).
5. `deploy-ea-audit prod` (defaults to `main`). After the gate the script asks
   you to type `PROD`; then it builds, backs the database up, migrates,
   switches, restarts and health-checks — and rolls back to the previous
   release if the health check fails. When stdin is not a terminal (`ssh host
   deploy-ea-audit prod`, a wrapper script) nobody can answer the prompt, so
   the script refuses unless you pass `--yes`.

`deploy-ea-audit status` shows what each instance is running.

## What a deployment does

The script is `deploy/deploy-ea-audit.sh` in this repository, installed as
`/usr/local/sbin/deploy-ea-audit` on the server (re-copy it after changing it:
`install -m 755 deploy/deploy-ea-audit.sh /usr/local/sbin/deploy-ea-audit`).

1. Takes a lock (`/run/lock/ea-audit-deploy.lock`). Deployments and rollbacks
   are mutually exclusive across both targets; `status` needs no lock.
2. Fetches the public repository into the bare mirror `/opt/ea-audit-src.git`
   and resolves the ref to a commit (`--no-fetch` skips the fetch when GitHub
   is unreachable and the mirror already has the commit).
3. **Gate** (production only) — see above. It runs before anything else is
   examined, so an un-tested commit is refused even on a target that is not
   set up yet.
4. Layout check: `<root>` and `<root>/shared/.env` exist and the unit's
   `WorkingDirectory` is `<root>/current`. Production fails here until it has
   been moved onto the release layout (see below).
5. Refuses to build with less than 1200 MB of free memory; the build itself runs
   as the `deploy` user inside a transient cgroup capped at 2200 MB (`systemd-run
   --scope`), niced, so it can never squeeze the running production process.
6. Exports `platform/` at that commit into `<root>/releases/<sha7>/`
   (`git archive`, so nothing uncommitted can ever be deployed), links
   `<root>/shared/.env` into it, `npm ci`, `next build`. An already-built
   release directory is reused (`--rebuild` to force — never for the release
   that is running, since that would delete it under the live process; deploy
   another ref or roll back first). If the target already runs that exact
   release directory the script says so and stops.
7. Production only: `pg_dump --format=custom` into `/opt/ea-audit-backups/`
   (`ea_audit-<stamp>-pre-<sha7>.dump`; dumps older than 14 days are removed
   by the next production deployment).
8. Migrations, run as `postgres` over the local socket (the app's own
   credential is deliberately too weak to alter the schema), then
   `db/rls.sql`, which is idempotent and must follow every migration.
   A failed migration stops the deployment with the current release untouched.
9. Atomically re-points `<root>/current` at the new release (`mv -T`),
   records the previous one in `<root>/current.previous`, restarts the unit.
   From the build onwards the run is shielded from a dropped ssh session:
   it ignores hang-ups and writes to `<root>/logs/deploy-<sha7>-<stamp>.log`,
   which a `tail` mirrors to the terminal — so a lost connection never leaves
   `current` re-pointed with the health check unfinished. If your terminal
   goes away, reconnect and read that log.
10. Health check: `GET /login` on the app port must return 200 (30 attempts,
    3 s apart, 10 s per request), then the same once through Apache with the
    real host name. On failure the previous release is restored — if there is
    one: on a target with no previous release `current` stays on the new build
    — and the script exits non-zero. Migrations are **not** reverted by the
    automatic rollback either; the failed build is kept for inspection.
11. Appends `<sha> <sha7> <ref> <utc time> tree=<tree hash>` (plus
    ` HOTFIX: <reason>` when the gate was bypassed) to `<root>/deployed-shas.log`
    and prunes to the three newest releases (never the current or previous one).
    A rollback appends `<sha> <sha7> rollback <utc time>`. Failed deployments
    are not logged.

Logs: `<root>/logs/deploy-<sha7>-<stamp>.log` (the run), `<root>/logs/build-<sha7>.log`
and `<root>/logs/migrate-<sha7>-<stamp>.log`; rollbacks write `<root>/logs/rollback-<stamp>.log`.
Application logs: `journalctl -u ea-audit` / `journalctl -u ea-audit-dev`.

## Rollback

`deploy-ea-audit rollback prod` (or `dev`) re-points `current` at the release
recorded in `<root>/current.previous` and restarts — no build, no migration.
Production asks for `PROD` (or `--yes`). Things to know:

- `current.previous` is whatever `current` pointed at before the last switch,
  including a switch made by `rollback` — so rolling back twice returns you to
  where you started. After an automatic rollback it is restored to its
  pre-deployment value, never the failed build.
- The script refuses to roll back onto a release that is not in
  `deployed-shas.log`, i.e. one that never passed a health check on that target,
  onto one that has no `.next/BUILD_ID` (a rebuild in progress or failed), and
  onto the release that is already current.
- If the health check fails *after* a rollback the script stops with `current`
  left on the rollback target; investigate before doing anything else.
- Migrations are **not** reverted. If a migration has to be undone, restore the
  pre-deploy dump — with the file opened by root (`<`): `/opt/ea-audit-backups`
  is root-only, so `pg_restore` running as `postgres` cannot open a path in it:

```
sudo -u postgres pg_restore --clean --if-exists -d ea_audit < /opt/ea-audit-backups/ea_audit-<stamp>-pre-<sha7>.dump
```

## Hotfix path

For a production fix that cannot wait for dev:

```
deploy-ea-audit prod <sha> --hotfix "what is broken and why it cannot wait"
```

The reason is written into `deployed-shas.log`. Deploy the same sha to dev
afterwards so dev does not fall behind production. (`--hotfix` is rejected on
dev, which has no gate.)

## Backups

**`docs/disaster-recovery.md` is the runbook.** In outline:

- Every four hours (`ea-audit-backup.timer` at 02:23, 06:23, 10:23, 14:23,
  18:23, 22:23 UTC → `/usr/local/sbin/ea-audit-backup`, source
  `deploy/ea-audit-backup.sh`): the whole of `ea_audit`, the cluster globals and
  a *rebuild set* (both `shared/.env` files, the units, the vhosts, the deploy
  log and a `state.txt` of installed versions), each verified with
  `pg_restore --list`, compressed, encrypted with GPG on this box, and copied to
  Wasabi. A local copy stays in `/opt/ea-audit-backups` for seven days as the
  fast path, pruned only after the remote copy verifies.
- Sundays 03:40 UTC: per-firm extracts and per-engagement rolling copies, so one
  firm or one audit file can be restored without unpacking the whole database.
  An engagement's archival copy is written once, when it is archived, and is
  WORM-locked for its retention period.
- Sundays 04:40 UTC (`ea-audit-restore-drill.timer`): the newest backup is
  fetched **from Wasabi**, decrypted, restored into a scratch database and
  checked — including that stored document bytes still match their recorded
  SHA-256. Results go to `/opt/ea-audit-backups/DRILL-LOG` and to the bucket.
- Before every production deployment (step 7 above), now written under `.part`
  and renamed only after it verifies.
- Failures alert by e-mail, and a dead-man's-switch ping catches the failures
  that stop the job running at all. Logs are in `/var/log/ea-audit/`, rotated.

Install or update the whole thing with `deploy/ea-audit-backup-install.sh`,
which refuses unless the encryption key and the two credential files are present
at mode 0400 and the buckets really have Object Lock enabled.

## Refreshing dev's data from production

Dev is a clone, not a replica; it drifts as people test. To re-clone:

```
systemctl stop ea-audit-dev
sudo -u postgres dropdb ea_audit_dev
sudo -u postgres createdb -O postgres ea_audit_dev
sudo -u postgres pg_dump ea_audit | sudo -u postgres psql -q ea_audit_dev
sudo -u postgres psql ea_audit_dev -c "GRANT CONNECT ON DATABASE ea_audit_dev TO ea_app"
systemctl start ea-audit-dev
```

Then check `pgmigrations` is in file order (see the note below) before the next
deploy, because the clone copies production's bookkeeping.

## Environment files

`<root>/shared/.env` is the only copy of each instance's environment; every
release links to it. It is `deploy:deploy 600` and is never in git.

Dev's was derived from production's by `deploy/setup-dev-instance.sh`. It is
an allowlist, not a copy: `AUTH_TRUST_HOST` and the `MAIL_*` identity are taken
over; `APP_DATABASE_URL` is re-pointed at `ea_audit_dev`; `AUTH_URL`/`APP_URL`
= `https://dev.auditisa.com`; a fresh `AUTH_SECRET`; `PG_POOL_MAX=5`;
`PG_APPLICATION_NAME`. Anything else in production's file is deliberately
dropped — above all `MAILERSEND_API_KEY`; the setup script refuses to run if
one is present in the dev file. Keep it that way. If production gains a
variable the app needs, add it to dev's file by hand.

## Moving production onto the release layout

Production ran as a plain copy of `platform/` in `/opt/ea-audit` with
`WorkingDirectory=/opt/ea-audit`. `deploy-ea-audit prod` refuses to touch it
until it is on the release layout, which means (once, as root):

1. A backup of `ea_audit` in `/opt/ea-audit-backups/` and the `pgmigrations`
   bookkeeping in file order (see *Known state*).
2. `/opt/ea-audit-prod/{releases,logs,shared}` owned by `deploy`, with
   `shared/.env` a byte-for-byte copy of `/opt/ea-audit/.env` (`deploy:deploy 600`)
   and an empty `deployed-shas.log`.
3. The legacy copy as *release zero*: `/opt/ea-audit-prod/current -> /opt/ea-audit`,
   a `RELEASE` file in `/opt/ea-audit` naming the commit it was built from, and
   a line for that commit in `/opt/ea-audit-prod/deployed-shas.log`. The first
   scripted deployment then has something to roll back to, and `rollback` will
   accept it.
4. `deploy/systemd/ea-audit.service` installed (same unit as before,
   `WorkingDirectory=/opt/ea-audit-prod/current`, `-H 127.0.0.1`), the old unit
   file kept in `/root/ea-audit.service.pre-layout`, `systemctl daemon-reload`.
   Nothing is restarted: the new `WorkingDirectory` resolves to the directory
   the running process already uses, so even an unplanned restart before the
   first deployment starts the same build.
5. `deploy-ea-audit status` shows `prod <sha7> main (active)`; then
   `deploy-ea-audit prod main` is the first scripted release — also when `main`
   is still the commit release zero was built from: only a release directory of
   the layout counts as "already running", so this builds it under
   `releases/<sha7>` and switches to it.

Fallback at any point: put `/root/ea-audit.service.pre-layout` back,
`systemctl daemon-reload`, `systemctl restart ea-audit`. Keep `/opt/ea-audit`
until the release layout has been through a few deployments — it is release
zero and `rollback` may need it.

## Known state to be aware of

- **`pgmigrations` order.** node-pg-migrate compares its bookkeeping table, in
  `run_on, id` order, position by position against the migration files and
  refuses to run if they disagree. Production's table had two rows recorded in
  the wrong order (`20260816000001_task_recode` / `20260816000002_task_recode_aux`)
  and two rows recorded twice (`20260820000008_session_integrity`,
  `20260820000009_mfa`). Dev was repaired on 2026-09-02; production is repaired
  as part of moving it onto the release layout. The repair is bookkeeping only:

  ```sql
  DELETE FROM pgmigrations a USING pgmigrations b WHERE a.name = b.name AND a.id > b.id;
  -- then swap the two ids so task_recode precedes task_recode_aux
  ```

  Check with: table order (`SELECT name FROM pgmigrations ORDER BY run_on, id`)
  must equal `ls migrations | sort`.
- The 14-digit migration prefixes make node-pg-migrate print
  `Can't determine timestamp for …` once per file. It is noise; the ordering it
  falls back to is the numeric prefix, which is what we want.
## First-time setup of the dev instance

Already done; recorded for the record and for rebuilding the server. It
assumes the `deploy` user exists, `/opt/ea-audit/.env` (or a production
`shared/.env` to point `PROD_ENV` at) is present, and the database
`ea_audit_dev` exists with `GRANT CONNECT … TO ea_app` (see *Refreshing dev's
data*); each missing piece makes the script stop before it changes anything.

1. `deploy/setup-dev-instance.sh` (as root) — directories, derived `.env`,
   `deploy/systemd/ea-audit-dev.service`, `deploy/apache/dev.auditisa.com.conf`
   (`a2ensite` + `apache2ctl configtest`), the deploy script.
2. `systemctl reload apache2`.
3. `deploy-ea-audit dev main` for the first release.

## From GitHub Actions

The same script, driven by CI: `.github/workflows/deploy.yml` deploys every
green CI run on `dev` to `dev.auditisa.com`, and offers every green CI run on
`main` as a production release that waits for a reviewer's approval — after
`deploy-ea-audit gate <sha>` has confirmed the commit ran on dev. Setup
(the SSH key, the repository secrets, the two GitHub environments) and the
day-to-day flow are in `docs/github-deploy-setup.md`. The rule above does not
change: the pipeline is a client of this script, not a way around it.
