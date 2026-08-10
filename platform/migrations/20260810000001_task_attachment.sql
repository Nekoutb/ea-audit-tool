-- Task attachments: files uploaded against a task (file_item), versioned by
-- name — re-uploading the same filename creates the next version, which is how
-- the edit-locally watcher records each save. Content lives in the row (25 MB
-- ceiling enforced in the route); tenant scoped (RLS via db/rls.sql).

-- Up Migration

CREATE TABLE task_attachment (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  file_item_id  uuid NOT NULL REFERENCES file_item (id) ON DELETE CASCADE,
  name          text NOT NULL,
  mime          text NOT NULL,
  size_bytes    integer NOT NULL CHECK (size_bytes > 0),
  version       integer NOT NULL CHECK (version > 0),
  content       bytea NOT NULL,
  uploaded_by   uuid NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  uploaded_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (file_item_id, name, version)
);

CREATE INDEX task_attachment_item_idx ON task_attachment (tenant_id, file_item_id, name, version DESC);

-- Down Migration

DROP TABLE IF EXISTS task_attachment;
