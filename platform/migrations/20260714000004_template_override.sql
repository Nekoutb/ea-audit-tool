-- Template management: per-tenant overrides of working-paper templates. A firm
-- admin can replace the purpose text and checklist items for any file-index
-- code; generateDocument merges the override over the code-defined template at
-- instantiation time. Already-generated documents are never mutated (their
-- bytes are frozen in document_version). Tenant scoped (RLS in db/rls.sql).

-- Up Migration

CREATE TABLE template_override (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  code       text NOT NULL,
  purpose_en text,
  purpose_fr text,
  items_en   jsonb,
  items_fr   jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, code)
);

-- Down Migration

DROP TABLE IF EXISTS template_override;
