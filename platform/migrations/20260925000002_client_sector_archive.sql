-- Client register: a sector on the entity record, and a way to retire a
-- client (UAT B98, B126).
--
-- sector: the industry the entity operates in, one of the keys the register
-- offers (lib/clients.ts SECTORS); free text at the column level so a later
-- key needs no migration.
--
-- archived_at: a retired client stays in the database with every engagement
-- and its history intact, but is hidden from the register and from the
-- new-engagement lookup unless asked for. Nothing is ever deleted.

-- Up Migration

ALTER TABLE client ADD COLUMN IF NOT EXISTS sector text;
ALTER TABLE client ADD COLUMN IF NOT EXISTS archived_at timestamptz;

CREATE INDEX IF NOT EXISTS client_archived_idx ON client (tenant_id, archived_at);

-- Down Migration

DROP INDEX IF EXISTS client_archived_idx;
ALTER TABLE client DROP COLUMN IF EXISTS archived_at;
ALTER TABLE client DROP COLUMN IF EXISTS sector;
