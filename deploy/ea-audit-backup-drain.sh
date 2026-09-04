#!/usr/bin/env bash
# ea-audit-backup-drain.sh — take queued backup jobs and get the objects to Wasabi.
#
# Runs every ten minutes, so an archived audit file reaches immutable off-site
# storage within ten minutes of a partner closing it. The archiving itself never
# waits on this: archiveEngagement() commits and enqueues, and a storage outage
# delays the copy rather than blocking the close.
#
# An engagement's archival copy is the one object in this whole system that gets
# a COMPLIANCE lock — irreversible, for the retention period — so it goes to the
# archive bucket and everything else does not.

set -euo pipefail
TAG=drain
HERE=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
# shellcheck source=lib/backup-common.sh
. "${BACKUP_COMMON:-$HERE/lib/backup-common.sh}"

RELEASE=$PROD_ROOT/current
[ -d "$RELEASE" ] || { echo "no release at $RELEASE"; exit 0; }
DBURL="postgresql://postgres@localhost/$PROD_DB?host=/var/run/postgresql"
psql_() { sudo -u postgres psql -v ON_ERROR_STOP=1 -Atd "$PROD_DB" "$@"; }

# Nothing to do is the common case; take no lock and make no noise for it.
PENDING=$(psql_ -c "SELECT count(*) FROM backup_job WHERE state = 'queued'")
[ "$PENDING" = 0 ] && exit 0

RUNID=$(run_id)
init_dirs
RUNLOG=$LOG_DIR/drain-$RUNID.log
exec > >(tee -a "$RUNLOG") 2>&1
take_lock
check_disk
load_wasabi
KID=$(key_id)
log "$PENDING queued job(s)"

WORK=$WORK_DIR/drain-$RUNID
install -d -m 700 "$WORK"
trap 'rm -rf "$WORK"' EXIT

while IFS='|' read -r JOB_ID ENG_ID TEN_ID KIND; do
  [ -n "$JOB_ID" ] || continue
  psql_ -c "UPDATE backup_job SET state='running', started_at=now(), attempts=attempts+1 WHERE id='$JOB_ID'" >/dev/null
  DIR=$WORK/$JOB_ID
  if ! (cd "$RELEASE" && sudo -u postgres env DATABASE_URL="$DBURL" EA_BACKUP_KEY_ID="$KID" \
          node scripts/backup-extract.mjs --engagement "$ENG_ID" --out "$DIR" >"$WORK/$JOB_ID.out" 2>&1); then
    ERR=$(tail -c 400 "$WORK/$JOB_ID.out" | scrub | tr "'" ' ')
    psql_ -c "UPDATE backup_job SET state='failed', last_error='$ERR', completed_at=now() WHERE id='$JOB_ID'" >/dev/null
    warn "job $JOB_ID failed to extract"
    continue
  fi

  # Read the identity out of the manifest so the object is named the way a
  # person would look for it: client and fiscal year, under the ids.
  SUB=$(find "$DIR" -mindepth 1 -maxdepth 1 -type d | head -1)
  MANIFEST=$SUB/manifest.json
  CLIENT=$(sed -n 's/.*"name": *"\([^"]*\)".*/\1/p' "$MANIFEST" | head -1)
  FY=$(sed -n 's/.*"fiscal_year": *\([0-9]*\).*/\1/p' "$MANIFEST" | head -1)
  ARCHIVED=$(sed -n 's/.*"archivedAt": *"\([0-9-]\{10\}\).*/\1/p' "$MANIFEST" | head -1)
  SLUG=$(printf '%s' "${CLIENT:-client}" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]\+/-/g; s/^-//; s/-$//')
  KEYBASE="tenant/$TEN_ID/engagement/$ENG_ID/archive/${ARCHIVED:-$(date -u +%F)}--${SLUG:-client}-FY${FY:-0000}"

  tar -cf "$WORK/$JOB_ID.tar" -C "$(dirname "$SUB")" "$(basename "$SUB")"
  OBJ=$(compress_encrypt "$WORK/$JOB_ID.tar" "$KID")
  SUM=$(sha256_of "$OBJ"); BYTES=$(stat -c%s "$OBJ")

  # The plaintext manifest travels beside the object: an operator can see what
  # the object would restore without holding the key.
  upload "$MANIFEST" "$BUCKET_ARCHIVE" "$KEYBASE.manifest.json"
  upload "$OBJ" "$BUCKET_ARCHIVE" "$KEYBASE.extract.tar.zst.gpg"

  psql_ -c "UPDATE backup_job
               SET state='done', completed_at=now(),
                   object_key='$KEYBASE.extract.tar.zst.gpg',
                   object_bytes=$BYTES, object_sha256='$SUM', last_error=NULL
             WHERE id='$JOB_ID'" >/dev/null
  log "archived copy stored: $KEYBASE.extract.tar.zst.gpg ($BYTES bytes)"
  rm -rf "$DIR" "$OBJ"
done < <(psql_ -c "SELECT id||'|'||coalesce(engagement_id::text,'')||'|'||tenant_id||'|'||kind
                     FROM backup_job WHERE state='queued' AND kind='engagement-archive'
                    ORDER BY requested_at LIMIT 20")

# The acceptance criterion, checked every run: an archived file that exists only
# on this box is the failure this whole tier is meant to prevent.
ORPHANS=$(psql_ -c "SELECT count(*) FROM engagement e
                     WHERE e.archived_at IS NOT NULL
                       AND e.archived_at < now() - interval '1 hour'
                       AND NOT EXISTS (SELECT 1 FROM backup_job j
                                        WHERE j.engagement_id = e.id
                                          AND j.kind='engagement-archive' AND j.state='done')")
[ "$ORPHANS" = 0 ] || notify "$ORPHANS archived engagement(s) have no off-site copy"
