#!/usr/bin/env bash
# install-github-deploy-key.sh — set up the GitHub Actions → server key end to
# end, from YOUR machine, in one run:
#
#   deploy/install-github-deploy-key.sh            do it
#   deploy/install-github-deploy-key.sh --check    only verify (server + secrets)
#
# Needs: ssh access to the server as root (the `ea-audit` alias from
# deploy/grant-claude-ssh-access.sh, or SERVER=root@host), and `gh` signed in
# to an account that may write repository secrets.
#
# What it does:
#   1. runs deploy/setup-github-deploy-key.sh ON the server: forced-command
#      wrapper, dedicated key /root/.ssh/github-deploy-ea-audit, restricted
#      authorized_keys entry (all idempotent)
#   2. self-tests that key on the server: it may run `deploy-ea-audit status`
#      and is refused anything else
#   3. sets the repository secrets DEPLOY_HOST, DEPLOY_USER, DEPLOY_KNOWN_HOSTS
#      and DEPLOY_SSH_KEY — the private key travels ssh → gh through a pipe and
#      is never printed or written to disk here
#
# Environment: SERVER (ea-audit)  SERVER_IP (45.32.150.96)  REPO (Nekoutb/ea-audit-tool)

set -euo pipefail

SERVER=${SERVER:-ea-audit}
SERVER_IP=${SERVER_IP:-45.32.150.96}
REPO=${REPO:-Nekoutb/ea-audit-tool}
KEY=/root/.ssh/github-deploy-ea-audit
HERE=$(cd "$(dirname "$0")" && pwd)

say()  { printf '\033[1;34m[github-key]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[github-key] %s\033[0m\n' "$*" >&2; exit 1; }
remote() { ssh -o BatchMode=yes -o ConnectTimeout=20 "$SERVER" "$@"; }

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
  local how=""
  if command -v winget >/dev/null;   then how="winget install --id GitHub.cli -e --accept-source-agreements --accept-package-agreements"
  elif command -v brew >/dev/null;   then how="brew install gh"
  elif command -v apt-get >/dev/null; then how="sudo apt-get install -y gh"
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
  say "gh is not signed in — starting 'gh auth login' (choose GitHub.com, HTTPS, browser)"
  gh auth login || die "gh sign-in did not complete"
fi
remote 'id -un' >/dev/null 2>&1 || die "cannot ssh to $SERVER non-interactively — run deploy/grant-claude-ssh-access.sh first, or set SERVER=root@host"

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
remote 'bash -s' < "$HERE/setup-github-deploy-key.sh" | grep -E '^(wrapper|key|authorized_keys):' || die "server-side setup failed"

# 2. prove the restriction works before the key goes anywhere
self_test

# 3. secrets — the private key goes straight from ssh into gh
say "setting repository secrets on $REPO"
gh secret set DEPLOY_HOST --repo "$REPO" --body "$SERVER_IP"
gh secret set DEPLOY_USER --repo "$REPO" --body root
ssh-keyscan -t ed25519 "$SERVER_IP" 2>/dev/null | gh secret set DEPLOY_KNOWN_HOSTS --repo "$REPO"
remote "cat $KEY" | gh secret set DEPLOY_SSH_KEY --repo "$REPO"
check_secrets

cat <<EOF

Done. Still needed (repository admin, in the GitHub UI — Settings → Environments):
  staging      no protection rules
  production   Required reviewers: you; deployment branches: main only

Then fast-forward main to dev (git push origin origin/dev:main) and the Deploy
workflow is live: green CI on dev → staging; green CI on main → gate → approval → production.
EOF
