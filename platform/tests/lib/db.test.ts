import { afterAll, describe, expect, it } from "vitest";
import { closePool, pool, withTenant } from "@/lib/db";

afterAll(async () => {
  await closePool();
});

describe("withTenant", () => {
  it("sets app.tenant_id inside the transaction", async () => {
    const tenantId = "11111111-1111-1111-1111-111111111111";

    const seen = await withTenant(tenantId, async (client) => {
      const result = await client.query<{ t: string }>(
        "SELECT current_setting('app.tenant_id', true) AS t",
      );
      return result.rows[0].t;
    });

    expect(seen).toBe(tenantId);
  });

  it("does not leak the tenant id outside the transaction", async () => {
    // A fresh query on a pooled connection must not see a previously-set,
    // transaction-local app.tenant_id (is_local = true resets at tx end).
    const result = await pool.query<{ t: string | null }>(
      "SELECT current_setting('app.tenant_id', true) AS t",
    );
    const value = result.rows[0].t;
    expect(value === null || value === "").toBe(true);
  });

  it("rolls back and rethrows when the callback throws", async () => {
    const tenantId = "22222222-2222-2222-2222-222222222222";

    await expect(
      withTenant(tenantId, async () => {
        throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
