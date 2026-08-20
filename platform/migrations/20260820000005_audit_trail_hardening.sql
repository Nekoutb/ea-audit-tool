-- Audit-trail hardening (assurance findings H6/H7).
--
-- H6: the trail recorded too little to reconstruct what happened — who acted in
--     what capacity, what the value was before and after, and whether the action
--     actually succeeded. Adds acting_role, before_value/after_value and outcome.
--     (engagement_id already exists on the table and is left alone.)
--
-- H7: the application role held UPDATE and DELETE on activity_log, so the code
--     that writes the audit trail could also rewrite or erase it. The grants are
--     revoked AND triggers reject UPDATE/DELETE/TRUNCATE outright, so the log
--     stays append-only even for a role that somehow regains the grant, and for
--     the table owner. (A superuser can still disable the triggers; that is a
--     database-administration boundary, not an application one.)
--
--     Legitimate retention purges must therefore be explicit and deliberate:
--       ALTER TABLE activity_log DISABLE TRIGGER USER;
--       <purge>
--       ALTER TABLE activity_log ENABLE TRIGGER USER;
--     which requires table ownership and leaves a trace in the server log.
--
-- Also: cra_assessment and risk_lead_index had RLS ENABLEd but never FORCEd, so
-- tenant isolation on those two tables did not bind the table owner. Both are
-- brought in line with every other tenant-scoped table (see db/rls.sql).

-- Up Migration

-- ---- H6: columns the trail needs to be evidence rather than a breadcrumb ----

-- The acting user's role AT THE TIME of the action. app_user.role can change
-- later, so resolving it at read time would misstate history.
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS acting_role text;

-- The changed state, for actions that mutate a value (materiality figure,
-- misstatement correction flag, sign-off status, phase …). Null for actions
-- where a before/after pair is meaningless (an export, a download).
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS before_value jsonb;
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS after_value jsonb;

-- Whether the attempt succeeded. A trail that only records successes cannot
-- evidence access control: refused attempts are exactly what a reviewer looks
-- for. Existing rows were all successful writes, hence the default.
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS outcome text NOT NULL DEFAULT 'success';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'activity_log_outcome_chk'
       AND conrelid = 'activity_log'::regclass
  ) THEN
    ALTER TABLE activity_log
      ADD CONSTRAINT activity_log_outcome_chk
      CHECK (outcome IN ('success', 'denied', 'failed'));
  END IF;
END $$;

-- The new event types (sign-offs, attachments, misstatements) are read per
-- entity, not only per engagement.
CREATE INDEX IF NOT EXISTS activity_log_entity_idx
  ON activity_log (tenant_id, entity_type, entity_id, created_at DESC);

-- ---- H7: append-only ----

-- 1. Take the write-back privileges away from the application role.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ea_app') THEN
    EXECUTE 'REVOKE UPDATE, DELETE, TRUNCATE ON activity_log FROM ea_app';
    -- Keep exactly what an append-only trail needs.
    EXECUTE 'GRANT SELECT, INSERT ON activity_log TO ea_app';
  END IF;
END $$;

-- 2. Defence in depth: reject the operations at the table itself, so a future
--    blanket GRANT (or ALTER DEFAULT PRIVILEGES) cannot silently re-open them.
--
--    ONE exception, and it is deliberate: activity_log.tenant_id is
--    REFERENCES tenant (id) ON DELETE CASCADE, so removing a tenant cascades
--    into the log. Refusing that would make a tenant undeletable (and would
--    break every test teardown that drops its fixture tenant), while allowing
--    it concedes nothing: whoever can delete the tenant row is destroying the
--    entire tenant, log included, by definition. The exemption is keyed on the
--    parent row having already gone — during an RI cascade the tenant is
--    deleted first — so an ordinary "DELETE FROM activity_log ..." issued
--    against a live tenant is still refused. `tenant` carries no RLS policy
--    (it is global, see db/rls.sql), so this lookup cannot be fooled by a
--    missing app.tenant_id.
CREATE OR REPLACE FUNCTION activity_log_append_only() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' AND NOT EXISTS (SELECT 1 FROM tenant WHERE id = OLD.tenant_id) THEN
    RETURN OLD;  -- cascade from the removal of the owning tenant
  END IF;
  RAISE EXCEPTION
    'activity_log is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

-- TRUNCATE has no OLD row, so it needs its own (statement-level) guard.
CREATE OR REPLACE FUNCTION activity_log_no_truncate() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'activity_log is append-only: TRUNCATE is not permitted'
    USING ERRCODE = 'insufficient_privilege';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS activity_log_append_only ON activity_log;
CREATE TRIGGER activity_log_append_only
  BEFORE UPDATE OR DELETE ON activity_log
  FOR EACH ROW EXECUTE FUNCTION activity_log_append_only();

DROP TRIGGER IF EXISTS activity_log_no_truncate ON activity_log;
CREATE TRIGGER activity_log_no_truncate
  BEFORE TRUNCATE ON activity_log
  FOR EACH STATEMENT EXECUTE FUNCTION activity_log_no_truncate();

-- ---- RLS: FORCE on the two tables that only had it ENABLEd ----

ALTER TABLE cra_assessment FORCE ROW LEVEL SECURITY;
ALTER TABLE risk_lead_index FORCE ROW LEVEL SECURITY;

-- Down Migration

ALTER TABLE cra_assessment NO FORCE ROW LEVEL SECURITY;
ALTER TABLE risk_lead_index NO FORCE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS activity_log_append_only ON activity_log;
DROP TRIGGER IF EXISTS activity_log_no_truncate ON activity_log;
DROP FUNCTION IF EXISTS activity_log_append_only();
DROP FUNCTION IF EXISTS activity_log_no_truncate();

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ea_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON activity_log TO ea_app';
  END IF;
END $$;

DROP INDEX IF EXISTS activity_log_entity_idx;

-- The added columns are deliberately NOT dropped. Rolling this migration back
-- restores the *privileges* it changed; dropping acting_role, before_value,
-- after_value and outcome would destroy audit evidence already recorded in
-- them, which no rollback should do. Remove them by hand if truly required.
