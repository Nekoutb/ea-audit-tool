-- The Risk Console: inherent risk factors and the FS-level pervasive note on
-- each risk (ISA 315 ¶31(a), ¶30), and the linkage table that carries a risk
-- into the financial statements — lead-schedule index + assertions — which the
-- P6.2 significance grid derives relevant assertions from (¶12(h), ¶12(k)).

-- Up Migration

ALTER TABLE risk ADD COLUMN IF NOT EXISTS inherent_factors text[] NOT NULL DEFAULT '{}';
ALTER TABLE risk ADD COLUMN IF NOT EXISTS fs_note text;

CREATE TABLE IF NOT EXISTS risk_lead_index (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  risk_id       uuid NOT NULL REFERENCES risk (id) ON DELETE CASCADE,
  index_code    text NOT NULL,
  assertions    text[] NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (risk_id, index_code)
);
CREATE INDEX IF NOT EXISTS risk_lead_index_idx ON risk_lead_index (tenant_id, risk_id);

DO $$
BEGIN
  EXECUTE 'ALTER TABLE risk_lead_index ENABLE ROW LEVEL SECURITY';
  EXECUTE 'CREATE POLICY tenant_isolation ON risk_lead_index
             USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)
             WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Down Migration

DROP TABLE IF EXISTS risk_lead_index;
ALTER TABLE risk DROP COLUMN IF EXISTS fs_note;
ALTER TABLE risk DROP COLUMN IF EXISTS inherent_factors;
