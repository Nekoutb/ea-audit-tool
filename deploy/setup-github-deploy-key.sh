#!/usr/bin/env bash
# setup-github-deploy-key.sh — the server side of docs/github-deploy-setup.md,
# as one idempotent script. Run as root ON THE SERVER:
#
#   ssh root@<server> 'bash -s' < deploy/setup-github-deploy-key.sh
#
# It:
#   1. installs the forced-command wrapper /usr/local/sbin/deploy-ea-audit-ssh,
#      which lets the GitHub key run deploy-ea-audit and nothing else
#   2. creates the dedicated key /root/.ssh/github-deploy-ea-audit (if missing)
#   3. adds its public half to /root/.ssh/authorized_keys, restricted to the wrapper
#   4. prints what to put in the repository secrets — the PRIVATE key is printed
#      last, on purpose, so the shell that ran this is the only place it appears:
#
#        ssh root@<server> cat /root/.ssh/github-deploy-ea-audit | gh secret set DEPLOY_SSH_KEY
#
# It does not touch the deploy script itself (install that separately:
# install -m 755 deploy/deploy-ea-audit.sh /usr/local/sbin/deploy-ea-audit).

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

# 4. what the repository needs
cat <<EOF

Repository secrets (Settings → Secrets and variables → Actions), or with gh:

  gh secret set DEPLOY_HOST        --body "$(hostname -I | awk '{print $1}')"
  gh secret set DEPLOY_USER        --body root
  ssh-keyscan -t ed25519 $(hostname -I | awk '{print $1}') | gh secret set DEPLOY_KNOWN_HOSTS
  ssh root@$(hostname -I | awk '{print $1}') cat $KEY | gh secret set DEPLOY_SSH_KEY

Self-test of the restricted key from this server (should print the status table):
  ssh -i $KEY -o IdentitiesOnly=yes root@127.0.0.1 -- deploy-ea-audit status
EOF
