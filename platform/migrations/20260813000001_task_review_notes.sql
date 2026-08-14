-- Review notes on a TASK (file_item), not only on a generated document: the
-- working-paper screen raises them, and a note addressed to the task's
-- assignee surfaces on that user's dashboard.

-- Up Migration

ALTER TABLE review_note ALTER COLUMN document_id DROP NOT NULL;
ALTER TABLE review_note ADD COLUMN IF NOT EXISTS file_item_id uuid REFERENCES file_item (id) ON DELETE CASCADE;
ALTER TABLE review_note ADD COLUMN IF NOT EXISTS engagement_id uuid REFERENCES engagement (id) ON DELETE CASCADE;
ALTER TABLE review_note ADD COLUMN IF NOT EXISTS assignee_id uuid REFERENCES app_user (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS review_note_item_idx ON review_note (tenant_id, file_item_id, status);
CREATE INDEX IF NOT EXISTS review_note_assignee_idx ON review_note (tenant_id, assignee_id, status);

-- Down Migration

DROP INDEX IF EXISTS review_note_assignee_idx;
DROP INDEX IF EXISTS review_note_item_idx;
ALTER TABLE review_note DROP COLUMN IF EXISTS assignee_id;
ALTER TABLE review_note DROP COLUMN IF EXISTS engagement_id;
ALTER TABLE review_note DROP COLUMN IF EXISTS file_item_id;
