-- 20260925000006_pbc_chase shipped without its "-- Up Migration" marker, so
-- the runner executed the whole file: the columns were added and then dropped
-- by the Down section in the same run, and the migration was recorded as
-- applied. Re-adding them here is idempotent everywhere the marker fix has
-- already taken effect.

-- Up Migration

ALTER TABLE pbc_item ADD COLUMN IF NOT EXISTS chased_at   timestamptz;
ALTER TABLE pbc_item ADD COLUMN IF NOT EXISTS chase_count int NOT NULL DEFAULT 0;

-- Down Migration

-- Intentionally empty: 20260925000006 owns these columns.
