#!/usr/bin/env bash
# deploy-ea-audit.sh — gated, atomic deployment of the AuditISA platform.
#
#   deploy-ea-audit.sh dev  [ref]                 build <ref> (default: dev) and run it on dev.auditisa.com
#   deploy-ea-audit.sh prod [ref]                 promote <ref> (default: main) to www.auditisa.com —
#                                                 refused unless that exact commit was deployed to dev first
#   deploy-ea-audit.sh prod <ref> --hotfix "why"  the documented way around the gate; the reason is logged
#   deploy-ea-audit.sh status                     what each target is running
#   deploy-ea-audit.sh gate [ref]                 would prod accept <ref> (default: main)? exit 0/1, changes nothing
#   deploy-ea-audit.sh rollback <dev|prod>        re-point at the previous release (no build, no migration)
#
# Runs as root on the server. Every release is a `git archive` of the commit,
# built in its own directory under $ROOT/releases/<sha>, so `current` is only
# ever re-pointed at something that finished building. Production is backed up
# before its migrations run. A failed health check re-points at the previous
# release and exits non-zero.
#
# Options: --rebuild   throw away an existing release directory for this sha and build again
#                      (refused for the release that is running: it would be deleted under the live process)
#          --no-fetch  do not contact GitHub (use the mirror as it is)
#          --yes       production only: skip the interactive "type PROD" confirmation
#                      (required when stdin is not a terminal, e.g. `ssh host deploy-ea-audit prod --yes`)

set -euo pipefail

REPO_URL=https://github.com/Nekoutb/ea-audit-tool.git
MIRROR=/opt/ea-audit-src.git
BACKUP_DIR=/opt/ea-audit-backups
LOCK=/run/lock/ea-audit-deploy.lock
KEEP_RELEASES=3
MIN_FREE_MB=1200          # refuse to build with less than this available — the build must never squeeze production
BUILD_MEM=2200M           # cgroup ceiling for npm ci / next build: the build dies before the box does
RUN_AS=deploy
YES=0

log()  { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[deploy]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[deploy] %s\033[0m\n' "$*" >&2; exit 1; }

configure() {
  case "$1" in
    dev)
      ROOT=/opt/ea-audit-dev;  SERVICE=ea-audit-dev; PORT=3201; DB=ea_audit_dev
      HOST=dev.auditisa.com;   DEFAULT_REF=dev ;;
    prod)
      ROOT=/opt/ea-audit-prod; SERVICE=ea-audit;     PORT=3200; DB=ea_audit
      HOST=www.auditisa.com;   DEFAULT_REF=main ;;
    *) die "unknown target '$1' (dev|prod)" ;;
  esac
  TARGET=$1
  DEPLOY_LOG=$ROOT/deployed-shas.log
}

current_release() {   # prints the release dir `current` points at, or nothing
  [ -L "$ROOT/current" ] && readlink -f "$ROOT/current" || true
}

previous_release() {  # prints what current.previous records, or nothing
  sed -n 's/^previous=//p' "$ROOT/current.previous" 2>/dev/null || true
}

sha_of_release() { [ -f "$1/RELEASE" ] && sed -n 's/^sha=//p' "$1/RELEASE" || basename "$1"; }

# deploy and rollback are mutually exclusive; status needs no lock.
take_lock() { exec 9>"$LOCK"; flock -n 9 || die "another deployment or rollback is running"; }

# shield <name>: from here on a dropped ssh session cannot kill the run half-way
# through a switch. Output goes to a run log; a tail mirrors it to the terminal
# and simply dies with the terminal, while the run itself ignores hang-ups.
# (Not tee: the uutils tee on Ubuntu 25.10 lingers forever with -p.)
shield() {
  RUNLOG=$ROOT/logs/$1-$(date -u +%Y%m%dT%H%M%SZ).log
  : > "$RUNLOG"
  tail --pid=$$ -f -n +1 "$RUNLOG" 9>&- &
  trap "" HUP
  exec >>"$RUNLOG" 2>&1
  log "run log: $RUNLOG"
}

# --- subcommands that need no build -----------------------------------------

cmd_status() {
  for t in dev prod; do
    configure $t
    local rel; rel=$(current_release)
    if [ -n "$rel" ]; then
      printf '%-5s %s  %s  (%s)\n' "$t" "$(sha_of_release "$rel" | cut -c1-12)" "$(sed -n 's/^ref=//p' "$rel/RELEASE" 2>/dev/null)" "$(systemctl is-active $SERVICE 2>/dev/null)"
    else
      printf '%-5s not on the release layout yet\n' "$t"
    fi
  done
}

# The production gate on its own, for the GitHub pipeline: it asks this before
# anyone is asked to approve a release, so a commit that never ran on dev is
# refused with the reason up front rather than after the approval. Read-only —
# no lock, no build, nothing written.
cmd_gate() {
  configure prod
  REF=${1:-$DEFAULT_REF}; NO_FETCH=0; HOTFIX=""
  ensure_mirror
  resolve_ref
  gate_prod
  log "$SHORT ($REF) has been deployed to dev — production would accept it"
}

cmd_rollback() {
  configure "${1:?rollback <dev|prod>}"; shift
  while [ $# -gt 0 ]; do
    case "$1" in
      --yes) YES=1 ;;
      *)     die "unknown option $1 (rollback <dev|prod> [--yes])" ;;
    esac; shift
  done
  take_lock
  local cur prev
  cur=$(current_release); [ -n "$cur" ] || die "$TARGET has no current release"
  prev=$(previous_release)
  [ -n "$prev" ] && [ -f "$prev/.next/BUILD_ID" ] || die "no built previous release recorded for $TARGET"
  [ "$prev" != "$cur" ] || die "current.previous points at the running release — nothing to roll back to"
  # Only ever roll back onto something that passed its health check here: a
  # release that never made it into the log is a build that was never good.
  grep -q "^$(sha_of_release "$prev") " "$DEPLOY_LOG" 2>/dev/null \
    || die "$(basename "$prev") was never successfully deployed to $TARGET (not in $DEPLOY_LOG) — refusing to roll back onto it"
  [ "$TARGET" = prod ] && confirm_prod "ROLLBACK production to $(basename "$prev")"
  shield rollback
  log "$TARGET: $(basename "$cur") -> $(basename "$prev") (migrations are NOT reverted)"
  switch_to "$prev"
  restart_and_check || die "$TARGET is unhealthy after rollback — current is left on $(basename "$prev"); investigate now"
  printf '%s %s rollback %s\n' "$(sha_of_release "$prev")" "$(basename "$prev")" "$(date -u +%FT%TZ)" >> "$DEPLOY_LOG"
}

# --- pieces of a deployment -------------------------------------------------

confirm_prod() {
  [ "$YES" = 1 ] && return 0
  [ -t 0 ] || die "$1: stdin is not a terminal, so nobody can confirm — re-run with --yes (or from an interactive shell)"
  printf '%s. Type the word PROD to continue: ' "$1"; read -r ans; [ "$ans" = PROD ] || die "aborted"
}

ensure_mirror() {
  if [ ! -d "$MIRROR" ]; then
    log "cloning mirror of $REPO_URL"
    git clone --quiet --mirror "$REPO_URL" "$MIRROR"
  elif [ "$NO_FETCH" = 0 ]; then
    git -C "$MIRROR" fetch --quiet --prune || die "git fetch from $REPO_URL failed (offline? --no-fetch uses the mirror as it is)"
  fi
}

resolve_ref() {
  SHA=$(git -C "$MIRROR" rev-parse --verify --quiet "${REF}^{commit}") || die "ref '$REF' not found in $MIRROR"
  SHORT=${SHA:0:7}
  TREE=$(git -C "$MIRROR" rev-parse "$SHA^{tree}")
}

gate_prod() {
  [ "$TARGET" = prod ] || return 0
  if [ -n "$HOTFIX" ]; then
    warn "HOTFIX PATH: skipping the dev gate for $SHORT — reason: $HOTFIX"
    return 0
  fi
  # The same commit, or a merge commit whose tree is byte-for-byte what dev ran
  # (merging dev into main with nothing else on main gives a new sha, same tree).
  local dev_log=/opt/ea-audit-dev/deployed-shas.log
  grep -qE "^$SHA |tree=$TREE( |$)" "$dev_log" 2>/dev/null || die "$SHORT has never been deployed to dev (not in $dev_log).
  Deploy it to dev first:   $0 dev $REF
  Emergency only:           $0 prod $REF --hotfix \"<reason>\""
  local dev_cur; dev_cur=$(readlink -f /opt/ea-audit-dev/current 2>/dev/null || true)
  if [ -n "$dev_cur" ] && [ "$(sha_of_release "$dev_cur")" != "$SHA" ]; then
    warn "dev is currently running $(sha_of_release "$dev_cur" | cut -c1-7), not $SHORT — the gate only checks that $SHORT was deployed there at some point"
  fi
  if ! git -C "$MIRROR" merge-base --is-ancestor "$SHA" main 2>/dev/null; then
    warn "$SHORT is not on main — promoting a commit that main does not contain"
  fi
}

# The target must already be on the release layout: <root>/current is what the
# unit runs, <root>/shared/.env is the only environment file. deploy/setup-*.sh
# put a target there; this script never changes the unit or the layout itself.
check_layout() {
  [ -d "$ROOT" ] || die "$ROOT does not exist — $TARGET is not set up for the release layout (see docs/deployment-workflow.md)"
  [ -f "$ROOT/shared/.env" ] || die "$ROOT/shared/.env is missing"
  local wd; wd=$(systemctl show "$SERVICE" -p WorkingDirectory --value 2>/dev/null || true)
  [ "$wd" = "$ROOT/current" ] || die "$SERVICE.service has WorkingDirectory=$wd, expected $ROOT/current — the unit must be moved to the release layout first"
  install -d -o $RUN_AS -g $RUN_AS "$ROOT/releases" "$ROOT/logs"
  install -d -m 700 "$BACKUP_DIR"
}

check_memory() {
  local avail; avail=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
  [ "$avail" -ge "$MIN_FREE_MB" ] || die "only ${avail} MB available; a build needs $MIN_FREE_MB MB free so production is never squeezed"
}

# Run a command as the deploy user inside a memory-capped transient cgroup.
capped() {
  systemd-run --quiet --scope --collect \
    -p MemoryMax=$BUILD_MEM -p MemorySwapMax=1G \
    nice -n 10 sudo -u $RUN_AS -H env HOME=/home/$RUN_AS PATH=/usr/local/bin:/usr/bin:/bin \
    bash -c "cd '$REL' && $*"
}

build_release() {
  REL=$ROOT/releases/$SHORT
  if [ -f "$REL/.next/BUILD_ID" ] && [ "$REBUILD" = 0 ]; then
    log "release $SHORT already built — reusing it (--rebuild to build again)"
    return 0
  fi
  # --rebuild must never delete the tree the live process is executing from.
  [ "$REL" != "$(current_release)" ] || die "$SHORT is the release $TARGET is running — rebuilding it would delete it under the live process; deploy another ref (or roll back) first"
  [ "$REL" != "$(previous_release)" ] || warn "$SHORT is the rollback target: rollback is unavailable until this build finishes"
  check_memory
  rm -rf "$REL"; install -d -o $RUN_AS -g $RUN_AS "$REL"
  log "exporting platform/ at $SHORT"
  git -C "$MIRROR" archive --format=tar "$SHA" platform | tar -x --strip-components=1 -C "$REL"
  printf 'sha=%s\nref=%s\nbuilt=%s\ntarget=%s\n' "$SHA" "$REF" "$(date -u +%FT%TZ)" "$TARGET" > "$REL/RELEASE"
  ln -s "$ROOT/shared/.env" "$REL/.env"
  chown -R $RUN_AS:$RUN_AS "$REL"
  local blog=$ROOT/logs/build-$SHORT.log
  log "npm ci (log: $blog)"
  capped "npm ci --no-audit --no-fund --prefer-offline" >"$blog" 2>&1 || die "npm ci failed — see $blog"
  log "next build"
  capped "NODE_OPTIONS=--max-old-space-size=1536 npm run build" >>"$blog" 2>&1 || die "next build failed — see $blog"
  [ -f "$REL/.next/BUILD_ID" ] || die "build produced no .next/BUILD_ID — see $blog"
  log "built $SHORT (BUILD_ID $(cat "$REL/.next/BUILD_ID"))"
}

# This is the dump reached for in the worst moment, so it is checked properly.
# `[ -s ]` — what this used to do — passes on a dump that died mid-stream, and
# the file is then indistinguishable from a good one by name or by size.
#
# Written under .part and renamed only once it verifies, so a partial file never
# acquires a real backup's name. The verification is deliberately inline rather
# than sourced from deploy/lib/backup-common.sh: a deployment must not stop
# working because the backup system is not installed yet. Same table list, same
# reasoning — a dump that lost document_version has lost the working papers.
backup_db() {
  BACKUP_FILE=$BACKUP_DIR/$DB-$(date -u +%Y%m%dT%H%M%SZ)-pre-$SHORT.dump
  log "backing up $DB -> $BACKUP_FILE"
  sudo -u postgres pg_dump --format=custom "$DB" > "$BACKUP_FILE.part"
  [ -s "$BACKUP_FILE.part" ] || die "backup file is empty"
  local toc
  toc=$(pg_restore --list "$BACKUP_FILE.part" 2>/dev/null) \
    || die "the pre-deploy dump is not a readable custom-format dump"
  local t
  for t in tenant engagement document_version task_attachment evidence pbc_item activity_log; do
    printf '%s\n' "$toc" | grep -q "TABLE DATA public $t " \
      || die "the pre-deploy dump has no data for '$t' — refusing to deploy over an incomplete backup"
  done
  mv -T "$BACKUP_FILE.part" "$BACKUP_FILE"
  log "backup verified ($(printf '%s\n' "$toc" | grep -c 'TABLE DATA') tables with data)"
  find "$BACKUP_DIR" -name "$DB-*-pre-*.dump" -mtime +14 -delete
  find "$BACKUP_DIR" -name "$DB-*-pre-*.dump.part" -mtime +1 -delete
}

migrate() {
  # Migrations run as the database owner (postgres, over the local socket),
  # exactly as they were run by hand on production; the app itself only ever
  # holds the RLS-bound ea_app credential.
  local url="postgresql://postgres@localhost/$DB?host=/var/run/postgresql"
  local mlog=$ROOT/logs/migrate-$SHORT-$(date -u +%Y%m%dT%H%M%SZ).log
  log "migrating $DB (log: $mlog)"
  # The 14-digit migration prefixes make node-pg-migrate print one harmless
  # "Can't determine timestamp" line per file; keep the full output in the log.
  if ! (cd "$REL" && sudo -u postgres env DATABASE_URL="$url" node node_modules/node-pg-migrate/bin/node-pg-migrate.js up) >"$mlog" 2>&1; then
    grep -v "Can't determine timestamp" "$mlog" | tail -n 15 >&2
    die "migration failed on $DB — current release untouched$( [ "$TARGET" = prod ] && echo "; if the schema is inconsistent restore it: sudo -u postgres pg_restore --clean --if-exists -d $DB < $BACKUP_FILE")"
  fi
  grep -E '^(> Migrating files|- |No migrations to run|### MIGRATION)' "$mlog" | head -40 | sed 's/^/    /'
  # rls.sql is idempotent and must follow every migration that adds a tenant table.
  (cd "$REL" && sudo -u postgres env DATABASE_URL="$url" node scripts/run-sql.mjs db/rls.sql) >>"$mlog" 2>&1 \
    || die "db/rls.sql failed on $DB — see $mlog"
}

# switch_to <release> [previous]: re-point current at <release> and record what
# to roll back to. By default that is whatever current pointed at until now;
# the automatic rollback passes the pre-deploy value instead, so a failed
# release never becomes the "previous" one.
switch_to() {
  local cur; cur=$(current_release)
  [ "$1" != "$cur" ] || return 0            # already there: keep the rollback record as it is
  local prev=${2-$cur}
  if [ -n "$prev" ]; then printf 'previous=%s\n' "$prev" > "$ROOT/current.previous"; else rm -f "$ROOT/current.previous"; fi
  ln -sfn "$1" "$ROOT/current.tmp" && mv -Tf "$ROOT/current.tmp" "$ROOT/current"
  chown -h $RUN_AS:$RUN_AS "$ROOT/current"
}

healthy() {   # $1 = attempts, 3 s apart, each request capped at 10 s
  local i code
  for ((i = 1; i <= $1; i++)); do
    code=$(curl -s --max-time 10 -o /dev/null -w '%{http_code}' -H "Host: $HOST" "http://127.0.0.1:$PORT/login" || true)
    [ "$code" = 200 ] && return 0
    sleep 3
  done
  warn "health check failed: GET http://127.0.0.1:$PORT/login -> ${code:-no response}"
  return 1
}

restart_and_check() {
  systemctl enable --quiet "$SERVICE" 2>/dev/null || true
  systemctl restart "$SERVICE"
  healthy 30 || return 1
  # through Apache as a real visitor would arrive (vhost, TLS, proxy headers)
  local code; code=$(curl -sk --max-time 15 -o /dev/null -w '%{http_code}' --resolve "$HOST:443:127.0.0.1" "https://$HOST/login" || true)
  [ "$code" = 200 ] || { warn "app is up on :$PORT but https://$HOST/login via Apache returned $code"; return 1; }
  return 0
}

prune_releases() {
  local cur prev; cur=$(current_release); prev=$(previous_release)
  ls -1dt "$ROOT"/releases/*/ 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | while read -r d; do
    d=${d%/}
    [ "$(readlink -f "$d")" = "$cur" ] && continue
    [ "$(readlink -f "$d")" = "$prev" ] && continue
    log "pruning old release $(basename "$d")"; rm -rf "$d"
  done
}

cmd_deploy() {
  configure "$1"; shift
  REF=""; REBUILD=0; NO_FETCH=0; HOTFIX=""
  while [ $# -gt 0 ]; do
    case "$1" in
      --rebuild)  REBUILD=1 ;;
      --no-fetch) NO_FETCH=1 ;;
      --yes)      YES=1 ;;
      --hotfix)   HOTFIX=${2:-}; [ -n "$HOTFIX" ] || die "--hotfix needs a reason"; shift ;;
      -*)         die "unknown option $1" ;;
      *)          [ -z "$REF" ] || die "one ref only"; REF=$1 ;;
    esac; shift
  done
  REF=${REF:-$DEFAULT_REF}
  if [ -n "$HOTFIX" ] && [ "$TARGET" != prod ]; then die "--hotfix only means something for prod (dev has no gate)"; fi

  take_lock
  ensure_mirror
  resolve_ref
  log "$TARGET <- $REF ($SHORT: $(git -C "$MIRROR" log -1 --format=%s "$SHA" | cut -c1-70))"
  gate_prod          # an un-tested commit is refused before anything else is looked at
  check_layout
  local cur prev_before; cur=$(current_release); prev_before=$(previous_release)
  if [ "$cur" = "$ROOT/releases/$SHORT" ] && [ "$REBUILD" = 0 ]; then
    grep -q "^$SHA " "$DEPLOY_LOG" 2>/dev/null || warn "$SHORT is not in $DEPLOY_LOG: an earlier run did not finish — check the unit and https://$HOST/"
    log "$TARGET already runs $SHORT — nothing to do"; exit 0
  fi
  [ "$TARGET" = prod ] && confirm_prod "Deploy $SHORT to PRODUCTION"
  [ -n "$cur" ] || warn "$TARGET has no current release: if the health check fails there is nothing to roll back to"
  shield deploy-$SHORT

  build_release
  [ "$TARGET" = prod ] && backup_db
  migrate
  switch_to "$REL"
  if restart_and_check; then
    printf '%s %s %s %s tree=%s%s\n' "$SHA" "$SHORT" "$REF" "$(date -u +%FT%TZ)" "$TREE" "${HOTFIX:+ HOTFIX: $HOTFIX}" >> "$DEPLOY_LOG"
    log "$TARGET is now running $SHORT — https://$HOST/"
    prune_releases
  else
    if [ -n "$cur" ]; then
      warn "rolling $TARGET back to $(basename "$cur")"
      switch_to "$cur" "$prev_before"     # current.previous goes back to what it was, not to the failed build
      restart_and_check && warn "rolled back; $TARGET is healthy on $(basename "$cur")" || warn "$TARGET is STILL unhealthy after rollback"
    else
      warn "$TARGET had no previous release — current is left on $SHORT; fix forward or restore by hand"
    fi
    die "deployment of $SHORT to $TARGET FAILED (build kept in $REL for inspection; migrations were NOT reverted)"
  fi
}

case "${1:-}" in
  status)   cmd_status ;;
  gate)     shift; cmd_gate "$@" ;;
  rollback) shift; cmd_rollback "$@" ;;
  dev|prod) cmd_deploy "$@" ;;
  *) sed -n '2,22p' "$0"; exit 64 ;;
esac
