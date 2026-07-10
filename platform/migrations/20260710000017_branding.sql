-- White-label phase 1: per-firm branding. The tenant table is GLOBAL (no
-- RLS) — application code must always scope reads/writes to the session
-- tenant id, never a client-supplied one.

-- Up Migration

ALTER TABLE tenant ADD COLUMN branding jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Down Migration

ALTER TABLE tenant DROP COLUMN IF EXISTS branding;
