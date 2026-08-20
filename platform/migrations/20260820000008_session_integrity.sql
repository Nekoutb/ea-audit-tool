-- Phase 1: a session must stop being authoritative when the account behind it
-- changes.
--
-- role, tenantId, isSuper and mustChangePassword live only in the JWT, so a
-- demoted or removed user kept their authority until the token expired, and
-- setting must_change_password on a live session did nothing. The token is now
-- re-checked against the row; these columns are what it checks against.

-- Up Migration

-- Bumped when the CREDENTIAL is void — the password changed, or an operator
-- revoked the sessions. A token minted against an older value is refused
-- outright. Drift in role or language is NOT a bump: a demotion refreshes the
-- token, it does not log the person out mid-sentence.
ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 1;

-- Suspend an account without deleting the rows signoff and activity_log
-- reference. A disabled user cannot hold a session or obtain one.
ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

COMMENT ON COLUMN app_user.session_version IS
  'Incremented when the credential is void (password change, forced revoke). '
  'A JWT carrying an older value is refused. See lib/session-guard.ts.';
COMMENT ON COLUMN app_user.disabled_at IS
  'Set to suspend an account while keeping its history intact.';

-- The bump is a trigger, not application code, so no future
-- "UPDATE app_user SET password_hash = ..." can forget it — the same reasoning
-- migration 20260820000005 applies to activity_log.
CREATE OR REPLACE FUNCTION bump_session_version() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF NEW.password_hash IS DISTINCT FROM OLD.password_hash THEN
    NEW.session_version := OLD.session_version + 1;
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS trg_bump_session_version ON app_user;
CREATE TRIGGER trg_bump_session_version
  BEFORE UPDATE ON app_user
  FOR EACH ROW EXECUTE FUNCTION bump_session_version();

-- Failed sign-ins. Global, like app_user — there is no tenant to attribute a
-- failure to, since the email may not belong to one, and activity_log cannot
-- hold these at all: recordActivity() opens with requireTenant() and
-- activity_log.tenant_id is NOT NULL under FORCE row-level security.
CREATE TABLE IF NOT EXISTS login_attempt (
  id          bigserial PRIMARY KEY,
  email       text        NOT NULL,
  ip          inet,
  successful  boolean     NOT NULL,
  at          timestamptz NOT NULL DEFAULT now()
);

-- The throttle asks one question: how many failures since this pair last
-- succeeded. Both indexes serve that scan.
CREATE INDEX IF NOT EXISTS login_attempt_email_at_idx ON login_attempt (lower(email), at DESC);
CREATE INDEX IF NOT EXISTS login_attempt_email_ip_at_idx ON login_attempt (lower(email), ip, at DESC);

COMMENT ON TABLE login_attempt IS
  'Failed and successful sign-ins, for throttling. Not audit evidence — it is '
  'pruned; the audit trail is activity_log.';

-- The app role writes these itself, so grant explicitly: db/create-app-role.sql
-- grants ON ALL TABLES as a one-shot snapshot taken before this table existed.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ea_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, DELETE ON login_attempt TO ea_app';
    EXECUTE 'GRANT USAGE, SELECT ON SEQUENCE login_attempt_id_seq TO ea_app';
  END IF;
END $$;

-- Down Migration

DROP TRIGGER IF EXISTS trg_bump_session_version ON app_user;
DROP FUNCTION IF EXISTS bump_session_version();
DROP TABLE IF EXISTS login_attempt;
ALTER TABLE app_user DROP COLUMN IF EXISTS session_version;
ALTER TABLE app_user DROP COLUMN IF EXISTS disabled_at;
