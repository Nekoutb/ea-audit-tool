#!/usr/bin/env bash
# ea-audit-backup-install.sh — put the backup system on the server.
#
#   ./ea-audit-backup-install.sh            install, timers left DISABLED
#   ./ea-audit-backup-install.sh --enable    install and start the timers
#
# This file exists because the previous backup script and its cron entry were
# copied onto the server by hand and installed by nothing. The repo copy and the
# server copy could differ indefinitely with no way to tell, and rebuilding the
# box from the repository would silently omit backups altogether. Compare
# deploy/setup-dev-instance.sh, which does install the deploy script and units.
#
# Idempotent. Refuses rather than improvises:
#   - it never creates, prints or reads a secret; the three credential files are
#     installed by a person, in an SSH session, and this only checks they exist
#     with the right mode;
#   - it refuses if a bucket does not have Object Lock enabled, because that
#     cannot be turned on afterwards and the only remedy is a new bucket and a
#     full re-copy.

set -euo pipefail
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
TAG=install
# shellcheck source=lib/backup-common.sh
. "$HERE/lib/backup-common.sh"

ENABLE=0
[ "${1:-}" = "--enable" ] && ENABLE=1

[ "$(id -u)" = 0 ] || die "run as root"

# ------------------------------------------------------------------ directories
install -d -m 700 "$CONF_DIR" "$KEY_DIR"
init_dirs
log "directories ready: $CONF_DIR (700), $BACKUP_DIR (700), $LOG_DIR (750)"

# ------------------------------------------------------------------- the secrets
require_secret() {
  local f=$1 what=$2
  [ -f "$f" ] || die "$f is missing — $what. Create it by hand in an SSH session; never through an agent."
  local mode; mode=$(stat -c%a "$f")
  [ "$mode" = 400 ] || die "$f is mode $mode; it must be 400"
  [ "$(stat -c%U "$f")" = root ] || die "$f must be owned by root"
}
require_secret "$WASABI_ENV" "the Wasabi access key and secret for the writer/reader sub-users"
require_secret "$ALERT_ENV"  "MAILERSEND_API_KEY, ALERT_TO and optionally HEALTHCHECK_URL"
ls -1 "$KEY_DIR"/*.key >/dev/null 2>&1 || die "no encryption key in $KEY_DIR — generate one and complete the escrow FIRST"
for k in "$KEY_DIR"/*.key; do require_secret "$k" "the backup encryption passphrase"; done
KID=$(key_id)
log "encryption key in use: $KID (names only — the value is never printed)"

# ------------------------------------------------------------------ dependencies
for tool in rclone gpg zstd pg_dump pg_restore jq curl; do
  command -v "$tool" >/dev/null || die "$tool is not installed"
done
[ -f "$RCLONE_CONF" ] || die "$RCLONE_CONF is missing (start from deploy/rclone.conf.example; the keys come from $WASABI_ENV, not from this file)"

# --------------------------------------------------------------- the buckets
# Object Lock cannot be added to an existing bucket. Catching that here, before
# the first byte, is the difference between a five-minute fix and re-copying
# everything into a new bucket later.
load_wasabi
for bucket in "$BUCKET_DR" "$BUCKET_ARCHIVE"; do
  rclone_ea lsd "wasabi:$bucket" >/dev/null 2>&1 || die "bucket '$bucket' is not reachable"
  if rclone_ea backend versioning "wasabi:$bucket" 2>/dev/null | grep -qi enabled; then
    log "bucket $bucket: versioning enabled (Object Lock forces this on)"
  else
    die "bucket '$bucket' does not report versioning — it was almost certainly created WITHOUT Object Lock. That cannot be retrofitted: create a new bucket with Object Lock enabled and re-copy."
  fi
done

# ------------------------------------------------------------------- programs
install -m 750 "$HERE/ea-audit-backup.sh"       /usr/local/sbin/ea-audit-backup
install -m 750 "$HERE/ea-audit-restore.sh"      /usr/local/sbin/ea-audit-restore
install -m 750 "$HERE/ea-audit-restore-drill.sh" /usr/local/sbin/ea-audit-restore-drill
install -m 750 "$HERE/ea-audit-backup-drain.sh"  /usr/local/sbin/ea-audit-backup-drain
install -d -m 750 /usr/local/lib/ea-audit
install -m 640 "$HERE/lib/backup-common.sh"     /usr/local/lib/ea-audit/backup-common.sh
# The installed programs source the installed library, not the repo checkout.
sed -i 's#^\. "${BACKUP_COMMON:-$HERE/lib/backup-common.sh}"#. "${BACKUP_COMMON:-/usr/local/lib/ea-audit/backup-common.sh}"#' \
  /usr/local/sbin/ea-audit-backup /usr/local/sbin/ea-audit-restore   /usr/local/sbin/ea-audit-restore-drill /usr/local/sbin/ea-audit-backup-drain
log "installed ea-audit-backup, ea-audit-restore, ea-audit-restore-drill, ea-audit-backup-drain"

install -m 644 "$HERE/systemd/ea-audit-backup.service"        /etc/systemd/system/
install -m 644 "$HERE/systemd/ea-audit-backup.timer"          /etc/systemd/system/
install -m 644 "$HERE/systemd/ea-audit-backup-weekly.service" /etc/systemd/system/
install -m 644 "$HERE/systemd/ea-audit-backup-weekly.timer"   /etc/systemd/system/
install -m 644 "$HERE/systemd/ea-audit-backup-drain.service"  /etc/systemd/system/
install -m 644 "$HERE/systemd/ea-audit-backup-drain.timer"    /etc/systemd/system/
install -m 644 "$HERE/systemd/ea-audit-restore-drill.service" /etc/systemd/system/
install -m 644 "$HERE/systemd/ea-audit-restore-drill.timer"   /etc/systemd/system/
install -m 644 "$HERE/systemd/ea-audit-backup-failure@.service" /etc/systemd/system/
install -m 644 "$HERE/logrotate.d-ea-audit-backup"            /etc/logrotate.d/ea-audit-backup
systemctl daemon-reload
log "installed units and logrotate"

# The old cron entry goes in the same operation as the timer arriving. There
# must never be a window in which both fire.
if [ -f /etc/cron.d/ea-audit-backup ]; then
  rm -f /etc/cron.d/ea-audit-backup
  log "removed /etc/cron.d/ea-audit-backup (superseded by ea-audit-backup.timer)"
fi

# ------------------------------------------------------------------ smoke test
log "dry run"
/usr/local/sbin/ea-audit-backup --class daily --dry-run || die "the dry run failed — not enabling anything"

if [ "$ENABLE" = 1 ]; then
  systemctl enable --now ea-audit-backup.timer ea-audit-backup-weekly.timer \n    ea-audit-backup-drain.timer ea-audit-restore-drill.timer
  log "timers enabled"
else
  log "timers installed but NOT enabled. Enable them only after a real run and a passing drill:"
  log "  ea-audit-backup --class daily            # one real run"
  log "  ea-audit-restore-drill                   # must pass end to end"
  log "  systemctl enable --now ea-audit-backup.timer ea-audit-backup-weekly.timer \n    ea-audit-backup-drain.timer ea-audit-restore-drill.timer"
fi
systemctl list-timers 'ea-audit-*' --all --no-pager || true
