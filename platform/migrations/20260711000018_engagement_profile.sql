-- Engagement profile: a user-defined engagement name (naming convention lives in
-- tenant.branding.engagementNaming) and the complexity classification captured at
-- creation from the 15-question assessment (lib/complexity.ts). The classification
-- drives how much of the audit file index is instantiated (nature/timing/extent):
-- complex = full index, non_complex = standard, very_simple = core only.
-- Existing engagements were created with the full index, so they backfill as
-- 'complex' via the column default.

-- Up Migration

ALTER TABLE engagement ADD COLUMN name text;
ALTER TABLE engagement ADD COLUMN complexity text NOT NULL DEFAULT 'complex'
  CHECK (complexity IN ('complex', 'non_complex', 'very_simple'));
ALTER TABLE engagement ADD COLUMN complexity_answers jsonb;

-- Down Migration

ALTER TABLE engagement DROP COLUMN IF EXISTS complexity_answers;
ALTER TABLE engagement DROP COLUMN IF EXISTS complexity;
ALTER TABLE engagement DROP COLUMN IF EXISTS name;
