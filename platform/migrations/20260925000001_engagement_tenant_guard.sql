-- A row may only point at an engagement of its own firm (UAT B01).
--
-- Row-level security filters what a firm can READ, but foreign-key checks run
-- without it: a firm-B session that knew a firm-A engagement id could insert
-- rows tagged tenant_id = B against that engagement. Firm A never saw them
-- (RLS), yet they occupied the (engagement_id, code) unique slots, so firm A
-- was then refused when it tried to save the same working paper.
--
-- The application now checks tenant ownership for oversight roles too
-- (lib/engagement-access.ts). This trigger is the authority underneath it: on
-- every table carrying both tenant_id and engagement_id, an INSERT or UPDATE
-- whose tenant_id differs from the engagement's raises
-- 'engagement-tenant-mismatch'. The lookup runs SECURITY DEFINER so it sees
-- the engagement whatever the caller's RLS context.
--
-- Rows already written across the boundary are removed, per tenant, with the
-- tenant GUC set so FORCE-RLS tables are reachable.

-- Up Migration

CREATE OR REPLACE FUNCTION reject_cross_tenant_engagement_row() RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  owner uuid;
BEGIN
  IF NEW.engagement_id IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT e.tenant_id INTO owner FROM engagement e WHERE e.id = NEW.engagement_id;
  IF owner IS NOT NULL AND NEW.tenant_id IS DISTINCT FROM owner THEN
    RAISE EXCEPTION 'engagement-tenant-mismatch'
      USING DETAIL = format('%s on %s refused: engagement %s belongs to another firm',
                            TG_OP, TG_TABLE_NAME, NEW.engagement_id);
  END IF;
  RETURN NEW;
END
$fn$;

DO $$
DECLARE
  t   record;
  tid uuid;
  n   bigint;
BEGIN
  FOR t IN
    SELECT c.table_name
      FROM information_schema.columns c
      JOIN information_schema.tables tb
        ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name
     WHERE c.table_schema = 'public'
       AND tb.table_type = 'BASE TABLE'
       AND c.column_name = 'engagement_id'
       AND c.table_name <> 'engagement'
       AND EXISTS (SELECT 1 FROM information_schema.columns c2
                    WHERE c2.table_schema = 'public' AND c2.table_name = c.table_name
                      AND c2.column_name = 'tenant_id')
     ORDER BY c.table_name
  LOOP
    -- Clean up what already crossed. Per tenant so FORCE-RLS policies admit
    -- the rows; per table in its own block so an append-only or archive
    -- trigger on one table reports instead of aborting the migration.
    FOR tid IN SELECT id FROM tenant LOOP
      PERFORM set_config('app.tenant_id', tid::text, true);
      BEGIN
        EXECUTE format(
          'DELETE FROM %I x WHERE x.tenant_id = $1
             AND EXISTS (SELECT 1 FROM engagement e WHERE e.id = x.engagement_id AND e.tenant_id <> $1)',
          t.table_name) USING tid;
        GET DIAGNOSTICS n = ROW_COUNT;
        IF n > 0 THEN
          RAISE NOTICE 'removed % cross-firm row(s) from % (tenant %)', n, t.table_name, tid;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE 'could not clean % for tenant %: %', t.table_name, tid, SQLERRM;
      END;
    END LOOP;

    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t.table_name || '_tenant_guard', t.table_name);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OF tenant_id, engagement_id ON %I
         FOR EACH ROW EXECUTE FUNCTION reject_cross_tenant_engagement_row()',
      t.table_name || '_tenant_guard', t.table_name);
  END LOOP;
  PERFORM set_config('app.tenant_id', '', true);
END
$$;

-- Down Migration

DO $$
DECLARE t record;
BEGIN
  FOR t IN
    SELECT tgrelid::regclass::text AS tbl, tgname
      FROM pg_trigger WHERE tgname LIKE '%\_tenant\_guard' AND NOT tgisinternal
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %s', t.tgname, t.tbl);
  END LOOP;
END
$$;
DROP FUNCTION IF EXISTS reject_cross_tenant_engagement_row();
