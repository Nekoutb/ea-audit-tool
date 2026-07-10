-- Build Phase 8: OHADA legal module (spec §12) — F1 statutory deadlines,
-- F2 conventions réglementées, F4 procédure d'alerte, F5 faits délictueux.
-- (F3/F6/F7/F8 reuse documents + completion_record; no dedicated tables.)

-- Up Migration

-- F1: auto-generated statutory deadlines with countdowns (spec §12.1).
CREATE TABLE statutory_deadline (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  key           text NOT NULL,
  due_date      date NOT NULL,
  basis         text NOT NULL,
  done          boolean NOT NULL DEFAULT false,
  done_at       timestamptz,
  UNIQUE (engagement_id, key)
);
CREATE INDEX statutory_deadline_idx ON statutory_deadline (tenant_id, engagement_id, due_date);

-- F2: register of conventions réglementées (spec §12.2, arts. 438-448 /
-- 350-353 / 853.14). Board authorization applies to SA only.
CREATE TABLE convention (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id  uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  parties        text NOT NULL,
  interested     text NOT NULL,
  capacity       text NOT NULL CHECK (capacity IN
                  ('director', 'gerant', 'shareholder10', 'president', 'dirigeant', 'controlling')),
  nature         text NOT NULL,
  terms          text NOT NULL DEFAULT '',
  amounts_period numeric(18, 0),
  continuing     boolean NOT NULL DEFAULT false,
  board_auth_ref text,
  notified_at    date,
  created_by     uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX convention_idx ON convention (tenant_id, engagement_id);

-- F4: procédure d'alerte state machine (spec §12.4, arts. 150-156).
CREATE TABLE alerte (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id  uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  variant        text NOT NULL CHECK (variant IN ('sa', 'non_sa')),
  stage          text NOT NULL DEFAULT 'request_sent',
  stage_deadline date,
  discontinued_at timestamptz,
  started_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid REFERENCES app_user (id) ON DELETE SET NULL
);
CREATE INDEX alerte_idx ON alerte (tenant_id, engagement_id);

CREATE TABLE alerte_event (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  alerte_id   uuid NOT NULL REFERENCES alerte (id) ON DELETE CASCADE,
  stage       text NOT NULL,
  note        text NOT NULL DEFAULT '',
  document_id uuid REFERENCES document (id) ON DELETE SET NULL,
  created_by  uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX alerte_event_idx ON alerte_event (tenant_id, alerte_id);

-- F5: révélation des faits délictueux — strictly access-controlled log
-- (partner-only enforcement in the application layer; spec §12.5 item 6).
CREATE TABLE fait_delictueux (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  description   text NOT NULL,
  document_id   uuid REFERENCES document (id) ON DELETE SET NULL,
  revealed_at   timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES app_user (id) ON DELETE SET NULL
);
CREATE INDEX fait_delictueux_idx ON fait_delictueux (tenant_id, engagement_id);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['statutory_deadline', 'convention', 'alerte', 'alerte_event', 'fait_delictueux']
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

DROP TABLE IF EXISTS fait_delictueux;
DROP TABLE IF EXISTS alerte_event;
DROP TABLE IF EXISTS alerte;
DROP TABLE IF EXISTS convention;
DROP TABLE IF EXISTS statutory_deadline;
