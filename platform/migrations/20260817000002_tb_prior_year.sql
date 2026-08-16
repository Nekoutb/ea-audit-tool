-- A third trial-balance timing: the PRIOR YEAR TB. It feeds the financial
-- analysis and ratio battery with true prior-year closing balances (including
-- the prior P&L, which the current TB's opening balances cannot carry under
-- SYSCOHADA where classes 6/7 reset at year start). It never becomes the
-- active working version — only a valid pre-audit TB drives the file.

-- Up Migration

ALTER TABLE trial_balance_version DROP CONSTRAINT IF EXISTS trial_balance_version_timing_check;
ALTER TABLE trial_balance_version
  ADD CONSTRAINT trial_balance_version_timing_check
  CHECK (timing IN ('pre_audit', 'post_audit', 'prior_year'));

-- Down Migration

ALTER TABLE trial_balance_version DROP CONSTRAINT IF EXISTS trial_balance_version_timing_check;
ALTER TABLE trial_balance_version
  ADD CONSTRAINT trial_balance_version_timing_check
  CHECK (timing IN ('pre_audit', 'post_audit'));
