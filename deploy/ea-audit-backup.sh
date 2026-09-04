#!/usr/bin/env bash
# ea-audit-backup.sh — the whole database, the rebuild set, and the firms,
# encrypted on this box and copied to Wasabi.
#
#   ea-audit-backup [--class auto|daily|weekly|monthly|yearly]
#   ea-audit-backup --dry-run          do everything except upload, keep the work directory
#   ea-audit-backup --no-upload        produce the objects locally only
#   ea-audit-backup --include-dev      also dump ea_audit_dev (before a risky dev migration)
#   ea-audit-backup --tenants          also produce the per-firm extracts (weekly pass)
#   ea-audit-backup --rolling          also produce per-engagement extracts for open files that changed
#
# Installed as /usr/local/sbin/ea-audit-backup by deploy/ea-audit-backup-install.sh,
# driven by ea-audit-backup.timer. Runs as root.
#
# What replaced what, and why it mattered:
#   - `pg_dump > file` with `[ -s "$f" ]` as the only check. A dump that died
#     mid-stream left a non-empty file with a perfectly ordinary name, and the
#     14-day prune then removed the last good copy around it.
#   - Backups on the same disk as the database they protect. A VM loss took the
#     database and every backup together.
#   - Nothing encrypted, nothing verified, nothing alerting. The files contain
#     every client's audit evidence and both production .env files.
#
# The ordering here is deliberate: manifest.json and SHA256SUMS upload LAST and
# _LATEST.json is written only after they land, so a partial run is not merely
# distinguishable from a good one — it is invisible to every tool that reads
# through _LATEST.

set -euo pipefail
TAG=backup
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/backup-common.sh
. "${BACKUP_COMMON:-$HERE/lib/backup-common.sh}"

CLASS=auto
DO_UPLOAD=1
DRY_RUN=0
INCLUDE_DEV=0
DO_TENANTS=0
DO_ROLLING=0

while [ $# -gt 0 ]; do
  case "$1" in
    --class)       CLASS=$2; shift ;;
    --dry-run)     DRY_RUN=1; DO_UPLOAD=0 ;;
    --no-upload)   DO_UPLOAD=0 ;;
    --include-dev) INCLUDE_DEV=1 ;;
    --tenants)     DO_TENANTS=1 ;;
    --rolling)     DO_ROLLING=1 ;;
    *) die "unknown option $1" ;;
  esac
  shift
done

# `auto` promotes by calendar: the same run is the daily, and on the right day
# also the weekly, monthly or yearly. Promotion is a server-side copy, so it
# costs no egress and no bandwidth on a shared NIC.
resolve_class() {
  [ "$CLASS" != auto ] && { echo "$CLASS"; return; }
  local d; d=$(date -u +%d) ; local m; m=$(date -u +%m) ; local dow; dow=$(date -u +%u) ; local h; h=$(date -u +%H)
  if [ "$h" != 02 ]; then echo daily; return; fi          # only the 02:23 run promotes
  if [ "$d" = 01 ] && [ "$m" = 01 ]; then echo yearly; return; fi
  if [ "$d" = 01 ]; then echo monthly; return; fi
  if [ "$dow" = 7 ]; then echo weekly; return; fi
  echo daily
}

RUNID=$(run_id)
CLASS=$(resolve_class)
init_dirs
RUNLOG=$LOG_DIR/backup-$RUNID.log
exec > >(tee -a "$RUNLOG") 2>&1

take_lock
take_deploy_lock 120
check_disk

KID=$(key_id)
WORK=$WORK_DIR/$RUNID
install -d -m 700 "$WORK"
trap 'rc=$?; [ $rc -ne 0 ] && warn "run $RUNID failed (exit $rc); work kept at $WORK"; exit $rc' EXIT

log "run $RUNID class=$CLASS key=$KID"

# ---------------------------------------------------------------- the database
# --snapshot ties the census below to the same instant as the dump, so the
# drill's row-count assertion is an equality rather than a hopeful heuristic.
CENSUS=$WORK/census.json
DUMP=$WORK/ea_audit.dump

log "dumping $PROD_DB"
sudo -u postgres psql -v ON_ERROR_STOP=1 -Atd "$PROD_DB" >"$CENSUS" <<'SQL' &
SELECT json_build_object(
  'takenAt', now(),
  'counts', (SELECT json_object_agg(t, n) FROM (
     SELECT 'tenant' AS t, count(*) AS n FROM tenant
     UNION ALL SELECT 'engagement', count(*) FROM engagement
     UNION ALL SELECT 'document_version', count(*) FROM document_version
     UNION ALL SELECT 'task_attachment', count(*) FROM task_attachment
     UNION ALL SELECT 'evidence', count(*) FROM evidence
     UNION ALL SELECT 'pbc_item', count(*) FROM pbc_item
     UNION ALL SELECT 'activity_log', count(*) FROM activity_log
     UNION ALL SELECT 'legal_hold', count(*) FROM legal_hold
     UNION ALL SELECT 'sub_ledger_row', count(*) FROM sub_ledger_row
     UNION ALL SELECT 'gl_line', count(*) FROM gl_line) c),
  'pgmigrations', (SELECT count(*) FROM pgmigrations),
  'pgmigrationsLast', (SELECT name FROM pgmigrations ORDER BY id DESC LIMIT 1),
  'databaseBytes', pg_database_size(current_database())
);
SQL
CENSUS_PID=$!

sudo -u postgres pg_dump --format=custom --compress=0 --lock-wait-timeout=60s "$PROD_DB" >"$DUMP.part"
wait $CENSUS_PID || die "census query failed"
mv -T "$DUMP.part" "$DUMP"
verify_dump "$DUMP"
cp -p "$DUMP" "$BACKUP_DIR/ea_audit-$RUNID.dump"      # the fast local path, pruned only after upload

log "dumping globals"
# --no-role-passwords on purpose: a full globals dump carries the SCRAM
# verifiers of eaap and cmipaportal — other projects' secrets — into an
# AuditISA bucket for a decade. Roles, memberships and grants survive without
# them, and our own credential travels inside the rebuild set anyway.
sudo -u postgres pg_dumpall --globals-only --no-role-passwords >"$WORK/globals.sql"

if [ "$INCLUDE_DEV" = 1 ]; then
  log "dumping $DEV_DB (--include-dev)"
  sudo -u postgres pg_dump --format=custom --compress=0 "$DEV_DB" >"$WORK/ea_audit_dev.dump"
fi

# ------------------------------------------------------------- the rebuild set
# The difference between "I have a dump" and "I have a running server".
# Excluded on purpose: /etc/letsencrypt (the wildcard key is shared with five
# other vhosts — certbot re-issues in minutes), the Postgres data directory,
# node_modules/.next/releases, and anything belonging to the other applications.
log "collecting the rebuild set"
STATE=$WORK/state.txt
{
  echo "# AuditISA server state at $RUNID"
  echo "## postgres";      sudo -u postgres psql -Atc "SELECT version()" || true
  sudo -u postgres psql -Atc "SELECT rolname FROM pg_roles ORDER BY 1" || true
  sudo -u postgres psql -Atd "$PROD_DB" -c "SELECT extname||' '||extversion FROM pg_extension ORDER BY 1" || true
  sudo -u postgres psql -Atd "$PROD_DB" -c "SELECT name FROM pgmigrations ORDER BY id DESC LIMIT 1" || true
  echo "## node";          node -v 2>/dev/null || true; npm -v 2>/dev/null || true
  echo "## apache";        apache2 -v 2>/dev/null | head -1 || true
  echo "## packages";      dpkg -l postgresql-17 apache2 nodejs 2>/dev/null | tail -n +6 || true
  echo "## disk";          df -h /
  echo "## timers";        systemctl list-timers 'ea-audit-*' --all --no-pager 2>/dev/null || true
} >"$STATE"

REBUILD_LIST=$WORK/rebuild-files.txt
: >"$REBUILD_LIST"
for f in \
  "$PROD_ROOT/shared/.env" "$DEV_ROOT/shared/.env" \
  "$PROD_ROOT/deployed-shas.log" "$DEV_ROOT/deployed-shas.log" \
  "$PROD_ROOT/current.previous" "$PROD_ROOT/current/RELEASE" \
  /etc/systemd/system/ea-audit.service /etc/systemd/system/ea-audit-dev.service \
  /etc/systemd/system/ea-audit-backup.service /etc/systemd/system/ea-audit-backup.timer \
  /etc/systemd/system/ea-audit-restore-drill.service /etc/systemd/system/ea-audit-restore-drill.timer \
  /etc/logrotate.d/ea-audit-backup \
  /usr/local/sbin/deploy-ea-audit /usr/local/sbin/ea-audit-backup \
  /usr/local/sbin/ea-audit-restore /usr/local/sbin/ea-audit-restore-drill
do [ -e "$f" ] && echo "$f" >>"$REBUILD_LIST"; done
for f in /etc/apache2/sites-available/*auditisa.com*.conf /etc/cron.d/ea-audit-*; do
  [ -e "$f" ] && echo "$f" >>"$REBUILD_LIST"
done
echo "$STATE" >>"$REBUILD_LIST"
tar --absolute-names -cf "$WORK/rebuild-set.tar" -T "$REBUILD_LIST"

# -------------------------------------------------------------- the firms
if [ "$DO_TENANTS" = 1 ] || [ "$DO_ROLLING" = 1 ]; then
  RELEASE=$PROD_ROOT/current
  if [ -d "$RELEASE" ]; then
    EXTRACTS=$WORK/extracts
    install -d -m 700 "$EXTRACTS"
    DBURL="postgresql://postgres@localhost/$PROD_DB?host=/var/run/postgresql"
    if [ "$DO_TENANTS" = 1 ]; then
      log "extracting every firm"
      (cd "$RELEASE" && sudo -u postgres env DATABASE_URL="$DBURL" EA_BACKUP_KEY_ID="$KID" \
        node scripts/backup-extract.mjs --all-tenants --out "$EXTRACTS/tenant" --credentials include) \
        || die "tenant extraction failed"
    fi
    if [ "$DO_ROLLING" = 1 ]; then
      log "extracting open engagements that changed"
      (cd "$RELEASE" && sudo -u postgres env DATABASE_URL="$DBURL" EA_BACKUP_KEY_ID="$KID" \
        node scripts/backup-extract.mjs --rolling --out "$EXTRACTS/engagement") \
        || die "rolling extraction failed"
    fi
    for d in "$EXTRACTS"/*/*/; do
      [ -d "$d" ] || continue
      tar -cf "${d%/}.tar" -C "$(dirname "${d%/}")" "$(basename "${d%/}")"
      rm -rf "$d"
    done
  else
    warn "no release at $RELEASE — skipping the per-firm extracts"
  fi
fi

# -------------------------------------------------------------- seal and ship
log "compressing and encrypting"
OBJECTS=()
while IFS= read -r plain; do
  OBJECTS+=("$(compress_encrypt "$plain" "$KID")")
done < <(find "$WORK" -maxdepth 2 -type f \( -name '*.dump' -o -name '*.sql' -o -name '*.tar' \) | sort)

# A canary, so the quarterly escrow exercise can prove the key still opens an
# object without downloading a database.
printf 'AuditISA backup %s, key %s, host %s\n' "$RUNID" "$KID" "$(hostname)" >"$WORK/canary.txt"
OBJECTS+=("$(compress_encrypt "$WORK/canary.txt" "$KID")")
encrypt "$CENSUS" "$WORK/manifest.full.json.gpg" "$KID"; rm -f "$CENSUS"
OBJECTS+=("$WORK/manifest.full.json.gpg")

# The plaintext manifest hashes the CIPHERTEXT, so integrity is checkable
# straight against the bucket by anyone — including someone who does not hold
# the key and only needs to know which object to fetch.
MANIFEST=$WORK/manifest.json
SUMS=$WORK/SHA256SUMS
: >"$SUMS"
{
  printf '{\n  "format": "auditisa-backup/1",\n  "kind": "db",\n  "class": "%s",\n' "$CLASS"
  printf '  "runId": "%s",\n  "keyId": "%s",\n  "host": "%s",\n  "files": [\n' "$RUNID" "$KID" "$(hostname)"
  first=1
  for o in "${OBJECTS[@]}"; do
    name=$(basename "$o"); sum=$(sha256_of "$o"); size=$(stat -c%s "$o")
    printf '%s  %s\n' "$sum" "$name" >>"$SUMS"
    [ $first = 1 ] || printf ',\n'
    printf '    {"path": "%s", "bytes": %s, "sha256": "%s"}' "$name" "$size" "$sum"
    first=0
  done
  printf '\n  ]\n}\n'
} >"$MANIFEST"
log "sealed ${#OBJECTS[@]} object(s), $(du -sh "$WORK" | cut -f1)"

if [ "$DO_UPLOAD" = 1 ]; then
  load_wasabi
  PREFIX="db/$CLASS/$(date -u +%Y/%m/%d)/$RUNID"
  case "$CLASS" in yearly) BUCKET=$BUCKET_ARCHIVE; PREFIX="db/yearly/$(date -u +%Y)/$RUNID" ;;
                   *)      BUCKET=$BUCKET_DR ;; esac
  log "uploading to $BUCKET/$PREFIX"
  for o in "${OBJECTS[@]}"; do upload "$o" "$BUCKET" "$PREFIX/$(basename "$o")"; done
  # Manifest last. Until these two land the prefix is invisible to _LATEST.
  upload "$SUMS" "$BUCKET" "$PREFIX/SHA256SUMS"
  upload "$MANIFEST" "$BUCKET" "$PREFIX/manifest.json"

  LATEST=$WORK/_LATEST.json
  printf '{"runId":"%s","class":"%s","bucket":"%s","prefix":"%s","keyId":"%s","at":"%s"}\n' \
    "$RUNID" "$CLASS" "$BUCKET" "$PREFIX" "$KID" "$(date -u +%FT%TZ)" >"$LATEST"
  rclone_ea copyto "$LATEST" "wasabi:$BUCKET_DR/db/_LATEST.json" --log-level ERROR \
    || die "could not update _LATEST.json"
  log "run $RUNID complete: $BUCKET/$PREFIX"
  prune_local 7
  rm -rf "$WORK"
  heartbeat
else
  log "upload skipped; objects are in $WORK"
  [ "$DRY_RUN" = 1 ] || rm -f "$BACKUP_DIR/ea_audit-$RUNID.dump"
fi

trap - EXIT
