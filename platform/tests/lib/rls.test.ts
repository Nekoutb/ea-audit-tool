import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closePool, withTenant } from "@/lib/db";

// Two throwaway tenants used to prove isolation. Seeded/torn down as the owner
// role (DATABASE_URL, superuser — bypasses RLS); the assertions below run as the
// app role (APP_DATABASE_URL = ea_app), which RLS actually constrains.
const TENANT_A = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const TENANT_B = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function removeTestTenants(): Promise<void> {
  // Cascades to their rls_probe rows.
  await admin.query("DELETE FROM tenant WHERE id = ANY($1::uuid[])", [[TENANT_A, TENANT_B]]);
}

beforeAll(async () => {
  await removeTestTenants();
  await admin.query(
    "INSERT INTO tenant (id, name, slug) VALUES ($1, 'RLS Test A', 'rls-test-a'), ($2, 'RLS Test B', 'rls-test-b')",
    [TENANT_A, TENANT_B],
  );
  await admin.query(
    "INSERT INTO rls_probe (tenant_id, note) VALUES ($1, 'secret-A'), ($2, 'secret-B')",
    [TENANT_A, TENANT_B],
  );
});

afterAll(async () => {
  await removeTestTenants();
  await admin.end();
  await closePool();
});

describe("Row-Level Security tenant isolation", () => {
  it("sees only its own tenant's rows", async () => {
    const rows = await withTenant(TENANT_A, async (client) => {
      const result = await client.query<{ tenant_id: string; note: string }>(
        "SELECT tenant_id, note FROM rls_probe",
      );
      return result.rows;
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].note).toBe("secret-A");
    expect(rows[0].tenant_id).toBe(TENANT_A);
  });

  it("cannot read another tenant's rows even when explicitly targeting them", async () => {
    const count = await withTenant(TENANT_A, async (client) => {
      const result = await client.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM rls_probe WHERE tenant_id = $1",
        [TENANT_B],
      );
      return result.rows[0].n;
    });

    expect(count).toBe("0");
  });

  it("blocks inserting a row for another tenant (WITH CHECK)", async () => {
    await expect(
      withTenant(TENANT_A, async (client) => {
        await client.query("INSERT INTO rls_probe (tenant_id, note) VALUES ($1, 'evil')", [
          TENANT_B,
        ]);
      }),
    ).rejects.toThrow();
  });

  it("sees no rows when no tenant context is set (fails closed)", async () => {
    // Query rls_probe directly on a pooled connection with no app.tenant_id GUC.
    const result = await admin.query("SELECT 1"); // keep admin pool warm
    expect(result.rowCount).toBe(1);

    const { pool } = await import("@/lib/db");
    const r = await pool.query<{ n: string }>("SELECT count(*)::text AS n FROM rls_probe");
    // ea_app with no GUC set -> policy NULL -> zero rows visible.
    expect(r.rows[0].n).toBe("0");
  });
});

// Coverage, not just behaviour.
//
// db/rls.sql carries a literal list of table names and a comment (db/rls.sql:17-18)
// asking later phases to add to it. Eleven migrations went on to apply policies
// in their own FOREACH loops instead, and nothing anywhere asserted that the
// union of all that actually covers the schema — a table could be added with a
// tenant_id and no policy, and every test would still pass while one firm's rows
// were readable by another. This is that assertion.
describe("row-level security covers every tenant-scoped table", () => {
  // membership is read during authentication, before a tenant context exists,
  // and is scoped by user_id in application code. Any addition to this list is
  // a deliberate decision that belongs in review.
  const DELIBERATELY_GLOBAL = ["membership"];

  it("leaves no tenant-scoped table without ENABLE + FORCE and a policy", async () => {
    const { rows } = await admin.query<{ relname: string }>(
      `SELECT c.relname
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relkind = 'r'
          AND EXISTS (SELECT 1 FROM pg_attribute a
                       WHERE a.attrelid = c.oid AND a.attname = 'tenant_id'
                         AND a.attnum > 0 AND NOT a.attisdropped)
          AND (NOT c.relrowsecurity
               OR NOT c.relforcerowsecurity
               OR NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid))
        ORDER BY c.relname`,
    );
    const unprotected = rows.map((r) => r.relname).filter((t) => !DELIBERATELY_GLOBAL.includes(t));
    expect(
      unprotected,
      `these tables carry tenant_id but no enforced policy — add one in the migration that creates them`,
    ).toEqual([]);
  });
});
