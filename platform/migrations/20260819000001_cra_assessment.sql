-- The Combined Risk Assessment proper: one cell per relevant assertion of each
-- significant account (lead index) holding the separately-assessed inherent
-- risk (lower/higher) and control risk (rely/not_rely). The CRA level itself
-- (minimal/low/moderate/high) is never stored — it is derived from the two
-- assessments at read time so it cannot diverge from them.

-- Up Migration

CREATE TABLE IF NOT EXISTS cra_assessment (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  index_code    text NOT NULL,
  assertion     text NOT NULL CHECK (assertion IN ('C', 'E', 'A', 'V', 'P')),
  relevant      boolean NOT NULL DEFAULT true,
  ir            text CHECK (ir IN ('lower', 'higher')),
  ir_basis      text,
  cr            text CHECK (cr IN ('rely', 'not_rely')),
  cr_basis     text,
  updated_by    uuid REFERENCES app_user (id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, index_code, assertion)
);
CREATE INDEX IF NOT EXISTS cra_assessment_idx ON cra_assessment (tenant_id, engagement_id);

ALTER TABLE cra_assessment ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON cra_assessment
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON cra_assessment TO ea_app;

-- Down Migration

DROP TABLE IF EXISTS cra_assessment;
