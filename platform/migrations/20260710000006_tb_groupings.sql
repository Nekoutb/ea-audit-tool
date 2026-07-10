-- Phase 3 foundation (steps 3.1–3.3, 3.5–3.6): trial balances with immutable
-- versions, adjusting journals, and the SYSCOHADA grouping rules (global
-- methodology seed + tenant-scoped client overrides).
-- The grouping SEED lives in migration 20260710000008 (single corrected source
-- for both fresh installs and existing databases). Tenant-scoped tables here
-- are covered by db/rls.sql.

-- Up Migration

CREATE TABLE trial_balance (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  client_id          uuid NOT NULL REFERENCES client (id) ON DELETE CASCADE,
  engagement_id      uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  currency           text NOT NULL DEFAULT 'XOF' CHECK (currency ~ '^[A-Z]{3}$'),
  period_end         date NOT NULL,
  current_version_no int NOT NULL DEFAULT 0 CHECK (current_version_no >= 0),
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (engagement_id)
);

CREATE INDEX trial_balance_tenant_client_idx
  ON trial_balance (tenant_id, client_id, period_end DESC);

CREATE TRIGGER trial_balance_set_updated_at
  BEFORE UPDATE ON trial_balance
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE trial_balance_version (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  trial_balance_id   uuid NOT NULL REFERENCES trial_balance (id) ON DELETE CASCADE,
  version_no         int NOT NULL CHECK (version_no > 0),
  version_kind       text NOT NULL DEFAULT 'initial'
                     CHECK (version_kind IN ('initial', 'adjusted', 'final')),
  validation_status  text NOT NULL DEFAULT 'pending'
                     CHECK (validation_status IN ('pending', 'valid', 'invalid')),
  source_filename    text,
  source_sha256      text,
  base_version_id    uuid REFERENCES trial_balance_version (id) ON DELETE RESTRICT,
  row_count          int NOT NULL DEFAULT 0 CHECK (row_count >= 0),
  total_debit        numeric(30, 6) NOT NULL DEFAULT 0,
  total_credit       numeric(30, 6) NOT NULL DEFAULT 0,
  validation_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by         uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trial_balance_id, version_no)
);

CREATE INDEX trial_balance_version_idx
  ON trial_balance_version (tenant_id, trial_balance_id, version_no DESC);

CREATE TABLE trial_balance_row (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  version_id      uuid NOT NULL REFERENCES trial_balance_version (id) ON DELETE CASCADE,
  row_no          int NOT NULL CHECK (row_no > 0),
  account_code    text NOT NULL,
  account_name    text,
  opening_debit   numeric(30, 6) NOT NULL DEFAULT 0,
  opening_credit  numeric(30, 6) NOT NULL DEFAULT 0,
  debit           numeric(30, 6) NOT NULL DEFAULT 0,
  credit          numeric(30, 6) NOT NULL DEFAULT 0,
  raw_data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (version_id, row_no)
);

CREATE INDEX trial_balance_row_account_idx
  ON trial_balance_row (tenant_id, version_id, account_code);

-- Audit adjusting journals; a derived adjusted/final version explicitly lists
-- the journals it applies through trial_balance_version_journal, so
-- FINAL = initial + client adjustments + booked audit adjustments reproducibly
-- (spec §10.1).
CREATE TABLE adjusting_journal (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  engagement_id   uuid NOT NULL REFERENCES engagement (id) ON DELETE CASCADE,
  trial_balance_id uuid NOT NULL REFERENCES trial_balance (id) ON DELETE CASCADE,
  journal_no      int NOT NULL CHECK (journal_no > 0),
  description     text NOT NULL,
  status          text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'posted', 'voided')),
  created_by      uuid REFERENCES app_user (id) ON DELETE SET NULL,
  posted_by      uuid REFERENCES app_user (id) ON DELETE SET NULL,
  posted_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (trial_balance_id, journal_no)
);

CREATE INDEX adjusting_journal_idx
  ON adjusting_journal (tenant_id, trial_balance_id, journal_no);

CREATE TRIGGER adjusting_journal_set_updated_at
  BEFORE UPDATE ON adjusting_journal
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TABLE adjusting_journal_line (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  journal_id    uuid NOT NULL REFERENCES adjusting_journal (id) ON DELETE CASCADE,
  line_no       int NOT NULL CHECK (line_no > 0),
  account_code  text NOT NULL,
  account_name  text,
  debit         numeric(30, 6) NOT NULL DEFAULT 0 CHECK (debit >= 0),
  credit        numeric(30, 6) NOT NULL DEFAULT 0 CHECK (credit >= 0),
  description   text,
  CHECK (NOT (debit > 0 AND credit > 0)),
  CHECK (debit > 0 OR credit > 0),
  UNIQUE (journal_id, line_no)
);

CREATE INDEX adjusting_journal_line_idx
  ON adjusting_journal_line (tenant_id, journal_id, account_code);

CREATE TABLE trial_balance_version_journal (
  tenant_id       uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  version_id      uuid NOT NULL REFERENCES trial_balance_version (id) ON DELETE CASCADE,
  journal_id      uuid NOT NULL REFERENCES adjusting_journal (id) ON DELETE RESTRICT,
  applied_order   int NOT NULL CHECK (applied_order > 0),
  PRIMARY KEY (version_id, journal_id)
);

CREATE INDEX trial_balance_version_journal_idx
  ON trial_balance_version_journal (tenant_id, version_id, applied_order);

-- Global methodology rules (public seed data — intentionally NOT tenant-scoped;
-- client-specific customisations below are tenant-isolated).
CREATE TABLE syscohada_grouping_rule (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_prefix text NOT NULL UNIQUE CHECK (account_prefix ~ '^[0-9]{1,8}$'),
  label_en       text NOT NULL,
  label_fr       text NOT NULL,
  fs_ref         text NOT NULL,
  section_code   text NOT NULL CHECK (section_code ~ '^E[0-9]{3}$'),
  priority       smallint NOT NULL DEFAULT 0,
  source         text NOT NULL DEFAULT 'starter',
  active         boolean NOT NULL DEFAULT true,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE client_grouping_override (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id      uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  client_id      uuid NOT NULL REFERENCES client (id) ON DELETE CASCADE,
  match_type     text NOT NULL CHECK (match_type IN ('exact', 'prefix')),
  account_prefix text NOT NULL CHECK (account_prefix ~ '^[0-9]{1,8}$'),
  label_en       text NOT NULL,
  label_fr       text NOT NULL,
  fs_ref         text NOT NULL,
  section_code   text NOT NULL CHECK (section_code ~ '^E[0-9]{3}$'),
  rationale      text NOT NULL,
  active         boolean NOT NULL DEFAULT true,
  created_by     uuid REFERENCES app_user (id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, match_type, account_prefix)
);

CREATE INDEX client_grouping_override_idx
  ON client_grouping_override (tenant_id, client_id, active, account_prefix);

CREATE TRIGGER client_grouping_override_set_updated_at
  BEFORE UPDATE ON client_grouping_override
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Down Migration

DROP TABLE IF EXISTS client_grouping_override;
DROP TABLE IF EXISTS syscohada_grouping_rule;
DROP TABLE IF EXISTS trial_balance_version_journal;
DROP TABLE IF EXISTS adjusting_journal_line;
DROP TABLE IF EXISTS adjusting_journal;
DROP TABLE IF EXISTS trial_balance_row;
DROP TABLE IF EXISTS trial_balance_version;
DROP TABLE IF EXISTS trial_balance;
