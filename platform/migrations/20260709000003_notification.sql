-- In-app notifications. Tenant-scoped (RLS) and additionally scoped to a user.
-- The email side is stubbed for now (lib/email.ts logs); this table is the
-- in-app inbox. Central notification service per master spec §13.

-- Up Migration

CREATE TABLE notification (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  kind       text NOT NULL,
  title      text NOT NULL,
  body       text,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX notification_tenant_user_idx
  ON notification (tenant_id, user_id, created_at DESC);

-- Down Migration

DROP TABLE IF EXISTS notification;
