-- ISA engine Wave 3, module A1 (circularisation upgrade): subject-type
-- coverage and positive/negative designation with the ISA 505.15 gate.
-- Expand-only. The A1 items that need no schema: `difference` already exists
-- on the base table; the ISA 705 scope-limitation flag is derived from state
-- (positive request closed with neither a reply nor an alternative procedure);
-- reminder cadence reads sent_at / reminder_count / last_reminder_at.

-- Up Migration

ALTER TABLE confirmation
  ADD COLUMN subject text NOT NULL DEFAULT 'receivable'
    CHECK (subject IN ('bank', 'receivable', 'payable',
                       'inventory_third_party', 'legal', 'lender')),
  ADD COLUMN method text NOT NULL DEFAULT 'positive'
    CHECK (method IN ('positive', 'negative')),
  ADD COLUMN method_rationale jsonb;

-- Down Migration

ALTER TABLE confirmation
  DROP COLUMN IF EXISTS subject,
  DROP COLUMN IF EXISTS method,
  DROP COLUMN IF EXISTS method_rationale;
