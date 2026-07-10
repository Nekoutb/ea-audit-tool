-- Build Phase 4: execution/fieldwork — program-step execution, evidence,
-- findings routing (B4/B5/C1/revise-approach), misstatements, control tests,
-- section conclusions. Tenant-scoped tables added to db/rls.sql.

-- Up Migration

ALTER TABLE program_step ADD COLUMN conclusion text;
ALTER TABLE program_step ADD COLUMN completed_by uuid REFERENCES app_user (id) ON DELETE SET NULL;
ALTER TABLE program_step ADD COLUMN completed_at timestamptz;

-- Evidence attached to a program step: an uploaded file, an imported dataset,
-- or an existing document (spec §6.2).
CREATE TABLE evidence (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id   uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  program_step_id uuid NOT NULL REFERENCES program_step (id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('file', 'dataset', 'document')),
  title           text NOT NULL,
  mime            text,
  content         bytea,
  dataset_id      uuid REFERENCES sub_ledger_dataset (id) ON DELETE SET NULL,
  document_id     uuid REFERENCES document (id) ON DELETE SET NULL,
  created_by      uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX evidence_step_idx ON evidence (tenant_id, program_step_id);

-- B4 significant matters and C1 management-letter points (spec §8.3): every
-- finding routes to exactly one destination and keeps its origin backlink.
CREATE TABLE finding (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id   uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  file_item_id    uuid REFERENCES file_item (id) ON DELETE SET NULL,
  program_step_id uuid REFERENCES program_step (id) ON DELETE SET NULL,
  route           text NOT NULL CHECK (route IN ('b4', 'c1')),
  title           text NOT NULL,
  detail          text,
  status          text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cleared')),
  response        text,
  cleared_by      uuid REFERENCES app_user (id) ON DELETE SET NULL,
  cleared_at      timestamptz,
  created_by      uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX finding_idx ON finding (tenant_id, engagement_id, route, status);

-- B5 misstatements (ISA 450, spec §6.2): below clearly-trivial is stored as
-- trivial (excluded from accumulation) with the "not indicative" confirmation.
CREATE TABLE misstatement (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id   uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  file_item_id    uuid REFERENCES file_item (id) ON DELETE SET NULL,
  program_step_id uuid REFERENCES program_step (id) ON DELETE SET NULL,
  description     text NOT NULL,
  accounts        text,
  amount          numeric(18, 0) NOT NULL,
  mtype           text NOT NULL CHECK (mtype IN ('factual', 'judgmental', 'projected', 'classification', 'disclosure')),
  corrected       boolean NOT NULL DEFAULT false,
  trivial         boolean NOT NULL DEFAULT false,
  created_by      uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX misstatement_idx ON misstatement (tenant_id, engagement_id, trivial);

-- Control tests: a deviation FORCES a decision (spec §6.2).
CREATE TABLE control_test (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id     uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  file_item_id      uuid NOT NULL REFERENCES file_item (id) ON DELETE CASCADE,
  description       text NOT NULL,
  result            text NOT NULL CHECK (result IN ('effective', 'deviation')),
  deviation_decision text CHECK (deviation_decision IN ('extend', 'abandon', 'deficiency')),
  note              text,
  created_by        uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  CHECK (result = 'effective' OR deviation_decision IS NOT NULL)
);
CREATE INDEX control_test_idx ON control_test (tenant_id, file_item_id);

-- Revise-approach log per section (spec §8.4).
CREATE TABLE revise_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  file_item_id  uuid REFERENCES file_item (id) ON DELETE SET NULL,
  description   text NOT NULL,
  risk_id       uuid REFERENCES risk (id) ON DELETE SET NULL,
  created_by    uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX revise_log_idx ON revise_log (tenant_id, engagement_id);

-- Section conclusion block (spec §6.1/§6.3): prepared → reviewed; partner
-- review additionally required when the section carries a significant risk.
CREATE TABLE section_conclusion (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id           uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id       uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  file_item_id        uuid NOT NULL UNIQUE REFERENCES file_item (id) ON DELETE CASCADE,
  conclusion          text NOT NULL,
  objectives_achieved boolean NOT NULL,
  prepared_by         uuid REFERENCES app_user (id) ON DELETE SET NULL,
  prepared_at         timestamptz NOT NULL DEFAULT now(),
  reviewed_by         uuid REFERENCES app_user (id) ON DELETE SET NULL,
  reviewed_at         timestamptz,
  partner_reviewed_by uuid REFERENCES app_user (id) ON DELETE SET NULL,
  partner_reviewed_at timestamptz
);
CREATE INDEX section_conclusion_idx ON section_conclusion (tenant_id, engagement_id);

-- Mid-audit risk additions (spec §8.4): dated, partner re-approval required.
ALTER TABLE risk ADD COLUMN added_after_planning boolean NOT NULL DEFAULT false;
ALTER TABLE risk ADD COLUMN addition_approved_by uuid REFERENCES app_user (id) ON DELETE SET NULL;

-- Down Migration

ALTER TABLE risk DROP COLUMN IF EXISTS addition_approved_by;
ALTER TABLE risk DROP COLUMN IF EXISTS added_after_planning;
DROP TABLE IF EXISTS section_conclusion;
DROP TABLE IF EXISTS revise_log;
DROP TABLE IF EXISTS control_test;
DROP TABLE IF EXISTS misstatement;
DROP TABLE IF EXISTS finding;
DROP TABLE IF EXISTS evidence;
ALTER TABLE program_step DROP COLUMN IF EXISTS completed_at;
ALTER TABLE program_step DROP COLUMN IF EXISTS completed_by;
ALTER TABLE program_step DROP COLUMN IF EXISTS conclusion;
