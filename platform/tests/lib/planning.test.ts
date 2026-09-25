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
import { generateLetter } from "@/lib/letters";
import { approveMateriality, computeMateriality, createMaterialityVersion } from "@/lib/materiality";
import { addCustomStep, generateProgram, listProgramSteps, sectionCoverage } from "@/lib/programs";
import { inherentRating, listPotentialRisks, listRisks, promotePotentialRisk, raisePotentialRisk, rebutRevenueFraudRisk, updateRisk } from "@/lib/risks";
import { assignTeamMember } from "@/lib/team";
import { paperFor, savePaper } from "@/lib/working-papers";
import { requiredKeys } from "@/lib/papers/types";

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

/**
 * Answer every required field of a task's working paper (Yes to each factor
 * and conclusion): a blank paper cannot be signed (UAT B17).
 */
async function completePaper(engagement: string, code: string): Promise<void> {
  await savePaper(
    engagement,
    code,
    Object.fromEntries(
      requiredKeys(paperFor(code)).map((k) => [k, k.startsWith("q_") || k.startsWith("c_") ? "yes" : "Done — see file."]),
    ),
  );
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
    expect(override?.sections.map((s) => s.code)).toContain("E3.1");
  });

  it("blocks downgrading management override", async () => {
    const risks = await listRisks(engagementId);
    const override = risks.find((r) => r.presumedType === "mgmt_override")!;
    await expect(updateRisk(override.id, { significant: false })).rejects.toThrow("not-rebuttable");
    await expect(rebutRevenueFraudRisk(override.id, "try")).rejects.toThrow("not-rebuttable");
  });

  it("blocks de-flagging the revenue-fraud presumption through a plain update (review fix)", async () => {
    const risks = await listRisks(engagementId);
    const revenue = risks.find((r) => r.presumedType === "revenue_fraud")!;
    await expect(updateRisk(revenue.id, { significant: false })).rejects.toThrow("not-rebuttable");
    // Rating updates that do NOT touch significance stay allowed.
    await updateRisk(revenue.id, { likelihood: "high", magnitude: "high" });
  });
});

describe("form framework", () => {
  it("saves and reloads structured fields", async () => {
    await saveForm(engagementId, "P3.1", { ownership_governance: "Family-owned SA", business_model: "Trading" });
    const { values } = await loadForm(engagementId, "P3.1");
    expect(values.ownership_governance).toBe("Family-owned SA");
  });

  it("enforces the P4.1 D&I inquiry+inspection rule", async () => {
    await expect(
      saveForm(engagementId, "P4.1", { control_environment: "ok", di_controls: "JE controls", di_inquiry: true, di_inspection: false }),
    ).rejects.toThrow("di-both-required");
    await saveForm(engagementId, "P4.1", { control_environment: "ok", di_controls: "JE controls", di_inquiry: true, di_inspection: true });
  });
});

describe("acceptance gates → planning (2.2, 2.3, 2.4)", () => {
  it("starts blocked — including the independence gate with NO campaign (review fix)", async () => {
    const gates = await acceptanceGates(engagementId);
    expect(gates.find((g) => g.key === "d31_form_complete")?.ok).toBe(false);
    // Vacuous pass is not allowed: zero campaigns means NOT complete.
    expect(gates.find((g) => g.key === "independence_complete")?.ok).toBe(false);
    await expect(advanceToPlanning(engagementId)).rejects.toThrow(GateError);
  });

  it("independence exception blocks acceptance until a partner disposes it", async () => {
    await launchCampaign(engagementId, [USER]);
    // Re-launch reuses the campaign — no duplicate outstanding confirmations
    // that would block the gate forever (review fix).
    await launchCampaign(engagementId, [USER]);
    expect(await listConfirmations(engagementId)).toHaveLength(1);

    let gates = await acceptanceGates(engagementId);
    expect(gates.find((g) => g.key === "independence_complete")?.ok).toBe(false);

    const confirmations = await listConfirmations(engagementId);
    const mine = confirmations.find((c) => c.userId === USER)!;
    // An exception without its explanation is refused outright (IESBA §120).
    await expect(
      submitConfirmation(mine.token, { financial_interest: true }, "Planner"),
    ).rejects.toThrow("explanation-required");
    const status = await submitConfirmation(mine.token, { financial_interest: true }, "Planner", {
      financial_interest: "Holds 40 shares in the client through a family PEA; divestment initiated.",
    });
    expect(status).toBe("exception");
    // The explanation is stored and readable by the reviewer.
    const withNotes = (await listConfirmations(engagementId)).find((c) => c.userId === USER)!;
    expect(withNotes.explanations?.financial_interest).toContain("40 shares");

    // The signed confirmation is archived into P1.1 as an artifact (spec §4.2).
    const archived = await admin.query<{ kind: string }>(
      "SELECT kind FROM document WHERE engagement_id = $1 AND title LIKE 'Independence confirmation%'",
      [engagementId],
    );
    expect(archived.rows).toHaveLength(1);
    expect(archived.rows[0].kind).toBe("letter");

    gates = await acceptanceGates(engagementId);
    expect(gates.find((g) => g.key === "independence_complete")?.ok).toBe(true);
    expect(gates.find((g) => g.key === "independence_exceptions_disposed")?.ok).toBe(false);

    await disposeException(mine.id, "Interest divested before fieldwork; safeguards documented.");
    gates = await acceptanceGates(engagementId);
    expect(gates.find((g) => g.key === "independence_exceptions_disposed")?.ok).toBe(true);
  });

  it("passes after P1.1 completion + partner sign-off, then advances", async () => {
    const checks = {
      engagement_type: "new",
      integrity_ok: true,
      competence_ok: true,
      conflicts_ok: true,
      aml_ok: true,
      independence_ok: true,
      risk_rating: "moderate",
    };
    // UAT B12: "accept" needs every required check answered Yes — and, on a
    // NEW engagement, the predecessor-auditor communication recorded.
    await expect(saveForm(engagementId, "P1.1", { ...checks, conclusion: "accept" })).rejects.toThrow(
      "acceptance-checks-failed",
    );
    await expect(
      saveForm(engagementId, "P1.1", { ...checks, predecessor_ok: true, aml_ok: false, conclusion: "accept" }),
    ).rejects.toThrow("acceptance-checks-failed");
    await saveForm(engagementId, "P1.1", { ...checks, predecessor_ok: true, conclusion: "accept" });
    // UAT B17: a blank working paper carries nothing to attest to.
    const p11 = await generateDocument(itemId("P1.1"), "en");
    await expect(signDocument(p11, "preparer")).rejects.toThrow("paper-incomplete");
    await completePaper(engagementId, "P1.1");
    await signAsPartner("P1.1");
    const gates = await acceptanceGates(engagementId);
    expect(gates.every((g) => g.ok)).toBe(true);
    await advanceToPlanning(engagementId);
    const phase = await admin.query<{ phase: string }>("SELECT phase FROM engagement WHERE id = $1", [engagementId]);
    expect(phase.rows[0].phase).toBe("planning");
    // Double-submit protection: the transition is atomic and phase-guarded.
    await expect(advanceToPlanning(engagementId)).rejects.toThrow("wrong-phase");
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
    const generated = await generateProgram(itemId("E4.20"), "en");
    expect(generated).toBeGreaterThan(0);
    const steps = await listProgramSteps(itemId("E4.20"));
    expect(steps.some((s) => s.source === "risk_extension")).toBe(true);
    const coverage = await sectionCoverage(itemId("E4.20"));
    const revenue = coverage.find((c) => c.riskDescription.includes("revenue"));
    expect(revenue?.linkedSteps).toBeGreaterThan(0);
  });
});

describe("planning-close gates (2.9, 2.10, 2.13)", () => {
  it("blocks with unapproved materiality, unsigned gate docs, unlinked significant risk", async () => {
    await expect(closePlanning(engagementId)).rejects.toThrow(GateError);
    const gates = await planningCloseGates(engagementId);
    expect(gates.find((g) => g.key === "materiality_approved")?.ok).toBe(false);
    // The presumed management-override risk arrives with its ISA 240 ¶32
    // response already linked — the standard prescribes it and it cannot be
    // rebutted, so it is not the auditor's to decide and no longer holds this
    // gate. A significant risk the auditor raises still does.
    const raised = await admin.query<{ id: string }>(
      `INSERT INTO risk (tenant_id, engagement_id, description, level, likelihood, magnitude, significant, source, category)
       VALUES ($1, $2, 'Unusual related-party financing', 'assertion', 'high', 'high', true, 'test', 'fraud') RETURNING id`,
      [TENANT, engagementId],
    );
    let linked = await planningCloseGates(engagementId);
    expect(linked.find((g) => g.key === "significant_risks_linked")?.ok).toBe(false);
    await admin.query("DELETE FROM risk WHERE id = $1", [raised.rows[0].id]);
    linked = await planningCloseGates(engagementId);
    expect(linked.find((g) => g.key === "significant_risks_linked")?.ok).toBe(true);
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
    await setSectionMaterial(itemId("E4.2"), true);
    const gates = await planningCloseGates(engagementId);
    expect(gates.find((g) => g.key === "material_sections_covered")?.ok).toBe(false);
  });

  it("closes once every gate passes, snapshots, and opens execution", async () => {
    await generateProgram(itemId("E3.1"), "en"); // links mgmt_override
    await addCustomStep(itemId("E4.2"), "Substantive coverage for purchases.", ["C", "A"]);
    // UAT B17: a bespoke paper with unanswered fields cannot be handed off.
    const p22 = await generateDocument(itemId("P2.2"), "en");
    await expect(signDocument(p22, "preparer")).rejects.toThrow("paper-incomplete");
    for (const code of ["P2.2", "P5.2", "S3.1"]) {
      await completePaper(engagementId, code);
      await signAsPartner(code);
    }
    // UAT B15: the three judgement papers alone do not close planning — the
    // partner approves the plan itself on P7.2 (ISA 300 ¶11, ISA 220 ¶30).
    const before = await planningCloseGates(engagementId);
    expect(before.filter((g) => !g.ok).map((g) => g.key)).toEqual(["p72_partner_signed"]);
    // UAT run 2 B07: the approval is the partner's signature on the P7.2
    // summary (every confirmation answered), not the row's sign-off chip.
    await expect(signAsPartner("P7.2")).rejects.toThrow("ras-not-approved");
    const { SECTION_A, SECTION_B } = await import("@/lib/planning-ras");
    for (const key of [...SECTION_A, ...SECTION_B].map((i) => i.key)) {
      await admin.query(
        `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value)
         VALUES ($1, $2, 'wp:P7.2', $3, to_jsonb('yes'::text))`,
        [TENANT, engagementId, key],
      );
    }
    for (const tier of ["fieldwork", "manager", "partner"]) {
      await admin.query(
        `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value)
         VALUES ($1, $2, 'wp:P7.2', $3, to_jsonb('Planner|2026-01-15 10:00'::text))`,
        [TENANT, engagementId, `sig_${tier}`],
      );
    }
    const p72 = await admin.query<{ id: string }>(
      "SELECT d.id FROM document d JOIN file_item fi ON fi.id = d.file_item_id WHERE fi.engagement_id = $1 AND fi.code = 'P7.2'",
      [engagementId],
    );
    await signDocument(p72.rows[0].id, "partner");

    const gates = await planningCloseGates(engagementId);
    // Named, so a failure says which gate held rather than "false".
    expect(gates.filter((g) => !g.ok).map((g) => g.key)).toEqual([]);

    await closePlanning(engagementId);
    const phase = await admin.query<{ phase: string }>("SELECT phase FROM engagement WHERE id = $1", [engagementId]);
    expect(phase.rows[0].phase).toBe("execution");
    const snapshot = await admin.query<{ data: { risks: unknown[] } }>(
      "SELECT data FROM planning_snapshot WHERE engagement_id = $1",
      [engagementId],
    );
    expect(snapshot.rows).toHaveLength(1);
    expect(Array.isArray(snapshot.rows[0].data.risks)).toBe(true);
    // Double-submit cannot produce a second snapshot (review fix).
    await expect(closePlanning(engagementId)).rejects.toThrow("wrong-phase");
    const again = await admin.query("SELECT 1 FROM planning_snapshot WHERE engagement_id = $1", [engagementId]);
    expect(again.rowCount).toBe(1);
  });

  it("only the latest materiality version is approvable (review fix)", async () => {
    const v2 = await createMaterialityVersion(engagementId, {
      benchmark: "revenue",
      benchmarkAmount: 2_100_000_000,
      percentage: 1,
      justification: "Revised after fieldwork start.",
      performancePct: 75,
      trivialPct: 5,
    });
    await expect(approveMateriality(engagementId, v2 - 1)).rejects.toThrow("stale-version");
    await approveMateriality(engagementId, v2);
    const approved = await admin.query(
      "SELECT version_no FROM materiality WHERE engagement_id = $1 AND status = 'approved'",
      [engagementId],
    );
    expect(approved.rowCount).toBe(1);
  });

  it("rejects out-of-range materiality input with a friendly code (review fix)", async () => {
    await expect(
      createMaterialityVersion(engagementId, {
        benchmark: "revenue",
        benchmarkAmount: 1_000_000,
        percentage: 1,
        justification: "x",
        performancePct: 0, // cleared optional input must not reach the DB CHECK
        trivialPct: 5,
      }),
    ).rejects.toThrow("invalid-materiality");
  });
});

describe("P5.2 promote race (review fix)", () => {
  it("a potential risk can only be promoted once", async () => {
    await raisePotentialRisk(engagementId, "Cut-off risk near year end", "P3.2");
    const open = (await listPotentialRisks(engagementId)).find((p) => p.status === "open")!;
    await promotePotentialRisk(open.id);
    await expect(promotePotentialRisk(open.id)).rejects.toThrow("not-found");
  });
});

describe("letter/working-paper collision (review fix)", () => {
  it("letters under P1.1 neither hijack the working paper nor satisfy the partner gate", async () => {
    const fresh = await createEngagement({ clientId, fiscalYear: 2027, periodEnd: "2027-12-31" });
    const letterId = await generateLetter(fresh, "engagement", "en");

    // The working paper is a NEW document, not the letter.
    const freshItems = await listFileItems(fresh);
    const d31 = freshItems.find((i) => i.code === "P1.1")!;
    const workpaperId = await generateDocument(d31.id, "en");
    expect(workpaperId).not.toBe(letterId);

    // The engagement letter is filed under P1.4 (ISA 210), a planning task.
    // Gates, not guidance (UAT B15): nothing of a later phase is signed while
    // acceptance is still open, so the letter cannot be signed at all yet...
    await expect(signDocument(letterId, "preparer")).rejects.toThrow("acceptance-open");
    let gates = await acceptanceGates(fresh);
    expect(gates.find((g) => g.key === "d31_partner_signed")?.ok).toBe(false);

    // ...and even a partner signature sitting on the LETTER (written straight
    // into the table, since the rule above refuses it) does not satisfy the
    // P1.1 gate, which counts working papers only.
    await admin.query(
      `INSERT INTO signoff (tenant_id, document_id, version_no, role, user_id)
       VALUES ($1, $2, 1, 'preparer', $3), ($1, $2, 1, 'partner', $3)`,
      [TENANT, letterId, USER],
    );
    gates = await acceptanceGates(fresh);
    expect(gates.find((g) => g.key === "d31_partner_signed")?.ok).toBe(false);

    // ...only signing the working paper does.
    await completePaper(fresh, "P1.1");
    await signDocument(workpaperId, "preparer");
    await signDocument(workpaperId, "partner");
    gates = await acceptanceGates(fresh);
    expect(gates.find((g) => g.key === "d31_partner_signed")?.ok).toBe(true);
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

    const { values, carried } = await loadForm(nextYear, "P3.1");
    expect(values.ownership_governance).toBe("Family-owned SA");
    expect(carried.has("ownership_governance")).toBe(true);

    // Editing confirms (clears the carried flag).
    await saveForm(nextYear, "P3.1", { ownership_governance: "Family-owned SA (confirmed 2026)" });
    const after = await loadForm(nextYear, "P3.1");
    expect(after.carried.has("ownership_governance")).toBe(false);

    const parties = await admin.query<{ carried_forward: boolean }>(
      "SELECT carried_forward FROM related_party WHERE engagement_id = $1 AND name = 'Holding SA'",
      [nextYear],
    );
    expect(parties.rows[0]?.carried_forward).toBe(true);
  });
});
