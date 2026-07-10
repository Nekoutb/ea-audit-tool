import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "dddddddd-dddd-dddd-dddd-dddddddddddd";
const USER = "dddddddd-dddd-dddd-dddd-ddddddddddd1";
const OTHER_USER = "dddddddd-dddd-dddd-dddd-ddddddddddd2";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: USER, tenantId: TENANT, role: "firm_admin", locale: "en" },
  })),
}));

import { closePool } from "@/lib/db";
import { generateDocument, signDocument } from "@/lib/documents";
import { createEngagement, listFileItems } from "@/lib/engagements";
import { carryForwardFromPriorYear, loadForm, saveForm } from "@/lib/forms";
import { acceptanceGates, advanceToPlanning, closePlanning, GateError, planningCloseGates, setSectionMaterial } from "@/lib/gates";
import { disposeException, launchCampaign, listConfirmations, submitConfirmation } from "@/lib/independence";
import { approveMateriality, computeMateriality, createMaterialityVersion } from "@/lib/materiality";
import { addCustomStep, generateProgram, listProgramSteps, sectionCoverage } from "@/lib/programs";
import { inherentRating, listRisks, rebutRevenueFraudRisk, updateRisk } from "@/lib/risks";
import { assignTeamMember } from "@/lib/team";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let engagementId: string;
let clientId: string;
let items: Awaited<ReturnType<typeof listFileItems>>;

function itemId(code: string): string {
  const item = items.find((i) => i.code === code);
  if (!item) throw new Error(`missing file item ${code}`);
  return item.id;
}

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1::uuid[])", [[USER, OTHER_USER]]);
}

async function signAsPartner(code: string): Promise<void> {
  const documentId = await generateDocument(itemId(code), "en");
  await signDocument(documentId, "preparer");
  await signDocument(documentId, "partner");
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Planning Firm', 'planning-test')", [TENANT]);
  await admin.query(
    `INSERT INTO app_user (id, email, name, password_hash) VALUES
       ($1, 'planner@test.local', 'Planner', 'x'), ($2, 'second@test.local', 'Second', 'x')`,
    [USER, OTHER_USER],
  );
  await admin.query(
    "INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $3, 'firm_admin'), ($2, $3, 'staff')",
    [USER, OTHER_USER, TENANT],
  );
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Plan SA', 'SA') RETURNING id",
    [TENANT],
  );
  clientId = client.rows[0].id;
  engagementId = await createEngagement({ clientId, fiscalYear: 2025, periodEnd: "2025-12-31" });
  items = await listFileItems(engagementId);
}, 30_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("pure computations", () => {
  it("computes materiality, performance and trivial thresholds", () => {
    const result = computeMateriality({
      benchmark: "revenue",
      benchmarkAmount: 1_000_000_000,
      percentage: 1,
      justification: "x",
      performancePct: 75,
      trivialPct: 5,
    });
    expect(result.overall).toBe(10_000_000);
    expect(result.performance).toBe(7_500_000);
    expect(result.trivial).toBe(500_000);
  });

  it("rates inherent risk as likelihood × magnitude", () => {
    expect(inherentRating("low", "low")).toBe("low");
    expect(inherentRating("medium", "medium")).toBe("medium");
    expect(inherentRating("high", "medium")).toBe("high");
    expect(inherentRating("high", "high")).toBe("high");
  });
});

describe("presumed risks (spec §3)", () => {
  it("seeds both presumed risks on engagement creation", async () => {
    const risks = await listRisks(engagementId);
    const types = risks.map((r) => r.presumedType).sort();
    expect(types).toEqual(["mgmt_override", "revenue_fraud"]);
    expect(risks.every((r) => r.significant)).toBe(true);
    const override = risks.find((r) => r.presumedType === "mgmt_override");
    expect(override?.sections.map((s) => s.code)).toContain("E350");
  });

  it("blocks downgrading management override", async () => {
    const risks = await listRisks(engagementId);
    const override = risks.find((r) => r.presumedType === "mgmt_override")!;
    await expect(updateRisk(override.id, { significant: false })).rejects.toThrow("not-rebuttable");
    await expect(rebutRevenueFraudRisk(override.id, "try")).rejects.toThrow("not-rebuttable");
  });
});

describe("form framework", () => {
  it("saves and reloads structured fields", async () => {
    await saveForm(engagementId, "D4.2", { ownership_governance: "Family-owned SA", business_model: "Trading" });
    const { values } = await loadForm(engagementId, "D4.2");
    expect(values.ownership_governance).toBe("Family-owned SA");
  });

  it("enforces the D4.4 D&I inquiry+inspection rule", async () => {
    await expect(
      saveForm(engagementId, "D4.4", { control_environment: "ok", di_controls: "JE controls", di_inquiry: true, di_inspection: false }),
    ).rejects.toThrow("di-both-required");
    await saveForm(engagementId, "D4.4", { control_environment: "ok", di_controls: "JE controls", di_inquiry: true, di_inspection: true });
  });
});

describe("acceptance gates → planning (2.2, 2.3, 2.4)", () => {
  it("starts blocked", async () => {
    const gates = await acceptanceGates(engagementId);
    expect(gates.find((g) => g.key === "d31_form_complete")?.ok).toBe(false);
    await expect(advanceToPlanning(engagementId)).rejects.toThrow(GateError);
  });

  it("independence exception blocks acceptance until a partner disposes it", async () => {
    await launchCampaign(engagementId, [USER]);
    let gates = await acceptanceGates(engagementId);
    expect(gates.find((g) => g.key === "independence_complete")?.ok).toBe(false);

    const confirmations = await listConfirmations(engagementId);
    const mine = confirmations.find((c) => c.userId === USER)!;
    const status = await submitConfirmation(mine.token, { financial_interest: true }, "Planner");
    expect(status).toBe("exception");

    gates = await acceptanceGates(engagementId);
    expect(gates.find((g) => g.key === "independence_complete")?.ok).toBe(true);
    expect(gates.find((g) => g.key === "independence_exceptions_disposed")?.ok).toBe(false);

    await disposeException(mine.id, "Interest divested before fieldwork; safeguards documented.");
    gates = await acceptanceGates(engagementId);
    expect(gates.find((g) => g.key === "independence_exceptions_disposed")?.ok).toBe(true);
  });

  it("passes after D3.1 completion + partner sign-off, then advances", async () => {
    await saveForm(engagementId, "D3.1", {
      engagement_type: "new",
      integrity_ok: true,
      competence_ok: true,
      conflicts_ok: true,
      aml_ok: true,
      independence_ok: true,
      risk_rating: "moderate",
      conclusion: "accept",
    });
    await signAsPartner("D3.1");
    const gates = await acceptanceGates(engagementId);
    expect(gates.every((g) => g.ok)).toBe(true);
    await advanceToPlanning(engagementId);
    const phase = await admin.query<{ phase: string }>("SELECT phase FROM engagement WHERE id = $1", [engagementId]);
    expect(phase.rows[0].phase).toBe("planning");
  });
});

describe("EQR independence (2.7)", () => {
  it("blocks assigning a team member as EQR", async () => {
    await assignTeamMember(engagementId, OTHER_USER, "staff");
    await expect(assignTeamMember(engagementId, OTHER_USER, "eqr_reviewer")).rejects.toThrow("eqr-on-team");
  });
});

describe("program tailoring (2.14)", () => {
  it("generates library steps + risk extensions auto-linked to the significant risk", async () => {
    const generated = await generateProgram(itemId("E100"), "en");
    expect(generated).toBeGreaterThan(0);
    const steps = await listProgramSteps(itemId("E100"));
    expect(steps.some((s) => s.source === "risk_extension")).toBe(true);
    const coverage = await sectionCoverage(itemId("E100"));
    const revenue = coverage.find((c) => c.riskDescription.includes("revenue"));
    expect(revenue?.linkedSteps).toBeGreaterThan(0);
  });
});

describe("planning-close gates (2.9, 2.10, 2.13)", () => {
  it("blocks with unapproved materiality, unsigned gate docs, unlinked significant risk", async () => {
    await expect(closePlanning(engagementId)).rejects.toThrow(GateError);
    const gates = await planningCloseGates(engagementId);
    expect(gates.find((g) => g.key === "materiality_approved")?.ok).toBe(false);
    // mgmt_override (E350) has no program yet → unlinked significant risk.
    expect(gates.find((g) => g.key === "significant_risks_linked")?.ok).toBe(false);
  });

  it("materiality versioning + partner approval", async () => {
    const version = await createMaterialityVersion(engagementId, {
      benchmark: "revenue",
      benchmarkAmount: 2_000_000_000,
      percentage: 1,
      justification: "Stable trading entity; revenue is the key benchmark.",
      performancePct: 75,
      trivialPct: 5,
    });
    await approveMateriality(engagementId, version);
    const gates = await planningCloseGates(engagementId);
    expect(gates.find((g) => g.key === "materiality_approved")?.ok).toBe(true);
  });

  it("stand-back: an uncovered material section blocks close", async () => {
    await setSectionMaterial(itemId("E110"), true);
    const gates = await planningCloseGates(engagementId);
    expect(gates.find((g) => g.key === "material_sections_covered")?.ok).toBe(false);
  });

  it("closes once every gate passes, snapshots, and opens execution", async () => {
    await generateProgram(itemId("E350"), "en"); // links mgmt_override
    await addCustomStep(itemId("E110"), "Substantive coverage for purchases.", ["C", "A"]);
    for (const code of ["D6.1", "D7.1", "D7.2"]) await signAsPartner(code);

    const gates = await planningCloseGates(engagementId);
    expect(gates.every((g) => g.ok)).toBe(true);

    await closePlanning(engagementId);
    const phase = await admin.query<{ phase: string }>("SELECT phase FROM engagement WHERE id = $1", [engagementId]);
    expect(phase.rows[0].phase).toBe("execution");
    const snapshot = await admin.query<{ data: { risks: unknown[] } }>(
      "SELECT data FROM planning_snapshot WHERE engagement_id = $1",
      [engagementId],
    );
    expect(snapshot.rows).toHaveLength(1);
    expect(Array.isArray(snapshot.rows[0].data.risks)).toBe(true);
  });
});

describe("rollforward (2.11)", () => {
  it("carries D4.x understanding + related parties forward as confirm-or-update", async () => {
    await admin.query(
      "INSERT INTO related_party (tenant_id, engagement_id, name, relationship) VALUES ($1, $2, 'Holding SA', 'Parent')",
      [TENANT, engagementId],
    );
    const nextYear = await createEngagement({ clientId, fiscalYear: 2026, periodEnd: "2026-12-31" });
    const copied = await carryForwardFromPriorYear(nextYear);
    expect(copied).toBeGreaterThan(0);

    const { values, carried } = await loadForm(nextYear, "D4.2");
    expect(values.ownership_governance).toBe("Family-owned SA");
    expect(carried.has("ownership_governance")).toBe(true);

    // Editing confirms (clears the carried flag).
    await saveForm(nextYear, "D4.2", { ownership_governance: "Family-owned SA (confirmed 2026)" });
    const after = await loadForm(nextYear, "D4.2");
    expect(after.carried.has("ownership_governance")).toBe(false);

    const parties = await admin.query<{ carried_forward: boolean }>(
      "SELECT carried_forward FROM related_party WHERE engagement_id = $1 AND name = 'Holding SA'",
      [nextYear],
    );
    expect(parties.rows[0]?.carried_forward).toBe(true);
  });
});
