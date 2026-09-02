#!/usr/bin/env bash
# One-time creation of the dev/staging instance on the production server.
# Idempotent: re-running updates the unit and vhost and leaves an existing
# shared/.env alone. Reads production's .env to derive the dev one; values are
# never printed. Run as root: bash setup-dev-instance.sh
set -euo pipefail
ROOT=/opt/ea-audit-dev
PROD_ENV=${PROD_ENV:-/opt/ea-audit-prod/shared/.env}   # production on the release layout; the legacy copy is the fallback
[ -f "$PROD_ENV" ] || PROD_ENV=/opt/ea-audit/.env
HERE=$(cd "$(dirname "$0")" && pwd)

install -d -o deploy -g deploy -m 755 "$ROOT" "$ROOT/releases" "$ROOT/logs"
install -d -o deploy -g deploy -m 750 "$ROOT/shared"
touch "$ROOT/deployed-shas.log"; chown deploy:deploy "$ROOT/deployed-shas.log"

if [ ! -f "$ROOT/shared/.env" ]; then
  [ -f "$PROD_ENV" ] || { echo "no $PROD_ENV to derive from" >&2; exit 1; }
  # Same MAIL_* identity (harmless: without MAILERSEND_API_KEY every send is a
  # stub), same AUTH_TRUST_HOST; everything that points somewhere is re-pointed
  # at dev, and the session secret is fresh so a production cookie is worthless here.
  umask 077
  {
    echo "# dev.auditisa.com — derived from production's .env on $(date -u +%F). Never a MailerSend key here."
    grep -E '^(AUTH_TRUST_HOST|MAIL_DOMAIN|MAIL_FROM_NAME|MAIL_FROM)=' "$PROD_ENV"
    grep -E '^APP_DATABASE_URL=' "$PROD_ENV" | sed -E 's#/ea_audit([^_[:alnum:]]|$)#/ea_audit_dev\1#'
    echo "AUTH_SECRET=$(openssl rand -base64 32)"
    echo "AUTH_URL=https://dev.auditisa.com"
    echo "APP_URL=https://dev.auditisa.com"
    echo "PG_POOL_MAX=5"
    echo "PG_APPLICATION_NAME=ea-audit-dev"
  } > "$ROOT/shared/.env"
  chown deploy:deploy "$ROOT/shared/.env"; chmod 600 "$ROOT/shared/.env"
  echo "wrote $ROOT/shared/.env (variables: $(grep -vE '^#' "$ROOT/shared/.env" | cut -d= -f1 | tr '\n' ' '))"
  # prove the derived URL reaches the dev database as the RLS-bound role
  url=$(sed -n 's/^APP_DATABASE_URL=//p' "$ROOT/shared/.env" | tr -d "\"'\r")
  got=$(psql "$url" -Atc "SELECT 'db='||current_database()||' role='||current_user" 2>&1 || true)
  if [ "$got" != "db=ea_audit_dev role=ea_app" ]; then
    rm -f "$ROOT/shared/.env"; echo "derived APP_DATABASE_URL is wrong ($got) — dev env discarded" >&2; exit 1
  fi
  echo "dev APP_DATABASE_URL verified: $got"
fi
grep -q MAILERSEND_API_KEY "$ROOT/shared/.env" && { echo "refusing: a MailerSend key is in the dev env" >&2; exit 1; }

install -m 644 "$HERE/systemd/ea-audit-dev.service" /etc/systemd/system/ea-audit-dev.service
systemctl daemon-reload
install -m 644 "$HERE/apache/dev.auditisa.com.conf" /etc/apache2/sites-available/dev.auditisa.com.conf
a2ensite -q dev.auditisa.com
apache2ctl configtest
install -m 755 "$HERE/deploy-ea-audit.sh" /usr/local/sbin/deploy-ea-audit
echo "unit, vhost (enabled, not yet reloaded) and /usr/local/sbin/deploy-ea-audit installed"
