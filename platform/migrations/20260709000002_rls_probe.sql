-- A minimal tenant-scoped table used solely to prove Row-Level Security tenant
-- isolation, exercised by tests/lib/rls.test.ts and by CI on every push. It is a
-- permanent, intentional self-test fixture: cheap insurance that the RLS
-- mechanism keeps working as real tenant-scoped tables are added in later phases.
-- Its name is listed in db/rls.sql so the tenant_isolation policy applies to it.

-- Up Migration

CREATE TABLE rls_probe (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  uuid NOT NULL REFERENCES tenant (id) ON DELETE CASCADE,
  note       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX rls_probe_tenant_id_idx ON rls_probe (tenant_id);

-- Down Migration

DROP TABLE IF EXISTS rls_probe;
