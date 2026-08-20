-- Platform super admin: app_user.is_super marks the cross-firm operator who
-- may open the /admin console (onboard firms, see platform-wide state). The
-- console reads per-tenant data only through withTenant, so RLS segregation
-- stays intact — the flag gates the UI and firm creation, not the data plane.
-- Seeds the operator account contact@cm-ea.com under the platform tenant.

-- Up Migration

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE app_user ADD COLUMN IF NOT EXISTS is_super boolean NOT NULL DEFAULT false;

INSERT INTO tenant (name, slug, default_language)
VALUES ('CM-EA Platform', 'cm-ea', 'en')
ON CONFLICT (slug) DO NOTHING;

-- The bootstrap password is supplied at install time, never written here. It
-- used to be the literal 'admin', which meant the platform super-admin
-- credential of every deployment was published in this repository.
--
--   SUPER_ADMIN_PASSWORD=<secret> npm run migrate:up
--
-- With nothing supplied the account is created with an unusable random secret
-- rather than a guessable one; nothing automated signs in as this account, so a
-- fresh install simply sets the variable when it wants a known first login.
DO $$
DECLARE
  pw text := coalesce(nullif(current_setting('ea.super_admin_password', true), ''),
                      encode(gen_random_bytes(24), 'base64'));
BEGIN
  INSERT INTO app_user (email, name, password_hash, preferred_language, is_super)
  VALUES ('contact@cm-ea.com', 'Platform Admin', crypt(pw, gen_salt('bf', 10)), 'en', true)
  ON CONFLICT DO NOTHING;
END $$;

UPDATE app_user SET is_super = true WHERE lower(email) = 'contact@cm-ea.com';

INSERT INTO membership (tenant_id, user_id, role)
SELECT t.id, u.id, 'firm_admin'
  FROM tenant t, app_user u
 WHERE t.slug = 'cm-ea' AND lower(u.email) = 'contact@cm-ea.com'
   AND NOT EXISTS (SELECT 1 FROM membership m WHERE m.user_id = u.id AND m.tenant_id = t.id);

-- Down Migration

ALTER TABLE app_user DROP COLUMN IF EXISTS is_super;
