-- Row-Level Security: tenant isolation enforced by PostgreSQL itself.
--
-- The app connects as ea_app (a non-owner, non-superuser role) and wraps every
-- tenant-scoped query in a transaction that runs:
--   SELECT set_config('app.tenant_id', '<tenantId>', true);
-- (see lib/db.ts#withTenant). The policy below then restricts every row on each
-- listed table to that tenant. When no tenant context is set the GUC reads as
-- '' (an undefined custom GUC resets to empty string, not NULL, once touched on
-- a pooled connection); NULLIF turns that into NULL, the comparison is NULL, and
-- NO rows are visible — the table fails closed, never open. NULLIF also avoids a
-- ''::uuid cast error on such connections.
--
-- FORCE ROW LEVEL SECURITY makes the policy apply even to the table owner, so
-- isolation holds regardless of which role runs a query (a superuser still
-- bypasses it — which is why the app must NOT connect as one).
--
-- Idempotent. Run after migrations. As new tenant-scoped tables are added in
-- later phases, add their names to the array below and re-run.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    -- Tenant-scoped tables. NOTE: tenant, app_user and membership are global and
    -- intentionally absent — they are read during authentication, before a
    -- tenant context exists, and are scoped by user_id/id in app code instead.
    'rls_probe',
    'notification',
    'client',
    'engagement',
    'file_item',
    'document',
    'document_version',
    'signoff',
    'review_note',
    'activity_log'
  ]
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
         USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)
         WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid);',
      t
    );
  END LOOP;
END $$;
