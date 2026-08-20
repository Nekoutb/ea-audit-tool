import pg from "pg";
import { afterAll, describe, expect, it } from "vitest";

/**
 * What the application's own database role may and may not do.
 *
 * db/create-app-role.sql grants SELECT/INSERT/UPDATE/DELETE ON ALL TABLES as a
 * broad sweep and then narrows it. A future migration that re-runs a blanket
 * GRANT — or a new table added without thought — would silently widen it again,
 * and nothing in the application would look any different. These assertions are
 * the thing that notices.
 */

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });

afterAll(async () => {
  await admin.end();
});

async function can(table: string, privilege: string): Promise<boolean> {
  const r = await admin.query<{ ok: boolean }>(
    `SELECT has_table_privilege('ea_app', c.oid, $2) AS ok
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1`,
    [table, privilege],
  );
  return r.rows[0]?.ok ?? false;
}

describe("the app role cannot destroy what the app never deletes", () => {
  // The only global delete in the codebase is lib/users.ts removing a
  // membership. Everything else here is surface area a leaked credential could
  // use, for no functional gain.
  it.each(["engagement", "client", "tenant", "app_user"])(
    "cannot DELETE %s",
    async (table) => {
      expect(await can(table, "DELETE")).toBe(false);
    },
  );

  it("keeps DELETE on membership, which is how a person leaves a firm", async () => {
    expect(await can("membership", "DELETE")).toBe(true);
  });

  it("keeps DELETE on engagement-scoped working data", async () => {
    // Clearing a form field is a delete; the archive triggers decide when it is
    // allowed, not the grant.
    expect(await can("form_response", "DELETE")).toBe(true);
  });

  it("can still read and write the tables it revoked DELETE on", async () => {
    for (const table of ["engagement", "client", "tenant", "app_user"]) {
      expect(await can(table, "SELECT")).toBe(true);
      expect(await can(table, "UPDATE")).toBe(true);
    }
  });
});

describe("append-only tables", () => {
  it("lets the app write the audit trail but never amend it", async () => {
    expect(await can("activity_log", "INSERT")).toBe(true);
    expect(await can("activity_log", "SELECT")).toBe(true);
    expect(await can("activity_log", "UPDATE")).toBe(false);
    expect(await can("activity_log", "DELETE")).toBe(false);
  });

  it("lets the app place and release a legal hold but never remove one", async () => {
    expect(await can("legal_hold", "INSERT")).toBe(true);
    expect(await can("legal_hold", "UPDATE")).toBe(true);
    expect(await can("legal_hold", "DELETE")).toBe(false);
  });
});

describe("the role itself", () => {
  it("is not a superuser and does not bypass row-level security", async () => {
    // Forced RLS constrains a non-superuser, non-owner login role and nothing
    // else. If either of these ever became true, tenant isolation would stop
    // being enforced without a single line of application code changing.
    const r = await admin.query<{ rolsuper: boolean; rolbypassrls: boolean }>(
      "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'ea_app'",
    );
    expect(r.rows[0].rolsuper).toBe(false);
    expect(r.rows[0].rolbypassrls).toBe(false);
  });
});
