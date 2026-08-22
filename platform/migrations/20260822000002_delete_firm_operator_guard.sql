-- Deleting a firm must never strand the platform operator.
--
-- Discovered in production: authorize() refuses any account without a
-- membership row — including is_super accounts — and admin_delete_firm's
-- cascade removed the membership the operator's account held in the deleted
-- firm. The account row survived (is_super is excluded from orphan cleanup)
-- but could no longer sign in, which locked the operator out of the platform
-- they administer.
--
-- The function now refuses to delete a firm whose removal would leave any
-- super-admin account with no membership at all. Re-home the operator into
-- another firm first (Settings → Users, or a membership INSERT), then delete.

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
  IF EXISTS (SELECT 1 FROM engagement WHERE tenant_id = p_tenant AND archived_at IS NOT NULL) THEN
    RAISE EXCEPTION 'firm-has-archived-files';
  END IF;
  IF EXISTS (SELECT 1 FROM legal_hold WHERE tenant_id = p_tenant) THEN
    RAISE EXCEPTION 'firm-has-legal-hold';
  END IF;
  -- The platform operator must keep at least one membership: an account with
  -- none cannot sign in (authorize() resolves the session through it), so a
  -- deletion that removes a super-admin's last membership locks the operator
  -- out of the platform.
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
