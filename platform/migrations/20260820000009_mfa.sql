-- Phase 1: second factor.
--
-- The secret is stored encrypted, not bare. A TOTP secret is symmetric — anyone
-- holding it can mint valid codes for ever — so a database copy would otherwise
-- defeat the factor it exists to add. Encryption is AES-256-GCM under a key
-- derived from AUTH_SECRET, which lives in /opt/ea-audit/.env and not in the
-- database, so a dump alone is not enough.

-- Up Migration

ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS totp_secret text,
  ADD COLUMN IF NOT EXISTS totp_enrolled_at timestamptz;

COMMENT ON COLUMN app_user.totp_secret IS
  'AES-256-GCM ciphertext of the base32 TOTP secret; see lib/mfa.ts. Never the '
  'bare secret. NULL until enrolment is confirmed by a working code.';
COMMENT ON COLUMN app_user.totp_enrolled_at IS
  'Set when a first valid code proved the authenticator was configured. A '
  'secret present with this NULL is an abandoned enrolment and is not enforced.';

-- Single-use recovery codes, hashed like passwords: losing a phone must not
-- mean losing the audit file, and an operator resetting the factor by hand is
-- the weakest link in any MFA deployment.
CREATE TABLE IF NOT EXISTS mfa_recovery_code (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id  uuid NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  code_hash text NOT NULL,
  used_at  timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS mfa_recovery_code_user_idx ON mfa_recovery_code (user_id) WHERE used_at IS NULL;

COMMENT ON TABLE mfa_recovery_code IS
  'One-time codes shown once at enrolment. Hashed, and marked used rather than '
  'deleted so a reviewer can see one was spent.';

-- The app role writes these itself; db/create-app-role.sql granted ON ALL
-- TABLES as a snapshot taken before this table existed.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ea_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON mfa_recovery_code TO ea_app';
  END IF;
END $$;

-- Down Migration

DROP TABLE IF EXISTS mfa_recovery_code;
ALTER TABLE app_user DROP COLUMN IF EXISTS totp_secret;
ALTER TABLE app_user DROP COLUMN IF EXISTS totp_enrolled_at;
