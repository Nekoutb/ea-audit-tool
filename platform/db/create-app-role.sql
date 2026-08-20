-- Creates the application database role `ea_app` and grants it table privileges.
--
-- CRITICAL: ea_app is a NON-superuser, NON-owner login role. Row-Level Security
-- only constrains such roles — a superuser always bypasses RLS, and the table
-- owner bypasses it too UNLESS the table has FORCE ROW LEVEL SECURITY, which is
-- exactly what FORCE changes: with FORCE the policies DO apply to the owner (a
-- superuser, and any role with BYPASSRLS, still bypasses them). The app connects
-- as ea_app (APP_DATABASE_URL); migrations run as the owner (postgres,
-- DATABASE_URL). Idempotent — safe to re-run.

-- The password is supplied at run time and never stored in this file. The
-- runner (scripts/run-sql.mjs) puts it in a session setting first:
--
--   APP_ROLE_PASSWORD="$(openssl rand -base64 24)" npm run db:role
--
-- A session setting is used rather than a psql variable because the runner is
-- deliberately psql-free (it must work in CI without psql on PATH). Missing or
-- empty is a hard error, so no path can recreate a known credential.
DO $$
DECLARE
  pw text := nullif(current_setting('ea.app_password', true), '');
BEGIN
  IF pw IS NULL THEN
    RAISE EXCEPTION
      'ea.app_password is not set - run with APP_ROLE_PASSWORD=<secret> (e.g. openssl rand -base64 24)';
  END IF;

  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ea_app') THEN
    EXECUTE format('CREATE ROLE ea_app LOGIN PASSWORD %L', pw);
  ELSE
    -- Re-running rotates the secret to the supplied value: run this, then
    -- update APP_DATABASE_URL and restart the service.
    EXECUTE format('ALTER ROLE ea_app PASSWORD %L', pw);
  END IF;
END $$;

GRANT CONNECT ON DATABASE ea_audit TO ea_app;
GRANT USAGE ON SCHEMA public TO ea_app;

-- Privileges on existing tables/sequences.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO ea_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO ea_app;

-- Auto-grant the same on tables/sequences created later by the owner (postgres),
-- so future migrations don't each need a manual GRANT.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO ea_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO ea_app;

-- ---- Append-only tables: exceptions to the blanket grant above ----
--
-- The audit trail must not be rewritable by the role that writes it, otherwise
-- the trail evidences nothing. GRANT ON ALL TABLES above is a one-shot snapshot
-- and ALTER DEFAULT PRIVILEGES applies to tables created *later*, so neither can
-- carve out a single table: the grant is made broadly and then narrowed here.
-- Re-running this file therefore always ends with the trail locked down again.
--
-- Migration 20260820000005 backs this with a trigger that refuses UPDATE,
-- DELETE and TRUNCATE on activity_log outright, so a future stray GRANT cannot
-- silently re-open the hole. Keep both: the REVOKE is the privilege boundary,
-- the trigger is the enforcement.
DO $$
BEGIN
  IF to_regclass('public.activity_log') IS NOT NULL THEN
    EXECUTE 'REVOKE UPDATE, DELETE, TRUNCATE ON activity_log FROM ea_app';
    EXECUTE 'GRANT SELECT, INSERT ON activity_log TO ea_app';
  END IF;
END $$;
