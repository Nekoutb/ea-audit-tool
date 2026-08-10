-- Independence auto-reminders + engagement invitations.
--
-- independence_confirmation gains created_at so the 24-hour reminder cadence
-- has an anchor (existing rows anchor at migration time — their reminders were
-- manual anyway). team_member gains an invitation lifecycle: members added by
-- email start as 'invited' and accept or decline the engagement from the
-- console; existing rows are grandfathered as accepted.

-- Up Migration

ALTER TABLE independence_confirmation
  ADD COLUMN created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE team_member
  ADD COLUMN status text NOT NULL DEFAULT 'accepted'
    CHECK (status IN ('invited', 'accepted', 'declined')),
  ADD COLUMN invited_at timestamptz,
  ADD COLUMN responded_at timestamptz;

-- Down Migration

ALTER TABLE team_member DROP COLUMN IF EXISTS responded_at;
ALTER TABLE team_member DROP COLUMN IF EXISTS invited_at;
ALTER TABLE team_member DROP COLUMN IF EXISTS status;
ALTER TABLE independence_confirmation DROP COLUMN IF EXISTS created_at;
