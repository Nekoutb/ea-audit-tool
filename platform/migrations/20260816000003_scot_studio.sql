-- SCOT Studio: significant classes of transactions as first-class records —
-- the SCOT itself (typed, linked to lead indexes, assignable), its
-- what-can-go-wrongs, the controls answering them, and the link that lets the
-- existing execution test log roll up per control. The operating conclusion is
-- never stored: it is derived from linked control_test rows at read time so it
-- cannot diverge from the deviation side-effects.

-- Up Migration

CREATE TABLE IF NOT EXISTS scot (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id    uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  name             text NOT NULL,
  description      text,
  transaction_type text NOT NULL DEFAULT 'routine'
                   CHECK (transaction_type IN ('routine', 'non_routine', 'estimation')),
  strategy         text NOT NULL DEFAULT 'substantive'
                   CHECK (strategy IN ('controls', 'substantive')),
  applications     text,
  assignee_user_id uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_by       uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, name)
);
CREATE INDEX IF NOT EXISTS scot_idx ON scot (tenant_id, engagement_id);

CREATE TABLE IF NOT EXISTS scot_index (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  scot_id     uuid NOT NULL REFERENCES scot (id) ON DELETE CASCADE,
  index_code  text NOT NULL,
  assertions  text[] NOT NULL DEFAULT '{}',
  UNIQUE (scot_id, index_code)
);
CREATE INDEX IF NOT EXISTS scot_index_idx ON scot_index (tenant_id, scot_id);

CREATE TABLE IF NOT EXISTS wcgw (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  scot_id     uuid NOT NULL REFERENCES scot (id) ON DELETE CASCADE,
  description text NOT NULL,
  assertions  text[] NOT NULL DEFAULT '{}',
  sort        int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS wcgw_idx ON wcgw (tenant_id, scot_id);

CREATE TABLE IF NOT EXISTS scot_control (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  scot_id              uuid NOT NULL REFERENCES scot (id) ON DELETE CASCADE,
  name                 text NOT NULL,
  owner                text,
  control_type         text NOT NULL DEFAULT 'manual'
                       CHECK (control_type IN ('manual', 'it_dependent', 'automated')),
  frequency            text,
  objective            text NOT NULL DEFAULT 'prevent'
                       CHECK (objective IN ('prevent', 'detect')),
  selected_for_testing boolean NOT NULL DEFAULT false,
  test_design          text,
  design_eval          text CHECK (design_eval IN ('effective', 'ineffective')),
  implemented          boolean,
  operating_notes      text,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS scot_control_idx ON scot_control (tenant_id, scot_id);

-- a control answers several WCGWs; tenant_id present so the RLS policy attaches
CREATE TABLE IF NOT EXISTS wcgw_control (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  wcgw_id    uuid NOT NULL REFERENCES wcgw (id) ON DELETE CASCADE,
  control_id uuid NOT NULL REFERENCES scot_control (id) ON DELETE CASCADE,
  UNIQUE (wcgw_id, control_id)
);
CREATE INDEX IF NOT EXISTS wcgw_control_idx ON wcgw_control (tenant_id, wcgw_id);

-- executed test evidence outlives its control: SET NULL, never CASCADE
ALTER TABLE control_test
  ADD COLUMN IF NOT EXISTS scot_control_id uuid REFERENCES scot_control (id) ON DELETE SET NULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['scot', 'scot_index', 'wcgw', 'scot_control', 'wcgw_control']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
    EXECUTE format('CREATE POLICY tenant_isolation ON %I
                      USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)
                      WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON %I TO ea_app', t);
  END LOOP;
END $$;

-- Down Migration

ALTER TABLE control_test DROP COLUMN IF EXISTS scot_control_id;
DROP TABLE IF EXISTS wcgw_control;
DROP TABLE IF EXISTS scot_control;
DROP TABLE IF EXISTS wcgw;
DROP TABLE IF EXISTS scot_index;
DROP TABLE IF EXISTS scot;
