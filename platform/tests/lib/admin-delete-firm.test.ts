import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The delete-firm policy lives in the admin_delete_firm SECURITY DEFINER
// function (migration 20260822000001): archived files and legal holds refuse
// deletion, everything else cascades, and accounts whose only firm this was
// are removed. Exercised here as the app role calls it in production.

const T1 = "b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b801"; // deletable firm
const T2 = "b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b802"; // survivor firm
const U_ONLY = "b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b811"; // member of T1 only
const U_BOTH = "b8b8b8b8-b8b8-4b8b-8b8b-b8b8b8b8b812"; // member of T1 and T2

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const app = new pg.Pool({ connectionString: process.env.APP_DATABASE_URL });

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = ANY($1)", [[T1, T2]]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1)", [[U_ONLY, U_BOTH]]);
}

async function makeFirm(id: string, slug: string): Promise<void> {
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, $2, $2)", [id, slug]);
}

beforeAll(async () => {
  await removeFixture();
  await makeFirm(T1, "delete-me-firm");
  await makeFirm(T2, "survivor-firm");
  for (const [id, email] of [
    [U_ONLY, "only@delete-firm.local"],
    [U_BOTH, "both@delete-firm.local"],
  ]) {
    await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, $2, $2, 'x')", [id, email]);
    await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'staff')", [id, T1]);
  }
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'staff')", [U_BOTH, T2]);
  const c = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Delete SA', 'SA') RETURNING id",
    [T1],
  );
  await admin.query(
    "INSERT INTO engagement (tenant_id, client_id, fiscal_year, period_end) VALUES ($1, $2, 2025, '2025-12-31')",
    [T1, c.rows[0].id],
  );
}, 60_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await app.end();
});

describe("admin_delete_firm", () => {
  it("refuses a firm with an archived audit file", async () => {
    await admin.query("UPDATE engagement SET archived_at = now() WHERE tenant_id = $1", [T1]);
    await expect(app.query("SELECT admin_delete_firm($1)", [T1])).rejects.toThrow("firm-has-archived-files");
    await admin.query("UPDATE engagement SET archived_at = NULL WHERE tenant_id = $1", [T1]);
  });

  it("refuses an unknown firm", async () => {
    await expect(
      app.query("SELECT admin_delete_firm($1)", ["00000000-0000-4000-8000-000000000000"]),
    ).rejects.toThrow("firm-not-found");
  });

  it("deletes the firm, cascades its data, removes only its exclusive accounts", async () => {
    const r = await app.query<{ admin_delete_firm: number }>("SELECT admin_delete_firm($1)", [T1]);
    expect(r.rows[0].admin_delete_firm).toBe(1);

    const gone = await admin.query("SELECT 1 FROM tenant WHERE id = $1", [T1]);
    expect(gone.rowCount).toBe(0);
    const clients = await admin.query("SELECT 1 FROM client WHERE tenant_id = $1", [T1]);
    expect(clients.rowCount).toBe(0);

    const only = await admin.query("SELECT 1 FROM app_user WHERE id = $1", [U_ONLY]);
    expect(only.rowCount).toBe(0);
    const both = await admin.query("SELECT 1 FROM app_user WHERE id = $1", [U_BOTH]);
    expect(both.rowCount).toBe(1);
    const bothMembership = await admin.query("SELECT tenant_id FROM membership WHERE user_id = $1", [U_BOTH]);
    expect(bothMembership.rows).toEqual([{ tenant_id: T2 }]);
  });

  it("the app role still cannot DELETE tenant directly", async () => {
    // SQLSTATE 42501 (insufficient_privilege) — the message text is localized.
    const direct = await app
      .query("DELETE FROM tenant WHERE id = $1", [T2])
      .then(() => "allowed")
      .catch((e: Error & { code?: string }) => e.code);
    expect(direct).toBe("42501");
  });
});
