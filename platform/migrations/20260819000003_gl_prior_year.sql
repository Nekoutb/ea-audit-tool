-- A third GL timing: the PRIOR-YEAR general ledger. It feeds the GL insight
-- suite (preparers/reviewers turnover, class volume deltas) with a true N-1
-- comparison base. Mirrors 20260817000002_tb_prior_year for the trial balance.
-- The column-level CHECK from 20260817000001 carries Postgres's default name
-- sub_ledger_dataset_timing_check.

-- Up Migration

ALTER TABLE sub_ledger_dataset DROP CONSTRAINT IF EXISTS sub_ledger_dataset_timing_check;
ALTER TABLE sub_ledger_dataset
  ADD CONSTRAINT sub_ledger_dataset_timing_check
  CHECK (timing IN ('pre_audit', 'post_audit', 'prior_year'));

-- Down Migration

SELECT 1;
