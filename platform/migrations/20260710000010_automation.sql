-- Build Phase 5: automation engines. Every engine run records its inputs,
-- parameters and results (spec §11: full reproducibility — this IS audit
-- evidence) and produces an indexed Excel output document.

-- Up Migration

CREATE TABLE automation_run (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id  uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  file_item_id   uuid REFERENCES file_item (id) ON DELETE SET NULL,
  engine         text NOT NULL CHECK (engine IN
                 ('sampling', 'recon_subledger', 'recon_far', 'recon_bank',
                  'recon_supplier', 'je_testing', 'substantive_analytics')),
  params         jsonb NOT NULL DEFAULT '{}'::jsonb,
  dataset_id     uuid REFERENCES sub_ledger_dataset (id) ON DELETE SET NULL,
  result_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  output_document_id uuid REFERENCES document (id) ON DELETE SET NULL,
  created_by     uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX automation_run_idx ON automation_run (tenant_id, engagement_id, engine);

-- New dataset kinds used by the engines.
ALTER TABLE sub_ledger_dataset DROP CONSTRAINT sub_ledger_dataset_kind_check;
ALTER TABLE sub_ledger_dataset ADD CONSTRAINT sub_ledger_dataset_kind_check
  CHECK (kind IN ('ar_open_items', 'ap_open_items', 'fixed_asset_register',
                  'inventory_listing', 'payroll_register', 'bank_statement',
                  'journal_entries', 'supplier_statements'));

-- Engine outputs are stored as documents under the section.
ALTER TABLE document DROP CONSTRAINT document_kind_check;
ALTER TABLE document ADD CONSTRAINT document_kind_check
  CHECK (kind IN ('workpaper', 'letter', 'leadsheet', 'engine_output'));

DO $$
BEGIN
  EXECUTE 'ALTER TABLE automation_run ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE automation_run FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON automation_run';
  EXECUTE 'CREATE POLICY tenant_isolation ON automation_run
             USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)
             WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)';
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON automation_run TO ea_app;

-- Down Migration

DELETE FROM document WHERE kind = 'engine_output';
ALTER TABLE document DROP CONSTRAINT document_kind_check;
ALTER TABLE document ADD CONSTRAINT document_kind_check
  CHECK (kind IN ('workpaper', 'letter', 'leadsheet'));
DELETE FROM sub_ledger_dataset WHERE kind IN ('journal_entries', 'supplier_statements');
ALTER TABLE sub_ledger_dataset DROP CONSTRAINT sub_ledger_dataset_kind_check;
ALTER TABLE sub_ledger_dataset ADD CONSTRAINT sub_ledger_dataset_kind_check
  CHECK (kind IN ('ar_open_items', 'ap_open_items', 'fixed_asset_register',
                  'inventory_listing', 'payroll_register', 'bank_statement'));
DROP TABLE IF EXISTS automation_run;
