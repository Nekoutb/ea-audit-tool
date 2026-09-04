#!/usr/bin/env bash
# ea-audit-restore.sh — fetch a backup, decrypt it, and load it somewhere safe.
#
#   ea-audit-restore --list [--class daily|weekly|monthly]
#   ea-audit-restore --latest --into ea_audit_scratch
#   ea-audit-restore --run 20260904T022300Z --into ea_audit_scratch
#   ea-audit-restore --latest --fetch-only --to /var/tmp/restore
#   ea-audit-restore --rebuild-set --run <runid> --to /var/tmp/rebuild
#
# Without this file "we have backups" is a claim rather than a capability, so it
# is deliberately the simplest thing in the set: list, fetch, check, decrypt,
# load. Every step prints what it did.
#
# --into refuses `ea_audit` unless you type the database name at the prompt. A
# restore over a live production database is almost never what someone means at
# three in the morning; the scratch database, compared side by side, almost
# always is.

set -euo pipefail
TAG=restore
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/backup-common.sh
. "${BACKUP_COMMON:-$HERE/lib/backup-common.sh}"

MODE=""
RUN=""
CLASS=daily
INTO=""
DEST=""

while [ $# -gt 0 ]; do
  case "$1" in
    --list)        MODE=list ;;
    --latest)      MODE=${MODE:-fetch}; RUN=latest ;;
    --run)         MODE=${MODE:-fetch}; RUN=$2; shift ;;
    --class)       CLASS=$2; shift ;;
    --into)        INTO=$2; shift ;;
    --fetch-only)  MODE=fetch ;;
    --rebuild-set) MODE=rebuild ;;
    --to)          DEST=$2; shift ;;
    *) die "unknown option $1" ;;
  esac
  shift
done
[ -n "$MODE" ] || die "one of --list, --latest, --run or --rebuild-set is required"

init_dirs
load_wasabi

if [ "$MODE" = list ]; then
  log "runs in $BUCKET_DR/db/$CLASS (newest last)"
  rclone_ea lsf "wasabi:$BUCKET_DR/db/$CLASS" --dirs-only --recursive | sort | tail -40
  echo
  log "_LATEST.json:"
  rclone_ea cat "wasabi:$BUCKET_DR/db/_LATEST.json" || warn "no _LATEST.json yet"
  exit 0
fi

# Resolve the run through _LATEST, which is only written after a run's manifest
# lands — so a half-finished run can never be selected here.
if [ "$RUN" = latest ]; then
  LATEST=$(rclone_ea cat "wasabi:$BUCKET_DR/db/_LATEST.json") || die "cannot read _LATEST.json"
  BUCKET=$(printf '%s' "$LATEST" | sed -n 's/.*"bucket":"\([^"]*\)".*/\1/p')
  PREFIX=$(printf '%s' "$LATEST" | sed -n 's/.*"prefix":"\([^"]*\)".*/\1/p')
  RUN=$(printf '%s' "$LATEST" | sed -n 's/.*"runId":"\([^"]*\)".*/\1/p')
else
  BUCKET=$BUCKET_DR
  PREFIX=$(rclone_ea lsf "wasabi:$BUCKET_DR/db" --dirs-only --recursive \
            | sed 's:/$::' | grep -- "$RUN" | head -1) \
    || die "run $RUN not found"
  PREFIX="db/$PREFIX"
fi
[ -n "${PREFIX:-}" ] || die "could not resolve a prefix for $RUN"

DEST=${DEST:-$WORK_DIR/restore-$RUN}
install -d -m 700 "$DEST"
log "fetching $BUCKET/$PREFIX -> $DEST"
rclone_ea copy "wasabi:$BUCKET/$PREFIX" "$DEST" --log-level ERROR || die "download failed"

[ -f "$DEST/SHA256SUMS" ] || die "no SHA256SUMS in that prefix — refusing an unverifiable restore"
( cd "$DEST" && sha256sum -c SHA256SUMS ) || die "checksums do not match what was uploaded"
log "checksums verified"

KID=$(sed -n 's/.*"keyId": *"\([^"]*\)".*/\1/p' "$DEST/manifest.json" | head -1)
[ -n "$KID" ] || die "manifest names no key id"
[ -f "$(key_file "$KID")" ] || die "key '$KID' is not in $KEY_DIR — fetch it from the escrow (see docs/disaster-recovery.md)"
log "decrypting with key $KID"
for g in "$DEST"/*.gpg; do
  plain=${g%.gpg}
  decrypt "$g" "$plain" "$KID"
  case "$plain" in *.zst) zstd -q -d --rm "$plain" ;; esac
done

if [ "$MODE" = rebuild ]; then
  log "rebuild set extracted under $DEST — it contains BOTH .env files; delete this directory when you are done"
  tar -tf "$DEST/rebuild-set.tar" | sed 's/^/  /'
  exit 0
fi

[ -n "$INTO" ] || { log "fetched and decrypted into $DEST (no --into given)"; exit 0; }

verify_dump "$DEST/ea_audit.dump"

if [ "$INTO" = "$PROD_DB" ]; then
  # Blunt on purpose. The safe path is a scratch database you can compare
  # against production before deciding anything.
  [ -t 0 ] || die "restoring over $PROD_DB needs a terminal; use a scratch database instead"
  warn "This will OVERWRITE the live production database."
  printf 'Type the database name to continue: '
  read -r answer
  [ "$answer" = "$PROD_DB" ] || die "aborted"
fi

sudo -u postgres psql -Atc "SELECT 1 FROM pg_database WHERE datname='$INTO'" | grep -q 1 \
  || { log "creating database $INTO"; sudo -u postgres createdb "$INTO"; }

log "restoring into $INTO"
# --single-transaction so a half-restore is impossible; -j 1 so the shared
# cluster sees one extra connection, not several.
sudo -u postgres pg_restore -d "$INTO" --clean --if-exists --single-transaction --exit-on-error -j 1 \
  <"$DEST/ea_audit.dump" || die "pg_restore failed"

log "restored $RUN into $INTO"
sudo -u postgres psql -Atd "$INTO" -c \
  "SELECT 'tenants='||(SELECT count(*) FROM tenant)||' engagements='||(SELECT count(*) FROM engagement)
       ||' documents='||(SELECT count(*) FROM document_version)||' attachments='||(SELECT count(*) FROM task_attachment)"
log "the decrypted copy is still in $DEST — remove it when you are done"
