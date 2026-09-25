-- The combined risk assessment keeps its history: when the inherent or control
-- risk of an assertion is reassessed (E6.8), the assessment it replaces is
-- copied here with the reason, the user and the time, so the original
-- judgement and its basis remain on the file (ISA 315 ¶37, ISA 230 ¶8) —
-- saveCraCell used to overwrite the row in place (UAT B22).

-- Up Migration

CREATE TABLE IF NOT EXISTS cra_assessment_history (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  index_code    text NOT NULL,
  assertion     text NOT NULL,
  ir            text,
  ir_basis      text,
  cr            text,
  cr_basis      text,
  -- the values that replaced the ones above
  new_ir        text,
  new_cr        text,
  reason        text,
  changed_by    uuid REFERENCES app_user (id) ON DELETE SET NULL,
  changed_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS cra_assessment_history_idx
  ON cra_assessment_history (tenant_id, engagement_id, index_code, assertion, changed_at);

ALTER TABLE cra_assessment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE cra_assessment_history FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON cra_assessment_history
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT ON cra_assessment_history TO ea_app;

-- An archived engagement is frozen: the same guard every engagement-scoped
-- table carries (see 20260820000002_archive_immutability).
DROP TRIGGER IF EXISTS cra_assessment_history_archive_guard ON cra_assessment_history;
CREATE TRIGGER cra_assessment_history_archive_guard
  BEFORE INSERT OR UPDATE OR DELETE ON cra_assessment_history
  FOR EACH ROW EXECUTE FUNCTION reject_archived_write();

-- Down Migration

DROP TABLE IF EXISTS cra_assessment_history;
