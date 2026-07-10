-- Build Phase 2: acceptance & planning — structured forms, independence
-- campaigns, job administration, materiality, risk register, audit programs,
-- planning snapshot. All tenant-scoped (added to db/rls.sql).

-- Up Migration

-- 2.1 Hybrid structured-field framework: facts the linkage engine needs live
-- here; narrative stays in the Word document (DECISIONS.md, spec §9.4).
CREATE TABLE form_response (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  code          text NOT NULL,           -- file-index code, e.g. 'D3.1'
  field_key     text NOT NULL,
  value         jsonb NOT NULL,
  carried_forward boolean NOT NULL DEFAULT false,  -- rolled from prior year, awaiting confirm
  updated_by    uuid REFERENCES app_user (id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, code, field_key)
);
CREATE INDEX form_response_idx ON form_response (tenant_id, engagement_id, code);

-- D5.6 related-party register (structured — feeds conventions réglementées in Phase 8).
CREATE TABLE related_party (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  name          text NOT NULL,
  relationship  text NOT NULL,
  notes         text,
  carried_forward boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX related_party_idx ON related_party (tenant_id, engagement_id);

-- D5.7 accounting-estimates inventory (drives E390/Exxx.3 in later phases).
CREATE TABLE accounting_estimate (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  nature        text NOT NULL,
  method        text,
  assumptions   text,
  uncertainty   text,
  retro_review  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX accounting_estimate_idx ON accounting_estimate (tenant_id, engagement_id);

-- 2.3/2.4 Independence confirmation campaigns (spec §4.2).
CREATE TABLE independence_campaign (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  created_by    uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX independence_campaign_idx ON independence_campaign (tenant_id, engagement_id);

CREATE TABLE independence_confirmation (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  campaign_id    uuid NOT NULL REFERENCES independence_campaign (id) ON DELETE CASCADE,
  user_id        uuid NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  token          text NOT NULL UNIQUE,
  status         text NOT NULL DEFAULT 'sent'
                 CHECK (status IN ('sent', 'opened', 'completed', 'exception')),
  answers        jsonb,
  signature_name text,
  signed_at      timestamptz,
  reminder_count int NOT NULL DEFAULT 0,
  last_reminder_at timestamptz,
  -- Exceptions (any "yes") create a threat-and-safeguard record requiring
  -- partner disposition before the engagement can be accepted.
  disposition    text,
  disposition_by uuid REFERENCES app_user (id) ON DELETE SET NULL,
  disposition_at timestamptz,
  UNIQUE (campaign_id, user_id)
);
CREATE INDEX independence_confirmation_idx ON independence_confirmation (tenant_id, campaign_id);

-- 2.7 D6.1 job administration.
CREATE TABLE team_member (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  team_role     text NOT NULL
                CHECK (team_role IN ('partner', 'manager', 'senior', 'staff', 'eqr_reviewer')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, user_id)
);
CREATE INDEX team_member_idx ON team_member (tenant_id, engagement_id);

CREATE TABLE budget_line (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  grade         text NOT NULL,
  hours         numeric(8,1) NOT NULL CHECK (hours >= 0),
  UNIQUE (engagement_id, grade)
);
CREATE INDEX budget_line_idx ON budget_line (tenant_id, engagement_id);

CREATE TABLE pbc_item (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  title         text NOT NULL,
  status        text NOT NULL DEFAULT 'requested'
                CHECK (status IN ('requested', 'uploaded', 'accepted')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pbc_item_idx ON pbc_item (tenant_id, engagement_id);

-- 2.9/2.10 Materiality (ISA 320) — versioned; partner approval gate.
CREATE TABLE materiality (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id         uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id     uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  version_no        int NOT NULL,
  benchmark         text NOT NULL
                    CHECK (benchmark IN ('pbt', 'revenue', 'total_assets', 'equity', 'expenses')),
  benchmark_amount  numeric(18,0) NOT NULL CHECK (benchmark_amount > 0),
  percentage        numeric(6,3) NOT NULL CHECK (percentage > 0 AND percentage <= 100),
  justification     text NOT NULL,
  performance_pct   numeric(5,2) NOT NULL DEFAULT 75
                    CHECK (performance_pct >= 60 AND performance_pct <= 85),
  performance_justification text,
  trivial_pct       numeric(5,2) NOT NULL DEFAULT 5 CHECK (trivial_pct > 0 AND trivial_pct <= 10),
  overall           numeric(18,0) NOT NULL,
  performance       numeric(18,0) NOT NULL,
  trivial           numeric(18,0) NOT NULL,
  status            text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'superseded')),
  approved_by       uuid REFERENCES app_user (id) ON DELETE SET NULL,
  approved_at       timestamptz,
  created_by        uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, version_no)
);
CREATE INDEX materiality_idx ON materiality (tenant_id, engagement_id, version_no DESC);

CREATE TABLE materiality_specific (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  materiality_id uuid NOT NULL REFERENCES materiality (id) ON DELETE CASCADE,
  description    text NOT NULL,
  amount         numeric(18,0) NOT NULL CHECK (amount > 0)
);
CREATE INDEX materiality_specific_idx ON materiality_specific (tenant_id, materiality_id);

-- 2.12 D7.1 potential risks (raised from any planning form).
CREATE TABLE potential_risk (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  description   text NOT NULL,
  source_code   text NOT NULL,          -- file-index code of the raising form
  status        text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'dismissed', 'promoted')),
  dismissal_rationale text,
  raised_by     uuid REFERENCES app_user (id) ON DELETE SET NULL,
  raised_at     timestamptz NOT NULL DEFAULT now(),
  decided_by    uuid REFERENCES app_user (id) ON DELETE SET NULL,
  decided_at    timestamptz
);
CREATE INDEX potential_risk_idx ON potential_risk (tenant_id, engagement_id, status);

-- 2.12 D7.2 risk register.
CREATE TABLE risk (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  description   text NOT NULL,
  source        text,                   -- cross-reference (form/field or D7.1 origin)
  level         text NOT NULL DEFAULT 'assertion' CHECK (level IN ('fs', 'assertion')),
  likelihood    text NOT NULL DEFAULT 'medium' CHECK (likelihood IN ('low', 'medium', 'high')),
  magnitude     text NOT NULL DEFAULT 'medium' CHECK (magnitude IN ('low', 'medium', 'high')),
  significant   boolean NOT NULL DEFAULT false,
  substantive_alone_insufficient boolean NOT NULL DEFAULT false,
  controls_reliance boolean NOT NULL DEFAULT false,
  status        text NOT NULL DEFAULT 'identified'
                CHECK (status IN ('identified', 'response_planned', 'response_executed', 'concluded')),
  -- Presumed risks auto-seeded per engagement (spec §3): revenue fraud is
  -- rebuttable with partner sign-off; management override is not rebuttable.
  presumed_type text CHECK (presumed_type IN ('revenue_fraud', 'mgmt_override')),
  rebutted      boolean NOT NULL DEFAULT false,
  rebuttal_justification text,
  rebuttal_approved_by uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_by    uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX risk_idx ON risk (tenant_id, engagement_id, status);
CREATE TRIGGER risk_set_updated_at BEFORE UPDATE ON risk
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Assertion-level mapping: risk → E-section(s) + assertions (C/E/A/V/P).
CREATE TABLE risk_section (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  risk_id       uuid NOT NULL REFERENCES risk (id) ON DELETE CASCADE,
  file_item_id  uuid NOT NULL REFERENCES file_item (id) ON DELETE CASCADE,
  assertions    text[] NOT NULL DEFAULT '{}',
  UNIQUE (risk_id, file_item_id)
);
CREATE INDEX risk_section_idx ON risk_section (tenant_id, file_item_id);

-- 2.14 Audit programs per E-section (library-generated, risk-tailored).
CREATE TABLE program_step (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  file_item_id  uuid NOT NULL REFERENCES file_item (id) ON DELETE CASCADE,
  seq           int NOT NULL,
  description   text NOT NULL,
  assertions    text[] NOT NULL DEFAULT '{}',
  source        text NOT NULL DEFAULT 'library'
                CHECK (source IN ('library', 'custom', 'risk_extension')),
  status        text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'complete', 'na')),
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX program_step_idx ON program_step (tenant_id, file_item_id, seq);

-- Planned response: mandatory two-way cross-reference risk ↔ program step.
CREATE TABLE risk_response (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  risk_id         uuid NOT NULL REFERENCES risk (id) ON DELETE CASCADE,
  program_step_id uuid NOT NULL REFERENCES program_step (id) ON DELETE CASCADE,
  UNIQUE (risk_id, program_step_id)
);
CREATE INDEX risk_response_idx ON risk_response (tenant_id, risk_id);

-- 2.13 Planning snapshot taken when planning closes (spec §5.4).
CREATE TABLE planning_snapshot (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  data          jsonb NOT NULL,
  taken_by      uuid REFERENCES app_user (id) ON DELETE SET NULL,
  taken_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX planning_snapshot_idx ON planning_snapshot (tenant_id, engagement_id);

-- Column additions on Phase 1 tables.
ALTER TABLE file_item ADD COLUMN owner_id uuid REFERENCES app_user (id) ON DELETE SET NULL;
-- Manual material flag for the Phase 2 stand-back gate; replaced by the
-- TB-driven computation (materiality vs lead-schedule totals) in Phase 3.
ALTER TABLE file_item ADD COLUMN material boolean NOT NULL DEFAULT false;
ALTER TABLE document ADD COLUMN kind text NOT NULL DEFAULT 'workpaper'
  CHECK (kind IN ('workpaper', 'letter'));
-- CAC mandate per client (AUSCGIE art. 704: 2 years if named in the statutes,
-- 6 years if appointed by the AGO).
ALTER TABLE client ADD COLUMN mandate_type text
  CHECK (mandate_type IN ('statutes', 'ago'));
ALTER TABLE client ADD COLUMN mandate_start_year int;

-- Down Migration

ALTER TABLE client DROP COLUMN IF EXISTS mandate_start_year;
ALTER TABLE client DROP COLUMN IF EXISTS mandate_type;
ALTER TABLE document DROP COLUMN IF EXISTS kind;
ALTER TABLE file_item DROP COLUMN IF EXISTS material;
ALTER TABLE file_item DROP COLUMN IF EXISTS owner_id;
DROP TABLE IF EXISTS planning_snapshot;
DROP TABLE IF EXISTS risk_response;
DROP TABLE IF EXISTS program_step;
DROP TABLE IF EXISTS risk_section;
DROP TABLE IF EXISTS risk;
DROP TABLE IF EXISTS potential_risk;
DROP TABLE IF EXISTS materiality_specific;
DROP TABLE IF EXISTS materiality;
DROP TABLE IF EXISTS pbc_item;
DROP TABLE IF EXISTS budget_line;
DROP TABLE IF EXISTS team_member;
DROP TABLE IF EXISTS independence_confirmation;
DROP TABLE IF EXISTS independence_campaign;
DROP TABLE IF EXISTS accounting_estimate;
DROP TABLE IF EXISTS related_party;
DROP TABLE IF EXISTS form_response;
