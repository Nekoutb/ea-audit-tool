#!/usr/bin/env bash
# grant-claude-ssh-access.sh — give Claude Code (or any local agent) key-based
# SSH access to the AuditISA server, without ever handing it a password.
#
#   deploy/grant-claude-ssh-access.sh            set up (idempotent; re-run any time)
#   deploy/grant-claude-ssh-access.sh --test     just check that the key works
#   deploy/grant-claude-ssh-access.sh --revoke   remove the key from the server and this machine
#
# Run it YOURSELF from a terminal (Git Bash on Windows, or any Linux/macOS
# shell): the one step that needs the root password — installing the public
# key — prompts you interactively. Afterwards Claude Code reaches the server
# with plain `ssh ea-audit`, and nothing else has to be typed.
#
# What it does:
#   1. creates a dedicated ed25519 key, ~/.ssh/ea-audit-claude (no passphrase —
#      an agent cannot answer a passphrase prompt; the key is scoped to this
#      one server and revocable with --revoke)
#   2. appends its public half to root's authorized_keys on the server
#      (skipped if already there)
#   3. writes a `Host ea-audit` block into ~/.ssh/config pointing at the key
#   4. verifies with a non-interactive login and prints what to tell Claude
#
# Override with environment variables:
#   SERVER_HOST (45.32.150.96)  SERVER_USER (root)  SSH_ALIAS (ea-audit)
#   JUMP_HOST (empty; e.g. root@185.92.222.217 if port 22 is ever closed)

set -euo pipefail

SERVER_HOST=${SERVER_HOST:-45.32.150.96}
SERVER_USER=${SERVER_USER:-root}
SSH_ALIAS=${SSH_ALIAS:-ea-audit}
JUMP_HOST=${JUMP_HOST:-}
KEY=$HOME/.ssh/ea-audit-claude
CONFIG=$HOME/.ssh/config
COMMENT="claude-code@$(hostname)"

say()  { printf '\033[1;34m[access]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[access]\033[0m %s\n' "$*" >&2; }
die()  { printf '\033[1;31m[access] %s\033[0m\n' "$*" >&2; exit 1; }

jump_opt() { [ -n "$JUMP_HOST" ] && printf -- '-J %s' "$JUMP_HOST" || true; }

# Non-interactive login with the dedicated key only — what Claude Code will do.
test_access() {
  # shellcheck disable=SC2046
  ssh -i "$KEY" -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=20 \
      -o StrictHostKeyChecking=accept-new $(jump_opt) \
      "$SERVER_USER@$SERVER_HOST" 'printf "%s as %s — " "$(hostname)" "$(id -un)"; uptime -p'
}

cmd_test() {
  [ -f "$KEY" ] || die "no key at $KEY — run without --test first"
  say "testing $SSH_ALIAS ($SERVER_USER@$SERVER_HOST) with $KEY"
  if test_access; then say "OK — Claude Code can use: ssh $SSH_ALIAS"; else die "the key is not accepted; run the script without --test to (re)install it"; fi
}

cmd_revoke() {
  [ -f "$KEY.pub" ] || die "no key at $KEY.pub — nothing to revoke"
  local pub; pub=$(cut -d' ' -f1,2 < "$KEY.pub")
  say "removing the key from $SERVER_USER@$SERVER_HOST:~/.ssh/authorized_keys (password prompt is the server's)"
  # shellcheck disable=SC2046
  ssh -o StrictHostKeyChecking=accept-new $(jump_opt) "$SERVER_USER@$SERVER_HOST" \
      "grep -vF '$pub' ~/.ssh/authorized_keys > ~/.ssh/authorized_keys.new && cat ~/.ssh/authorized_keys.new > ~/.ssh/authorized_keys && rm -f ~/.ssh/authorized_keys.new && echo 'server: key removed'"
  rm -f "$KEY" "$KEY.pub"
  say "local key deleted; the 'Host $SSH_ALIAS' block in $CONFIG is left in place (harmless without the key)"
}

cmd_setup() {
  mkdir -p "$HOME/.ssh" && chmod 700 "$HOME/.ssh"

  # 1. key
  if [ -f "$KEY" ]; then
    say "key already exists: $KEY"
  else
    say "creating $KEY"
    ssh-keygen -t ed25519 -N "" -C "$COMMENT" -f "$KEY" -q
  fi
  local pub; pub=$(cut -d' ' -f1,2 < "$KEY.pub")

  # 2. install on the server — the only step that can prompt for the password
  say "installing the public key on $SERVER_USER@$SERVER_HOST (enter the root password if asked — it never leaves this terminal)"
  # shellcheck disable=SC2046
  ssh -o StrictHostKeyChecking=accept-new $(jump_opt) "$SERVER_USER@$SERVER_HOST" \
      "mkdir -p ~/.ssh && chmod 700 ~/.ssh && touch ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys
       if grep -qF '$pub' ~/.ssh/authorized_keys; then echo 'server: key already authorised'
       else printf '%s\n' '$pub $COMMENT' >> ~/.ssh/authorized_keys && echo 'server: key added'; fi" \
    || die "could not install the key (wrong password, or the server unreachable)"

  # 3. ~/.ssh/config alias, written once
  touch "$CONFIG" && chmod 600 "$CONFIG"
  if grep -qE "^Host[[:space:]]+$SSH_ALIAS([[:space:]]|\$)" "$CONFIG"; then
    say "$CONFIG already has a 'Host $SSH_ALIAS' block — leaving it as it is"
  else
    say "adding 'Host $SSH_ALIAS' to $CONFIG"
    {
      printf '\n# AuditISA server, for Claude Code — added by deploy/grant-claude-ssh-access.sh\n'
      printf 'Host %s\n    HostName %s\n    User %s\n    IdentityFile %s\n    IdentitiesOnly yes\n    ServerAliveInterval 30\n' \
        "$SSH_ALIAS" "$SERVER_HOST" "$SERVER_USER" "$KEY"
      [ -n "$JUMP_HOST" ] && printf '    ProxyJump %s\n' "$JUMP_HOST"
    } >> "$CONFIG"
  fi

  # 4. verify the way an agent will use it: no prompt, no agent, this key only
  say "verifying a non-interactive login"
  test_access || die "the login still fails — check the server's sshd allows PubkeyAuthentication for $SERVER_USER"

  cat <<EOF

Done. Tell Claude Code:

    "The server is reachable as 'ssh $SSH_ALIAS' (key $KEY)."

It can now run, for example:
    ssh $SSH_ALIAS 'deploy-ea-audit status'
    ssh $SSH_ALIAS 'systemctl is-active ea-audit ea-audit-dev'

To take the access away again:  $0 --revoke
EOF
}

case "${1:-}" in
  "")        cmd_setup ;;
  --test)    cmd_test ;;
  --revoke)  cmd_revoke ;;
  *)         sed -n '2,24p' "$0"; exit 64 ;;
esac
