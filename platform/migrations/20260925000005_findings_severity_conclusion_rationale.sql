-- UAT batch 1 (2026-09-25).
--
-- B21: a finding routed to C5.1 carries a severity (ISA 265: significant
-- deficiency / deficiency / observation), a recommendation and management's
-- response, so the management letter can group the points and the register
-- can show what kind of point each one is.
--
-- B45: an E-section can be concluded "objectives achieved" with no procedure
-- retained only against a written rationale; the rationale lives with the
-- conclusion it justifies.
--
-- B65: ten years is the retention floor (OHADA / ISA 230 practice); firms set
-- below it are raised to it before the tighter constraint is applied.

-- Up Migration

ALTER TABLE finding
  ADD COLUMN IF NOT EXISTS severity text
    CHECK (severity IN ('significant_deficiency', 'deficiency', 'observation')),
  ADD COLUMN IF NOT EXISTS recommendation text,
  ADD COLUMN IF NOT EXISTS management_response text;

ALTER TABLE section_conclusion
  ADD COLUMN IF NOT EXISTS no_procedures_rationale text;

UPDATE tenant SET retention_years = 10 WHERE retention_years < 10;
ALTER TABLE tenant DROP CONSTRAINT IF EXISTS tenant_retention_years_range;
ALTER TABLE tenant ADD CONSTRAINT tenant_retention_years_range
  CHECK (retention_years BETWEEN 10 AND 30);

-- Down Migration

ALTER TABLE tenant DROP CONSTRAINT IF EXISTS tenant_retention_years_range;
ALTER TABLE tenant ADD CONSTRAINT tenant_retention_years_range
  CHECK (retention_years BETWEEN 5 AND 30);
ALTER TABLE section_conclusion DROP COLUMN IF EXISTS no_procedures_rationale;
ALTER TABLE finding DROP COLUMN IF EXISTS management_response;
ALTER TABLE finding DROP COLUMN IF EXISTS recommendation;
ALTER TABLE finding DROP COLUMN IF EXISTS severity;
