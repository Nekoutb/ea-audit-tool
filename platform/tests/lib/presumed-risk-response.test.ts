import { readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Planning cannot close while a significant, unrebutted risk has no program
// step linked to it. Two risks are presumed on every engagement by ISA 240.
// Revenue fraud is rebuttable and its procedures come from the S5.5 design, so
// the gate rightly waits on the auditor there. Management override is neither:
// the standard prescribes its response outright, in ¶32, and the risk cannot
// be rebutted — so the response is seeded with the risk. The screen that used
// to let a person link it by hand has been removed; this holds the file open
// to closing without it.

const TENANT = "d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d101";
const USER = "d1d1d1d1-d1d1-4d1d-8d1d-d1d1d1d1d102";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: USER, tenantId: TENANT, role: "firm_admin", locale: "en", clientId: null },
  })),
}));

import { closePool } from "@/lib/db";
import { createEngagement } from "@/lib/engagements";
import { planningCloseGates } from "@/lib/gates";
import { MGMT_OVERRIDE_PROCEDURE } from "@/lib/risks";
import { paperFor, savePaper } from "@/lib/working-papers";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let engagementId: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1", [USER]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Override Firm', 'presumed-risk-test')", [TENANT]);
  await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'override@risk.local', 'Override', 'x')", [USER]);
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')", [USER, TENANT]);
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Override SA', 'SA') RETURNING id",
    [TENANT],
  );
  engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31" });
}, 60_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("the presumed management-override risk", () => {
  it("is seeded with its ISA 240 ¶32 response already linked, on E3.1", async () => {
    const r = await admin.query<{ description: string; source: string; code: string; status: string }>(
      `SELECT ps.description, ps.source, fi.code, r.status
         FROM risk r
         JOIN risk_response rr ON rr.risk_id = r.id
         JOIN program_step ps ON ps.id = rr.program_step_id
         JOIN file_item fi ON fi.id = ps.file_item_id
        WHERE r.engagement_id = $1 AND r.presumed_type = 'mgmt_override'`,
      [engagementId],
    );
    expect(r.rowCount).toBe(1);
    expect(r.rows[0].code).toBe("E3.1");
    expect(r.rows[0].source).toBe("risk_extension");
    expect(r.rows[0].description).toBe(MGMT_OVERRIDE_PROCEDURE);
    expect(r.rows[0].status).toBe("response_planned");
    // The words have to name what the standard actually requires.
    expect(MGMT_OVERRIDE_PROCEDURE).toMatch(/journal entries/);
    expect(MGMT_OVERRIDE_PROCEDURE).toMatch(/ISA 240/);
  });

  it("is written into the backfill migration word for word", () => {
    // The paper's conclusion finds the seeded step by its exact wording, so a
    // step the migration wrote must read identically to one the seed writes —
    // or engagements created before the seed existed could never complete it.
    const sql = readFileSync(
      path.resolve(__dirname, "../../migrations/20260909000004_mgmt_override_response.sql"),
      "utf8",
    );
    expect(sql).toContain(`'${MGMT_OVERRIDE_PROCEDURE}'`);
  });

  it("leaves the rebuttable revenue-fraud risk for the auditor to answer", async () => {
    // Seeding a response for that one would take a judgement away from the
    // person who is supposed to make it, so the gate must still be waiting.
    const r = await admin.query(
      `SELECT 1 FROM risk r JOIN risk_response rr ON rr.risk_id = r.id
        WHERE r.engagement_id = $1 AND r.presumed_type = 'revenue_fraud'`,
      [engagementId],
    );
    expect(r.rowCount).toBe(0);
    const gate = (await planningCloseGates(engagementId)).find((g) => g.key === "significant_risks_linked");
    expect(gate?.ok).toBe(false);
  });

  it("is the only thing standing between that gate and green", async () => {
    // Rebut revenue fraud the way a partner would and the gate opens: proof that
    // management override is no longer the reason a file cannot leave planning.
    await admin.query(
      `UPDATE risk SET rebutted = true, rebuttal_approved_by = $2
        WHERE engagement_id = $1 AND presumed_type = 'revenue_fraud'`,
      [engagementId, USER],
    );
    const gate = (await planningCloseGates(engagementId)).find((g) => g.key === "significant_risks_linked");
    expect(gate?.ok).toBe(true);
  });
});

describe("the seeded step and the E3.1 paper", () => {
  const stepState = () =>
    admin.query<{ status: string; conclusion: string | null }>(
      `SELECT ps.status, ps.conclusion
         FROM program_step ps JOIN file_item fi ON fi.id = ps.file_item_id
        WHERE fi.engagement_id = $1 AND fi.code = 'E3.1' AND ps.description = $2`,
      [engagementId, MGMT_OVERRIDE_PROCEDURE],
    );

  it("starts planned: the response is designed, the work is not yet done", async () => {
    expect((await stepState()).rows[0]?.status).toBe("planned");
  });

  it("completes when every conclusion on the paper is answered", async () => {
    const yes = Object.fromEntries((paperFor("E3.1").conclEn ?? []).map((_, i) => [`c_${i}`, "yes"]));
    await savePaper(engagementId, "E3.1", yes);
    const r = (await stepState()).rows[0];
    expect(r.status).toBe("complete");
    expect(r.conclusion).toMatch(/E3\.1/);
  });

  it("reopens when a conclusion is cleared, so the completion gate stays honest", async () => {
    await savePaper(engagementId, "E3.1", { c_0: "" });
    expect((await stepState()).rows[0]?.status).toBe("planned");
  });
});
