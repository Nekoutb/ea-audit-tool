-- The procédure d'alerte deadlines (15 days for the reply, 8 days for the
-- communication to the associés, one month for the board minutes) run from
-- the day the event happened — the letter sent, the reply received — not the
-- day it was keyed into the file. alerte_event gets the event's own date; the
-- stage deadline is computed from it (lib/alerte.ts) and the history shows it.
-- Existing rows keep the day they were recorded, which is all that was known.

-- Up Migration

ALTER TABLE alerte_event ADD COLUMN IF NOT EXISTS event_date date;

UPDATE alerte_event SET event_date = created_at::date WHERE event_date IS NULL;

-- Down Migration

ALTER TABLE alerte_event DROP COLUMN IF EXISTS event_date;
