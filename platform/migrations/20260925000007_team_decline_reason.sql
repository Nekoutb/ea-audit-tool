-- A member who declines an engagement says why (UAT B130): the reason is shown
-- on the team page and in the trail, and reaches the engagement partners.
ALTER TABLE team_member ADD COLUMN IF NOT EXISTS decline_reason text;
