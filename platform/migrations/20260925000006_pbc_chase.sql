-- Chasing a PBC request (UAT B112). A request the client has not answered is
-- reminded from the PBC list; the list shows when it was last chased and how
-- many times, so a reviewer can see the follow-up rather than take it on trust.

ALTER TABLE pbc_item ADD COLUMN IF NOT EXISTS chased_at   timestamptz;
ALTER TABLE pbc_item ADD COLUMN IF NOT EXISTS chase_count int NOT NULL DEFAULT 0;

-- Down Migration

ALTER TABLE pbc_item DROP COLUMN IF EXISTS chase_count;
ALTER TABLE pbc_item DROP COLUMN IF EXISTS chased_at;
