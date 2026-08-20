-- Extends the archive lock (20260820000002) to evidence-bearing tables it
-- missed. Found by an adversarial test against production: with an engagement
-- archived inside a transaction, `UPDATE file_item SET title_en = title_en`
-- succeeded on 114 rows while form_response and activity_log were correctly
-- refused. The trigger worked; these tables simply never carried it.
--
-- file_item is the working-paper index itself — its code, title, owner,
-- assignee, due date and materiality flag. An archived file whose index can be
-- renamed or reassigned is not a closed record (ISA 230 ¶14-16), so this is the
-- one that mattered.
--
-- The source-data tables are a considered reversal. 20260820000002 left
-- trial_balance, sub_ledger_dataset and gl_line open on the grounds that "the
-- app already refuses imports on a closed file" — application-layer reasoning
-- for a database-layer control, which is the precise weakness that guarding was
-- meant to remove. They are the figures the opinion rests on. Verified safe:
-- gl_line is only ever written by buildProjection, reached through POST
-- /api/engagements/[id]/gl-analytics, which calls assertMutable first, so no
-- read path builds a projection.
--
-- Still deliberately open, unchanged from 20260820000002:
--   engagement         archiveEngagement() stamps archived_at on it
--   completion_record  carries the manifest, written BEFORE archived_at is set
--   activity_log       append-only by its own trigger; must record the archiving
--   notification, time_entry, comment
--                      not audit evidence; the file may still be discussed and
--                      time may still be booked against a closed engagement

-- Up Migration

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    -- the working-paper index
    'file_item',
    -- the figures under audit
    'trial_balance',
    'sub_ledger_dataset',
    'gl_line',
    -- who performed and reviewed the work (ISA 220 ¶14-17)
    'team_member',
    -- OHADA statutory duties that form part of the file
    'alerte',
    'convention',
    'fait_delictueux',
    'statutory_deadline',
    'independence_campaign',
    -- planning and machine-generated records belonging to the file
    'budget_line',
    'automation_run',
    'revise_log'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    -- only guard it if it actually carries engagement_id
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = t AND column_name = 'engagement_id'
    ) THEN CONTINUE; END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_archive_' || t, t);
    EXECUTE format(
      'CREATE TRIGGER %I BEFORE INSERT OR UPDATE OR DELETE ON %I
         FOR EACH ROW EXECUTE FUNCTION reject_archived_write()',
      'trg_archive_' || t, t);
  END LOOP;
END $$;

-- Down Migration

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'file_item', 'trial_balance', 'sub_ledger_dataset', 'gl_line', 'team_member',
    'alerte', 'convention', 'fait_delictueux', 'statutory_deadline',
    'independence_campaign', 'budget_line', 'automation_run', 'revise_log'
  ]
  LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS %I ON %I', 'trg_archive_' || t, t);
  END LOOP;
END $$;
