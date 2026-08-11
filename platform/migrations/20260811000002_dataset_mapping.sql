-- Confirmed column mapping chosen on the dataset analyzer confirm screen.
ALTER TABLE sub_ledger_dataset ADD COLUMN IF NOT EXISTS mapping jsonb;
