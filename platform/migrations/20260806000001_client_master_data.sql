-- Entity master data (IA audit #7): reusable client-level fields.
-- Expand-only; UI ships with the entity-record rework.
ALTER TABLE client
  ADD COLUMN registration_number text,
  ADD COLUMN niu text,
  ADD COLUMN address text,
  ADD COLUMN year_end text,
  ADD COLUMN framework text,
  ADD COLUMN pie boolean NOT NULL DEFAULT false;
