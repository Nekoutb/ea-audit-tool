-- Setting a password without ever being sent one.
--
-- Onboarding worked by generating a temporary password, emailing it, and
-- holding the first session on the change-password screen. That means a
-- usable credential travels through a mailbox, and the person who created the
-- account is told about a password they neither chose nor know — which is
-- exactly the confusion this replaces. An invitation now carries a one-time
-- token instead: the recipient opens it, chooses their own password, and only
-- then signs in.
--
-- Deliberately NO tenant_id and therefore no row-level security, for the same
-- reason as login_attempt and mfa_recovery_code: this row is read before any
-- session exists, so there is no app.tenant_id to match and an RLS policy
-- would hide every row from the only code path that needs it. It is reachable
-- solely by presenting the token, and the token is stored as a SHA-256 digest
-- so the table is useless to anyone who reads it.

CREATE TABLE IF NOT EXISTS user_invite (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  token_hash    text NOT NULL UNIQUE,
  -- where to land once the password is set; a plain path, never a URL
  next_path     text,
  created_by    uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  used_at       timestamptz
);

-- One live invitation per person: issuing a new one supersedes the old, so a
-- forwarded link from three weeks ago cannot still set somebody's password.
CREATE UNIQUE INDEX IF NOT EXISTS user_invite_one_live_idx
  ON user_invite (user_id) WHERE used_at IS NULL;

CREATE INDEX IF NOT EXISTS user_invite_expiry_idx ON user_invite (expires_at) WHERE used_at IS NULL;

-- The app reads an invitation by token and marks it used. It never deletes:
-- a spent invitation is the record that this account was set up this way.
GRANT SELECT, INSERT, UPDATE ON user_invite TO ea_app;
