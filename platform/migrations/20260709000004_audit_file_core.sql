-- Build Phase 1 core: clients, engagements, the audit file index, working-paper
-- documents with immutable versions, sign-offs, and review notes.
-- All tables are tenant-scoped (add to db/rls.sql and re-run npm run db:rls).

-- Up Migration

-- An audit client of the firm (master spec §2, client sub-tenant profile —
-- minimal v1 fields; portal users and mandate details come in later phases).
CREATE TABLE client (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  name       text NOT NULL,
  legal_form text NOT NULL DEFAULT 'SARL'
             CHECK (legal_form IN ('SA', 'SARL', 'SAS', 'GIE', 'OTHER')),
  listed     boolean NOT NULL DEFAULT false,
  co_cac     boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX client_tenant_idx ON client (tenant_id, name);

CREATE TRIGGER client_set_updated_at
  BEFORE UPDATE ON client
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- One audit of one client for one fiscal year (master spec §2).
CREATE TABLE engagement (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  client_id   uuid NOT NULL REFERENCES client (id) ON DELETE CASCADE,
  fiscal_year int NOT NULL,
  period_end  date NOT NULL,
  phase       text NOT NULL DEFAULT 'acceptance'
              CHECK (phase IN ('acceptance', 'planning', 'execution', 'conclusion', 'archived')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, fiscal_year)
);

CREATE INDEX engagement_tenant_idx ON engagement (tenant_id, created_at DESC);

CREATE TRIGGER engagement_set_updated_at
  BEFORE UPDATE ON engagement
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- The audit file index (A–F) instantiated per engagement from the default
-- definition in lib/file-index.ts. Codes preserve the methodology's numbering
-- gaps exactly (no D2, no D5.3, ...).
CREATE TABLE file_item (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  code          text NOT NULL,
  section       text NOT NULL CHECK (section IN ('A', 'B', 'C', 'D', 'E', 'F')),
  title_en      text NOT NULL,
  title_fr      text NOT NULL,
  sort_order    int NOT NULL,
  conditional   boolean NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id, code)
);

CREATE INDEX file_item_engagement_idx ON file_item (tenant_id, engagement_id, sort_order);

-- A working-paper document attached to a file-index item. The docx bytes live in
-- document_version; this row carries the workflow state (check-out lock,
-- sign-off status).
CREATE TABLE document (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id   uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  file_item_id    uuid NOT NULL REFERENCES file_item (id) ON DELETE CASCADE,
  title           text NOT NULL,
  language        text NOT NULL DEFAULT 'fr' CHECK (language IN ('en', 'fr')),
  status          text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'signed')),
  current_version int NOT NULL DEFAULT 0,
  checked_out_by  uuid REFERENCES app_user (id) ON DELETE SET NULL,
  checked_out_at  timestamptz,
  created_by      uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX document_file_item_idx ON document (tenant_id, file_item_id);
CREATE INDEX document_engagement_idx ON document (tenant_id, engagement_id);

CREATE TRIGGER document_set_updated_at
  BEFORE UPDATE ON document
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Immutable version rows. Bytes stored in Postgres for v1 (see DECISIONS.md —
-- object storage swap is isolated behind lib/documents.ts).
CREATE TABLE document_version (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES document (id) ON DELETE CASCADE,
  version_no  int NOT NULL,
  mime        text NOT NULL,
  byte_size   int NOT NULL,
  sha256      text NOT NULL,
  content     bytea NOT NULL,
  note        text,
  created_by  uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (document_id, version_no)
);

CREATE INDEX document_version_doc_idx ON document_version (tenant_id, document_id, version_no DESC);

-- Electronic sign-offs. Signing freezes the version it points at (its sha256 is
-- already stored on document_version); reopening voids the sign-off row.
CREATE TABLE signoff (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES document (id) ON DELETE CASCADE,
  version_no  int NOT NULL,
  role        text NOT NULL CHECK (role IN ('preparer', 'reviewer', 'partner')),
  user_id     uuid NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  signed_at   timestamptz NOT NULL DEFAULT now(),
  voided_at   timestamptz,
  void_reason text
);

CREATE INDEX signoff_document_idx ON signoff (tenant_id, document_id);

-- Reviewer coaching notes; must be cleared before reviewer sign-off.
CREATE TABLE review_note (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES document (id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  body        text NOT NULL,
  response    text,
  status      text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'cleared')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  cleared_at  timestamptz,
  cleared_by  uuid REFERENCES app_user (id) ON DELETE SET NULL
);

CREATE INDEX review_note_document_idx ON review_note (tenant_id, document_id, status);

-- Down Migration

DROP TABLE IF EXISTS review_note;
DROP TABLE IF EXISTS signoff;
DROP TABLE IF EXISTS document_version;
DROP TABLE IF EXISTS document;
DROP TABLE IF EXISTS file_item;
DROP TABLE IF EXISTS engagement;
DROP TABLE IF EXISTS client;
