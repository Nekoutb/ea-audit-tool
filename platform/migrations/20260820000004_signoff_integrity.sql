-- Sign-off integrity (assurance findings C4 / H1): a signature must attest to
-- the content that existed when it was given.
--
--   content_hash        the sha256 of the paper's content (its wp: form_response
--                       rows + the section conclusion) at the moment of signing.
--   invalidated_at      set when a later edit changes that content: the row is
--   invalidated_reason  kept so the history shows a signature was given AND that
--                       a subsequent edit voided it. The invalidating path also
--                       sets voided_at/void_reason, so every existing reader
--                       (gates, dashboards, exports) stops counting it as active
--                       without needing to know about the new columns.

-- Up Migration

ALTER TABLE signoff
  ADD COLUMN content_hash       text,
  ADD COLUMN invalidated_at     timestamptz,
  ADD COLUMN invalidated_reason text;

CREATE INDEX signoff_active_idx ON signoff (document_id)
  WHERE voided_at IS NULL AND invalidated_at IS NULL;

-- Down Migration

DROP INDEX IF EXISTS signoff_active_idx;

ALTER TABLE signoff
  DROP COLUMN IF EXISTS content_hash,
  DROP COLUMN IF EXISTS invalidated_at,
  DROP COLUMN IF EXISTS invalidated_reason;
