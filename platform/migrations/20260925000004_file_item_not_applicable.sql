-- A task the team decides not to perform is recorded as not applicable, with
-- the reason, rather than left untouched: the archive gate tasks_addressed
-- (lib/completion.ts) refuses a file holding tasks that are neither worked nor
-- marked not applicable (UAT B63).

-- Up Migration

ALTER TABLE file_item
  ADD COLUMN IF NOT EXISTS na_reason text,
  ADD COLUMN IF NOT EXISTS na_by uuid REFERENCES app_user (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS na_at timestamptz;

COMMENT ON COLUMN file_item.na_reason IS
  'Why the task is not applicable to this engagement; NULL when the task is expected to be performed.';

-- Down Migration

ALTER TABLE file_item
  DROP COLUMN IF EXISTS na_at,
  DROP COLUMN IF EXISTS na_by,
  DROP COLUMN IF EXISTS na_reason;
