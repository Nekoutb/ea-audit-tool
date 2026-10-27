-- EQR eligibility (F005) and the default sign-off matrix (F002), decisions
-- of the firm of 2026-10-27.
--
-- team_member.eqr_declared_at / eqr_declared_by: the objectivity declaration
-- recorded when someone is appointed engagement quality reviewer (team role
-- eqr_reviewer) — who ticked it and when. lib/team.ts refuses the appointment
-- without it ('eqr-declaration-required'); the other eligibility rules (firm
-- rank, not on the team otherwise, ISQM 2 ¶20 cooling-off) are checked there
-- and need no column. Existing EQR seats keep NULL: they were appointed before
-- the declaration existed.
--
-- firm_signoff_policy.require_partner_on: the column default follows the new
-- default matrix (lib/signoff-policy.ts DEFAULT_REQUIRE_PARTNER_ON). Stored
-- rows are not rewritten: the application unites a stored list with the
-- matrix's partner sign-offs, so no firm loses one.

-- Up Migration

ALTER TABLE team_member
  ADD COLUMN IF NOT EXISTS eqr_declared_at timestamptz,
  ADD COLUMN IF NOT EXISTS eqr_declared_by uuid REFERENCES app_user (id) ON DELETE SET NULL;

ALTER TABLE firm_signoff_policy
  ALTER COLUMN require_partner_on SET DEFAULT ARRAY[
    'P1.1', 'P2.2', 'P5.2', 'P7.2', 'S3.1', 'S6.1', 'S6.2', 'C1.1',
    'C5.1', 'C5.2', 'C5.3', 'C5.4', 'C5.5', 'C5.6', 'C5.7', 'C5.8', 'C5.9', 'C5.10', 'C6.2'
  ]::text[];

-- Down Migration

ALTER TABLE firm_signoff_policy
  ALTER COLUMN require_partner_on SET DEFAULT ARRAY['P1.1', 'P2.2', 'P5.2', 'P7.2', 'S3.1', 'S6.1', 'S6.2', 'C1.1']::text[];

ALTER TABLE team_member
  DROP COLUMN IF EXISTS eqr_declared_by,
  DROP COLUMN IF EXISTS eqr_declared_at;
