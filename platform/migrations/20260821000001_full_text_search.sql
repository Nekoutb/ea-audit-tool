-- Phase 2: search. There was none anywhere in the product — an auditor looking
-- for the paper where a matter was discussed had to remember which task it was.
--
-- CONFIGURATION. 'simple' rather than 'english' or 'french': the product is
-- bilingual and a stemmer picked at index time would be wrong for half the
-- content. Audit text is also full of things a stemmer damages — account codes,
-- ISA references, proper names — where exact matching is what a user wants.
--
-- unaccent is layered on top because the alternative is a French firm failing
-- to find its own working papers: without it "creances" does not match
-- "Créances", and nobody types the accents into a search box.
--
-- Generated columns rather than triggers: the vector cannot drift out of step
-- with the text, because Postgres recomputes it on every write.

-- Up Migration

CREATE EXTENSION IF NOT EXISTS unaccent;

-- Rebuilt from scratch so re-running is idempotent.
DROP TEXT SEARCH CONFIGURATION IF EXISTS audit_search CASCADE;
CREATE TEXT SEARCH CONFIGURATION audit_search (COPY = simple);
ALTER TEXT SEARCH CONFIGURATION audit_search
  ALTER MAPPING FOR hword, hword_part, word WITH unaccent, simple;

COMMENT ON TEXT SEARCH CONFIGURATION audit_search IS
  'simple + unaccent. No stemming: the content is bilingual EN/FR and full of '
  'codes and names a stemmer would damage. Changing this silently changes every '
  'stored vector — rebuild the generated columns if it is ever altered.';

/*
 * One vector per table, over the columns that hold prose somebody would search
 * for. Status and enum columns are deliberately excluded: matching "open" or
 * "draft" against every row is noise, not a result.
 */

-- The index itself: how an auditor finds a task by name or code.
ALTER TABLE file_item ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('audit_search',
    coalesce(code, '') || ' ' || coalesce(title_en, '') || ' ' || coalesce(title_fr, ''))) STORED;

ALTER TABLE risk ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('audit_search',
    coalesce(description, '') || ' ' || coalesce(fs_note, '') || ' ' || coalesce(rebuttal_justification, ''))) STORED;

ALTER TABLE finding ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('audit_search',
    coalesce(title, '') || ' ' || coalesce(detail, '') || ' ' || coalesce(response, ''))) STORED;

ALTER TABLE misstatement ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('audit_search',
    coalesce(description, '') || ' ' || coalesce(accounts, ''))) STORED;

ALTER TABLE review_note ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('audit_search',
    coalesce(body, '') || ' ' || coalesce(response, ''))) STORED;

ALTER TABLE section_conclusion ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('audit_search', coalesce(conclusion, ''))) STORED;

ALTER TABLE program_step ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('audit_search',
    coalesce(description, '') || ' ' || coalesce(conclusion, ''))) STORED;

ALTER TABLE control_test ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('audit_search',
    coalesce(description, '') || ' ' || coalesce(note, ''))) STORED;

ALTER TABLE scot ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('audit_search',
    coalesce(name, '') || ' ' || coalesce(description, '') || ' ' || coalesce(strategy, ''))) STORED;

ALTER TABLE document ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('audit_search', coalesce(title, ''))) STORED;

-- The working papers themselves. form_response.value is jsonb holding whatever
-- the auditor typed, so it is flattened to text: this is the one that finds a
-- matter discussed in a paper rather than in its title.
ALTER TABLE form_response ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (to_tsvector('audit_search',
    coalesce(code, '') || ' ' || coalesce(field_key, '') || ' ' ||
    coalesce(value #>> '{}', ''))) STORED;

CREATE INDEX IF NOT EXISTS file_item_search_idx ON file_item USING gin (search_vector);
CREATE INDEX IF NOT EXISTS risk_search_idx ON risk USING gin (search_vector);
CREATE INDEX IF NOT EXISTS finding_search_idx ON finding USING gin (search_vector);
CREATE INDEX IF NOT EXISTS misstatement_search_idx ON misstatement USING gin (search_vector);
CREATE INDEX IF NOT EXISTS review_note_search_idx ON review_note USING gin (search_vector);
CREATE INDEX IF NOT EXISTS section_conclusion_search_idx ON section_conclusion USING gin (search_vector);
CREATE INDEX IF NOT EXISTS program_step_search_idx ON program_step USING gin (search_vector);
CREATE INDEX IF NOT EXISTS control_test_search_idx ON control_test USING gin (search_vector);
CREATE INDEX IF NOT EXISTS scot_search_idx ON scot USING gin (search_vector);
CREATE INDEX IF NOT EXISTS document_search_idx ON document USING gin (search_vector);
CREATE INDEX IF NOT EXISTS form_response_search_idx ON form_response USING gin (search_vector);

-- Down Migration

DROP INDEX IF EXISTS file_item_search_idx;
DROP INDEX IF EXISTS risk_search_idx;
DROP INDEX IF EXISTS finding_search_idx;
DROP INDEX IF EXISTS misstatement_search_idx;
DROP INDEX IF EXISTS review_note_search_idx;
DROP INDEX IF EXISTS section_conclusion_search_idx;
DROP INDEX IF EXISTS program_step_search_idx;
DROP INDEX IF EXISTS control_test_search_idx;
DROP INDEX IF EXISTS scot_search_idx;
DROP INDEX IF EXISTS document_search_idx;
DROP INDEX IF EXISTS form_response_search_idx;

ALTER TABLE file_item DROP COLUMN IF EXISTS search_vector;
ALTER TABLE risk DROP COLUMN IF EXISTS search_vector;
ALTER TABLE finding DROP COLUMN IF EXISTS search_vector;
ALTER TABLE misstatement DROP COLUMN IF EXISTS search_vector;
ALTER TABLE review_note DROP COLUMN IF EXISTS search_vector;
ALTER TABLE section_conclusion DROP COLUMN IF EXISTS search_vector;
ALTER TABLE program_step DROP COLUMN IF EXISTS search_vector;
ALTER TABLE control_test DROP COLUMN IF EXISTS search_vector;
ALTER TABLE scot DROP COLUMN IF EXISTS search_vector;
ALTER TABLE document DROP COLUMN IF EXISTS search_vector;
ALTER TABLE form_response DROP COLUMN IF EXISTS search_vector;

DROP TEXT SEARCH CONFIGURATION IF EXISTS audit_search CASCADE;
