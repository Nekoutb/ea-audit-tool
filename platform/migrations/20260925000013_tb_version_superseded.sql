-- Re-importing a trial balance into a slot (pre-audit, post-audit, prior
-- year) deleted every earlier version of that slot and reused its number, so
-- the history was gone and current_version_no could point at a version that
-- no longer existed — or, after an invalid re-import, at nothing valid. The
-- earlier version now stays, marked superseded; version numbers only ever
-- grow, and the readers that want the live upload of a slot filter on
-- superseded_at IS NULL (lib/tb.ts, lib/financial-analysis.ts).

-- Up Migration

ALTER TABLE trial_balance_version ADD COLUMN IF NOT EXISTS superseded_at timestamptz;

CREATE INDEX IF NOT EXISTS trial_balance_version_live_idx
  ON trial_balance_version (trial_balance_id, timing)
  WHERE superseded_at IS NULL;

-- Down Migration

DROP INDEX IF EXISTS trial_balance_version_live_idx;
ALTER TABLE trial_balance_version DROP COLUMN IF EXISTS superseded_at;
