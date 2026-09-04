#!/usr/bin/env bash
# backup-common.sh — everything the backup, drill and restore scripts share.
#
# Sourced, never executed. The point of putting the conventions in one file is
# that the tiers cannot drift: the key scheme, the encryption chain, the rclone
# flags, the manifest format and the alerting are defined once and used by all
# of them, rather than agreed in a document and re-implemented three times.
#
# Everything here runs as root on the server. It must keep working when the
# application does not exist — disaster recovery cannot depend on the thing it
# is recovering — so nothing in this file touches node_modules or a release.

# ---------------------------------------------------------------- configuration
BACKUP_DIR=${BACKUP_DIR:-/opt/ea-audit-backups}
WORK_DIR=$BACKUP_DIR/work
LOG_DIR=${LOG_DIR:-/var/log/ea-audit}
CONF_DIR=${CONF_DIR:-/etc/ea-audit}
KEY_DIR=$CONF_DIR/keys
WASABI_ENV=$CONF_DIR/wasabi.env
ALERT_ENV=$CONF_DIR/alert.env
RCLONE_CONF=${RCLONE_CONF:-/root/.config/rclone/rclone.conf}
LOCK=${LOCK:-/run/lock/ea-audit-backup.lock}

BUCKET_DR=${BUCKET_DR:-auditisa-dr}
BUCKET_ARCHIVE=${BUCKET_ARCHIVE:-auditisa-archive}

MIN_FREE_MB=${MIN_FREE_MB:-5120}   # a backup that fills the disk is worse than no backup
UPLOAD_TIMEOUT=${UPLOAD_TIMEOUT:-900}
PROD_ROOT=/opt/ea-audit-prod
DEV_ROOT=/opt/ea-audit-dev
PROD_DB=ea_audit
DEV_DB=ea_audit_dev

TAG=${TAG:-backup}
log()  { printf '\033[1;34m[%s]\033[0m %s\n' "$TAG" "$*"; }
warn() { printf '\033[1;33m[%s]\033[0m %s\n' "$TAG" "$*" >&2; }
die()  { printf '\033[1;31m[%s] %s\033[0m\n' "$TAG" "$*" >&2; notify "failed: $*"; exit 1; }

run_id() { date -u +%Y%m%dT%H%M%SZ; }

take_lock() {
  mkdir -p "$(dirname "$LOCK")"
  exec 9>"$LOCK"
  flock -n 9 || die "another backup run holds the lock"
}

# The deploy lock too, where it matters: a backup taken while migrations are
# half-applied records a schema state that never really existed.
take_deploy_lock() {
  exec 8>/run/lock/ea-audit-deploy.lock
  flock -w "${1:-60}" 8 || die "a deployment is running; not backing up mid-migration"
}

check_disk() {
  local free
  free=$(df -Pm "$BACKUP_DIR" | awk 'NR==2 {print $4}')
  [ "$free" -ge "$MIN_FREE_MB" ] || die "only ${free}MB free under $BACKUP_DIR (need ${MIN_FREE_MB}MB)"
}

# ------------------------------------------------------------------- encryption
# GPG symmetric AES-256. Symmetric rather than public-key for one reason that
# outweighs the rest: the weekly restore drill has to decrypt unattended, and a
# drill that needs a human to fetch a private key is a drill that stops
# happening. Anyone with root here can already read the live database, so the
# marginal exposure is historical data — and the answer to that is rotating
# AUTH_SECRET and the ea_app password after a compromise, not the cipher mode.
#
# The passphrase is escrowed in three places off this machine before a single
# object is uploaded. An un-escrowed key turns a backup into a liability.
key_id() {
  local newest
  newest=$(ls -1 "$KEY_DIR"/*.key 2>/dev/null | sort | tail -1) || true
  [ -n "$newest" ] || die "no encryption key in $KEY_DIR (see docs/disaster-recovery.md)"
  basename "$newest" .key
}

key_file() { echo "$KEY_DIR/$1.key"; }

# encrypt <in> <out> <kid>
encrypt() {
  local kid=$3
  gpg --batch --yes --quiet --symmetric --cipher-algo AES256 \
      --s2k-mode 3 --s2k-digest-algo SHA512 --s2k-count 65011712 \
      --compress-algo none \
      --passphrase-file "$(key_file "$kid")" \
      -o "$2" "$1"
}

# decrypt <in> <out> <kid>
decrypt() {
  gpg --batch --yes --quiet --decrypt --passphrase-file "$(key_file "$3")" -o "$2" "$1"
}

# compress_encrypt <plain file> <kid> -> writes <plain>.zst.gpg, removes the plaintext
compress_encrypt() {
  local plain=$1 kid=$2
  zstd -q -19 --rm -o "$plain.zst" "$plain"
  encrypt "$plain.zst" "$plain.zst.gpg" "$kid"
  rm -f "$plain.zst"
  echo "$plain.zst.gpg"
}

sha256_of() { sha256sum "$1" | awk '{print $1}'; }

# ---------------------------------------------------------------------- transport
load_wasabi() {
  [ -f "$WASABI_ENV" ] || die "$WASABI_ENV is missing — the bucket credentials are installed by hand, never by an agent"
  set +x
  # shellcheck disable=SC1090
  . "$WASABI_ENV"
  export RCLONE_S3_ACCESS_KEY_ID RCLONE_S3_SECRET_ACCESS_KEY
}

# The one rclone invocation. Hard HTTP timeouts so a stalled TLS handshake can
# never leave a backup process alive into business hours; a bandwidth cap so the
# upload does not squeeze the five other applications sharing this NIC;
# --immutable so an accidental overwrite is an error rather than a silent
# replacement.
rclone_ea() {
  timeout --signal=TERM --kill-after=60 "$UPLOAD_TIMEOUT" \
  rclone "$@" \
    --config "$RCLONE_CONF" \
    --s3-server-side-encryption AES256 \
    --s3-chunk-size 16M --s3-upload-concurrency 2 \
    --transfers 1 --checkers 2 \
    --contimeout 30s --timeout 300s --expect-continue-timeout 10s \
    --low-level-retries 5 --retries 3 --retries-sleep 20s \
    --bwlimit 8M --stats 0
}

# upload <local file> <bucket> <key>
upload() {
  local file=$1 bucket=$2 key=$3
  rclone_ea copyto "$file" "wasabi:$bucket/$key" --immutable \
    --log-level INFO --log-file "$LOG_DIR/rclone-${RUNID:-manual}.log" \
    || die "upload failed: $key"
  # Verify what landed, not what we think we sent.
  local remote local_size
  remote=$(rclone_ea lsjson "wasabi:$bucket/$key" | sed -n 's/.*"Size":\([0-9]*\).*/\1/p' | head -1)
  local_size=$(stat -c%s "$file")
  [ "$remote" = "$local_size" ] \
    || die "uploaded size mismatch for $key (local $local_size, remote ${remote:-none})"
}

# ------------------------------------------------------------------- alerting
# Four layers, because each covers a gap the others cannot: a push on failure,
# a dead-man's switch for the failures that stop the script running at all, an
# in-run freshness assertion, and the disk guard above.
#
# Credentials come from $ALERT_ENV, deliberately NOT from the application's
# shared/.env: rotating the app's mail key must not silently kill DR alerting,
# and a root-owned recovery script should not depend on the app's env file
# existing at all.
scrub() {
  sed -E 's/((pass|passphrase|secret|key|token|pwd)[^ =]*[=:])[^ ]*/\1<redacted>/gi'
}

notify() {
  [ -f "$ALERT_ENV" ] || return 0
  # shellcheck disable=SC1090
  ( set +x; . "$ALERT_ENV"
    [ -n "${MAILERSEND_API_KEY:-}" ] && [ -n "${ALERT_TO:-}" ] || exit 0
    local body
    body=$(printf '%s\n\nhost: %s\nrun: %s\n\n%s\n' "$1" "$(hostname)" "${RUNID:-n/a}" \
             "$(tail -n 15 "${RUNLOG:-/dev/null}" 2>/dev/null | scrub)")
    curl -sS --max-time 20 -X POST https://api.mailersend.com/v1/email \
      -H "Authorization: Bearer $MAILERSEND_API_KEY" \
      -H "Content-Type: application/json" \
      -d "$(jq -n --arg to "$ALERT_TO" --arg from "${ALERT_FROM:-support@auditisa.com}" \
                  --arg subject "[AuditISA backup] $1" --arg text "$body" \
            '{from:{email:$from,name:"AuditISA backup"},to:[{email:$to}],subject:$subject,text:$text}')" \
      >/dev/null 2>&1 || true
  ) || true
}

# The layer that matters most, and the cheapest: a ping that must ARRIVE.
# Nothing inside this script can report that cron was removed, the disk filled,
# or the box is off — only the absence of a ping can.
heartbeat() {
  [ -n "${HEALTHCHECK_URL:-}" ] || return 0
  curl -fsS -m 10 --retry 3 "$HEALTHCHECK_URL" >/dev/null 2>&1 || warn "heartbeat ping failed"
}

# ---------------------------------------------------------------- verification
# A dump must be structurally readable and must contain the tables that hold the
# audit evidence, before it is allowed anywhere near the bucket. `[ -s "$f" ]`
# — the old check — passes on a truncated dump, and the prune then eats the last
# good copy around it.
REQUIRED_TABLES="tenant engagement document_version task_attachment evidence pbc_item activity_log legal_hold"

verify_dump() {
  local dump=$1 toc
  toc=$(pg_restore --list "$dump" 2>/dev/null) || die "$(basename "$dump") is not a readable custom-format dump"
  local t
  for t in $REQUIRED_TABLES; do
    printf '%s\n' "$toc" | grep -q "TABLE DATA public $t " \
      || die "$(basename "$dump") has no data for '$t' — refusing to store a dump that lost the evidence"
  done
  log "dump verified: $(printf '%s\n' "$toc" | grep -c 'TABLE DATA') tables with data"
}

# ------------------------------------------------------------------- housekeeping
init_dirs() {
  install -d -m 700 "$BACKUP_DIR" "$WORK_DIR"
  install -d -m 750 "$LOG_DIR"
}

# Never prune on a schedule that runs independently of upload success — that is
# how the previous script could eat its own last good copy.
prune_local() {
  local keep_days=${1:-7}
  find "$BACKUP_DIR" -maxdepth 1 -name 'ea_audit-*.dump' -mtime "+$keep_days" -delete
  find "$WORK_DIR" -maxdepth 1 -type d -mtime +2 -exec rm -rf {} + 2>/dev/null || true
}
