import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "abababab-abab-abab-abab-abababababab";
const USER = "abababab-abab-abab-abab-ababababab01";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: USER, tenantId: TENANT, role: "firm_admin", locale: "en" },
  })),
}));

import { closePool } from "@/lib/db";
import { createEngagement, listFileItems } from "@/lib/engagements";
import {
  addEvidenceFile,
  approveRiskAddition,
  completeStep,
  evaluateB5,
  listControlTests,
  listEvidence,
  listFindings,
  recordControlTest,
  reviewSectionConclusion,
  routeFinding,
  saveSectionConclusion,
  setMisstatementCorrected,
} from "@/lib/execution";
import { approveMateriality, createMaterialityVersion } from "@/lib/materiality";
import { addCustomStep, listProgramSteps } from "@/lib/programs";
import { listRisks } from "@/lib/risks";
import { assignTeamMember } from "@/lib/team";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let engagementId: string;
let e100: string;
let e110: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1", [USER]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Exec Firm', 'exec-test')", [TENANT]);
  await admin.query(
    "INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'exec@test.local', 'Exec Tester', 'x')",
    [USER],
  );
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')", [USER, TENANT]);
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Exec SA', 'SA') RETURNING id",
    [TENANT],
  );
  engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31" });
  const items = await listFileItems(engagementId);
  e100 = items.find((i) => i.code === "E4.1")!.id;
  e110 = items.find((i) => i.code === "E4.2")!.id;
  await assignTeamMember(engagementId, USER, "partner");
  const version = await createMaterialityVersion(engagementId, {
    benchmark: "revenue",
    benchmarkAmount: 1_000_000_000,
    percentage: 1, // overall 10M, trivial 500k
    justification: "Test.",
    performancePct: 75,
    trivialPct: 5,
  });
  await approveMateriality(engagementId, version);
}, 30_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("program-step execution + evidence (4.2/4.3)", () => {
  it("completes a step with a conclusion and attaches evidence", async () => {
    await addCustomStep(e110, "Test unrecorded liabilities.", ["C"]);
    const step = (await listProgramSteps(e110))[0];
    await addEvidenceFile(step.id, "invoices.pdf", "application/pdf", Buffer.from("PDF"));
    await completeStep(step.id, "No unrecorded liabilities noted.");
    const after = (await listProgramSteps(e110))[0];
    expect(after.status).toBe("complete");
    expect(await listEvidence(step.id)).toHaveLength(1);
    await expect(completeStep(step.id, "again")).rejects.toThrow("not-found"); // already complete
  });
});

describe("findings routing (4.4/4.5) — one destination each", () => {
  it("routes to C1.2 and C5.1 with origin backlinks", async () => {
    await routeFinding({ engagementId, fileItemId: e100, route: "b4", title: "Revenue cut-off issue" });
    await routeFinding({ engagementId, fileItemId: e110, route: "c1", title: "Weak PO approval" });
    const findings = await listFindings(engagementId);
    expect(findings.find((f) => f.route === "b4")?.sectionCode).toBe("E4.1");
    expect(findings.find((f) => f.route === "c1")?.sectionCode).toBe("E4.2");
  });

  it("refuses a below-trivial C1.1 without the confirmation, then logs it as trivial", async () => {
    await expect(
      routeFinding({ engagementId, route: "b5", title: "Tiny diff", amount: 100_000 }),
    ).rejects.toThrow("trivial-confirm-required");
    const result = await routeFinding({
      engagementId,
      route: "b5",
      title: "Tiny diff",
      amount: 100_000,
      trivialConfirmed: true,
    });
    expect(result.destination).toBe("b5-trivial");
  });

  it("accumulates non-trivial misstatements against final materiality (4.6)", async () => {
    await routeFinding({ engagementId, fileItemId: e100, route: "b5", title: "Overstated revenue", amount: 8_000_000, mtype: "factual" });
    await routeFinding({ engagementId, fileItemId: e100, route: "b5", title: "Provision shortfall", amount: 4_000_000, mtype: "judgmental" });
    let b5 = await evaluateB5(engagementId);
    expect(b5.uncorrectedTotal).toBe(12_000_000);
    expect(b5.exceedsMateriality).toBe(true); // > 10M overall
    expect(b5.trivialCount).toBe(1);

    // Correcting one brings the aggregate back under materiality.
    const big = b5.items.find((item) => item.amount === 8_000_000)!;
    await setMisstatementCorrected(big.id, true);
    b5 = await evaluateB5(engagementId);
    expect(b5.uncorrectedTotal).toBe(4_000_000);
    expect(b5.exceedsMateriality).toBe(false);
  });
});

describe("control tests (4.7) — deviation forces a decision", () => {
  it("rejects a deviation without a decision", async () => {
    await expect(
      recordControlTest({ engagementId, fileItemId: e110, description: "3-way match", result: "deviation" }),
    ).rejects.toThrow("deviation-decision-required");
  });

  it("extend appends an extension step; deficiency routes to C5.1", async () => {
    const before = (await listProgramSteps(e110)).length;
    await recordControlTest({
      engagementId, fileItemId: e110, description: "3-way match", result: "deviation", deviationDecision: "extend",
    });
    expect((await listProgramSteps(e110)).length).toBe(before + 1);

    await recordControlTest({
      engagementId, fileItemId: e110, description: "Bank sig. authority", result: "deviation", deviationDecision: "deficiency",
    });
    const findings = await listFindings(engagementId);
    expect(findings.some((f) => f.route === "c1" && f.title.includes("Bank sig"))).toBe(true);
    expect(await listControlTests(e110)).toHaveLength(2);
  });
});

describe("revise-approach (4.10)", () => {
  it("adds a dated risk requiring partner approval, logged per section", async () => {
    const result = await routeFinding({
      engagementId, fileItemId: e100, route: "revise",
      title: "New fraud scheme identified in fieldwork", significant: true,
    });
    expect(result.destination).toBe("risk");
    const risks = await listRisks(engagementId);
    const added = risks.find((r) => r.addedAfterPlanning)!;
    expect(added.additionApproved).toBe(false);
    expect(added.sections.map((s) => s.code)).toContain("E4.1");

    await approveRiskAddition(added.id);
    const after = (await listRisks(engagementId)).find((r) => r.id === added.id)!;
    expect(after.additionApproved).toBe(true);

    const log = await admin.query("SELECT 1 FROM revise_log WHERE engagement_id = $1", [engagementId]);
    expect(log.rowCount).toBe(1);
  });
});

describe("section conclusion + review chain (4.11)", () => {
  it("prepares, reviews, and requires partner on significant-risk sections", async () => {
    // E4.1 carries the presumed significant revenue risk → partner required.
    await saveSectionConclusion(e100, "Objectives achieved; revenue fairly stated.", true);
    const conclusion = (await import("@/lib/execution")).getSectionConclusion;
    let state = await conclusion(e100);
    expect(state?.partnerRequired).toBe(true);
    expect(state?.reviewedByName).toBeNull();

    await reviewSectionConclusion(e100, false);
    await reviewSectionConclusion(e100, true);
    state = await conclusion(e100);
    expect(state?.reviewedByName).not.toBeNull();
    expect(state?.partnerReviewedByName).not.toBeNull();

    // Re-saving the conclusion voids the review chain (fresh review needed).
    await saveSectionConclusion(e100, "Updated after late evidence.", true);
    state = await conclusion(e100);
    expect(state?.reviewedByName).toBeNull();
    expect(state?.partnerReviewedByName).toBeNull();
  });
});
