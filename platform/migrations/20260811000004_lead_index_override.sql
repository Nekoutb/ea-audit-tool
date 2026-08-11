-- Per-client overrides of the embedded lead-schedule index taxonomy: the
-- analyzer auto-assigns an index (account type + class follow from it) to each
-- account-class prefix; the user's corrections persist here.

-- Up Migration

CREATE TABLE client_lead_index_override (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  client_id      uuid NOT NULL REFERENCES client (id) ON DELETE CASCADE,
  account_prefix text NOT NULL CHECK (account_prefix ~ '^[0-9]{1,8}$'),
  index_code     text NOT NULL,
  created_by     uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, account_prefix)
);

CREATE INDEX client_lead_index_override_idx ON client_lead_index_override (tenant_id, client_id);

DO $$
BEGIN
  EXECUTE 'ALTER TABLE client_lead_index_override ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE client_lead_index_override FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON client_lead_index_override';
  EXECUTE 'CREATE POLICY tenant_isolation ON client_lead_index_override
             USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)
             WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)';
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON client_lead_index_override TO ea_app;

-- Down Migration

DROP TABLE IF EXISTS client_lead_index_override;
