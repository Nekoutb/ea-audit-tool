-- The deck's four risk types, made first-class: each register entry carries a
-- category — business (from the entity's objectives and environment), fraud,
-- or error. Presumed ISA 240 risks are fraud by construction.

-- Up Migration

ALTER TABLE risk
  ADD COLUMN IF NOT EXISTS category text
  CHECK (category IN ('business', 'fraud', 'error'));

UPDATE risk SET category = 'fraud' WHERE presumed_type IS NOT NULL AND category IS NULL;

-- Down Migration

ALTER TABLE risk DROP COLUMN IF EXISTS category;
