-- S2.2 / Sampling tool: the sample for a control's test of operating
-- effectiveness is COMPUTED by the sampling tool (random / MUS) and assigned
-- onto the control — never typed by hand on the design screen.

-- Up Migration

ALTER TABLE scot_control ADD COLUMN IF NOT EXISTS sample_size integer;
ALTER TABLE scot_control ADD COLUMN IF NOT EXISTS sample_note text;

-- Down Migration

ALTER TABLE scot_control DROP COLUMN IF EXISTS sample_size;
ALTER TABLE scot_control DROP COLUMN IF EXISTS sample_note;
