-- F041 (firm decision 2026-10-27): a sixth assertion, RO — rights and
-- obligations — joins C/E/A/V/P on the risk register, the CRA matrix (S3.1)
-- and the procedure design (S5.5). The register, the WCGWs and the program
-- steps hold assertions as unconstrained text[], so only the CRA cell table
-- carries a CHECK to widen. Existing cells are untouched: the RO column of an
-- engagement assessed before today simply has no row yet, and the board shows
-- it empty, to be assessed.

-- Up Migration

ALTER TABLE cra_assessment DROP CONSTRAINT IF EXISTS cra_assessment_assertion_check;
ALTER TABLE cra_assessment
  ADD CONSTRAINT cra_assessment_assertion_check CHECK (assertion IN ('C', 'E', 'A', 'V', 'P', 'RO'));

-- Down Migration

-- The five-code CHECK comes back NOT VALID: rows already assessed for RO are
-- kept (nothing is deleted), new RO rows are refused.
ALTER TABLE cra_assessment DROP CONSTRAINT IF EXISTS cra_assessment_assertion_check;
ALTER TABLE cra_assessment
  ADD CONSTRAINT cra_assessment_assertion_check CHECK (assertion IN ('C', 'E', 'A', 'V', 'P')) NOT VALID;
