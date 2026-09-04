-- Row-Level Security: tenant isolation enforced by PostgreSQL itself.
--
-- The app connects as ea_app (a non-owner, non-superuser role) and wraps every
-- tenant-scoped query in a transaction that runs:
--   SELECT set_config('app.tenant_id', '<tenantId>', true);
-- (see lib/db.ts#withTenant). The policy below then restricts every row on each
-- covered table to that tenant. When no tenant context is set the GUC reads as
-- '' (an undefined custom GUC resets to empty string, not NULL, once touched on
-- a pooled connection); NULLIF turns that into NULL, the comparison is NULL, and
-- NO rows are visible — the table fails closed, never open. NULLIF also avoids a
-- ''::uuid cast error on such connections.
--
-- FORCE ROW LEVEL SECURITY makes the policy apply even to the table owner, so
-- isolation holds regardless of which role runs a query (a superuser still
-- bypasses it — which is why the app must NOT connect as one).
--
-- WHICH TABLES: every table in `public` that has a `tenant_id` column, asked of
-- the catalog at run time, minus the explicit exclusions below.
--
-- This used to be a literal list with a comment asking later phases to keep it
-- current. They did not: eleven migrations went on to apply policies in their
-- own loops instead, the list here stayed at fifteen names, and nothing
-- compared the two. A database built from this repository came up with thirty
-- tenant-scoped tables unprotected — `evidence` and `pbc_item` among them, both
-- of which hold uploaded client documents — while production, patched by hand
-- along the way, had them covered. The repository could no longer rebuild the
-- server it describes, which is precisely the situation a disaster-recovery
-- plan exists to prevent.
--
-- Deriving the list removes the failure mode rather than fixing an instance of
-- it, and tests/lib/rls.test.ts asserts the result against the catalog so the
-- gap cannot silently reopen.
--
-- Idempotent. Run after every migration (deploy/deploy-ea-audit.sh does).

DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND EXISTS (
             SELECT 1 FROM pg_attribute a
              WHERE a.attrelid = c.oid AND a.attname = 'tenant_id'
                AND a.attnum > 0 AND NOT a.attisdropped)
       -- membership is read during authentication, before any tenant context
       -- exists, and is scoped by user_id in application code. tenant and
       -- app_user have no tenant_id at all and so never appear here.
       AND c.relname <> 'membership'
     ORDER BY c.relname
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

-- A few migrations create their own identically-named-by-table policy
-- (legal_hold_tenant_isolation, for instance). Those carry the same predicate,
-- so a table holding both is not weakened: permissive policies are OR-ed, and
-- OR-ing a predicate with itself changes nothing.
