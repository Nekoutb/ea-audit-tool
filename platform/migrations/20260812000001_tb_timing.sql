-- Two trial-balance timings per engagement: the Pre-audit TB (the client's
-- balance the audit works from) and the Post-audit TB (after adjustments).
-- Uploading a timing replaces that timing's TB outright — no version list.

-- Up Migration

ALTER TABLE trial_balance_version
  ADD COLUMN IF NOT EXISTS timing text NOT NULL DEFAULT 'pre_audit'
  CHECK (timing IN ('pre_audit', 'post_audit'));

-- Down Migration

ALTER TABLE trial_balance_version DROP COLUMN IF EXISTS timing;
