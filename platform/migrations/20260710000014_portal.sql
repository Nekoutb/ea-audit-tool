-- Build Phase 9 (9.1/9.2): client portal — portal users are memberships with
-- role 'client_user' scoped to ONE client; PBC items carry the uploaded file
-- and its acceptance/attachment trail.

-- Up Migration

-- A client_user membership belongs to exactly one client of the firm.
ALTER TABLE membership ADD COLUMN client_id uuid REFERENCES client (id) ON DELETE CASCADE;

ALTER TABLE pbc_item ADD COLUMN note text NOT NULL DEFAULT '';
ALTER TABLE pbc_item ADD COLUMN filename text;
ALTER TABLE pbc_item ADD COLUMN mime text;
ALTER TABLE pbc_item ADD COLUMN content bytea;
ALTER TABLE pbc_item ADD COLUMN uploaded_by uuid REFERENCES app_user (id) ON DELETE SET NULL;
ALTER TABLE pbc_item ADD COLUMN uploaded_at timestamptz;
ALTER TABLE pbc_item ADD COLUMN accepted_by uuid REFERENCES app_user (id) ON DELETE SET NULL;
ALTER TABLE pbc_item ADD COLUMN accepted_at timestamptz;
-- Evidence linkage: the working-paper document created from the upload.
ALTER TABLE pbc_item ADD COLUMN document_id uuid REFERENCES document (id) ON DELETE SET NULL;

-- Down Migration

ALTER TABLE pbc_item DROP COLUMN IF EXISTS document_id;
ALTER TABLE pbc_item DROP COLUMN IF EXISTS accepted_at;
ALTER TABLE pbc_item DROP COLUMN IF EXISTS accepted_by;
ALTER TABLE pbc_item DROP COLUMN IF EXISTS uploaded_at;
ALTER TABLE pbc_item DROP COLUMN IF EXISTS uploaded_by;
ALTER TABLE pbc_item DROP COLUMN IF EXISTS content;
ALTER TABLE pbc_item DROP COLUMN IF EXISTS mime;
ALTER TABLE pbc_item DROP COLUMN IF EXISTS filename;
ALTER TABLE pbc_item DROP COLUMN IF EXISTS note;
ALTER TABLE membership DROP COLUMN IF EXISTS client_id;
