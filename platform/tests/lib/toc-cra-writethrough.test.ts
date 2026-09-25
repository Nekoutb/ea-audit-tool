import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Concluding a control NOT EFFECTIVE in E1.2 must set S3.1 to not-rely for
// every assertion that control answered, on every lead index its SCOT feeds,
// and say why — the assessment can never disagree with the test result.

const TENANT = "c9c9c9c9-c9c9-4c9c-8c9c-c9c9c9c9c901";
const USER = "c9c9c9c9-c9c9-4c9c-8c9c-c9c9c9c9c902";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: USER, tenantId: TENANT, role: "firm_admin", locale: "en", clientId: null },
  })),
}));

import { closePool } from "@/lib/db";
import { createEngagement } from "@/lib/engagements";
import { CR_DEFICIENT_BASIS, updateControl } from "@/lib/scots";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let engagementId: string;
let controlId: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1", [USER]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'ToC Firm', 'toc-cra-test')", [TENANT]);
  await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'toc@cra.local', 'ToC', 'x')", [USER]);
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')", [USER, TENANT]);
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'ToC SA', 'SA') RETURNING id",
    [TENANT],
  );
  engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31" });

  const scot = await admin.query<{ id: string }>(
    "INSERT INTO scot (tenant_id, engagement_id, name, transaction_type, strategy) VALUES ($1, $2, 'Revenue', 'routine', 'controls') RETURNING id",
    [TENANT, engagementId],
  );
  const scotId = scot.rows[0].id;
  await admin.query("INSERT INTO scot_index (tenant_id, scot_id, index_code, assertions) VALUES ($1, $2, 'R', '{}')", [TENANT, scotId]);
  const wcgw = await admin.query<{ id: string }>(
    "INSERT INTO wcgw (tenant_id, scot_id, description, assertions) VALUES ($1, $2, 'Revenue recorded that did not occur', ARRAY['E','A']) RETURNING id",
    [TENANT, scotId],
  );
  const control = await admin.query<{ id: string }>(
    "INSERT INTO scot_control (tenant_id, scot_id, name, control_type, frequency, objective, selected_for_testing) VALUES ($1, $2, 'Invoice approval', 'manual', 'daily', 'prevent', true) RETURNING id",
    [TENANT, scotId],
  );
  controlId = control.rows[0].id;
  await admin.query("INSERT INTO wcgw_control (tenant_id, wcgw_id, control_id) VALUES ($1, $2, $3)", [TENANT, wcgw.rows[0].id, controlId]);
  // "Effective" is a conclusion on evidence (UAT B84): plan a sample of two and
  // test both on the grid, every attribute answered, before any conclusion below.
  await updateControl(controlId, { sampleSize: 2, tocGrid: TESTED_GRID });
}, 60_000);

const TESTED_GRID = {
  attributes: ["Approved by manager"],
  rows: [
    { ref: "INV-001", date: "2025-02-10", desc: "", results: { "Approved by manager": "pass" as const } },
    { ref: "INV-002", date: "2025-07-22", desc: "", results: { "Approved by manager": "pass" as const } },
  ],
};

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("E1.2 conclusion writes through to S3.1", () => {
  it("effective leaves the matrix untouched", async () => {
    await updateControl(controlId, { operatingEval: "effective" });
    const r = await admin.query("SELECT 1 FROM cra_assessment WHERE engagement_id = $1", [engagementId]);
    expect(r.rowCount).toBe(0);
  });

  it("not effective sets not-rely on the covered assertions, with the reason", async () => {
    await updateControl(controlId, { operatingEval: "not_effective" });
    const r = await admin.query<{ index_code: string; assertion: string; cr: string; cr_basis: string }>(
      "SELECT index_code, assertion, cr, cr_basis FROM cra_assessment WHERE engagement_id = $1 ORDER BY assertion",
      [engagementId],
    );
    expect(r.rows.map((x) => x.assertion)).toEqual(["A", "E"]);
    expect(r.rows.every((x) => x.index_code === "R")).toBe(true);
    expect(r.rows.every((x) => x.cr === "not_rely")).toBe(true);
    expect(r.rows.every((x) => x.cr_basis === CR_DEFICIENT_BASIS)).toBe(true);
    expect(CR_DEFICIENT_BASIS).toMatch(/E1\.2/);
  });

  it("does not touch assertions the control never answered", async () => {
    const r = await admin.query("SELECT 1 FROM cra_assessment WHERE engagement_id = $1 AND assertion IN ('C','V','P')", [engagementId]);
    expect(r.rowCount).toBe(0);
  });

  it("re-concluding does not duplicate the basis", async () => {
    await updateControl(controlId, { operatingEval: "not_effective" });
    const r = await admin.query<{ cr_basis: string }>(
      "SELECT cr_basis FROM cra_assessment WHERE engagement_id = $1 AND assertion = 'E'",
      [engagementId],
    );
    expect(r.rows[0].cr_basis).toBe(CR_DEFICIENT_BASIS);
  });

  it("preserves an existing manual basis alongside the E1.2 reason", async () => {
    await admin.query(
      "UPDATE cra_assessment SET cr = 'rely', cr_basis = 'Walkthrough supported reliance' WHERE engagement_id = $1 AND assertion = 'A'",
      [engagementId],
    );
    await updateControl(controlId, { operatingEval: "not_effective" });
    const r = await admin.query<{ cr: string; cr_basis: string }>(
      "SELECT cr, cr_basis FROM cra_assessment WHERE engagement_id = $1 AND assertion = 'A'",
      [engagementId],
    );
    expect(r.rows[0].cr).toBe("not_rely");
    expect(r.rows[0].cr_basis).toContain("Walkthrough supported reliance");
    expect(r.rows[0].cr_basis).toContain("E1.2");
  });
});

// The same conclusion in reverse. Concluding a control effective again has to
// lift the not-rely E1.2 stamped, or S3.1 keeps a reliance decision the test
// result no longer supports — and the auditor has no way to correct it from the
// screen where the mistake was made.
describe("concluding a control effective again lifts what E1.2 stamped", () => {
  it("clears its own stamp, and strips only its clause from a shared basis", async () => {
    // Carried over from the block above: 'E' holds the E1.2 reason alone, 'A'
    // holds a reason somebody reached themselves with E1.2's appended to it.
    await updateControl(controlId, { operatingEval: "effective" });

    const alone = await admin.query<{ cr: string | null; cr_basis: string | null }>(
      "SELECT cr, cr_basis FROM cra_assessment WHERE engagement_id = $1 AND assertion = 'E'",
      [engagementId],
    );
    expect(alone.rows[0].cr).toBeNull();
    expect(alone.rows[0].cr_basis).toBeNull();

    const shared = await admin.query<{ cr: string; cr_basis: string }>(
      "SELECT cr, cr_basis FROM cra_assessment WHERE engagement_id = $1 AND assertion = 'A'",
      [engagementId],
    );
    expect(shared.rows[0].cr).toBe("not_rely");
    expect(shared.rows[0].cr_basis).toBe("Walkthrough supported reliance");
    expect(shared.rows[0].cr_basis).not.toContain("E1.2");
  });

  it("will not release an assertion another failing control still covers", async () => {
    const scot = await admin.query<{ scot_id: string }>(
      "SELECT scot_id FROM scot_control WHERE id = $1",
      [controlId],
    );
    const wcgw = await admin.query<{ wcgw_id: string }>(
      "SELECT wcgw_id FROM wcgw_control WHERE control_id = $1",
      [controlId],
    );
    const second = await admin.query<{ id: string }>(
      `INSERT INTO scot_control (tenant_id, scot_id, name, control_type, frequency, objective, selected_for_testing)
       VALUES ($1, $2, 'Credit limit check', 'manual', 'daily', 'prevent', true) RETURNING id`,
      [TENANT, scot.rows[0].scot_id],
    );
    await admin.query("INSERT INTO wcgw_control (tenant_id, wcgw_id, control_id) VALUES ($1, $2, $3)", [
      TENANT,
      wcgw.rows[0].wcgw_id,
      second.rows[0].id,
    ]);

    await updateControl(controlId, { operatingEval: "not_effective" });
    await updateControl(second.rows[0].id, { operatingEval: "not_effective" });
    // One of the two is put right; the other still fails, so the assertions
    // they share cannot go back to being relied upon.
    await updateControl(controlId, { operatingEval: "effective" });

    const r = await admin.query<{ cr: string; cr_basis: string }>(
      "SELECT cr, cr_basis FROM cra_assessment WHERE engagement_id = $1 AND assertion = 'E'",
      [engagementId],
    );
    expect(r.rows[0].cr).toBe("not_rely");
    expect(r.rows[0].cr_basis).toBe(CR_DEFICIENT_BASIS);
  });
});

// "Effective" needs the planned sample fully tested on the grid (UAT B84). A
// control with no planned sample has no plan to fall short of, so it is not
// blocked. The control here answers no WCGW, so its conclusion reaches S3.1
// nowhere and the assertions above are left as they are.
describe("concluding effective needs the planned sample tested (UAT B84)", () => {
  let looseId: string;
  beforeAll(async () => {
    const scot = await admin.query<{ scot_id: string }>("SELECT scot_id FROM scot_control WHERE id = $1", [controlId]);
    const c = await admin.query<{ id: string }>(
      `INSERT INTO scot_control (tenant_id, scot_id, name, control_type, frequency, objective, selected_for_testing)
       VALUES ($1, $2, 'Bank reconciliation review', 'manual', 'monthly', 'detect', false) RETURNING id`,
      [TENANT, scot.rows[0].scot_id],
    );
    looseId = c.rows[0].id;
  });

  it("refuses when fewer rows are fully tested than the sample planned, and rolls the conclusion back", async () => {
    await updateControl(looseId, { sampleSize: 3, tocGrid: TESTED_GRID }); // 2 tested of 3 planned
    await expect(updateControl(looseId, { operatingEval: "effective" })).rejects.toThrow("toc-incomplete");
    const r = await admin.query<{ operating_eval: string | null }>("SELECT operating_eval FROM scot_control WHERE id = $1", [looseId]);
    expect(r.rows[0].operating_eval).toBeNull();
  });

  it("a row with an attribute left blank does not count as tested", async () => {
    const partial = { ...TESTED_GRID, rows: [...TESTED_GRID.rows, { ref: "INV-003", date: "2025-09-01", desc: "", results: { "Approved by manager": "" as const } }] };
    await expect(updateControl(looseId, { operatingEval: "effective", tocGrid: partial })).rejects.toThrow("toc-incomplete");
  });

  it("accepts once the planned rows are all answered, a grid saved in the same call counting", async () => {
    const full = { ...TESTED_GRID, rows: [...TESTED_GRID.rows, { ref: "INV-003", date: "2025-09-01", desc: "", results: { "Approved by manager": "na" as const } }] };
    await updateControl(looseId, { operatingEval: "effective", tocGrid: full });
    const r = await admin.query<{ operating_eval: string | null }>("SELECT operating_eval FROM scot_control WHERE id = $1", [looseId]);
    expect(r.rows[0].operating_eval).toBe("effective");
  });

  it("does not block a control with no planned sample size", async () => {
    await admin.query("UPDATE scot_control SET sample_size = NULL, toc_grid = NULL, operating_eval = NULL WHERE id = $1", [looseId]);
    await updateControl(looseId, { operatingEval: "effective" });
    const r = await admin.query<{ operating_eval: string | null }>("SELECT operating_eval FROM scot_control WHERE id = $1", [looseId]);
    expect(r.rows[0].operating_eval).toBe("effective");
  });
});
