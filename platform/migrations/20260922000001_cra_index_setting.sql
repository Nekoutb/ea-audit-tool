-- Per-account settings of the combined risk assessment that are not an
-- assertion cell: today the key-item threshold — the amount at or above which
-- an item of the account is examined in full rather than sampled. Set on S3.1
-- beside the account's CRA; read by the tests-of-details sampling. Absent, the
-- tolerable error applies.

-- Up Migration

CREATE TABLE IF NOT EXISTS cra_index_setting (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id      uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  index_code         text NOT NULL,
  key_item_threshold numeric(30,2) CHECK (key_item_threshold IS NULL OR key_item_threshold > 0),
  updated_by         uuid REFERENCES app_user (id) ON DELETE SET NULL,
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, index_code)
);
CREATE INDEX IF NOT EXISTS cra_index_setting_idx ON cra_index_setting (tenant_id, engagement_id);

ALTER TABLE cra_index_setting ENABLE ROW LEVEL SECURITY;
ALTER TABLE cra_index_setting FORCE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON cra_index_setting
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON cra_index_setting TO ea_app;

-- An archived engagement is frozen: the same guard every engagement-scoped
-- table carries (see 20260820000002_archive_immutability).
DROP TRIGGER IF EXISTS cra_index_setting_archive_guard ON cra_index_setting;
CREATE TRIGGER cra_index_setting_archive_guard
  BEFORE INSERT OR UPDATE OR DELETE ON cra_index_setting
  FOR EACH ROW EXECUTE FUNCTION reject_archived_write();

-- Down Migration

DROP TABLE IF EXISTS cra_index_setting;
