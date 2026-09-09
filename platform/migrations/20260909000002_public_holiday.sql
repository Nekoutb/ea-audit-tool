-- The public-holiday calendar the journal-entry selection engine tests dates
-- against (lib/je-selection.ts, criterion "public-holiday").
--
-- Nothing in this repository knew what a public holiday was before this
-- migration. The weekend test could be written against extract(isodow …), but
-- "posted on a day the country does not work" needs a calendar, and a calendar
-- is data, not arithmetic.
--
-- Two tables, the same division of labour as syscohada_grouping_rule and
-- client_grouping_override in migrations/20260710000006_tb_groupings.sql:
--
--   public_holiday — the national calendar. Deliberately NOT tenant-scoped and
--     deliberately read-only to the application: 1 January is 1 January for
--     every firm on the box, and a national holiday is not one tenant's data.
--     ea_app is granted SELECT and nothing else.
--
--   firm_holiday  — the firm's own dates, tenant-isolated under RLS like every
--     other tenant table. engagement_id is nullable on purpose: a row without
--     one applies to every file the firm runs (a company holiday, a local
--     closure), and a row with one is that single engagement's own date, which
--     is how a client's factory shutdown gets tested without editing the
--     national calendar.
--
-- WHAT IS SEEDED, AND WHAT IS NOT.
--
-- Seeded — Cameroon's six FIXED public holidays, 2020 to 2035, generated from
-- their fixed month and day:
--   1 January (New Year), 11 February (Youth Day), 1 May (Labour Day),
--   20 May (National Day), 15 August (Assumption), 25 December (Christmas).
--
-- Seeded — Good Friday and Ascension for 2023 to 2027 only, written out date by
-- date. They are movable but they are DERIVED, not declared: Ascension is the
-- thirty-ninth day after Western Easter, and both are listed here as literal
-- dates so that nothing in the running system computes a feast day.
--
-- NOT seeded — Eid al-Fitr (Fête du Ramadan) and Eid al-Adha (Fête du Mouton).
-- Both are fixed each year by announcement after the moon is sighted, they move
-- by a day between countries and sometimes between years' predictions, and no
-- source for the dates actually observed in Cameroon could be verified while
-- this migration was written. A wrong holiday is worse than a missing one: it
-- puts a line into an auditor's selection with a reason that is not true. The
-- firm adds each year's two dates to firm_holiday as the authorities announce
-- them — lib/je-selection.ts#addFirmHoliday, or the INSERT at the foot of this
-- file's comment block:
--
--   INSERT INTO firm_holiday (tenant_id, country, holiday_date, label_en, label_fr)
--   VALUES ('<tenant uuid>', 'CM', '<yyyy-mm-dd>', 'Eid al-Fitr', 'Fête du Ramadan');
--
-- Adding a later year of Good Friday and Ascension works the same way, or by a
-- new migration extending the seed below.

-- Up Migration

CREATE TABLE IF NOT EXISTS public_holiday (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  country      text NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
  holiday_date date NOT NULL,
  label_en     text NOT NULL,
  label_fr     text NOT NULL,
  -- fixed-date holidays are generated; movable ones are written out per year
  movable      boolean NOT NULL DEFAULT false,
  -- where the date came from, so a later reader can retrace it
  source       text NOT NULL DEFAULT 'seed',
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (country, holiday_date, label_en)
);

CREATE INDEX IF NOT EXISTS public_holiday_lookup_idx ON public_holiday (country, holiday_date);

CREATE TABLE IF NOT EXISTS firm_holiday (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  -- null means the date applies to every engagement of this firm
  engagement_id uuid REFERENCES engagement (id) ON DELETE CASCADE,
  country       text NOT NULL CHECK (country ~ '^[A-Z]{2}$'),
  holiday_date  date NOT NULL,
  label_en      text NOT NULL,
  label_fr      text NOT NULL,
  created_by    uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Two partial indexes rather than one UNIQUE constraint: a nullable
-- engagement_id inside a UNIQUE would let the same firm-wide date be entered
-- any number of times, because NULL is never equal to NULL.
CREATE UNIQUE INDEX IF NOT EXISTS firm_holiday_firm_wide_idx
  ON firm_holiday (tenant_id, country, holiday_date)
  WHERE engagement_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS firm_holiday_engagement_idx
  ON firm_holiday (tenant_id, engagement_id, country, holiday_date)
  WHERE engagement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS firm_holiday_lookup_idx
  ON firm_holiday (tenant_id, country, holiday_date);

-- Tenant isolation, same policy shape as every other tenant-scoped table
-- (db/rls.sql). FORCE so the policy binds the owner role too.
ALTER TABLE firm_holiday ENABLE ROW LEVEL SECURITY;
ALTER TABLE firm_holiday FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_isolation ON firm_holiday;
CREATE POLICY tenant_isolation ON firm_holiday
  USING (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid)
  WITH CHECK (tenant_id = NULLIF(current_setting('app.tenant_id', true), '')::uuid);

-- The national calendar is reference data: the application reads it and never
-- writes it, so it carries no policy and no INSERT grant.
GRANT SELECT ON public_holiday TO ea_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON firm_holiday TO ea_app;

-- Archive immutability. migrations/20260820000002_archive_immutability.sql owns
-- the guard function and its table list; that migration has been applied and is
-- never edited, so a table created afterwards attaches the same trigger here.
-- Only the engagement-scoped rows are reachable by it — reject_archived_write()
-- leaves a NULL engagement_id alone, which is exactly right for a firm-wide
-- date that belongs to no file.
DROP TRIGGER IF EXISTS firm_holiday_archive_guard ON firm_holiday;
CREATE TRIGGER firm_holiday_archive_guard
  BEFORE INSERT OR UPDATE OR DELETE ON firm_holiday
  FOR EACH ROW EXECUTE FUNCTION reject_archived_write();

-- ---------------------------------------------------------------------------
-- Cameroon, fixed dates. Re-runnable: the seed is idempotent on the natural key.

INSERT INTO public_holiday (country, holiday_date, label_en, label_fr, movable, source)
SELECT 'CM', make_date(y, h.month, h.day), h.label_en, h.label_fr, false, 'cm-fixed'
  FROM generate_series(2020, 2035) AS y,
       (VALUES
          (1,  1,  'New Year''s Day', 'Jour de l''An'),
          (2,  11, 'Youth Day',       'Fête de la Jeunesse'),
          (5,  1,  'Labour Day',      'Fête du Travail'),
          (5,  20, 'National Day',    'Fête Nationale'),
          (8,  15, 'Assumption',      'Assomption'),
          (12, 25, 'Christmas Day',   'Noël')
       ) AS h(month, day, label_en, label_fr)
ON CONFLICT (country, holiday_date, label_en) DO NOTHING;

-- Cameroon, the two Christian movable feasts, written out per year. Good Friday
-- is the Friday before Western Easter; Ascension is the thirty-ninth day after
-- it. Listed rather than computed so that no running code has to know what a
-- computus is, and so that adding 2028 is a visible edit.
INSERT INTO public_holiday (country, holiday_date, label_en, label_fr, movable, source)
VALUES
  ('CM', DATE '2023-04-07', 'Good Friday', 'Vendredi Saint', true, 'cm-movable'),
  ('CM', DATE '2024-03-29', 'Good Friday', 'Vendredi Saint', true, 'cm-movable'),
  ('CM', DATE '2025-04-18', 'Good Friday', 'Vendredi Saint', true, 'cm-movable'),
  ('CM', DATE '2026-04-03', 'Good Friday', 'Vendredi Saint', true, 'cm-movable'),
  ('CM', DATE '2027-03-26', 'Good Friday', 'Vendredi Saint', true, 'cm-movable'),
  ('CM', DATE '2023-05-18', 'Ascension',   'Ascension',      true, 'cm-movable'),
  ('CM', DATE '2024-05-09', 'Ascension',   'Ascension',      true, 'cm-movable'),
  ('CM', DATE '2025-05-29', 'Ascension',   'Ascension',      true, 'cm-movable'),
  ('CM', DATE '2026-05-14', 'Ascension',   'Ascension',      true, 'cm-movable'),
  ('CM', DATE '2027-05-06', 'Ascension',   'Ascension',      true, 'cm-movable')
ON CONFLICT (country, holiday_date, label_en) DO NOTHING;

-- Down Migration

DROP TRIGGER IF EXISTS firm_holiday_archive_guard ON firm_holiday;
DROP TABLE IF EXISTS firm_holiday;
DROP TABLE IF EXISTS public_holiday;
