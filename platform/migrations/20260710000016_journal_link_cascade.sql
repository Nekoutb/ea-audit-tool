-- Deleting a client (or engagement) cascades through adjusting_journal, but
-- the version↔journal link table blocked it: its journal_id FK had no delete
-- action, so the cascade failed mid-flight depending on FK evaluation order.
-- Align it with the rest of the schema.

-- Up Migration

ALTER TABLE trial_balance_version_journal
  DROP CONSTRAINT trial_balance_version_journal_journal_id_fkey;
ALTER TABLE trial_balance_version_journal
  ADD CONSTRAINT trial_balance_version_journal_journal_id_fkey
  FOREIGN KEY (journal_id) REFERENCES adjusting_journal (id) ON DELETE CASCADE;

-- Down Migration

ALTER TABLE trial_balance_version_journal
  DROP CONSTRAINT trial_balance_version_journal_journal_id_fkey;
ALTER TABLE trial_balance_version_journal
  ADD CONSTRAINT trial_balance_version_journal_journal_id_fkey
  FOREIGN KEY (journal_id) REFERENCES adjusting_journal (id);
