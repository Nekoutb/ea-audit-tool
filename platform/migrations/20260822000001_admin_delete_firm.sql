-- Firm deletion for the platform admin console.
--
-- The application role deliberately holds no DELETE on tenant (or engagement,
-- client, app_user): a leaked app credential must not be able to drop a firm.
-- Deletion therefore goes through one SECURITY DEFINER function owned by the
-- migration role, granted to ea_app, whose body states the policy:
--
--   * A firm holding ARCHIVED audit files cannot be deleted. Archived files
--     carry a retention obligation (ISA 230 / the firm's retention_years);
--     destroying them via the tenant cascade would bypass the archive-lock
--     triggers, which exempt cascades (pg_trigger_depth() > 1) precisely so
--     that fixture teardown works. The refusal here is the control.
--   * A firm with any legal_hold row cannot be deleted. The NO ACTION foreign
--     key and the append-only trigger would abort the cascade anyway; checking
--     first turns a trigger error into a clear answer.
--   * Everything else cascades: FKs from every tenant-scoped table are
--     ON DELETE CASCADE, and the activity_log append-only trigger exempts the
--     tenant-cascade path by design (see 20260820000005).
--
-- Accounts whose only firm this was are removed too (the platform super-admin
-- excepted); an account that also belongs to another firm keeps its row and
-- its other memberships untouched.

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
      -- Still referenced from surviving data (e.g. placed a legal hold in
      -- another firm): the row stays, membership-less, rather than breaking
      -- the reference.
      NULL;
    END;
  END LOOP;

  RETURN removed;
END;
$$;

REVOKE ALL ON FUNCTION admin_delete_firm(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_delete_firm(uuid) TO ea_app;
