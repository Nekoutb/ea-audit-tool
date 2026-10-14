import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// The engagement partner is chosen before the file is opened (firm decision
// 2026-10-14): createEngagement refuses a file without one, keeps the seat for
// firm partners and administrators (F003), seats the partner as the ACCEPTED
// engagement partner so the acceptance gate is met from the start, and a
// rollforward carries the prior year's partner over.

const TENANT = "6e6e6e6e-6e6e-4e6e-8e6e-6e6e6e6e6e6e";
const OTHER_TENANT = "6e6e6e6e-6e6e-4e6e-8e6e-6e6e6e6e6e00";
const ADMIN = "6e6e6e6e-6e6e-4e6e-8e6e-6e6e6e6e6e01";
const PARTNER = "6e6e6e6e-6e6e-4e6e-8e6e-6e6e6e6e6e02";
const MANAGER = "6e6e6e6e-6e6e-4e6e-8e6e-6e6e6e6e6e03";
const FOREIGN_PARTNER = "6e6e6e6e-6e6e-4e6e-8e6e-6e6e6e6e6e04";

let actor = { id: ADMIN, role: "firm_admin" };

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: actor.id, tenantId: TENANT, role: actor.role, locale: "en", clientId: null },
  })),
}));

import { rollforward } from "@/lib/completion";
import { closePool } from "@/lib/db";
import { createEngagement } from "@/lib/engagements";
import { acceptanceGates } from "@/lib/gates";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let clientId: string;

const as = (id: string, role: string) => {
  actor = { id, role };
};

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = ANY($1::uuid[])", [[TENANT, OTHER_TENANT]]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1::uuid[])", [[ADMIN, PARTNER, MANAGER, FOREIGN_PARTNER]]);
}

async function partnerSeats(engagementId: string): Promise<{ user_id: string; status: string }[]> {
  const r = await admin.query<{ user_id: string; status: string }>(
    "SELECT user_id, status FROM team_member WHERE engagement_id = $1 AND team_role = 'partner'",
    [engagementId],
  );
  return r.rows;
}

async function engagementCount(): Promise<number> {
  const r = await admin.query<{ n: string }>("SELECT count(*) AS n FROM engagement WHERE tenant_id = $1", [TENANT]);
  return Number(r.rows[0].n);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query(
    "INSERT INTO tenant (id, name, slug) VALUES ($1, 'Partner Firm', 'partner-required-test'), ($2, 'Other Firm', 'partner-required-other')",
    [TENANT, OTHER_TENANT],
  );
  const users: [string, string, string, string][] = [
    [ADMIN, "admin@partner-required.local", "firm_admin", TENANT],
    [PARTNER, "partner@partner-required.local", "partner", TENANT],
    [MANAGER, "manager@partner-required.local", "manager", TENANT],
    [FOREIGN_PARTNER, "partner@partner-required-other.local", "partner", OTHER_TENANT],
  ];
  for (const [id, email, role, tenant] of users) {
    await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, $2, $2, 'x')", [id, email]);
    await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, $3)", [id, tenant, role]);
  }
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Partner SA', 'SA') RETURNING id",
    [TENANT],
  );
  clientId = client.rows[0].id;
}, 60_000);

afterEach(() => as(ADMIN, "firm_admin"));

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("createEngagement — the engagement partner is mandatory", () => {
  it("refuses a file without a partner", async () => {
    const before = await engagementCount();
    await expect(
      createEngagement({ clientId, fiscalYear: 2030, periodEnd: "2030-12-31" } as never),
    ).rejects.toThrow("engagement-partner-required");
    await expect(
      createEngagement({ clientId, fiscalYear: 2030, periodEnd: "2030-12-31", partnerId: "" }),
    ).rejects.toThrow("engagement-partner-required");
    expect(await engagementCount()).toBe(before);
  });

  it("refuses a partner below partner rank, and opens nothing", async () => {
    const before = await engagementCount();
    await expect(
      createEngagement({ clientId, fiscalYear: 2030, periodEnd: "2030-12-31", partnerId: MANAGER }),
    ).rejects.toThrow("partner-role-requires-partner-rank");
    // a partner of another firm holds no rank in this one
    await expect(
      createEngagement({ clientId, fiscalYear: 2030, periodEnd: "2030-12-31", partnerId: FOREIGN_PARTNER }),
    ).rejects.toThrow("partner-role-requires-partner-rank");
    // the refusal rolls the whole creation back: no partner-less file is left behind
    expect(await engagementCount()).toBe(before);
  });

  it("seats exactly one accepted engagement partner and meets the acceptance gate", async () => {
    const id = await createEngagement({ clientId, fiscalYear: 2031, periodEnd: "2031-12-31", partnerId: PARTNER });
    expect(await partnerSeats(id)).toEqual([{ user_id: PARTNER, status: "accepted" }]);
    const gate = (await acceptanceGates(id)).find((g) => g.key === "engagement_partner_designated");
    expect(gate?.ok).toBe(true);
  });

  it("seats the chosen partner alongside a manager who opens the file", async () => {
    as(MANAGER, "manager");
    const id = await createEngagement({ clientId, fiscalYear: 2032, periodEnd: "2032-12-31", partnerId: PARTNER });
    expect(await partnerSeats(id)).toEqual([{ user_id: PARTNER, status: "accepted" }]);
    const team = await admin.query<{ user_id: string; team_role: string }>(
      "SELECT user_id, team_role FROM team_member WHERE engagement_id = $1 ORDER BY team_role::text",
      [id],
    );
    expect(team.rows).toEqual([
      { user_id: MANAGER, team_role: "manager" },
      { user_id: PARTNER, team_role: "partner" },
    ]);
  });

  it("lets a firm administrator take the seat themselves", async () => {
    const id = await createEngagement({ clientId, fiscalYear: 2033, periodEnd: "2033-12-31", partnerId: ADMIN });
    expect(await partnerSeats(id)).toEqual([{ user_id: ADMIN, status: "accepted" }]);
  });
});

describe("rollforward — the prior year's partner carries over", () => {
  it("seats the source engagement's accepted partner on the new file", async () => {
    const source = await createEngagement({ clientId, fiscalYear: 2034, periodEnd: "2034-12-31", partnerId: PARTNER });
    const next = await rollforward(source, 2035);
    expect(await partnerSeats(next)).toEqual([{ user_id: PARTNER, status: "accepted" }]);
    expect((await acceptanceGates(next)).find((g) => g.key === "engagement_partner_designated")?.ok).toBe(true);
  });

  it("refuses to roll forward a file with no accepted partner", async () => {
    const source = await createEngagement({ clientId, fiscalYear: 2036, periodEnd: "2036-12-31", partnerId: PARTNER });
    // a file opened before the partner became mandatory: the seat is empty
    await admin.query("DELETE FROM team_member WHERE engagement_id = $1", [source]);
    const before = await engagementCount();
    await expect(rollforward(source, 2037)).rejects.toThrow("engagement-partner-required");
    // an invited (not yet accepted) partner does not carry over either
    await admin.query(
      "INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role, status) VALUES ($1, $2, $3, 'partner', 'invited')",
      [TENANT, source, PARTNER],
    );
    await expect(rollforward(source, 2037)).rejects.toThrow("engagement-partner-required");
    expect(await engagementCount()).toBe(before);
  });
});
