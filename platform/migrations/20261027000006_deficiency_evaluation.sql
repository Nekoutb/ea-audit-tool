-- F037 (firm decision 2026-10-27): the ISA 265 evaluation of each deficiency
-- in internal control, on the C5.11 communications paper.
--
-- A finding routed 'c1' is a deficiency; its severity column used to be set
-- once, when the finding was raised. ISA 265 ¶8 asks for an evaluation —
-- the likelihood of a misstatement and its potential magnitude (A5–A6), the
-- accounts and assertions exposed, whether management already knows, the A6–A7
-- indicators, and the related deficiencies considered together — before the
-- grade is final. This table holds that evaluation, one row per finding; the
-- final grade is written back to finding.severity so the letters, the register
-- and the completion gates read one value.
--
-- communicated_on / recipient record the WRITTEN communication of a
-- significant deficiency to those charged with governance (ISA 265 ¶9, ¶11).
-- The archive gate 'deficiencies_communicated' (lib/completion.ts) refuses to
-- close the file while a significant deficiency has no such date.

-- Up Migration

CREATE TABLE IF NOT EXISTS deficiency_evaluation (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id            uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id        uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  finding_id           uuid NOT NULL UNIQUE REFERENCES finding (id) ON DELETE CASCADE,
  likelihood           text CHECK (likelihood IS NULL OR likelihood IN ('remote', 'reasonably_possible', 'probable')),
  magnitude            text CHECK (magnitude IS NULL OR magnitude IN ('inconsequential', 'significant', 'material')),
  accounts_assertions  text,
  management_aware     boolean,
  indicators           text,
  related_finding_ids  uuid[] NOT NULL DEFAULT '{}'::uuid[],
  aggregation_note     text,
  grade                text NOT NULL CHECK (grade IN ('significant_deficiency', 'deficiency', 'observation')),
  communicated_on      date,
  recipient            text,
  updated_by           uuid REFERENCES app_user (id) ON DELETE SET NULL,
  updated_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS deficiency_evaluation_idx ON deficiency_evaluation (tenant_id, engagement_id);

ALTER TABLE deficiency_evaluation ENABLE ROW LEVEL SECURITY;
ALTER TABLE deficiency_evaluation FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON deficiency_evaluation;
CREATE POLICY tenant_isolation ON deficiency_evaluation
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON deficiency_evaluation TO ea_app;

-- an archived file is immutable, like the finding the row evaluates
DROP TRIGGER IF EXISTS deficiency_evaluation_archive_guard ON deficiency_evaluation;
CREATE TRIGGER deficiency_evaluation_archive_guard
  BEFORE INSERT OR UPDATE OR DELETE ON deficiency_evaluation
  FOR EACH ROW EXECUTE FUNCTION reject_archived_write();

-- Down Migration

DROP TRIGGER IF EXISTS deficiency_evaluation_archive_guard ON deficiency_evaluation;
DROP TABLE IF EXISTS deficiency_evaluation;
