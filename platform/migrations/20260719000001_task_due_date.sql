-- Per-task deadlines: an editable due date on each working-paper task.
-- Display logic prefers file_item.due_date and falls back to the phase-derived
-- deadline (lib/engagement-dashboard phaseDeadline). No RLS change needed —
-- file_item is already tenant-isolated.

-- Up Migration

ALTER TABLE file_item ADD COLUMN due_date date;

-- Down Migration

ALTER TABLE file_item DROP COLUMN IF EXISTS due_date;
