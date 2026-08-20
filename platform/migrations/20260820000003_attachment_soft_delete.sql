-- Attachments are audit evidence: deleting them must be recoverable and
-- attributable (ISA 230 ¶8-11 — the file must show what was there and who
-- removed it). Closes assurance finding C1: deleteAttachment() hard-deleted
-- every version with no role check, no archive guard and no recovery path.
--
-- Soft delete keeps the row (and its bytes) and stamps who removed it and
-- when. Read paths filter on deleted_at IS NULL; restore is allowed inside a
-- 30-day window (enforced in lib/attachments.ts).
--
-- The UNIQUE (file_item_id, name, version) key is deliberately left as is:
-- version numbers keep climbing past a deleted name so a later re-upload can
-- never collide with, or silently resurrect, a removed version chain.

-- Up Migration

ALTER TABLE task_attachment
  ADD COLUMN deleted_at timestamptz,
  ADD COLUMN deleted_by uuid REFERENCES app_user (id) ON DELETE SET NULL;

-- Every list/get/download path filters on deleted_at IS NULL; a partial index
-- keeps those reads on the live rows only.
CREATE INDEX task_attachment_live_idx
  ON task_attachment (tenant_id, file_item_id, name, version DESC)
  WHERE deleted_at IS NULL;

-- Down Migration

DROP INDEX IF EXISTS task_attachment_live_idx;

ALTER TABLE task_attachment
  DROP COLUMN IF EXISTS deleted_by,
  DROP COLUMN IF EXISTS deleted_at;
