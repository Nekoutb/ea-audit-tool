import pg from "pg";
import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The firm's ISA-paper decisions of 2026-10-27:
//   F035 going concern — E6.3 close call and governance communication, the
//        twelve-month horizon measured from the approval of the financial
//        statements on S4.2 and E6.3, the report section cross-referenced on C5.1
//   F025 C5.1 is the opinion and the report; C5.11 is the ISA 260/265
//        communications task, where the governance letters and the ISA 265
//        findings go (migration 20261027000005 moves the existing ones)
//   F037 the ISA 265 deficiency evaluation grid on C5.11, written back to the
//        register, and the archive gate on the written communication
//   F038 the substantive analytical procedures tool (lib/sap.ts)
//
// The database tests need migrations 20261027000005-7 applied.

const TENANT = "b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b3b3";
const ADMIN = "b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b301";
const MANAGER = "b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b302";
const USERS = [ADMIN, MANAGER];

let actor = { id: ADMIN, role: "firm_admin" };

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: actor.id, tenantId: TENANT, role: actor.role, locale: "en", clientId: null },
  })),
}));

import { archiveGates } from "@/lib/completion";
import { closePool, withTenant } from "@/lib/db";
import {
  listDeficiencies,
  saveDeficiencyEvaluation,
  suggestedGrade,
  uncommunicatedSignificantDeficienciesTx,
} from "@/lib/deficiencies";
import { createEngagement, listFileItems } from "@/lib/engagements";
import { listFindings, routeFinding } from "@/lib/execution";
import { DEFAULT_FILE_INDEX, itemsForComplexity, shortTitle, tierOf } from "@/lib/file-index";
import { generateLetter, letterFileCode } from "@/lib/letters";
import { CONCLUSION_PAPERS } from "@/lib/papers/conclusion";
import { EXECUTION_PAPERS } from "@/lib/papers/execution";
import { STRATEGY_PAPERS } from "@/lib/papers/strategy";
import type { PaperDef, PaperItem, PaperProc } from "@/lib/papers/types";
import { sapCountsByIndex, sapThresholds, sapView, saveSap, setSapThresholds } from "@/lib/sap";
import { DEFAULT_SAP_THRESHOLDS, evaluateSap, thresholdPctFor } from "@/lib/sap-model";
import { DEFAULT_REQUIRE_PARTNER_ON, defaultPolicy, effectiveTaskRule } from "@/lib/signoff-policy";
import { groupOfTask } from "@/lib/task-groups";
import { toolOutputsFor } from "@/lib/tool-fed-papers";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import { seedApprovedMateriality, seedValidTb } from "./tool-output-fixtures";

const as = (id: string, role: string) => {
  actor = { id, role };
};

const procs = (def: PaperDef): PaperProc[] =>
  (def.sections ?? []).flatMap((s) => (s.kind === "proc" ? s.procs : []));
const items = (def: PaperDef): PaperItem[] =>
  (def.sections ?? []).flatMap((s) => (s.kind === "yn" ? s.items : []));
const allText = (def: PaperDef): string =>
  [
    ...(def.reqEn ?? []), ...(def.reqFr ?? []), ...(def.conclEn ?? []), ...(def.conclFr ?? []),
    ...procs(def).flatMap((p) => [p.en, p.fr, p.srcEn, p.srcFr, p.tipEn ?? "", p.tipFr ?? ""]),
    ...items(def).flatMap((i) => [i.en, i.fr]),
  ].join(" ");

/* ------------------------------ F025 — the index ------------------------------ */

describe("F025 — C5.1 is the report, C5.11 the communications", () => {
  const c51 = DEFAULT_FILE_INDEX.find((e) => e.code === "C5.1")!;
  const c511 = DEFAULT_FILE_INDEX.find((e) => e.code === "C5.11")!;

  it("retitles C5.1 to the opinion and the report, in both languages", () => {
    expect(c51.titleEn).toBe("Opinion and auditor's report (ISA 700–706)");
    expect(c51.titleFr).toBe("Opinion et rapport d'audit (ISA 700 à 706)");
    expect(shortTitle("C5.1", "en", "")).toMatch(/Opinion/);
    expect(shortTitle("C5.1", "fr", "")).toMatch(/Opinion/);
  });

  it("adds C5.11 as a core task of section C, right after C5.1", () => {
    expect(c511.section).toBe("C");
    expect(c511.titleEn).toBe("Communications with those charged with governance and management (ISA 260/265)");
    expect(c511.titleFr).toBe("Communications avec la gouvernance et la direction (ISA 260/265)");
    expect(tierOf(c511)).toBe("core");
    expect(c511.conditional).toBeUndefined();
    const codes = DEFAULT_FILE_INDEX.map((e) => e.code);
    expect(codes.indexOf("C5.11")).toBe(codes.indexOf("C5.1") + 1);
    // every tier instantiates it
    for (const complexity of ["very_simple", "non_complex", "complex"] as const) {
      expect(itemsForComplexity(complexity).some((e) => e.code === "C5.11")).toBe(true);
    }
    expect(shortTitle("C5.11", "en", "")).toBe("Communications (ISA 260/265)");
    expect(groupOfTask("C5.11")?.id).toBe("c5");
  });

  it("gives C5.11 the C5.x sign-off rule: manager prepares, partner reviews and signs", () => {
    const rule = effectiveTaskRule(defaultPolicy(), new Map(), "C5.11");
    expect([rule.minPreparer, rule.minReviewer, rule.partnerRequired]).toEqual(["manager", "partner", true]);
    expect(DEFAULT_REQUIRE_PARTNER_ON).toContain("C5.11");
    // the C5.1 rule is unchanged by the retitle
    const c51Rule = effectiveTaskRule(defaultPolicy(), new Map(), "C5.1");
    expect([c51Rule.minPreparer, c51Rule.minReviewer, c51Rule.partnerRequired]).toEqual(["manager", "partner", true]);
  });

  it("leaves the tool-fed mapping untouched: neither C5.1 nor C5.11 is tool-fed", () => {
    expect(toolOutputsFor("C5.1")).toEqual([]);
    expect(toolOutputsFor("C5.11")).toEqual([]);
  });

  it("files the governance and management letters on C5.11", () => {
    expect(letterFileCode("planning_tcwg")).toBe("C5.11");
    expect(letterFileCode("tcwg_completion")).toBe("C5.11");
    expect(letterFileCode("management_letter")).toBe("C5.11");
    expect(letterFileCode("engagement")).toBe("P1.4");
    expect(letterFileCode("rep_affirmation")).toBe("C3.1");
  });

  it("names C5.11, not C5.1, wherever the screens route a deficiency or a letter", () => {
    for (const m of [en, fr]) {
      expect(m.planning.execution.routes.c1).toContain("C5.11");
      expect(m.planning.execution.decisions.deficiency).toContain("C5.11");
      expect(m.planning.findings.c1).toContain("C5.11");
      expect(m.planning.letters.planningTcwg).toContain("C5.11");
      expect(m.planning.conclusion.managementLetter).toContain("C5.11");
      expect(m.planning.conclusion.tcwgReport).toContain("C5.11");
      expect(m.planning.conclusion.managementLetter).not.toMatch(/C5\.1\b/);
    }
  });

  it("gives C5.11 a communications paper of its own under ISA 260 and ISA 265", () => {
    const def = CONCLUSION_PAPERS["C5.11"];
    expect(def).toBeDefined();
    expect(def.std).toMatch(/ISA 260/);
    expect(def.std).toMatch(/ISA 265/);
    const keys = procs(def).map((p) => p.key);
    expect(keys).toEqual(expect.arrayContaining(["planning", "findings", "independence", "evaluate", "sig_written", "mgmt", "timing"]));
    expect(items(def).map((i) => i.key)).toEqual(expect.arrayContaining(["planning", "findings", "graded", "sig_written", "mgmt", "timely"]));
    expect(allText(def)).toMatch(/ISA 265 ¶9/);
    expect(allText(def)).toMatch(/¶10/);
    // the report paper stays the report paper
    expect(CONCLUSION_PAPERS["C5.1"].std).toMatch(/ISA 700/);
  });
});

/* ------------------------------ F035 — going concern ------------------------------ */

describe("F035 — going concern (ISA 570 Revised 2024)", () => {
  const e63 = EXECUTION_PAPERS["E6.3"];
  const s42 = STRATEGY_PAPERS["S4.2"];
  const c51 = CONCLUSION_PAPERS["C5.1"];

  it("E6.3 carries the close-call procedure and item (¶20)", () => {
    const closeCall = procs(e63).find((p) => p.key === "close_call")!;
    expect(closeCall).toBeDefined();
    expect(closeCall.en).toMatch(/no material uncertainty/);
    expect(closeCall.srcEn).toMatch(/¶20/);
    expect(closeCall.fr).toMatch(/cas limite/i);
    const item = items(e63).find((i) => i.key === "close_call")!;
    expect(item.en).toMatch(/¶20/);
    expect(item.na).toBe(true);
  });

  it("E6.3 communicates the events or conditions to governance (¶25) through C5.11", () => {
    const communicate = procs(e63).find((p) => p.key === "communicate")!;
    expect(communicate.en).toMatch(/those charged with governance/);
    expect(communicate.en).toMatch(/C5\.11/);
    expect(communicate.srcEn).toMatch(/¶25/);
    expect(communicate.fr).toMatch(/C5\.11/);
    const item = items(e63).find((i) => i.key === "communicated")!;
    expect(item.en).toMatch(/C5\.11/);
  });

  it("S4.2 and E6.3 measure the twelve months from the date of approval of the financial statements", () => {
    for (const def of [e63, s42]) {
      const text = allText(def);
      expect(text).toMatch(/twelve months from the (expected )?date (of|the financial statements will be) approv/);
      expect(text).toMatch(/douze mois à compter de la date (prévue )?d'approbation/);
      expect(text).not.toMatch(/authorised for issue/);
      expect(text).not.toMatch(/autorisation de publication/);
      expect(text).not.toMatch(/twelve months from the date of the financial statements/);
    }
    expect((e63.reqEn ?? []).join(" ")).toMatch(/Revised 2024/);
    expect((s42.reqEn ?? []).join(" ")).toMatch(/Revised 2024/);
    expect(items(e63).find((i) => i.key === "period")!.en).toMatch(/date of approval/);
    expect(items(s42).find((i) => i.key === "assessment")!.fr).toMatch(/date d'approbation/);
  });

  it("C5.1 cross-references the report section of ISA 570 ¶22–23", () => {
    const gc = procs(c51).find((p) => p.key === "going_concern")!;
    expect(gc.en).toMatch(/Material uncertainty related to going concern/);
    expect(gc.srcEn).toMatch(/¶20, ¶22–23/);
    expect(gc.fr).toMatch(/Incertitude significative liée à la continuité d'exploitation/);
    expect(items(c51).some((i) => i.key === "going_concern" && /¶22–23/.test(i.en))).toBe(true);
    expect((e63.conclEn ?? []).join(" ")).toMatch(/¶22/);
  });
});

/* ------------------------------ F037 / F038 — pure ------------------------------ */

describe("F037 — ISA 265 grade suggestion", () => {
  it("follows the likelihood × magnitude matrix of A5", () => {
    expect(suggestedGrade("probable", "material")).toBe("significant_deficiency");
    expect(suggestedGrade("reasonably_possible", "material")).toBe("significant_deficiency");
    expect(suggestedGrade("remote", "material")).toBe("deficiency");
    expect(suggestedGrade("remote", "inconsequential")).toBe("observation");
    expect(suggestedGrade("probable", "inconsequential")).toBe("deficiency");
    expect(suggestedGrade(null, "material")).toBeNull();
  });

  it("labels the archive gate in both languages", () => {
    expect(en.planning.conclusion.archiveGateNames.deficiencies_communicated).toMatch(/ISA 265/);
    expect(fr.planning.conclusion.archiveGateNames.deficiencies_communicated).toMatch(/ISA 265/);
    for (const m of [en, fr]) {
      const errors = m.planning.errors as Record<string, string>;
      for (const code of ["recipient-required", "significant-deficiency-not-communicated", "sap-override-reason-required", "sap-threshold-out-of-range", "sap-expectation-required"]) {
        expect(errors[code], code).toBeTruthy();
      }
    }
  });
});

describe("F038 — the threshold model", () => {
  it("maps the CRA level to the firm percentage, minimal with low, unassessed as high", () => {
    expect(thresholdPctFor("minimal", DEFAULT_SAP_THRESHOLDS)).toBe(75);
    expect(thresholdPctFor("low", DEFAULT_SAP_THRESHOLDS)).toBe(75);
    expect(thresholdPctFor("moderate", DEFAULT_SAP_THRESHOLDS)).toBe(50);
    expect(thresholdPctFor("high", DEFAULT_SAP_THRESHOLDS)).toBe(25);
    expect(thresholdPctFor(null, { low: 80, moderate: 50, high: 20 })).toBe(20);
  });

  it("compares the difference with the share of performance materiality", () => {
    expect(evaluateSap({ expected: 10_000, actual: 12_000, performanceMateriality: 7_500, pct: 25 })).toEqual({ threshold: 1_875, difference: 2_000, exceeds: true });
    expect(evaluateSap({ expected: 10_000, actual: 11_000, performanceMateriality: 7_500, pct: 25 })).toEqual({ threshold: 1_875, difference: 1_000, exceeds: false });
    expect(evaluateSap({ expected: 10_000, actual: null, performanceMateriality: 7_500, pct: 25 })).toEqual({ threshold: 1_875, difference: null, exceeds: null });
    expect(evaluateSap({ expected: 10_000, actual: 9_000, performanceMateriality: null, pct: 25 })).toEqual({ threshold: null, difference: -1_000, exceeds: null });
  });
});

/* ------------------------------ database ------------------------------ */

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let engagementId: string;
let c51Id: string;
let c511Id: string;
let e41Id: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1::uuid[])", [USERS]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Batch3 Firm', 'batch3-test')", [TENANT]);
  for (const [id, email, role] of [
    [ADMIN, "admin@batch3.local", "firm_admin"],
    [MANAGER, "manager@batch3.local", "manager"],
  ]) {
    await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, $2, $2, 'x')", [id, email]);
    await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, $3)", [id, TENANT, role]);
  }
  as(ADMIN, "firm_admin");
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Batch3 SA', 'SA') RETURNING id",
    [TENANT],
  );
  engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31", partnerId: ADMIN });
  await admin.query(
    "INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role, status) VALUES ($1, $2, $3, 'manager', 'accepted')",
    [TENANT, engagementId, MANAGER],
  );
  const fileItems = await listFileItems(engagementId);
  c51Id = fileItems.find((i) => i.code === "C5.1")!.id;
  c511Id = fileItems.find((i) => i.code === "C5.11")!.id;
  e41Id = fileItems.find((i) => i.code === "E4.1")!.id;
  await seedApprovedMateriality(admin, engagementId); // PM 7 500
}, 30_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("F025 — C5.11 on the file", () => {
  it("instantiates C5.11 right after C5.1 and files the governance letters there", async () => {
    const fileItems = await listFileItems(engagementId);
    const codes = fileItems.map((i) => i.code);
    expect(codes.indexOf("C5.11")).toBe(codes.indexOf("C5.1") + 1);
    const docOf = async (id: string) =>
      (await admin.query<{ code: string }>("SELECT fi.code FROM document d JOIN file_item fi ON fi.id = d.file_item_id WHERE d.id = $1", [id])).rows[0].code;
    expect(await docOf(await generateLetter(engagementId, "management_letter", "en"))).toBe("C5.11");
    expect(await docOf(await generateLetter(engagementId, "tcwg_completion", "fr"))).toBe("C5.11");
    // the planning communication still prefers P7.1 when the file has it (UAT run 2 B56)
    expect(await docOf(await generateLetter(engagementId, "planning_tcwg", "en"))).toBe("P7.1");
  });

  it("migration 20261027000005 moves the letters and findings of a pre-split file and logs the move", async () => {
    // a file from before the split: no C5.11, a letter and a finding on C5.1
    await admin.query("DELETE FROM file_item WHERE id = $1", [c511Id]);
    const letter = await admin.query<{ id: string }>(
      `INSERT INTO document (tenant_id, engagement_id, file_item_id, title, language, kind)
       VALUES ($1, $2, $3, 'Old management letter', 'en', 'letter') RETURNING id`,
      [TENANT, engagementId, c51Id],
    );
    const finding = await admin.query<{ id: string }>(
      `INSERT INTO finding (tenant_id, engagement_id, file_item_id, route, title, severity)
       VALUES ($1, $2, $3, 'c1', 'Old deficiency on C5.1', 'deficiency') RETURNING id`,
      [TENANT, engagementId, c51Id],
    );
    const sql = readFileSync("migrations/20261027000005_c511_communications.sql", "utf8");
    const up = sql.split(/^-- Up Migration\s*$/m)[1].split(/^-- Down Migration\s*$/m)[0];
    const tx = await admin.connect();
    try {
      await tx.query("BEGIN");
      await tx.query(up);
      await tx.query("COMMIT");
    } catch (e) {
      await tx.query("ROLLBACK");
      throw e;
    } finally {
      tx.release();
    }
    const c511 = await admin.query<{ id: string; sort_order: number }>(
      "SELECT id, sort_order FROM file_item WHERE engagement_id = $1 AND code = 'C5.11'",
      [engagementId],
    );
    expect(c511.rows).toHaveLength(1);
    c511Id = c511.rows[0].id;
    const moved = await admin.query<{ letter: string; finding: string }>(
      `SELECT (SELECT file_item_id FROM document WHERE id = $1) AS letter,
              (SELECT file_item_id FROM finding WHERE id = $2) AS finding`,
      [letter.rows[0].id, finding.rows[0].id],
    );
    expect(moved.rows[0]).toEqual({ letter: c511Id, finding: c511Id });
    const log = await admin.query<{ summary: string; meta: { letters: number; findings: number } }>(
      "SELECT summary, meta FROM activity_log WHERE engagement_id = $1 AND action = 'task_recoded' AND entity_id = $2",
      [engagementId, c511Id],
    );
    expect(log.rows).toHaveLength(1);
    expect(log.rows[0].summary).toMatch(/1 letter\(s\) and 1 finding\(s\) moved from C5\.1 to C5\.11/);
    expect(log.rows[0].meta).toMatchObject({ from: "C5.1", to: "C5.11", letters: 1, findings: 1 });
    // a second run is a no-op
    const again = await admin.connect();
    try {
      await again.query("BEGIN");
      await again.query(up);
      await again.query("COMMIT");
    } finally {
      again.release();
    }
    expect((await admin.query("SELECT count(*)::int AS n FROM file_item WHERE engagement_id = $1 AND code = 'C5.11'", [engagementId])).rows[0].n).toBe(1);
    await admin.query("DELETE FROM finding WHERE id = $1", [finding.rows[0].id]);
  });
});

describe("F037 — the deficiency evaluation grid and the archive gate", () => {
  let findingId: string;
  let otherId: string;

  it("grades a deficiency on the grid and writes the grade back to the register", async () => {
    await routeFinding({ engagementId, fileItemId: e41Id, route: "c1", title: "Credit limits not reviewed", severity: "deficiency" });
    await routeFinding({ engagementId, fileItemId: e41Id, route: "c1", title: "No aged-balance review", severity: "observation" });
    const findings = await listFindings(engagementId);
    findingId = findings.find((f) => f.title === "Credit limits not reviewed")!.id;
    otherId = findings.find((f) => f.title === "No aged-balance review")!.id;
    await saveDeficiencyEvaluation({
      engagementId, findingId,
      likelihood: "probable", magnitude: "material",
      accountsAssertions: "Receivables (E) — valuation", managementAware: false,
      indicators: "No remediation of the deficiency reported last year",
      relatedFindingIds: [otherId], aggregationNote: "Together the two leave the receivables balance unreviewed.",
      grade: "significant_deficiency", communicatedOn: null, recipient: null,
    });
    const row = (await listDeficiencies(engagementId)).find((d) => d.findingId === findingId)!;
    expect(row.severity).toBe("significant_deficiency");
    expect(row.evaluation?.grade).toBe("significant_deficiency");
    expect(row.evaluation?.relatedFindingIds).toEqual([otherId]);
    expect(row.evaluation?.communicatedOn).toBeNull();
    expect((await listFindings(engagementId)).find((f) => f.id === findingId)?.severity).toBe("significant_deficiency");
  });

  it("refuses an unknown related deficiency and a communication date without a recipient", async () => {
    const base = {
      engagementId, findingId, likelihood: "probable", magnitude: "material", accountsAssertions: null, managementAware: null,
      indicators: null, relatedFindingIds: [] as string[], aggregationNote: null, grade: "significant_deficiency", recipient: null,
    };
    await expect(saveDeficiencyEvaluation({ ...base, communicatedOn: null, relatedFindingIds: ["b3b3b3b3-b3b3-4b3b-8b3b-b3b3b3b3b3ff"] })).rejects.toThrow("related-finding-unknown");
    await expect(saveDeficiencyEvaluation({ ...base, communicatedOn: "2026-03-20" })).rejects.toThrow("recipient-required");
    await expect(saveDeficiencyEvaluation({ ...base, communicatedOn: null, grade: "severe" })).rejects.toThrow("invalid-severity");
  });

  it("holds the archive gate while a significant deficiency has no written-communication date", async () => {
    const pending = await withTenant(TENANT, (tx) => uncommunicatedSignificantDeficienciesTx(tx, engagementId));
    expect(pending).toBe(1);
    const gate = (await archiveGates(engagementId)).find((g) => g.key === "deficiencies_communicated")!;
    expect(gate.ok).toBe(false);
    expect(gate.pending).toBe(1);
    expect(gate.codes).toEqual(["C5.11"]);

    await saveDeficiencyEvaluation({
      engagementId, findingId, likelihood: "probable", magnitude: "material", accountsAssertions: null, managementAware: true,
      indicators: null, relatedFindingIds: [otherId], aggregationNote: null, grade: "significant_deficiency",
      communicatedOn: "2026-03-20", recipient: "Chairman of the board",
    });
    expect(await withTenant(TENANT, (tx) => uncommunicatedSignificantDeficienciesTx(tx, engagementId))).toBe(0);
    const after = (await archiveGates(engagementId)).find((g) => g.key === "deficiencies_communicated")!;
    expect(after.ok).toBe(true);
    const row = (await listDeficiencies(engagementId)).find((d) => d.findingId === findingId)!;
    expect(row.evaluation?.communicatedOn).toBe("2026-03-20");
    expect(row.evaluation?.recipient).toBe("Chairman of the board");
    // an observation never holds the gate
    expect((await listDeficiencies(engagementId)).find((d) => d.findingId === otherId)!.severity).toBe("observation");
  });
});

describe("F038 — substantive analytical procedures", () => {
  it("reads the firm defaults and lets an administrator change them within the rules", async () => {
    expect(await sapThresholds()).toEqual({ low: 75, moderate: 50, high: 25 });
    await expect(setSapThresholds({ low: 120, moderate: 50, high: 25 })).rejects.toThrow("sap-threshold-out-of-range");
    await expect(setSapThresholds({ low: 40, moderate: 50, high: 25 })).rejects.toThrow("sap-threshold-order");
    as(MANAGER, "manager");
    await expect(setSapThresholds({ low: 80, moderate: 50, high: 20 })).rejects.toThrow();
    as(ADMIN, "firm_admin");
    await setSapThresholds({ low: 80, moderate: 50, high: 20 });
    expect(await sapThresholds()).toEqual({ low: 80, moderate: 50, high: 20 });
  });

  it("needs an expectation, and a reason for a threshold override", async () => {
    const base = {
      engagementId, indexCode: "E", assertion: "E", expectationModel: "Opening balance + sales − cash received, per month",
      inputs: null, expectedValue: 10_000, dataReliability: "Sales ledger tested in E4.20", thresholdOverridePct: null,
      thresholdOverrideReason: null, actualValue: 12_000, investigation: null, corroboration: null, conclusion: null,
    };
    await expect(saveSap({ ...base, expectationModel: "  " })).rejects.toThrow("sap-expectation-required");
    await expect(saveSap({ ...base, thresholdOverridePct: 10 })).rejects.toThrow("sap-override-reason-required");
    await expect(saveSap({ ...base, indexCode: "ZZ" })).rejects.toThrow("invalid-index");
    await expect(saveSap({ ...base, assertion: "X" })).rejects.toThrow("invalid-assertion");
    await expect(saveSap({ ...base, conclusion: "maybe" })).rejects.toThrow("invalid-conclusion");
  });

  it("evaluates expected against the recorded amount at the CRA threshold, snapshotting the percentage", async () => {
    // no CRA on E/E yet: the tightest (high) percentage applies — 20 % of PM 7 500 = 1 500
    await saveSap({
      engagementId, indexCode: "E", assertion: "E", expectationModel: "Opening + sales − receipts", inputs: "Sales 120 000; receipts 118 000",
      expectedValue: 10_000, dataReliability: "ledger tested", thresholdOverridePct: null, thresholdOverrideReason: null,
      actualValue: 12_000, investigation: "Two December invoices unpaid", corroboration: "Subsequent receipts in January", conclusion: "supported",
    });
    let view = await sapView(engagementId);
    let ix = view.indexes.find((i) => i.def.code === "E")!;
    expect(ix.taskCode).toBe("E4.1");
    expect(ix.fileItemId).toBe(e41Id);
    let p = ix.procedures.find((x) => x.assertion === "E")!;
    expect(p.craLevel).toBeNull();
    expect(p.thresholdPct).toBe(20);
    expect(p.actualSource).toBe("manual");
    expect(p.evaluation).toEqual({ threshold: 1_500, difference: 2_000, exceeds: true });

    // a minimal CRA on E/E and an imported TB: the low percentage and the TB closing
    await admin.query(
      `INSERT INTO cra_assessment (tenant_id, engagement_id, index_code, assertion, relevant, ir, cr)
       VALUES ($1, $2, 'E', 'E', true, 'lower', 'rely')`,
      [TENANT, engagementId],
    );
    await seedValidTb(admin, engagementId); // 411000 Clients 1 000 → index E
    await saveSap({
      engagementId, indexCode: "E", assertion: "E", expectationModel: "Opening + sales − receipts", inputs: null,
      expectedValue: 1_100, dataReliability: null, thresholdOverridePct: 5, thresholdOverrideReason: "Precise expectation from a tested ledger",
      actualValue: 999_999, investigation: null, corroboration: null, conclusion: "supported",
    });
    view = await sapView(engagementId);
    ix = view.indexes.find((i) => i.def.code === "E")!;
    expect(ix.tbClosing).toBe(1_000);
    expect(ix.cra.E).toBe("minimal");
    p = ix.procedures.find((x) => x.assertion === "E")!;
    expect(p.craLevel).toBe("minimal");
    expect(p.thresholdPct).toBe(80);
    expect(p.thresholdOverridePct).toBe(5);
    expect(p.actualSource).toBe("tb");
    expect(p.actualValue).toBe(1_000);
    // the override applies: 5 % of 7 500 = 375, |1 000 − 1 100| = 100 → within
    expect(p.evaluation).toEqual({ threshold: 375, difference: -100, exceeds: false });

    const counts = await sapCountsByIndex(engagementId);
    expect(counts.E).toEqual({ total: 1, concluded: 1, exceeding: 0 });
    expect(counts.N).toBeUndefined();
  });
});
