-- Task-level approver assignment (operator request): alongside the preparer
-- (owner_id) and the general assignee, a task can name who is expected to
-- approve it. Enforcement of WHO MAY approve stays in signDocument (partner-
-- only codes are checked there against rank, not this column) — this column
-- is the staffing plan, the sign-off is the act.
ALTER TABLE file_item ADD COLUMN IF NOT EXISTS approver_user_id uuid REFERENCES app_user (id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS file_item_approver_idx ON file_item (engagement_id, approver_user_id) WHERE approver_user_id IS NOT NULL;
