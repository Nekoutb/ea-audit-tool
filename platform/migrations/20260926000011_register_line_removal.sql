-- S4.3 related parties and S4.4 accounting estimates: a wrong line can be
-- removed (UAT run 2 B26). Removal is soft — the row stays on the file with who
-- removed it and when, and every read path skips it. ADD COLUMN fires no row
-- trigger, so archived engagements are untouched.
--
-- Duplicate names are refused by lib/registers.ts under an advisory lock, not by
-- a unique index: existing files (archived ones included, which cannot be
-- rewritten) may already hold duplicates.

-- Up Migration

ALTER TABLE related_party ADD COLUMN IF NOT EXISTS removed_at timestamptz;
ALTER TABLE related_party ADD COLUMN IF NOT EXISTS removed_by uuid REFERENCES app_user (id) ON DELETE SET NULL;
ALTER TABLE accounting_estimate ADD COLUMN IF NOT EXISTS removed_at timestamptz;
ALTER TABLE accounting_estimate ADD COLUMN IF NOT EXISTS removed_by uuid REFERENCES app_user (id) ON DELETE SET NULL;

-- Down Migration

ALTER TABLE accounting_estimate DROP COLUMN IF EXISTS removed_by;
ALTER TABLE accounting_estimate DROP COLUMN IF EXISTS removed_at;
ALTER TABLE related_party DROP COLUMN IF EXISTS removed_by;
ALTER TABLE related_party DROP COLUMN IF EXISTS removed_at;
