-- Sub-ledger datasets carry an audit timing, mirroring the trial balance:
-- a pre-audit GL and a post-audit GL live side by side, and uploading a file
-- REPLACES the previous dataset of the same kind and timing (the replacement
-- itself happens in lib/subledgers.ts createDataset, inside the ingest tx).
-- Existing datasets all become pre_audit; nothing else changes for them.

-- Up Migration

ALTER TABLE sub_ledger_dataset
  ADD COLUMN IF NOT EXISTS timing text NOT NULL DEFAULT 'pre_audit'
  CHECK (timing IN ('pre_audit', 'post_audit'));

CREATE INDEX IF NOT EXISTS sub_ledger_dataset_timing_idx
  ON sub_ledger_dataset (engagement_id, kind, timing);

-- Down Migration

DROP INDEX IF EXISTS sub_ledger_dataset_timing_idx;
ALTER TABLE sub_ledger_dataset DROP COLUMN IF EXISTS timing;
