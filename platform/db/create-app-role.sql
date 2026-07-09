-- Creates the application database role `ea_app` and grants it table privileges.
--
-- CRITICAL: ea_app is a NON-superuser, NON-owner login role. Row-Level Security
-- only constrains such roles — superusers and table owners bypass RLS (even with
-- FORCE ROW LEVEL SECURITY, the owner is exempt; a superuser always is). The app
-- connects as ea_app (APP_DATABASE_URL); migrations run as the owner (postgres,
-- DATABASE_URL). Idempotent — safe to re-run.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ea_app') THEN
    CREATE ROLE ea_app LOGIN PASSWORD 'ea_app_password';
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
