-- Time tracking: actual hours captured against an engagement (and optionally a
-- specific working paper), complementing budget_line (budgeted hours by grade).
-- Enables budget-vs-actual and per-person workload. Tenant scoped (RLS added in
-- db/rls.sql).

-- Up Migration

CREATE TABLE time_entry (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  file_item_id  uuid REFERENCES file_item (id) ON DELETE SET NULL,
  entry_date    date NOT NULL,
  hours         numeric(6,2) NOT NULL CHECK (hours > 0 AND hours <= 24),
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX time_entry_eng_idx ON time_entry (tenant_id, engagement_id, entry_date DESC);
CREATE INDEX time_entry_user_idx ON time_entry (tenant_id, user_id, entry_date DESC);

-- Down Migration

DROP TABLE IF EXISTS time_entry;
