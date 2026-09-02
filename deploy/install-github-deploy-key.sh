#!/usr/bin/env bash
# install-github-deploy-key.sh — set up the GitHub Actions → server key end to
# end, in one run. Self-contained: copy just this file anywhere and run it.
#
#   install-github-deploy-key.sh            do it
#   install-github-deploy-key.sh --check    only verify (server + secrets)
#
# Runs in either place:
#   ON THE SERVER, as root (the normal case — it notices deploy-ea-audit is
#     installed and works locally, no ssh involved):
#       curl -fsSL https://raw.githubusercontent.com/Nekoutb/ea-audit-tool/dev/deploy/install-github-deploy-key.sh -o /root/gitkeys.sh && bash /root/gitkeys.sh
#   FROM A WORKSTATION with ssh access to the server as root (the `ea-audit`
#     alias from deploy/grant-claude-ssh-access.sh, or SERVER=root@host).
# Either way `gh` must be able to sign in to an account that may write the
# repository's secrets; it is installed and signed in on demand.
#
# What it does:
#   1. on the server: installs the forced-command wrapper
#      /usr/local/sbin/deploy-ea-audit-ssh, creates the dedicated key
#      /root/.ssh/github-deploy-ea-audit, adds a restricted authorized_keys
#      entry (all idempotent — re-run any time)
#   2. self-tests that key on the server: it may run `deploy-ea-audit status`
#      and is refused anything else
#   3. sets the repository secrets DEPLOY_HOST, DEPLOY_USER, DEPLOY_KNOWN_HOSTS
#      and DEPLOY_SSH_KEY — the private key travels through a pipe into gh and
#      is never printed or written to disk here
#
# Environment: SERVER (ea-audit, or "local" to force running on this host)
#              SERVER_IP (45.32.150.96; on the server: its first address)
#              REPO (Nekoutb/ea-audit-tool)

set -euo pipefail

REPO=${REPO:-Nekoutb/ea-audit-tool}
KEY=/root/.ssh/github-deploy-ea-audit
WRAPPER=/usr/local/sbin/deploy-ea-audit-ssh

say()  { printf '\033[1;34m[github-key]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[github-key] %s\033[0m\n' "$*" >&2; exit 1; }

# Where are we? Root on a host that has the deploy script IS the server.
if [ "${SERVER:-}" = local ] || { [ -z "${SERVER:-}" ] && [ "$(id -u)" = 0 ] && [ -x /usr/local/sbin/deploy-ea-audit ]; }; then
  LOCAL=1
  SERVER_IP=${SERVER_IP:-$(hostname -I 2>/dev/null | awk '{print $1}')}
  [ -n "$SERVER_IP" ] || die "could not determine this server's IP — set SERVER_IP"
  say "running on the server itself ($(hostname), $SERVER_IP)"
else
  LOCAL=0
  SERVER=${SERVER:-ea-audit}
  SERVER_IP=${SERVER_IP:-45.32.150.96}
fi

# Run a command on the server: directly when we are the server, over ssh otherwise.
remote() {
  if [ "$LOCAL" = 1 ]; then bash -c "$*"; else ssh -o BatchMode=yes -o ConnectTimeout=20 "$SERVER" "$@"; fi
}

# ---------------------------------------------------------------- gh ---------
# gh: on PATH, or installed where its installers put it but not yet on this
# shell's PATH (Git Bash on Windows is the usual case) — or offer to install it.
find_gh() {
  command -v gh >/dev/null && return 0
  local candidates=(
    "/c/Program Files/GitHub CLI"
    "${LOCALAPPDATA:+$(cygpath -u "$LOCALAPPDATA" 2>/dev/null)/Programs/GitHub CLI}"
    "/opt/homebrew/bin" "/usr/local/bin" "/home/linuxbrew/.linuxbrew/bin"
  )
  local d
  for d in "${candidates[@]}"; do
    [ -n "$d" ] && [ -x "$d/gh" ] || [ -x "$d/gh.exe" ] 2>/dev/null || continue
    export PATH="$d:$PATH"; say "gh found at $d (added to PATH for this run)"; return 0
  done
  return 1
}

install_gh() {
  say "gh (GitHub CLI) is not installed."
  local how="" sudo=""; [ "$(id -u)" = 0 ] || sudo="sudo "
  if command -v winget >/dev/null;   then how="winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements"
  elif command -v brew >/dev/null;   then how="brew install gh"
  elif command -v apt-get >/dev/null; then how="${sudo}apt-get update -qq && ${sudo}apt-get install -y gh"
  elif command -v dnf >/dev/null;    then how="${sudo}dnf install -y gh"
  fi
  [ -n "$how" ] || die "install it from https://cli.github.com and run this script again"
  printf 'Install it now with:  %s  [y/N] ' "$how"; read -r ans
  [ "$ans" = y ] || [ "$ans" = Y ] || die "install gh (https://cli.github.com) and run this script again"
  eval "$how" || die "the install failed — install gh by hand and run this script again"
  hash -r
  find_gh || die "gh installed but not found — open a new terminal and run this script again"
}

find_gh || install_gh
if ! gh auth status >/dev/null 2>&1; then
  if [ "$LOCAL" = 1 ]; then
    say "gh is not signed in — starting 'gh auth login' (GitHub.com, HTTPS, 'Login with a web browser': it prints a one-time code to enter at github.com/login/device from any browser)"
  else
    say "gh is not signed in — starting 'gh auth login' (choose GitHub.com, HTTPS, browser)"
  fi
  gh auth login || die "gh sign-in did not complete"
fi
[ "$LOCAL" = 1 ] || remote 'id -un' >/dev/null 2>&1 || die "cannot ssh to $SERVER non-interactively — run deploy/grant-claude-ssh-access.sh first, or set SERVER=root@host"

# ------------------------------------------------ the server-side part -------
# Emitted as a script and fed to `bash -s` on the server (or locally), so this
# file has no sibling to depend on. Idempotent.
server_setup() {
  cat <<'SETUP'
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "run as root" >&2; exit 1; }
KEY=/root/.ssh/github-deploy-ea-audit
WRAPPER=/usr/local/sbin/deploy-ea-audit-ssh

# 1. forced command: validates SSH_ORIGINAL_COMMAND before anything runs
cat > "$WRAPPER" <<'W'
#!/usr/bin/env bash
# Forced command for the github-deploy key: only deploy-ea-audit, only with
# arguments a deployment can have (dev|prod|gate|status, a ref, --yes).
# --hotfix is deliberately absent: the hotfix path stays with a person.
set -euo pipefail
read -ra ARGS <<< "${SSH_ORIGINAL_COMMAND:-}"
[ "${ARGS[0]:-}" = "deploy-ea-audit" ] || { echo "refused: ${ARGS[0]:-<empty>}" >&2; exit 1; }
for a in "${ARGS[@]:1}"; do
  [[ "$a" =~ ^([A-Za-z0-9._/-]+|--yes)$ ]] || { echo "refused argument: $a" >&2; exit 1; }
done
exec /usr/local/sbin/deploy-ea-audit "${ARGS[@]:1}"
W
chmod 755 "$WRAPPER"
echo "wrapper: $WRAPPER installed"

# 2. key
mkdir -p /root/.ssh && chmod 700 /root/.ssh
if [ -f "$KEY" ]; then
  echo "key: $KEY already exists (kept)"
else
  ssh-keygen -t ed25519 -N "" -C github-deploy-ea-audit -f "$KEY" -q
  echo "key: $KEY created"
fi

# 3. restricted authorized_keys entry
pub=$(cut -d' ' -f1,2 < "$KEY.pub")
touch /root/.ssh/authorized_keys && chmod 600 /root/.ssh/authorized_keys
if grep -qF "$pub" /root/.ssh/authorized_keys; then
  echo "authorized_keys: entry already present"
else
  printf 'restrict,command="%s" %s github-deploy-ea-audit\n' "$WRAPPER" "$pub" >> /root/.ssh/authorized_keys
  echo "authorized_keys: restricted entry added"
fi
SETUP
}

self_test() {
  say "self-test: the restricted key may run 'deploy-ea-audit status' …"
  remote "ssh -i $KEY -o IdentitiesOnly=yes -o BatchMode=yes -o StrictHostKeyChecking=accept-new root@127.0.0.1 -- deploy-ea-audit status" \
    || die "the restricted key cannot run deploy-ea-audit status"
  say "self-test: … and is refused anything else"
  if remote "ssh -i $KEY -o IdentitiesOnly=yes -o BatchMode=yes root@127.0.0.1 -- id" 2>/dev/null; then
    die "the key ran 'id' — the forced command is not in place"
  else
    say "refused, as it should be"
  fi
}

check_secrets() {
  say "repository secrets on $REPO:"
  local have; have=$(gh secret list --repo "$REPO" --json name --jq '.[].name' 2>/dev/null || gh secret list --repo "$REPO" | awk '{print $1}')
  local missing=0
  for s in DEPLOY_HOST DEPLOY_USER DEPLOY_KNOWN_HOSTS DEPLOY_SSH_KEY; do
    if grep -qx "$s" <<< "$have"; then printf '   %-20s set\n' "$s"; else printf '   %-20s MISSING\n' "$s"; missing=1; fi
  done
  return $missing
}

if [ "${1:-}" = "--check" ]; then
  remote "test -f $KEY" || die "$KEY does not exist on the server — run without --check"
  self_test
  check_secrets || die "some secrets are missing"
  say "everything is in place"
  exit 0
fi

# 1. server side
say "server: installing wrapper, key and restricted authorized_keys entry"
server_setup | remote 'bash -s' || die "server-side setup failed"

# 2. prove the restriction works before the key goes anywhere
self_test

# 3. secrets — the private key goes straight from the server into gh
say "setting repository secrets on $REPO"
gh secret set DEPLOY_HOST --repo "$REPO" --body "$SERVER_IP"
gh secret set DEPLOY_USER --repo "$REPO" --body root
# The host key as GitHub's runner will see it: keyed by the public address.
# On the server itself 127.0.0.1 answers with the same key, if the public
# address does not route back.
known=$(ssh-keyscan -t ed25519 "$SERVER_IP" 2>/dev/null || true)
[ -n "$known" ] || known=$(ssh-keyscan -t ed25519 127.0.0.1 2>/dev/null | sed "s/^127\.0\.0\.1/$SERVER_IP/")
[ -n "$known" ] || die "ssh-keyscan returned nothing for $SERVER_IP"
printf '%s\n' "$known" | gh secret set DEPLOY_KNOWN_HOSTS --repo "$REPO"
remote "cat $KEY" | gh secret set DEPLOY_SSH_KEY --repo "$REPO"
check_secrets

cat <<EOF

Done. Still needed (repository admin, in the GitHub UI — Settings → Environments):
  staging      no protection rules
  production   Required reviewers: you; deployment branches: main only

Then fast-forward main to dev (git push origin origin/dev:main) and the Deploy
workflow is live: green CI on dev → staging; green CI on main → gate → approval → production.
EOF
