-- The UAT workbook's answers: one row per tester per scenario.
--
-- Kept in the database rather than in a document so several people can test at
-- once without merging copies of a spreadsheet, and so "what did we actually
-- exercise before we went live?" survives the laptop it was typed on.
--
-- Scoped per USER as well as per firm: two testers working through the same
-- script must not overwrite each other, and a disagreement between them about
-- whether something passed is itself worth seeing.

CREATE TABLE IF NOT EXISTS uat_result (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  -- the scenario's stable key from lib/uat-scenarios.ts, not its wording
  scenario_key  text NOT NULL,
  status        text NOT NULL DEFAULT 'not_started'
                CHECK (status IN ('not_started', 'passed', 'failed', 'blocked')),
  -- what went wrong, in the tester's own words
  notes         text NOT NULL DEFAULT '',
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scenario_key)
);

CREATE INDEX IF NOT EXISTS uat_result_tenant_idx ON uat_result (tenant_id, scenario_key);

ALTER TABLE uat_result ENABLE ROW LEVEL SECURITY;
ALTER TABLE uat_result FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON uat_result;
CREATE POLICY tenant_isolation ON uat_result
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE ON uat_result TO ea_app;
