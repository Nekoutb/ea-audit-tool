-- Unified activity log (audit trail): one append-only row per meaningful user
-- action across an engagement, so a reviewer or regulator can see the complete
-- history in one place. Complements the existing per-entity history
-- (document_version, signoff, review_note, trial_balance_version …). Tenant
-- scoped (RLS added in db/rls.sql).

-- Up Migration

CREATE TABLE activity_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid REFERENCES engagement (id) ON DELETE CASCADE,
  user_id       uuid REFERENCES app_user (id) ON DELETE SET NULL,
  entity_type   text NOT NULL,
  entity_id     uuid,
  action        text NOT NULL,
  summary       text,
  meta          jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX activity_log_eng_idx ON activity_log (tenant_id, engagement_id, created_at DESC);

-- Down Migration

DROP TABLE IF EXISTS activity_log;
