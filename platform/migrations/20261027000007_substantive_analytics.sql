-- F038 (firm decision 2026-10-27): substantive analytical procedures (ISA 520
-- ¶5–7) as a tool of their own, one procedure per lead index and assertion.
--
-- The variance review on the lead schedules stays what it is — the ISA 315
-- risk analytic. This table holds the substantive procedure: the expectation
-- built before looking at the recorded amount (model, inputs, expected value),
-- the reliability of the data behind it, the threshold above which a
-- difference is investigated, the recorded amount it is compared with, the
-- investigation and corroboration of any difference, and the conclusion on the
-- assertion.
--
-- The threshold is a percentage of performance materiality set by the CRA
-- level of the account and assertion (S3.1): the firm's defaults live on the
-- tenant row — low 75 %, moderate 50 %, high 25 % (a minimal CRA takes the
-- low percentage) — editable in Settings; a procedure may override its
-- percentage with a written reason. cra_level and threshold_pct are snapshots
-- taken when the procedure is saved, so a later change of the firm default or
-- of the CRA does not silently rewrite a concluded procedure.
--
-- actual_value is the closing balance of the index in the current trial
-- balance when one is imported (actual_source = 'tb'), else the amount typed
-- (actual_source = 'manual').

-- Up Migration

ALTER TABLE tenant
  ADD COLUMN IF NOT EXISTS sap_threshold_low_pct      integer NOT NULL DEFAULT 75
    CHECK (sap_threshold_low_pct BETWEEN 1 AND 100),
  ADD COLUMN IF NOT EXISTS sap_threshold_moderate_pct integer NOT NULL DEFAULT 50
    CHECK (sap_threshold_moderate_pct BETWEEN 1 AND 100),
  ADD COLUMN IF NOT EXISTS sap_threshold_high_pct     integer NOT NULL DEFAULT 25
    CHECK (sap_threshold_high_pct BETWEEN 1 AND 100);

CREATE TABLE IF NOT EXISTS substantive_analytical_procedure (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id                uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id            uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  index_code               text NOT NULL,
  assertion                text NOT NULL CHECK (assertion IN ('C', 'E', 'A', 'V', 'P')),
  expectation_model        text NOT NULL,
  inputs                   text,
  expected_value           numeric(18,2) NOT NULL,
  data_reliability         text,
  cra_level                text CHECK (cra_level IS NULL OR cra_level IN ('minimal', 'low', 'moderate', 'high')),
  threshold_pct            integer NOT NULL CHECK (threshold_pct BETWEEN 1 AND 100),
  threshold_override_pct   integer CHECK (threshold_override_pct IS NULL OR threshold_override_pct BETWEEN 1 AND 100),
  threshold_override_reason text,
  performance_materiality  numeric(18,2),
  actual_value             numeric(18,2),
  actual_source            text NOT NULL DEFAULT 'manual' CHECK (actual_source IN ('tb', 'manual')),
  investigation            text,
  corroboration            text,
  conclusion               text CHECK (conclusion IS NULL OR conclusion IN ('supported', 'not_supported')),
  created_by               uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_by               uuid REFERENCES app_user (id) ON DELETE SET NULL,
  updated_at               timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, index_code, assertion)
);
CREATE INDEX IF NOT EXISTS sap_engagement_idx ON substantive_analytical_procedure (tenant_id, engagement_id, index_code);

ALTER TABLE substantive_analytical_procedure ENABLE ROW LEVEL SECURITY;
ALTER TABLE substantive_analytical_procedure FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON substantive_analytical_procedure;
CREATE POLICY tenant_isolation ON substantive_analytical_procedure
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON substantive_analytical_procedure TO ea_app;

DROP TRIGGER IF EXISTS sap_archive_guard ON substantive_analytical_procedure;
CREATE TRIGGER sap_archive_guard
  BEFORE INSERT OR UPDATE OR DELETE ON substantive_analytical_procedure
  FOR EACH ROW EXECUTE FUNCTION reject_archived_write();

-- Down Migration

DROP TRIGGER IF EXISTS sap_archive_guard ON substantive_analytical_procedure;
DROP TABLE IF EXISTS substantive_analytical_procedure;
ALTER TABLE tenant
  DROP COLUMN IF EXISTS sap_threshold_low_pct,
  DROP COLUMN IF EXISTS sap_threshold_moderate_pct,
  DROP COLUMN IF EXISTS sap_threshold_high_pct;
