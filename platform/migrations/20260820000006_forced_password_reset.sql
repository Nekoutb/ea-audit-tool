-- Up Migration

-- Phase 0 item 1: a temporary password must survive only until first sign-in.
-- Until now a firm admin created through the console kept their generated
-- password indefinitely, and the console handed it back in a query string.
-- The flag below lets the proxy hold such an account on the change-password
-- screen until it sets its own secret.
ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;

-- When the change happens, so we can evidence password age during an
-- inspection and later enforce a maximum age.
ALTER TABLE app_user
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;

COMMENT ON COLUMN app_user.must_change_password IS
  'Set when the account holds a system-generated temporary password. The proxy '
  'confines the session to /change-password until the user replaces it.';

-- Down Migration
ALTER TABLE app_user DROP COLUMN IF EXISTS must_change_password;
ALTER TABLE app_user DROP COLUMN IF EXISTS password_changed_at;
