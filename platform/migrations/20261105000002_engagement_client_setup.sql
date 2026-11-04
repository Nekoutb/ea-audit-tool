-- F073-F076 (firm decisions 2026-10-27): client and engagement set-up.
--
-- client: how the entity is run and who regulates it (F074). Share capital and
-- the co-CAC flag already exist and move onto the record's form.
-- engagement: the planned report/AGM date (F073).
-- A client may now hold, for one fiscal year, a statutory audit AND a limited
-- review or a contribution audit (F075), so the "one engagement per client and
-- year" rule becomes "one per client, year and nature". Rows with no nature
-- count as statutory audits. No row changes.

-- Up Migration

ALTER TABLE client ADD COLUMN governance_mode text
  CHECK (governance_mode IN ('ca_pdg', 'ca_dg', 'administrateur_general', 'gerance'));
ALTER TABLE client ADD COLUMN regulator text;
ALTER TABLE engagement ADD COLUMN planned_agm_date date;

ALTER TABLE engagement DROP CONSTRAINT IF EXISTS engagement_client_id_fiscal_year_key;
CREATE UNIQUE INDEX engagement_client_year_nature_key
  ON engagement (client_id, fiscal_year, coalesce(nature, 'statutory_audit'));

-- Down Migration

-- Restoring the older rule fails, deliberately, if two natures now coexist for
-- one client and year: no engagement is ever deleted to make a rollback pass.
DROP INDEX engagement_client_year_nature_key;
ALTER TABLE engagement ADD CONSTRAINT engagement_client_id_fiscal_year_key UNIQUE (client_id, fiscal_year);
ALTER TABLE engagement DROP COLUMN planned_agm_date;
ALTER TABLE client DROP COLUMN regulator;
ALTER TABLE client DROP COLUMN governance_mode;
