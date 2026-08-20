-- Default working papers for the account tasks (E4.1 Trade Receivables,
-- E4.2 Trade Payables, E4.3 Inventory, E4.4 Fixed Assets).
--
-- Nothing to migrate: the firm's four Excel papers live in the repo under
-- `wp-templates/` and are attached lazily, per engagement, by
-- lib/wp-templates.ts — the first time an auditor opens one of those tasks the
-- template is inserted into task_attachment as version 1. Seeding in SQL would
-- mean carrying the bytes in a migration and writing rows for engagements
-- nobody has opened (archived files included), so the application owns it.
--
-- This migration exists for the record, so the change has a dated entry in the
-- schema history alongside the code that introduced it.

-- Up Migration

SELECT 1;

-- Down Migration

SELECT 1;
