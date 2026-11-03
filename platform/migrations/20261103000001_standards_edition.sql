-- F045 (firm decision 2026-10-27): the edition of the ISAs an engagement is
-- audited under. ISA 240 (Revised) and ISA 570 (Revised 2024) apply to periods
-- beginning on or after 15 December 2026; earlier periods apply the editions in
-- force. The papers, the JE workbook and the generated documents cite the
-- paragraph numbers and the wording of the engagement's edition
-- (lib/standards-edition.ts), so the edition is a fact of the engagement:
--   'current'      — the editions in force
--   'revised_2026' — ISA 240 (Revised), ISA 570 (Revised 2024)
-- Set at creation from the first day of the period; a manager or above may
-- override it from the engagement settings, with a reason in activity_log.
--
-- Backfill: the first day of the period is the day after the period end less
-- the duration (twelve months when the engagement never said) — the same rule
-- lib/standards-edition.ts periodStartOf applies at creation.

-- Up Migration

ALTER TABLE engagement ADD COLUMN IF NOT EXISTS standards_edition text;

UPDATE engagement
   SET standards_edition = CASE
     WHEN (period_end + 1 - make_interval(months => coalesce(duration_months, 12)))::date >= DATE '2026-12-15'
       THEN 'revised_2026'
     ELSE 'current'
   END
 WHERE standards_edition IS NULL;

ALTER TABLE engagement ALTER COLUMN standards_edition SET DEFAULT 'current';
ALTER TABLE engagement ALTER COLUMN standards_edition SET NOT NULL;
ALTER TABLE engagement DROP CONSTRAINT IF EXISTS engagement_standards_edition_check;
ALTER TABLE engagement
  ADD CONSTRAINT engagement_standards_edition_check CHECK (standards_edition IN ('current', 'revised_2026'));

-- Down Migration

-- The column and its values stay (nothing is deleted); only the constraints
-- the application relies on are lifted, so an older build inserting without
-- the column still works.
ALTER TABLE engagement DROP CONSTRAINT IF EXISTS engagement_standards_edition_check;
ALTER TABLE engagement ALTER COLUMN standards_edition DROP NOT NULL;
ALTER TABLE engagement ALTER COLUMN standards_edition DROP DEFAULT;
