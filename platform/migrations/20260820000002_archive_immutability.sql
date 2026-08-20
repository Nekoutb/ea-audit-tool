-- Archive immutability enforced by the DATABASE (assurance finding C3: an
-- archived engagement was only "read-only" where an application chokepoint
-- happened to call assertMutable — 8 call sites against ~40 mutation entry
-- points, and nothing at all below the application layer).
--
-- ISA 230 ¶14–16: once the file is assembled and archived it is a closed
-- record. From here the guarantee is a row-level trigger on every
-- evidence-bearing table: whatever the path — server action, API route, a
-- future background job, an operator with a psql prompt as ea_app — a write
-- that touches a row belonging to an archived engagement raises
-- 'engagement-archived'. The application-layer guards stay (lib/mutability.ts)
-- because they produce a clean, translatable error; the trigger is now the
-- authority.
--
-- Deliberately NOT guarded:
--   * engagement            — archiveEngagement() stamps archived_at on it, and
--                             a future supervised un-archive must be able to
--                             clear it. Guarding it would lock out the very
--                             statement that closes the file.
--   * completion_record     — carries the archive manifest itself. Verified in
--                             lib/completion.ts#archiveEngagement: the manifest
--                             INSERT runs BEFORE the UPDATE that sets
--                             archived_at, so the order is already safe, but the
--                             table stays open so the manifest can be re-stated
--                             and so points-forward can be read/written across
--                             the rollforward boundary.
--   * activity_log,         — audit trail, notifications, time and discussion.
--     notification,           None of them is audit evidence, and blocking them
--     time_entry, comment     would stop the file from recording that it was
--                             archived (or from being discussed afterwards).
--   * trial_balance*, gl_*, sub_ledger_* — imported source data, owned by the
--                             analytics workstream; the app already refuses
--                             imports on a closed file.
--
-- Two escape hatches remain, both intentional:
--   * TRUNCATE does not fire row-level triggers (no application path issues it).
--   * A cascade from deleting a parent row (tenant, client, engagement, app_user)
--     runs at pg_trigger_depth() > 1 and is allowed through — otherwise an
--     archived engagement could never be removed even when its whole tenant is,
--     and ON DELETE SET NULL housekeeping on app_user deletion would fail.
--     A direct DELETE against an archived engagement's rows still raises.

-- Up Migration

-- Guard for tables that carry engagement_id themselves. Optional argument: the
-- column name to read (defaults to 'engagement_id'). A NULL value is not
-- resolvable and is left to the table's own constraints.
CREATE OR REPLACE FUNCTION reject_archived_write() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  col  text := coalesce(TG_ARGV[0], 'engagement_id');
  data jsonb;
  eid  uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN data := to_jsonb(OLD); ELSE data := to_jsonb(NEW); END IF;
  IF pg_trigger_depth() <= 1 THEN
    eid := nullif(data ->> col, '')::uuid;
    IF eid IS NOT NULL
       AND EXISTS (SELECT 1 FROM engagement e WHERE e.id = eid AND e.archived_at IS NOT NULL)
    THEN
      RAISE EXCEPTION 'engagement-archived'
        USING DETAIL = format('%s on %s refused: engagement %s is archived (ISA 230)',
                              TG_OP, TG_TABLE_NAME, eid);
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$fn$;

-- Guard for tables that reach the engagement through a parent. Arguments:
--   [0] the foreign-key column on this table
--   [1] a query resolving that key to an engagement id, taking it as $1
CREATE OR REPLACE FUNCTION reject_archived_child_write() RETURNS trigger
LANGUAGE plpgsql AS $fn$
DECLARE
  col    text := TG_ARGV[0];
  lookup text := TG_ARGV[1];
  data   jsonb;
  parent uuid;
  eid    uuid;
BEGIN
  IF TG_OP = 'DELETE' THEN data := to_jsonb(OLD); ELSE data := to_jsonb(NEW); END IF;
  IF pg_trigger_depth() <= 1 THEN
    parent := nullif(data ->> col, '')::uuid;
    IF parent IS NOT NULL THEN
      EXECUTE lookup INTO eid USING parent;
      IF eid IS NOT NULL
         AND EXISTS (SELECT 1 FROM engagement e WHERE e.id = eid AND e.archived_at IS NOT NULL)
      THEN
        RAISE EXCEPTION 'engagement-archived'
          USING DETAIL = format('%s on %s refused: engagement %s is archived (ISA 230)',
                                TG_OP, TG_TABLE_NAME, eid);
      END IF;
    END IF;
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END
$fn$;

-- Tables carrying engagement_id: the working papers, the risk model, the
-- evidence, the conclusions.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'form_response',
    'program_step',
    'task_attachment',
    'document',
    'section_conclusion',
    'evidence',
    'misstatement',
    'finding',
    'risk',
    'potential_risk',
    'control_test',
    'scot',
    'confirmation',
    'cra_assessment',
    'accounting_estimate',
    'materiality',
    'related_party',
    'pbc_item',
    'planning_snapshot',
    'adjusting_journal',
    'review_note'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_archive_guard', t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON %I
         FOR EACH ROW EXECUTE FUNCTION reject_archived_write()',
      t || '_archive_guard', t);
  END LOOP;
END $$;

-- Tables reached through a parent. review_note gets a SECOND guard because its
-- engagement_id is nullable: a note raised on a document carries document_id
-- only, and each guard skips the shape it cannot resolve.
DO $$
DECLARE
  spec text[];
BEGIN
  FOREACH spec SLICE 1 IN ARRAY ARRAY[
    -- table, fk column, lookup taking the fk value as $1
    ['document_version',    'document_id', 'SELECT engagement_id FROM document WHERE id = $1'],
    ['signoff',             'document_id', 'SELECT engagement_id FROM document WHERE id = $1'],
    ['review_note',         'document_id', 'SELECT engagement_id FROM document WHERE id = $1'],
    ['risk_response',       'risk_id',     'SELECT engagement_id FROM risk WHERE id = $1'],
    ['risk_section',        'risk_id',     'SELECT engagement_id FROM risk WHERE id = $1'],
    ['risk_lead_index',     'risk_id',     'SELECT engagement_id FROM risk WHERE id = $1'],
    ['scot_index',          'scot_id',     'SELECT engagement_id FROM scot WHERE id = $1'],
    ['wcgw',                'scot_id',     'SELECT engagement_id FROM scot WHERE id = $1'],
    ['scot_control',        'scot_id',     'SELECT engagement_id FROM scot WHERE id = $1'],
    ['wcgw_control',        'wcgw_id',     'SELECT s.engagement_id FROM wcgw w JOIN scot s ON s.id = w.scot_id WHERE w.id = $1'],
    ['materiality_specific','materiality_id', 'SELECT engagement_id FROM materiality WHERE id = $1'],
    ['adjusting_journal_line', 'journal_id', 'SELECT engagement_id FROM adjusting_journal WHERE id = $1']
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', spec[1] || '_archive_parent_guard', spec[1]);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON %I
         FOR EACH ROW EXECUTE FUNCTION reject_archived_child_write(%L, %L)',
      spec[1] || '_archive_parent_guard', spec[1], spec[2], spec[3]);
  END LOOP;
END $$;

-- Down Migration

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'form_response', 'program_step', 'task_attachment', 'document', 'section_conclusion',
    'evidence', 'misstatement', 'finding', 'risk', 'potential_risk', 'control_test',
    'scot', 'confirmation', 'cra_assessment', 'accounting_estimate', 'materiality',
    'related_party', 'pbc_item', 'planning_snapshot', 'adjusting_journal', 'review_note'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_archive_guard', t);
  END LOOP;

  FOREACH t IN ARRAY ARRAY[
    'document_version', 'signoff', 'review_note', 'risk_response', 'risk_section',
    'risk_lead_index', 'scot_index', 'wcgw', 'scot_control', 'wcgw_control',
    'materiality_specific', 'adjusting_journal_line'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', t || '_archive_parent_guard', t);
  END LOOP;
END $$;

DROP FUNCTION IF EXISTS reject_archived_child_write();
DROP FUNCTION IF EXISTS reject_archived_write();
