-- Engagement identity profile captured at creation: the year-end period,
-- duration, nature of the engagement, phase of the work, reporting framework
-- and whether this is a first-year appointment. The nature-of-entity
-- classification (complexity) already exists; task propagation is deferred to
-- that classification, so an unclassified engagement simply has no file items.

ALTER TABLE engagement
  ADD COLUMN IF NOT EXISTS duration_months integer,
  ADD COLUMN IF NOT EXISTS nature text,
  ADD COLUMN IF NOT EXISTS engagement_phase text,
  ADD COLUMN IF NOT EXISTS framework text,
  ADD COLUMN IF NOT EXISTS first_year boolean;
