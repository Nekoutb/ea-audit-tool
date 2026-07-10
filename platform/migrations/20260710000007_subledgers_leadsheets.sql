-- Phase 3 (steps 3.4/3.7): sub-ledger datasets and the leadsheet document kind.
-- RLS for the new tables is applied INLINE here rather than in db/rls.sql to
-- avoid concurrent edits to that file while the TB workstream (steps 3.1-3.6)
-- is in flight; fold these names into db/rls.sql at the next consolidation.

-- Up Migration

-- Typed sub-ledger datasets (spec §10.1): AR/AP open items, fixed-asset
-- register, inventory listing, payroll register, bank statements — used by the
-- Phase 5 automation engines. Rows are stored as-imported (jsonb) plus a parsed
-- amount so populations can be totalled and reconciled to the TB.
CREATE TABLE sub_ledger_dataset (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id   uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN
                  ('ar_open_items', 'ap_open_items', 'fixed_asset_register',
                   'inventory_listing', 'payroll_register', 'bank_statement')),
  name            text NOT NULL,
  source_filename text NOT NULL,
  source_sha256   text NOT NULL,
  row_count       int NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  total_amount    numeric(30,6),
  amount_column   text,
  created_by      uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX sub_ledger_dataset_idx ON sub_ledger_dataset (tenant_id, engagement_id, kind);

CREATE TABLE sub_ledger_row (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  dataset_id  uuid NOT NULL REFERENCES sub_ledger_dataset (id) ON DELETE CASCADE,
  row_no      int NOT NULL CHECK (row_no > 0),
  data        jsonb NOT NULL,
  amount      numeric(30,6),
  UNIQUE (dataset_id, row_no)
);
CREATE INDEX sub_ledger_row_idx ON sub_ledger_row (tenant_id, dataset_id, row_no);

-- Inline tenant-isolation policies (same pattern as db/rls.sql).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sub_ledger_dataset', 'sub_ledger_row'] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)
         WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid);',
      t
    );
  END LOOP;
END $$;

-- Grant to the app role (created tables default-grant via db/create-app-role.sql
-- ALTER DEFAULT PRIVILEGES, restated defensively here).
GRANT SELECT, INSERT, UPDATE, DELETE ON sub_ledger_dataset, sub_ledger_row TO ea_app;

-- Lead schedules (spec §10.3) are stored as versioned documents on the
-- E-section file item — extend the document kind domain.
ALTER TABLE document DROP CONSTRAINT document_kind_check;
ALTER TABLE document ADD CONSTRAINT document_kind_check
  CHECK (kind IN ('workpaper', 'letter', 'leadsheet'));

-- Down Migration

ALTER TABLE document DROP CONSTRAINT document_kind_check;
ALTER TABLE document ADD CONSTRAINT document_kind_check
  CHECK (kind IN ('workpaper', 'letter'));
DROP TABLE IF EXISTS sub_ledger_row;
DROP TABLE IF EXISTS sub_ledger_dataset;
