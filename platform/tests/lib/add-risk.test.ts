import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The risk console no longer harvests leads from the rest of the file. It
// holds the two presumed ISA 240 risks and whatever the auditor adds by hand,
// documented as it is added: what the risk is, where it was identified, its
// category and level, the assessment and the index it threatens.

const TENANT = "a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a201";
const USER = "a2a2a2a2-a2a2-4a2a-8a2a-a2a2a2a2a202";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: USER, tenantId: TENANT, role: "firm_admin", locale: "en", clientId: null },
  })),
}));

import { closePool } from "@/lib/db";
import { createEngagement } from "@/lib/engagements";
import { addRisk, listRisks } from "@/lib/risks";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let engagementId: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1", [USER]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Add Risk Firm', 'add-risk-test')", [TENANT]);
  await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'add@risk.local', 'Adder', 'x')", [USER]);
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')", [USER, TENANT]);
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Add Risk SA', 'SA') RETURNING id",
    [TENANT],
  );
  engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31" });
}, 60_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("adding a risk by hand on the console", () => {
  it("records the risk with its documentation, assessment and index", async () => {
    const id = await addRisk(engagementId, {
      description: "Cut-off of import services invoiced in January for December deliveries",
      source: "Discussion with the finance director, 12 Feb",
      category: "error",
      level: "assertion",
      likelihood: "high",
      magnitude: "medium",
      significant: true,
      factors: ["complexity", "change"],
      index: "UA",
      assertions: ["C", "E"],
      managementMissed: "Not on management's own risk list — cut-off is not monitored monthly",
    });
    const risks = await listRisks(engagementId);
    const added = risks.find((r) => r.id === id);
    expect(added).toBeDefined();
    expect(added?.description).toContain("Cut-off of import services");
    expect(added?.description).toContain("Not identified by management's risk process");
    expect(added?.category).toBe("error");
    expect(added?.level).toBe("assertion");
    expect(added?.likelihood).toBe("high");
    expect(added?.magnitude).toBe("medium");
    expect(added?.significant).toBe(true);
    expect(added?.inherentFactors).toEqual(["complexity", "change"]);
    expect(added?.indexLinks.map((l) => l.indexCode)).toEqual(["UA"]);
    expect(added?.indexLinks[0]?.assertions).toEqual(["C", "E"]);
    expect(added?.presumedType).toBeNull();
  });

  it("keeps the two presumed ISA 240 risks beside it", async () => {
    const risks = await listRisks(engagementId);
    expect(risks.map((r) => r.presumedType).filter(Boolean).sort()).toEqual(["mgmt_override", "revenue_fraud"]);
  });

  it("refuses an empty description", async () => {
    await expect(addRisk(engagementId, { description: "   ", category: "business", level: "fs" })).rejects.toThrow("risk-description-required");
  });
});
