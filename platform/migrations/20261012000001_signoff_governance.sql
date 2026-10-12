-- Sign-off governance (F002 / F003).
--
-- firm_signoff_policy: one row per firm, the defaults every task inherits —
-- the lowest engagement-team role that may sign as reviewer, the tasks that
-- need the engagement partner's own signature, and whether preparer and
-- approver of a task must be different people. No row = today's constants in
-- lib/documents.ts (lib/signoff-policy.ts falls back to them).
--
-- allow_sole_practitioner is stored for completeness but never relaxes the
-- no-self-review rule (F001): the application ignores it.
--
-- firm_task_signoff_rule: per-task overrides, one row per (firm, task code).
-- A NULL column means "use the firm policy / today's default".
--
-- engagement.partner_delegate_user_id (F003): a partner the engagement
-- partner has delegated partner-tier sign-offs to, or NULL.

-- Up Migration

CREATE TABLE IF NOT EXISTS firm_signoff_policy (
  tenant_id                          uuid PRIMARY KEY REFERENCES tenant (id) ON DELETE CASCADE,
  min_reviewer_role                  text NOT NULL DEFAULT 'senior'
    CHECK (min_reviewer_role IN ('staff', 'senior', 'manager', 'senior_manager', 'director', 'partner')),
  require_partner_on                 text[] NOT NULL
    DEFAULT ARRAY['P1.1', 'P2.2', 'P5.2', 'P7.2', 'S3.1', 'S6.1', 'S6.2', 'C1.1']::text[],
  allow_sole_practitioner            boolean NOT NULL DEFAULT false,
  require_distinct_preparer_approver boolean NOT NULL DEFAULT true,
  updated_by                         uuid REFERENCES app_user (id) ON DELETE SET NULL,
  updated_at                         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE firm_signoff_policy ENABLE ROW LEVEL SECURITY;
ALTER TABLE firm_signoff_policy FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON firm_signoff_policy;
CREATE POLICY tenant_isolation ON firm_signoff_policy
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON firm_signoff_policy TO ea_app;

CREATE TABLE IF NOT EXISTS firm_task_signoff_rule (
  tenant_id         uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  code              text NOT NULL,
  min_preparer_role text
    CHECK (min_preparer_role IS NULL
           OR min_preparer_role IN ('staff', 'senior', 'manager', 'senior_manager', 'director', 'partner')),
  min_reviewer_role text
    CHECK (min_reviewer_role IS NULL
           OR min_reviewer_role IN ('staff', 'senior', 'manager', 'senior_manager', 'director', 'partner')),
  partner_required  boolean,
  updated_by        uuid REFERENCES app_user (id) ON DELETE SET NULL,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, code)
);

ALTER TABLE firm_task_signoff_rule ENABLE ROW LEVEL SECURITY;
ALTER TABLE firm_task_signoff_rule FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON firm_task_signoff_rule;
CREATE POLICY tenant_isolation ON firm_task_signoff_rule
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);
GRANT SELECT, INSERT, UPDATE, DELETE ON firm_task_signoff_rule TO ea_app;

ALTER TABLE engagement
  ADD COLUMN IF NOT EXISTS partner_delegate_user_id uuid REFERENCES app_user (id) ON DELETE SET NULL;

-- Down Migration

ALTER TABLE engagement DROP COLUMN IF EXISTS partner_delegate_user_id;
DROP TABLE IF EXISTS firm_task_signoff_rule;
DROP TABLE IF EXISTS firm_signoff_policy;
