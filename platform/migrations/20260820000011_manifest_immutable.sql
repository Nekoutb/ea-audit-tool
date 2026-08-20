-- The archive manifest is the record of what the file contained when it closed.
-- It was the one such record the application role could still rewrite.
--
-- completion_record is deliberately exempt from the archive-immutability
-- triggers (see the header of 20260820000002) because archiveEngagement writes
-- the manifest into it, and because points-forward must stay writable across the
-- rollforward boundary. That exemption is right for the table and wrong for this
-- one key, so the key is guarded instead.
--
-- recordCompletion already refuses 'archive_manifest' in application code. This
-- is the layer beneath: direct SQL as ea_app could rewrite it, and the one row
-- proving what was archived should not depend on a TypeScript check.

-- Up Migration

CREATE OR REPLACE FUNCTION reject_manifest_rewrite() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF OLD.key = 'archive_manifest' THEN
    RAISE EXCEPTION 'archive-manifest-immutable'
      USING DETAIL = format('%s on the archive manifest of engagement %s is not permitted',
                            TG_OP, OLD.engagement_id);
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS trg_manifest_immutable ON completion_record;
CREATE TRIGGER trg_manifest_immutable
  BEFORE UPDATE OR DELETE ON completion_record
  FOR EACH ROW EXECUTE FUNCTION reject_manifest_rewrite();

COMMENT ON FUNCTION reject_manifest_rewrite() IS
  'Blocks UPDATE/DELETE of the archive_manifest completion_record. Other keys, '
  'including points_forward, are unaffected.';

-- Down Migration

DROP TRIGGER IF EXISTS trg_manifest_immutable ON completion_record;
DROP FUNCTION IF EXISTS reject_manifest_rewrite();
