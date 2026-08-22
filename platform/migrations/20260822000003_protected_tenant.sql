-- A protected tenant can never be deleted — by anyone, through anything.
--
-- The platform operator's session must carry a firm context (authorize()
-- resolves every session through a membership), so one tenant exists purely
-- as the operator's home. Twice in one evening its deletion locked the
-- operator out of the platform. "Do not delete" as a name is advice;
-- this migration makes it physics:
--
--   * tenant.protected, default false; the operator-home tenant is flagged.
--   * admin_delete_firm refuses protected tenants before anything else.
--   * A BEFORE DELETE trigger refuses the row even for the table owner in
--     raw SQL — clearing the flag first is the single, deliberate way out.

ALTER TABLE tenant ADD COLUMN IF NOT EXISTS protected boolean NOT NULL DEFAULT false;

UPDATE tenant SET protected = true WHERE slug = 'platform-operator';

CREATE OR REPLACE FUNCTION tenant_protected_no_delete() RETURNS trigger AS $$
BEGIN
  IF OLD.protected THEN
    RAISE EXCEPTION 'firm-protected'
      USING DETAIL = format('tenant %s (%s) is protected and cannot be deleted', OLD.slug, OLD.id);
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tenant_protected_no_delete ON tenant;
CREATE TRIGGER tenant_protected_no_delete
  BEFORE DELETE ON tenant
  FOR EACH ROW EXECUTE FUNCTION tenant_protected_no_delete();

-- Refuse in the function too, so the console gets a clear answer instead of
-- a trigger error.
CREATE OR REPLACE FUNCTION admin_delete_firm(p_tenant uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  orphans uuid[];
  orphan  uuid;
  removed integer := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM tenant WHERE id = p_tenant) THEN
    RAISE EXCEPTION 'firm-not-found';
  END IF;
  IF EXISTS (SELECT 1 FROM tenant WHERE id = p_tenant AND protected) THEN
    RAISE EXCEPTION 'firm-protected';
  END IF;
  IF EXISTS (SELECT 1 FROM engagement WHERE tenant_id = p_tenant AND archived_at IS NOT NULL) THEN
    RAISE EXCEPTION 'firm-has-archived-files';
  END IF;
  IF EXISTS (SELECT 1 FROM legal_hold WHERE tenant_id = p_tenant) THEN
    RAISE EXCEPTION 'firm-has-legal-hold';
  END IF;
  IF EXISTS (
    SELECT 1 FROM app_user u
     WHERE u.is_super = true
       AND EXISTS (SELECT 1 FROM membership m WHERE m.user_id = u.id AND m.tenant_id = p_tenant)
       AND NOT EXISTS (SELECT 1 FROM membership m WHERE m.user_id = u.id AND m.tenant_id <> p_tenant)
  ) THEN
    RAISE EXCEPTION 'firm-holds-operator-membership';
  END IF;

  SELECT array_agg(u.id) INTO orphans
    FROM app_user u
   WHERE u.is_super = false
     AND EXISTS (SELECT 1 FROM membership m WHERE m.user_id = u.id AND m.tenant_id = p_tenant)
     AND NOT EXISTS (SELECT 1 FROM membership m WHERE m.user_id = u.id AND m.tenant_id <> p_tenant);

  DELETE FROM tenant WHERE id = p_tenant;
  removed := 1;

  FOREACH orphan IN ARRAY coalesce(orphans, '{}'::uuid[]) LOOP
    BEGIN
      DELETE FROM app_user WHERE id = orphan;
    EXCEPTION WHEN foreign_key_violation THEN
      NULL;
    END;
  END LOOP;

  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION admin_delete_firm(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_firm(uuid) TO ea_app;
