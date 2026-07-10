-- Build Phase 7: conclusion & reporting — completion records, report/archive
-- state on the engagement, and the 'report' document kind.

-- Up Migration

-- One-off completion artifacts that are not computable from other tables
-- (final analytical review snapshot, FS tie-out result, disclosure checklist,
-- subsequent-events review, partner overall conclusion, points forward).
CREATE TABLE completion_record (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  key           text NOT NULL,
  data          jsonb NOT NULL DEFAULT '{}'::jsonb,
  done          boolean NOT NULL DEFAULT true,
  done_by       uuid REFERENCES app_user (id) ON DELETE SET NULL,
  done_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, key)
);
CREATE INDEX completion_record_idx ON completion_record (tenant_id, engagement_id);

DO $$
BEGIN
  EXECUTE 'ALTER TABLE completion_record ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE completion_record FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON completion_record';
  EXECUTE 'CREATE POLICY tenant_isolation ON completion_record
             USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)
             WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)';
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON completion_record TO ea_app;

-- Report issuance + archive state (spec §7/§9.6): report date starts the
-- 60-day assembly clock; archiving locks the file.
ALTER TABLE engagement ADD COLUMN report_date date;
ALTER TABLE engagement ADD COLUMN opinion text
  CHECK (opinion IN ('unmodified', 'qualified', 'adverse', 'disclaimer'));
ALTER TABLE engagement ADD COLUMN archived_at timestamptz;
-- OHADA statutory dates (used by Phase 8's F1 calendar too).
ALTER TABLE engagement ADD COLUMN agm_date date;
ALTER TABLE engagement ADD COLUMN board_date date;

-- Share capital for the F7 equity-vs-half-capital monitor.
ALTER TABLE client ADD COLUMN share_capital numeric(18, 0);

-- The audit report is a first-class document kind.
ALTER TABLE document DROP CONSTRAINT document_kind_check;
ALTER TABLE document ADD CONSTRAINT document_kind_check
  CHECK (kind IN ('workpaper', 'letter', 'leadsheet', 'engine_output', 'report'));

-- Down Migration

DELETE FROM document WHERE kind = 'report';
ALTER TABLE document DROP CONSTRAINT document_kind_check;
ALTER TABLE document ADD CONSTRAINT document_kind_check
  CHECK (kind IN ('workpaper', 'letter', 'leadsheet', 'engine_output'));
ALTER TABLE client DROP COLUMN IF EXISTS share_capital;
ALTER TABLE engagement DROP COLUMN IF EXISTS board_date;
ALTER TABLE engagement DROP COLUMN IF EXISTS agm_date;
ALTER TABLE engagement DROP COLUMN IF EXISTS archived_at;
ALTER TABLE engagement DROP COLUMN IF EXISTS opinion;
ALTER TABLE engagement DROP COLUMN IF EXISTS report_date;
DROP TABLE IF EXISTS completion_record;
