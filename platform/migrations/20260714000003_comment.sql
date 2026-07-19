-- Collaboration: threaded discussion per engagement. A comment may reply to a
-- parent (one level of threading). @mentions are parsed in app code and turned
-- into notifications. Tenant scoped (RLS added in db/rls.sql).

-- Up Migration

CREATE TABLE comment (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  parent_id     uuid REFERENCES comment (id) ON DELETE CASCADE,
  user_id       uuid REFERENCES app_user (id) ON DELETE SET NULL,
  body          text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX comment_eng_idx ON comment (tenant_id, engagement_id, created_at);

-- Down Migration

DROP TABLE IF EXISTS comment;
