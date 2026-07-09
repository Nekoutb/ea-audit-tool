-- Global (non-tenant-scoped) tables: tenant, app_user, membership.
-- These are read during authentication, before a tenant context exists, so they
-- are intentionally NOT covered by Row-Level Security (added for tenant-scoped
-- tables in a later migration). Naming is snake_case throughout; the app layer
-- uses raw parameterized SQL (no ORM), so unquoted lower-case identifiers are
-- preferred over the reference project's quoted camelCase.

-- Up Migration

-- Firm-level roles per master spec Section 2 (RBAC). Engagement-scoped roles are
-- layered on top of these at the engagement level in a later phase.
CREATE TYPE user_role AS ENUM (
  'firm_admin',
  'partner',
  'manager',
  'senior',
  'staff',
  'eqr_reviewer',
  'read_only',
  'client_user'
);

-- Shared trigger to maintain updated_at on row updates.
CREATE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- An audit firm (the primary tenant).
CREATE TABLE tenant (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name              text NOT NULL,
  slug              text NOT NULL UNIQUE,
  default_framework text NOT NULL DEFAULT 'SYSCOHADA',
  default_language  text NOT NULL DEFAULT 'fr' CHECK (default_language IN ('en', 'fr')),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER tenant_set_updated_at
  BEFORE UPDATE ON tenant
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- A person. A user is global; their access to a tenant is granted via membership.
-- "user" is a reserved word in SQL, so the table is named app_user.
CREATE TABLE app_user (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email          text NOT NULL,
  name           text,
  password_hash  text NOT NULL,
  totp_secret    text,
  totp_enabled   boolean NOT NULL DEFAULT false,
  preferred_language text NOT NULL DEFAULT 'fr' CHECK (preferred_language IN ('en', 'fr')),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- Case-insensitive uniqueness on email.
CREATE UNIQUE INDEX app_user_email_lower_idx ON app_user (lower(email));

CREATE TRIGGER app_user_set_updated_at
  BEFORE UPDATE ON app_user
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Links a user to a tenant with a firm-level role. Read during auth to resolve
-- the user's tenant, so it is excluded from RLS (scoped by user_id in app code).
CREATE TABLE membership (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES app_user (id) ON DELETE CASCADE,
  tenant_id  uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  role       user_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

CREATE INDEX membership_tenant_id_idx ON membership (tenant_id);
CREATE INDEX membership_user_id_idx ON membership (user_id);

CREATE TRIGGER membership_set_updated_at
  BEFORE UPDATE ON membership
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Down Migration

DROP TABLE IF EXISTS membership;
DROP TABLE IF EXISTS app_user;
DROP TABLE IF EXISTS tenant;
DROP FUNCTION IF EXISTS set_updated_at();
DROP TYPE IF EXISTS user_role;
