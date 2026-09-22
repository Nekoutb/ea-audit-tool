-- The items drawn for a test of controls: the occurrence numbers (1..population)
-- the random draw selected, kept with the control so the Excel extract shows
-- the very items that were generated — and a fresh draw replaces them.

-- Up Migration

ALTER TABLE scot_control ADD COLUMN IF NOT EXISTS toc_sample_items integer[];
ALTER TABLE scot_control ADD COLUMN IF NOT EXISTS toc_sample_drawn_at timestamptz;

-- Down Migration

ALTER TABLE scot_control DROP COLUMN IF EXISTS toc_sample_items;
ALTER TABLE scot_control DROP COLUMN IF EXISTS toc_sample_drawn_at;
