#!/usr/bin/env bash
# Nightly logical backup of the production AuditISA database. Keeps 14 days.
# Installed on the server as /usr/local/sbin/ea-audit-backup, run by
# /etc/cron.d/ea-audit-backup at 02:17 UTC. Restore with:
#   sudo -u postgres pg_restore -d <db> --clean --if-exists <file>.dump
set -euo pipefail
DIR=/opt/ea-audit-backups; DB=ea_audit
install -d -m 700 "$DIR"
f="$DIR/$DB-$(date -u +%Y%m%dT%H%M%SZ)-nightly.dump"
sudo -u postgres pg_dump --format=custom "$DB" > "$f"
[ -s "$f" ] || { echo "ea-audit-backup: empty dump $f" >&2; exit 1; }
find "$DIR" -name "$DB-*-nightly.dump" -mtime +14 -delete
