# Backup and disaster recovery

AuditISA holds audit firms' complete working files — the documentation of the
work performed and the Word, PowerPoint and PDF evidence attached to it. All of
it lives inside PostgreSQL as `bytea` (`document_version.content`,
`task_attachment.content`, `evidence.content`, `pbc_item.content`). There is no
separate file store: **the database is the product**, and a database backup is a
backup of every document.

Against that sits a ten-year retention obligation the schema itself enforces
(`tenant.retention_years`, default 10, OHADA AUDCIF art. 24), archive
immutability on 32 tables, an append-only audit trail, and legal hold.

This document is the runbook. In practice it, rather than the backup scripts,
determines how long a recovery takes.

## Targets

| | Target |
|---|---|
| RPO — how much work a disaster can cost | **≤ 4 hours** |
| RTO — database damaged, box healthy | **≤ 30 minutes** |
| RTO — box lost, rebuilt on a fresh VM | **≤ 4 hours** *(estimate; replaced by the measured time at the first quarterly rehearsal)* |

## What runs, and when

All times UTC. `:23` past the hour is clear of the `*/5`, `*/10`, `*/15`, `:10`,
`:15`, `:17` and `:30` jobs the other applications on this box already use.

| When | Unit | What |
|---|---|---|
| 02:23, 06:23, 10:23, 14:23, 18:23, 22:23 | `ea-audit-backup.timer` | whole database + globals + rebuild set → Wasabi |
| Sundays 03:40 | `ea-audit-backup-weekly.timer` | per-firm extracts, per-engagement rolling copies |
| Sundays 04:40 | `ea-audit-restore-drill.timer` | restore the newest backup from Wasabi and check it |
| every production deploy | `deploy-ea-audit prod` | verified pre-deploy dump, local |

`systemctl list-timers 'ea-audit-*'` shows the schedule and the last run.

## The three granularities

**Whole database** — `db/…`. Disaster recovery. Includes every firm, every
engagement and every uploaded file, plus `pg_dumpall --globals-only` for the
roles and a *rebuild set*: both `shared/.env` files, the systemd units, the
Apache vhosts, the cron/timer files, `deployed-shas.log`, the deploy scripts and
a generated `state.txt` naming the exact PostgreSQL, Node and Apache versions to
install. That last file is what turns a dump into a running server.

**Per firm** — `tenant/<tenant_id>/full/…`. One firm's rows, extracted with an
explicit `WHERE tenant_id = …` (never via row-level security — RLS is a *deny*
mechanism, and using it for selection would make an unclassified table fail
towards including everyone's rows). Restores one firm without touching the rest,
and is the basis of a future "download my firm's data".

**Per engagement** — `tenant/<id>/engagement/<id>/…`. An archived file gets one
`archive/` copy, written once, WORM-locked for the retention period: this is the
statutory copy. Open files get a weekly `rolling/` copy, produced only when
`activity_log` shows the file actually changed.

> The ZIP produced by the in-app export (`lib/export-bundle.ts`) is **not** a
> backup. It is an excellent readable artefact for a regulator or a successor
> auditor, but it carries no primary keys, omits ~30 tables, and does not
> include `evidence.content` or `pbc_item.content`. Restores use the extract.

## Encryption, and the key

Objects are compressed with `zstd` and encrypted with **GPG symmetric AES-256**
before they leave the box. Wasabi server-side encryption is applied underneath.

The passphrase lives in `/etc/ea-audit/keys/<kid>.key`, `root:root 0400`. The
key id (`YYYY-MM-A`) is recorded in every plaintext manifest, so restoring a
three-year-old object never involves guessing which key opened it. **Old key
files are never deleted while any object encrypted with them is still stored.**

Symmetric rather than public-key, deliberately: the weekly restore drill has to
decrypt unattended, and a drill that needs a human to fetch a private key is a
drill that stops happening. Anyone with root on this box can already read the
live database, so the marginal exposure is historical data — and the answer to
that is rotating `AUTH_SECRET` and the `ea_app` password after a suspected
compromise, not the cipher mode.

### Escrow — three copies, no two in the same failure domain

1. **Paper**, in the firm's safe: key id, date, passphrase, bucket names, and
   the four commands under "Total loss" below. Sealed, dated, signed.
2. **Password manager**, a dedicated "AuditISA DR" item shared with a **second
   named person**. A single-operator key is a single point of failure with a pulse.
3. **A cloud that is not Wasabi.** The key and the ciphertext must never be
   recoverable from one provider's account.

Never in the bucket, never in git, never in `shared/.env`, never pasted into a
chat or an agent session. **No object is uploaded before escrow is complete** —
an un-escrowed key turns the backup from an asset into a liability, and you find
out on the worst possible day.

**Quarterly**, the second person retrieves the envelope, downloads
`canary.txt.gpg` from a random old run, decrypts it and confirms the run id
matches. Five minutes, and it is the only thing that proves the escrow is real.
Record the date at the bottom of this file.

## Storage

| Bucket | Object Lock | Holds |
|---|---|---|
| `auditisa-dr` | GOVERNANCE 90 days | 4-hourly, weekly and monthly database runs; per-firm and rolling extracts; drill results |
| `auditisa-archive` | COMPLIANCE, 10 years | archived engagements' copies, and the yearly database anchor |

Both were created **with Object Lock enabled**, which cannot be added
afterwards. Retention is a bucket-level default because rclone cannot set it per
object — that is why there are two buckets rather than one.

GOVERNANCE, not COMPLIANCE, for everything except the archive tier: COMPLIANCE
is irreversible by anyone including the account root, and the realistic mishap
on a young system is a bug uploading garbage, which you would then pay to keep
for a decade. The box's credential has no `DeleteObject` and no
`BypassGovernanceRetention`, so GOVERNANCE gives identical protection against
the threat that actually exists. Pruning is done by bucket lifecycle rules, not
by the server — a compromised box cannot erase the history.

**No retention anywhere is shorter than 90 days**, because Wasabi bills a 90-day
minimum per object regardless: a shorter expiry saves nothing and only loses
recoverability.

## Restoring

### One firm, or one audit file, as it stood

The common case — a successor auditor wants FY2024, counsel wants what the file
said in March, someone deleted something. **This never writes to production.**

```
ea-audit-restore --list                            # what exists
ea-audit-restore --run <runid> --into ea_audit_scratch
```

Then read the scratch database, or run the export bundle against it. Stop here.
There is no step that touches the live database, and there rarely needs to be.

### The live database is damaged, the box is fine

```
systemctl stop ea-audit
ea-audit-restore --latest --into ea_audit_scratch   # verify first, always
ea-audit-restore --latest --into ea_audit           # types the db name to confirm
systemctl start ea-audit
```

### Total loss — the box is gone

1. Provision a VM. Fetch the rebuild set and read `state.txt` for the exact
   PostgreSQL, Node and Apache versions:
   ```
   ea-audit-restore --rebuild-set --run <runid> --to /var/tmp/rebuild
   ```
   You need only the escrowed key and the Wasabi reader credentials to do this.
2. Install those versions. Restore the roles (`globals.sql`), then the database.
3. Put `shared/.env`, the units and the vhosts back from the rebuild set.
   Re-issue TLS with certbot — the certificates are deliberately not backed up,
   because the wildcard key is shared with five unrelated vhosts.
4. `deploy-ea-audit prod <sha>` using the newest sha in `deployed-shas.log`.
5. Check `/login` returns 200 signed out **and** that a real account can sign in.

Delete `/var/tmp/rebuild` afterwards: it contains both production `.env` files.

### Moving rows back into a live production database

Only after a scratch restore has been verified, and only interactively. The
archive-immutability triggers fire on INSERT, so a restored archived file is
rebuilt using the triggers' own design — insert the `engagement` row with
`archived_at NULL`, insert its children (the guards see an open file and pass),
then stamp `archived_at`/`retention_until` back. This works as `ea_app`, needs
no ownership, and leaves the guard armed for every concurrent session.

**Never `ALTER TABLE … DISABLE TRIGGER USER` on production.** It needs table
ownership, it disables every trigger on that table for every concurrent session,
and the approach above makes it unnecessary.

## When something is wrong

| Symptom | What it means | Do this |
|---|---|---|
| No heartbeat ping received | The run did not happen at all — timer removed, disk full, box down | `systemctl list-timers 'ea-audit-*'`, `journalctl -u ea-audit-backup` |
| "failed" mail from a run | A step failed; the work directory is kept at `/opt/ea-audit-backups/work/<runid>` | read `/var/log/ea-audit/backup-<runid>.log` |
| Drill failed on decryption | **The archive may be unreadable.** Stop and treat as an incident | check the key id in the manifest against `/etc/ea-audit/keys/` |
| Drill failed on a content hash | A document's bytes did not survive | do not prune anything; investigate the source rows |
| Drill failed on freshness | Runs have silently stopped | as for the heartbeat |
| `only NNNMB free` | The disk guard refused to start | free space before anything else; a backup must never fill the disk |

A failed drill is not a reason to retry blindly. Read the result at
`/opt/ea-audit-backups/DRILL-LOG` and in `drill/<Y>/<M>/<runid>.json`.

## Deliberately not done

**Point-in-time recovery.** `archive_mode` is cluster-wide on a box whose
PostgreSQL also serves `eaap`, `cmipaportal` and `ea_audit_dev`. Enabling it
means a restart affecting all of them, ships *their* write-ahead log into an
AuditISA bucket under our key and our retention, and introduces a new way for
the safety system to take the whole cluster down (a stuck `archive_command`
fills `pg_wal`). Six runs a day gives RPO ≤ 4 h for none of that. The correct
form of PITR is a dedicated PostgreSQL instance for AuditISA — revisit when
`ea_audit` passes ~5 GB or a client contract names an RPO under an hour.

**Nightly backups of `ea_audit_dev`.** It is a clone of production, re-creatable
in one documented command, and backing it up would double the number of
encrypted copies of production client personal data. `ea-audit-backup
--include-dev` exists for use before a risky dev migration.

**TLS certificates.** The wildcard key is shared with five unrelated vhosts;
capturing it would take custody of their TLS. Certbot re-issues in minutes.

## Rehearsal log

The automated drill proves the *artefact*. Only a human rehearsal on a fresh VM,
using nothing but the escrowed key, proves the *runbook* — and the runbook is
what is actually broken at three in the morning. Record each one here, with the
elapsed time, and replace the RTO estimate above with the measured number.

| Date | Who | Kind | Elapsed | Notes |
|---|---|---|---|---|
| _(pending)_ | | first full rebuild rehearsal | | |
