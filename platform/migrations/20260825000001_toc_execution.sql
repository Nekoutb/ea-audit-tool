-- Test-of-controls execution fields (EY GAM CONTROLS 4-7 + SAMPLE 3):
--   operating_eval  the preparer's conclusion per control — Effective / Not
--                   effective — recorded on the E1.2 board. Distinct from the
--                   derived control_test roll-up: this is the documented
--                   judgment after evaluating exceptions (CONTROLS 7.3).
--   toc_population  occurrences of the control in the period of reliance —
--                   drives the SAMPLE 3.3 minimum size.
--   toc_grid        the transactions tested: JSON {attributes: string[],
--                   rows: [{ref, date, desc, results: {attr: pass|fail|na}}]}
--                   — the sample matrix with user-amendable attributes.
ALTER TABLE scot_control
  ADD COLUMN IF NOT EXISTS operating_eval text
    CHECK (operating_eval IN ('effective', 'not_effective')),
  ADD COLUMN IF NOT EXISTS toc_population integer,
  ADD COLUMN IF NOT EXISTS toc_grid jsonb;
