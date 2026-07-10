-- Build Phase 6: third-party confirmations (ISA 505, spec §11.3) — full
-- lifecycle: selection → letter → management approval → dispatch → reminders →
-- reply evaluation → disposition / alternative procedures.

-- Up Migration

CREATE TABLE confirmation (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id      uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  file_item_id       uuid REFERENCES file_item (id) ON DELETE SET NULL,
  ctype              text NOT NULL CHECK (ctype IN
                     ('ar_positive', 'ar_negative', 'ap', 'bank', 'legal',
                      'related_party', 'inventory_third_party')),
  party_name         text NOT NULL,
  party_email        text,
  book_amount        numeric(18, 0),
  status             text NOT NULL DEFAULT 'prepared' CHECK (status IN
                     ('prepared', 'approved', 'sent', 'replied', 'reconciled',
                      'exception', 'alternative', 'closed')),
  reply_token        text NOT NULL UNIQUE,
  letter_document_id uuid REFERENCES document (id) ON DELETE SET NULL,
  sent_at            timestamptz,
  reminder_count     int NOT NULL DEFAULT 0,
  last_reminder_at   timestamptz,
  replied_at         timestamptz,
  confirmed_amount   numeric(18, 0),
  difference         numeric(18, 0),
  disposition        text CHECK (disposition IN ('timing', 'client_error', 'confirmee_error')),
  alt_procedure      text,
  source_row         jsonb,
  created_by         uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX confirmation_idx ON confirmation (tenant_id, engagement_id, ctype, status);

DO $$
BEGIN
  EXECUTE 'ALTER TABLE confirmation ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE confirmation FORCE ROW LEVEL SECURITY';
  EXECUTE 'DROP POLICY IF EXISTS tenant_isolation ON confirmation';
  EXECUTE 'CREATE POLICY tenant_isolation ON confirmation
             USING (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)
             WITH CHECK (tenant_id = NULLIF(current_setting(''app.tenant_id'', true), '''')::uuid)';
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON confirmation TO ea_app;

-- Down Migration

DROP TABLE IF EXISTS confirmation;
