-- F070 (firm decision 2026-10-27): the email domains an engagement-team
-- invitation may be sent to.
--
-- Held on the firm (tenant) row, as the retention period is: a list of bare
-- domains, lower-case, e.g. {eca.com, eca-cm.com}. Matching is exact and
-- case-insensitive on the part after the '@'; a subdomain (audit.eca.com) does
-- NOT match its parent (eca.com) unless it is listed itself. An empty list
-- keeps the behaviour before the rule: any address may be invited. Client
-- portal contacts are not engagement-team members and are not subject to it.
--
-- Reversible: the down migration drops the column.

-- Up Migration

ALTER TABLE tenant
  ADD COLUMN IF NOT EXISTS allowed_email_domains text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN tenant.allowed_email_domains IS
  'Email domains an engagement-team invitation may go to (F070). Exact, '
  'case-insensitive match on the domain; subdomains do not match. Empty = no restriction.';

-- Down Migration

ALTER TABLE tenant DROP COLUMN IF EXISTS allowed_email_domains;
