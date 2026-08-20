-- The typed general-ledger line projection.
--
-- sub_ledger_row keeps the GL exactly as imported (jsonb keyed by the source
-- file's own headers) — faithful, but untyped and unindexable, so every
-- aggregate over it had to be computed by streaming the whole ledger into Node.
-- On a real client ledger (hundreds of thousands of lines) that is a memory and
-- latency defect, not a style preference.
--
-- gl_line is the projection the analytics engine actually queries: one row per
-- imported ledger line, typed and indexed, built once per dataset by
-- lib/gl-line.ts#buildProjection. Every analytic in lib/gl-analytics.ts and
-- lib/gl-correlation.ts is a SQL aggregate against this table.
--
-- Amount convention (never silently reversed anywhere in the stack):
--   signed = debit - credit  -> debits positive, credits negative.
-- When the source maps only a single amount column that value is already
-- signed, and debit/credit are split back out of it by sign.

-- Up Migration

CREATE TABLE IF NOT EXISTS gl_line (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id    uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  dataset_id       uuid NOT NULL REFERENCES sub_ledger_dataset (id) ON DELETE CASCADE,
  line_no          int NOT NULL,
  account          text NOT NULL,
  account_name     text,
  je_number        text NOT NULL,
  journal_code     text,
  je_description   text,
  line_description text,
  journal_date     date,
  entry_date       date,
  debit            numeric(30,6) NOT NULL DEFAULT 0,
  credit           numeric(30,6) NOT NULL DEFAULT 0,
  signed           numeric(30,6) NOT NULL DEFAULT 0,
  reference        text,
  third_party_code text,
  third_party_name text,
  preparer         text,
  reviewer         text,
  approver         text,
  cost_center      text,
  UNIQUE (dataset_id, line_no)
);

-- Scoping index first (every query filters dataset + engagement), then the
-- group-by / filter columns each analytic leans on.
CREATE INDEX IF NOT EXISTS gl_line_scope_idx     ON gl_line (tenant_id, engagement_id, dataset_id);
CREATE INDEX IF NOT EXISTS gl_line_account_idx   ON gl_line (dataset_id, account);
CREATE INDEX IF NOT EXISTS gl_line_je_idx        ON gl_line (dataset_id, je_number);
CREATE INDEX IF NOT EXISTS gl_line_jdate_idx     ON gl_line (dataset_id, journal_date);
CREATE INDEX IF NOT EXISTS gl_line_preparer_idx  ON gl_line (dataset_id, preparer);
CREATE INDEX IF NOT EXISTS gl_line_approver_idx  ON gl_line (dataset_id, approver);
CREATE INDEX IF NOT EXISTS gl_line_signed_idx    ON gl_line (dataset_id, signed);

-- Tenant isolation, same policy shape as every other tenant-scoped table
-- (db/rls.sql). FORCE so the policy binds the owner role too.
ALTER TABLE gl_line ENABLE ROW LEVEL SECURITY;
ALTER TABLE gl_line FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON gl_line;
CREATE POLICY tenant_isolation ON gl_line
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

GRANT SELECT, INSERT, UPDATE, DELETE ON gl_line TO ea_app;

-- Down Migration

SELECT 1;
