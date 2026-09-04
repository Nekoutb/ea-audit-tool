#!/usr/bin/env bash
# ea-audit-restore-drill.sh — prove weekly that the backups are restorable.
#
# The single highest-value control in this design, and the reason the encryption
# is symmetric: it has to run unattended. A drill that needs a human to fetch a
# private key is a drill that stops happening by week six, and then nobody finds
# out the archive is unreadable until the day it matters.
#
# It restores FROM WASABI, not from the local dump, because the remote copy is
# the one that survives the box. Sunday 04:40 UTC, clear of the 02:23 run.

set -euo pipefail
TAG=drill
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/backup-common.sh
. "${BACKUP_COMMON:-$HERE/lib/backup-common.sh}"

DRILL_DB=${DRILL_DB:-ea_audit_drill}
RUNID=$(run_id)
init_dirs
RUNLOG=$LOG_DIR/drill-$RUNID.log
exec > >(tee -a "$RUNLOG") 2>&1

WORK=$WORK_DIR/drill-$RUNID
FAILURES=()
record() { FAILURES+=("$1"); warn "CHECK FAILED: $1"; }
check()  { if eval "$2"; then log "ok: $1"; else record "$1"; fi; }

cleanup() {
  sudo -u postgres dropdb --if-exists "$DRILL_DB" >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap cleanup EXIT

take_lock
check_disk
load_wasabi

LATEST=$(rclone_ea cat "wasabi:$BUCKET_DR/db/_LATEST.json") || die "cannot read _LATEST.json"
BUCKET=$(printf '%s' "$LATEST" | sed -n 's/.*"bucket":"\([^"]*\)".*/\1/p')
PREFIX=$(printf '%s' "$LATEST" | sed -n 's/.*"prefix":"\([^"]*\)".*/\1/p')
SRC_RUN=$(printf '%s' "$LATEST" | sed -n 's/.*"runId":"\([^"]*\)".*/\1/p')
AGE_HOURS=$(( ( $(date -u +%s) - $(date -u -d "$(printf '%s' "$SRC_RUN" | sed -E 's/^(....)(..)(..)T(..)(..)(..)Z$/\1-\2-\3 \4:\5:\6 UTC/')" +%s) ) / 3600 ))

install -d -m 700 "$WORK"
log "drilling $BUCKET/$PREFIX (run $SRC_RUN, ${AGE_HOURS}h old)"

# Freshness: every individual run can succeed and the schedule still have
# stopped. The newest object being old is the only symptom of that.
check "the newest run is less than 8 hours old" "[ $AGE_HOURS -lt 8 ]"

rclone_ea copy "wasabi:$BUCKET/$PREFIX" "$WORK" --log-level ERROR || die "download failed"
check "SHA256SUMS present" "[ -f '$WORK/SHA256SUMS' ]"
( cd "$WORK" && sha256sum -c SHA256SUMS >/dev/null 2>&1 ) \
  && log "ok: ciphertext checksums match" || record "ciphertext checksums match"

KID=$(sed -n 's/.*"keyId": *"\([^"]*\)".*/\1/p' "$WORK/manifest.json" | head -1)
if decrypt "$WORK/ea_audit.dump.zst.gpg" "$WORK/ea_audit.dump.zst" "$KID" 2>/dev/null; then
  log "ok: decrypted with key $KID"
  zstd -q -d --rm "$WORK/ea_audit.dump.zst"
else
  record "decryption with key $KID"   # the nightmare case, found within 7 days
fi

if [ -f "$WORK/ea_audit.dump" ]; then
  verify_dump "$WORK/ea_audit.dump" && log "ok: dump structure" || record "dump structure"

  sudo -u postgres dropdb --if-exists "$DRILL_DB"
  sudo -u postgres createdb "$DRILL_DB"
  # --single-transaction makes a half-restore impossible; -j 1 keeps the shared
  # cluster to one extra connection out of 60.
  if sudo -u postgres pg_restore -d "$DRILL_DB" --single-transaction --exit-on-error -j 1 \
       <"$WORK/ea_audit.dump" >/dev/null 2>&1; then
    log "ok: pg_restore into $DRILL_DB"
  else
    record "pg_restore into $DRILL_DB"
  fi

  # The census travelled encrypted; open it and compare exactly.
  if decrypt "$WORK/manifest.full.json.gpg" "$WORK/census.json" "$KID" 2>/dev/null; then
    for t in tenant engagement document_version task_attachment evidence pbc_item activity_log legal_hold; do
      want=$(sed -n "s/.*\"$t\" *: *\([0-9]*\).*/\1/p" "$WORK/census.json" | head -1)
      got=$(sudo -u postgres psql -Atd "$DRILL_DB" -c "SELECT count(*) FROM $t" 2>/dev/null || echo -1)
      if [ "${want:-x}" = "$got" ]; then log "ok: $t = $got"; else record "$t row count (manifest $want, restored $got)"; fi
    done
  else
    record "census decryption"
  fi

  # THE check. Row counts prove a row arrived and say nothing about whether the
  # Word document inside it did — a restore with empty blobs passes every count.
  BADHASH=$(sudo -u postgres psql -Atd "$DRILL_DB" -c "
    SELECT count(*) FROM (
      SELECT id FROM document_version
       WHERE content IS NOT NULL AND encode(sha256(content),'hex') <> sha256
       ORDER BY created_at DESC LIMIT 100) x" 2>/dev/null || echo -1)
  check "stored document bytes match their recorded sha256" "[ '${BADHASH}' = '0' ]"

  # A restore that silently dropped these yields a database that looks right and
  # is not compliant: an archived file could be edited afterwards.
  GUARDS=$(sudo -u postgres psql -Atd "$DRILL_DB" -c "
    SELECT count(*) FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid
     WHERE NOT t.tgisinternal AND p.proname IN
       ('reject_archived_write','reject_archived_child_write','legal_hold_append_only','reject_delete_under_hold')" \
     2>/dev/null || echo 0)
  check "archive, legal-hold and append-only triggers restored (got $GUARDS)" "[ '${GUARDS:-0}' -ge 30 ]"

  RLSCOUNT=$(sudo -u postgres psql -Atd "$DRILL_DB" -c "
    SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity AND c.relforcerowsecurity" 2>/dev/null || echo 0)
  check "row-level security restored on the tenant tables (got $RLSCOUNT)" "[ '${RLSCOUNT:-0}' -ge 60 ]"
fi

RESULT=$WORK/result.json
STATUS=$([ ${#FAILURES[@]} -eq 0 ] && echo pass || echo fail)
{
  printf '{"format":"auditisa-drill/1","runId":"%s","source":"%s/%s","sourceRun":"%s","status":"%s","failures":[' \
    "$RUNID" "$BUCKET" "$PREFIX" "$SRC_RUN" "$STATUS"
  for i in "${!FAILURES[@]}"; do [ "$i" -gt 0 ] && printf ','; printf '"%s"' "${FAILURES[$i]}"; done
  printf ']}\n'
} >"$RESULT"

# Three places on purpose: on the box, in the bucket (survives the box), and in
# the repo runbook when a human copies it there (survives the account).
cat "$RESULT" >>"$BACKUP_DIR/DRILL-LOG"
upload "$RESULT" "$BUCKET_DR" "drill/$(date -u +%Y/%m)/$RUNID.json" || warn "could not store the drill result"

if [ "$STATUS" = fail ]; then
  notify "restore drill FAILED (${#FAILURES[@]} check(s)): ${FAILURES[*]}"
  die "drill failed"
fi
log "drill passed against run $SRC_RUN"
heartbeat
