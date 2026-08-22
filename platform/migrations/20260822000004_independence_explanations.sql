-- Independence exceptions must explain themselves (IESBA Code §120: identify
-- the threat, evaluate it, address it). An exception answer now carries the
-- member's own account of the circumstances and mitigating factors/safeguards,
-- captured at confirmation time, keyed by question.

ALTER TABLE independence_confirmation ADD COLUMN IF NOT EXISTS explanations jsonb;
