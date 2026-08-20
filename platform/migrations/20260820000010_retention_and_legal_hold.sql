-- Phase 2: how long an audit file must be kept, and how to stop it going
-- anywhere while a dispute is live.
--
-- Neither existed. C6.2 already asks a partner to confirm the retention period
-- has been set, which the schema could not hold — the product asked for an
-- attestation about a fact it did not record.
--
-- ISA 230 ¶A23 leaves the period to law and regulation. For OHADA/CEMAC the
-- binding floor is the commercial-law obligation to keep accounting records ten
-- years (AUDCIF art. 24), and an auditor's file is retained on the same footing,
-- so the default here is ten rather than the five ISQM 1 practice often quotes.
-- A firm may raise it; the CHECK stops anyone setting a period shorter than the
-- five years no jurisdiction the product serves goes below.

-- Up Migration

ALTER TABLE tenant
  ADD COLUMN IF NOT EXISTS retention_years integer NOT NULL DEFAULT 10;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenant_retention_years_range') THEN
    ALTER TABLE tenant ADD CONSTRAINT tenant_retention_years_range
      CHECK (retention_years BETWEEN 5 AND 30);
  END IF;
END $$;

COMMENT ON COLUMN tenant.retention_years IS
  'Years an archived engagement is kept. Default 10 (OHADA AUDCIF art. 24); the '
  'floor of 5 is the shortest period any jurisdiction the product serves allows.';

-- Stamped when the file is archived, from the firm's period and the report
-- date, so changing the firm setting later cannot retrospectively shorten the
-- life of a file that is already closed.
ALTER TABLE engagement
  ADD COLUMN IF NOT EXISTS retention_until date;

COMMENT ON COLUMN engagement.retention_until IS
  'Earliest date this file may be considered for destruction. Fixed at archive '
  'time from the report date (falling back to period end) plus the firm''s '
  'retention_years. A later change to the firm setting does not move it.';

/*
 * Legal hold.
 *
 * A hold has value only if it predates the attempt, which is why this ships
 * before any destruction path rather than alongside one. While a hold is
 * active the file survives retention expiry and cannot be destroyed by any
 * route, including one added later — the guard is a trigger, not a check in
 * application code that a future caller can forget.
 *
 * Both foreign keys are NO ACTION rather than CASCADE on purpose: deleting the
 * engagement a hold protects must fail loudly, not quietly remove the hold and
 * proceed.
 */
CREATE TABLE IF NOT EXISTS legal_hold (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     uuid NOT NULL REFERENCES tenant (id) ON DELETE NO ACTION,
  engagement_id uuid NOT NULL REFERENCES engagement (id) ON DELETE NO ACTION,
  reason        text NOT NULL,
  placed_by     uuid NOT NULL REFERENCES app_user (id) ON DELETE NO ACTION,
  placed_at     timestamptz NOT NULL DEFAULT now(),
  released_by   uuid REFERENCES app_user (id) ON DELETE NO ACTION,
  released_at   timestamptz,
  release_reason text,
  CONSTRAINT legal_hold_reason_present CHECK (length(btrim(reason)) > 0),
  CONSTRAINT legal_hold_release_complete CHECK (
    (released_at IS NULL AND released_by IS NULL AND release_reason IS NULL)
    OR (released_at IS NOT NULL AND released_by IS NOT NULL AND length(btrim(release_reason)) > 0)
  )
);

-- One active hold per engagement; released ones accumulate as history.
CREATE UNIQUE INDEX IF NOT EXISTS legal_hold_one_active_idx
  ON legal_hold (engagement_id) WHERE released_at IS NULL;

CREATE INDEX IF NOT EXISTS legal_hold_tenant_idx ON legal_hold (tenant_id);

COMMENT ON TABLE legal_hold IS
  'Suspends retention expiry for one engagement. Released rows are kept as '
  'history — who placed it, who lifted it, and why in both directions.';

-- A hold is a record of a legal position; it is amended by release, never by
-- rewriting. Only the release fields may ever change.
CREATE OR REPLACE FUNCTION legal_hold_append_only() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'legal_hold is append-only: DELETE is not permitted';
  END IF;
  IF NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.engagement_id IS DISTINCT FROM OLD.engagement_id
     OR NEW.reason IS DISTINCT FROM OLD.reason
     OR NEW.placed_by IS DISTINCT FROM OLD.placed_by
     OR NEW.placed_at IS DISTINCT FROM OLD.placed_at
  THEN
    RAISE EXCEPTION 'legal_hold: only the release fields may be updated';
  END IF;
  IF OLD.released_at IS NOT NULL THEN
    RAISE EXCEPTION 'legal_hold: a released hold cannot be changed again';
  END IF;
  RETURN NEW;
END
$fn$;

DROP TRIGGER IF EXISTS trg_legal_hold_append_only ON legal_hold;
CREATE TRIGGER trg_legal_hold_append_only
  BEFORE UPDATE OR DELETE ON legal_hold
  FOR EACH ROW EXECUTE FUNCTION legal_hold_append_only();

-- Refuse to remove an engagement while a hold is live. This is the guard the
-- whole table exists for: it must not depend on the caller remembering.
CREATE OR REPLACE FUNCTION reject_delete_under_hold() RETURNS trigger
LANGUAGE plpgsql AS $fn$
BEGIN
  IF EXISTS (SELECT 1 FROM legal_hold h
              WHERE h.engagement_id = OLD.id AND h.released_at IS NULL) THEN
    RAISE EXCEPTION 'legal-hold'
      USING DETAIL = format('engagement %s is under legal hold and cannot be deleted', OLD.id);
  END IF;
  RETURN OLD;
END
$fn$;

DROP TRIGGER IF EXISTS trg_engagement_legal_hold ON engagement;
CREATE TRIGGER trg_engagement_legal_hold
  BEFORE DELETE ON engagement
  FOR EACH ROW EXECUTE FUNCTION reject_delete_under_hold();

-- Tenant isolation, same as every other engagement-scoped table.
ALTER TABLE legal_hold ENABLE ROW LEVEL SECURITY;
ALTER TABLE legal_hold FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS legal_hold_tenant_isolation ON legal_hold;
CREATE POLICY legal_hold_tenant_isolation ON legal_hold
  USING (tenant_id = current_setting('app.tenant_id', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true)::uuid);

DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'ea_app') THEN
    EXECUTE 'GRANT SELECT, INSERT, UPDATE ON legal_hold TO ea_app';
    -- Deliberately no DELETE: the trigger refuses it anyway, and the grant
    -- should say the same thing as the trigger.
    EXECUTE 'REVOKE DELETE ON legal_hold FROM ea_app';
  END IF;
END $$;

-- Backfill: an already-archived file has a retention date too, and leaving it
-- NULL would mean the oldest files were the only ones with no recorded period.
UPDATE engagement e
   SET retention_until =
       (coalesce(e.report_date, e.period_end)
        + (SELECT t.retention_years FROM tenant t WHERE t.id = e.tenant_id) * interval '1 year')::date
 WHERE e.archived_at IS NOT NULL AND e.retention_until IS NULL;

-- Down Migration

DROP TRIGGER IF EXISTS trg_engagement_legal_hold ON engagement;
DROP FUNCTION IF EXISTS reject_delete_under_hold();
DROP TRIGGER IF EXISTS trg_legal_hold_append_only ON legal_hold;
DROP FUNCTION IF EXISTS legal_hold_append_only();
DROP TABLE IF EXISTS legal_hold;
ALTER TABLE engagement DROP COLUMN IF EXISTS retention_until;
ALTER TABLE tenant DROP CONSTRAINT IF EXISTS tenant_retention_years_range;
ALTER TABLE tenant DROP COLUMN IF EXISTS retention_years;
