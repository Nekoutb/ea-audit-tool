import ExcelJS from "exceljs";
import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Sign-off governance (F001 no self-review, F002 firm sign-off policy and
// per-task role rules, F003 exactly one engagement partner).
//
// The database half needs migrations/20261012000001_signoff_governance.sql
// applied (firm_signoff_policy, firm_task_signoff_rule and
// engagement.partner_delegate_user_id). The workbook half is pure.

const TENANT = "5f5f5f5f-5f5f-4f5f-8f5f-5f5f5f5f5f5f";
const ADMIN = "5f5f5f5f-5f5f-4f5f-8f5f-5f5f5f5f5f01";
const PARTNER = "5f5f5f5f-5f5f-4f5f-8f5f-5f5f5f5f5f02";
const PARTNER2 = "5f5f5f5f-5f5f-4f5f-8f5f-5f5f5f5f5f03";
const MANAGER = "5f5f5f5f-5f5f-4f5f-8f5f-5f5f5f5f5f04";
const SENIOR = "5f5f5f5f-5f5f-4f5f-8f5f-5f5f5f5f5f05";
const STAFF = "5f5f5f5f-5f5f-4f5f-8f5f-5f5f5f5f5f06";

let actor = { id: ADMIN, role: "firm_admin" };

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: actor.id, tenantId: TENANT, role: actor.role, locale: "en", clientId: null },
  })),
}));

import { closePool } from "@/lib/db";
import { generateDocument, getDocument, signDocument } from "@/lib/documents";
import { createEngagement, listFileItems } from "@/lib/engagements";
import { acceptanceGates } from "@/lib/gates";
import {
  MATRIX_SHEET,
  buildSignoffMatrix,
  matrixTasks,
  parseMatrixRole,
  parseMatrixYesNo,
  parseSignoffMatrix,
} from "@/lib/signoff-matrix";
import {
  DEFAULT_REQUIRE_PARTNER_ON,
  belowMinimumCode,
  defaultPolicy,
  effectiveTaskRule,
  getPolicy,
  savePolicy,
  saveTaskRules,
  teamRank,
} from "@/lib/signoff-policy";
import {
  assignTasks,
  assignTeamMember,
  engagementPartnerInfo,
  removeTeamMember,
  setPartnerDelegate,
  transferEngagementPartner,
} from "@/lib/team";
import { DEFAULT_FILE_INDEX } from "@/lib/file-index";
import { seedValidTb } from "./tool-output-fixtures";

const as = (id: string, role: string) => {
  actor = { id, role };
};

/* ------------------------------ pure rules ------------------------------ */

describe("the ladder and the effective rule", () => {
  it("ranks the six-level ladder and keeps the EQR off it", () => {
    expect(teamRank("staff")).toBeLessThan(teamRank("senior"));
    expect(teamRank("senior")).toBeLessThan(teamRank("manager"));
    expect(teamRank("manager")).toBeLessThan(teamRank("senior_manager"));
    expect(teamRank("senior_manager")).toBeLessThan(teamRank("director"));
    expect(teamRank("director")).toBeLessThan(teamRank("partner"));
    expect(teamRank("eqr_reviewer")).toBe(-1);
    expect(teamRank(null)).toBe(-1);
  });

  it("falls back to the default matrix when the firm saved nothing", () => {
    const policy = defaultPolicy();
    expect(policy.minReviewerRole).toBe("senior");
    expect(policy.allowSolePractitioner).toBe(false);
    expect(policy.requireDistinctPreparerApprover).toBe(true);
    // the 2026-10-27 matrix (F002): every C5.x and C6.2 join the older eight
    const c5 = DEFAULT_FILE_INDEX.map((e) => e.code).filter((c) => c.startsWith("C5."));
    expect([...DEFAULT_REQUIRE_PARTNER_ON].sort()).toEqual(
      ["C1.1", "P1.1", "P2.2", "P5.2", "P7.2", "S3.1", "S6.1", "S6.2", "C6.2", ...c5].sort(),
    );
    expect(effectiveTaskRule(policy, new Map(), "P1.1")).toEqual({
      minPreparer: "manager",
      minReviewer: "partner",
      partnerRequired: true,
    });
    expect(effectiveTaskRule(policy, new Map(), "E4.1").partnerRequired).toBe(false);
  });

  it("lets a task rule override each column, NULL meaning the firm default", () => {
    const rules = new Map([["E4.1", { minPreparer: "senior" as const, minReviewer: null, partnerRequired: true }]]);
    expect(effectiveTaskRule({ ...defaultPolicy(), minReviewerRole: "manager" }, rules, "E4.1")).toEqual({
      minPreparer: "senior",
      minReviewer: "manager",
      partnerRequired: true,
    });
  });

  it("names the required role in the refusal code", () => {
    expect(belowMinimumCode("senior_manager")).toBe("role-below-task-minimum-senior-manager");
    expect(belowMinimumCode("partner")).toBe("role-below-task-minimum-partner");
  });
});

describe("the sign-off matrix workbook", () => {
  it("reads roles by key or by FR/EN label, and Oui/Non or Yes/No", () => {
    expect(parseMatrixRole("Assistant audit")).toBe("staff");
    expect(parseMatrixRole("staff")).toBe("staff");
    expect(parseMatrixRole("Senior manager")).toBe("senior_manager");
    expect(parseMatrixRole("senior_manager")).toBe("senior_manager");
    expect(parseMatrixRole("Directeur")).toBe("director");
    expect(parseMatrixRole("Associé")).toBe("partner");
    expect(parseMatrixRole("associe")).toBe("partner");
    expect(parseMatrixRole("  ")).toBeNull();
    expect(parseMatrixRole("Stagiaire")).toBeUndefined();
    expect(parseMatrixYesNo("Oui")).toBe(true);
    expect(parseMatrixYesNo("No")).toBe(false);
    expect(parseMatrixYesNo("")).toBeNull();
    expect(parseMatrixYesNo("Peut-être")).toBeUndefined();
  });

  it("lists all the default index tasks, phase by phase", () => {
    const tasks = matrixTasks();
    expect(tasks).toHaveLength(DEFAULT_FILE_INDEX.length);
    expect(new Set(tasks.map((t) => t.entry.code)).size).toBe(DEFAULT_FILE_INDEX.length);
  });

  it("round-trips: download, fill columns I-K, import", async () => {
    const content = await buildSignoffMatrix(defaultPolicy(), new Map(), "fr");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(content as unknown as ArrayBuffer);
    expect(wb.worksheets.map((w) => w.name)).toEqual(["Rôles", MATRIX_SHEET]);
    const ws = wb.getWorksheet(MATRIX_SHEET)!;
    // header in French, data from row 2, today's values in F-H
    expect(ws.getRow(1).getCell(11).value).toBe("Signature associé requise (Oui/Non)");
    const rowOf = (code: string) => {
      let found = 0;
      ws.eachRow((row, n) => {
        if (row.getCell(1).value === code) found = n;
      });
      return found;
    };
    const p11 = rowOf("P1.1");
    expect(ws.getRow(p11).getCell(8).value).toBe("Oui");
    expect(ws.getRow(p11).getCell(6).value).toBe("Manager");
    expect(ws.getRow(p11).getCell(7).value).toBe("Associé");
    // the firm's own columns
    const e41 = rowOf("E4.1");
    ws.getRow(e41).getCell(9).value = "Senior";
    ws.getRow(e41).getCell(10).value = "manager";
    ws.getRow(e41).getCell(11).value = "Oui";
    ws.getRow(e41).getCell(12).value = "comment ignored";
    const back = Buffer.from(await wb.xlsx.writeBuffer());
    const parsed = await parseSignoffMatrix(back, "fr");
    expect(parsed.errors).toEqual([]);
    expect(parsed.rules).toHaveLength(DEFAULT_FILE_INDEX.length);
    expect(parsed.rules.find((r) => r.code === "E4.1")).toEqual({
      code: "E4.1",
      minPreparer: "senior",
      minReviewer: "manager",
      partnerRequired: true,
    });
    // a blank I-K row is the firm default
    expect(parsed.rules.find((r) => r.code === "P1.1")).toEqual({
      code: "P1.1",
      minPreparer: null,
      minReviewer: null,
      partnerRequired: null,
    });
  });

  it("reports every bad row and keeps nothing from them", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Rôles");
    const ws = wb.addWorksheet(MATRIX_SHEET);
    ws.addRow(["Code"]);
    ws.addRow(["E4.1", "", "", "", "", "", "", "", "Stagiaire", "", ""]);
    ws.addRow(["Z9.9", "", "", "", "", "", "", "", "", "", ""]);
    ws.addRow(["E4.2", "", "", "", "", "", "", "", "", "", "Peut-être"]);
    ws.addRow(["E4.3", "", "", "", "", "", "", "", "Directeur", "Associé", "Non"]);
    const parsed = await parseSignoffMatrix(Buffer.from(await wb.xlsx.writeBuffer()), "en");
    expect(parsed.errors.map((e) => e.row)).toEqual([2, 3, 4]);
    expect(parsed.errors[0].message).toContain("column I");
    expect(parsed.rules).toEqual([{ code: "E4.3", minPreparer: "director", minReviewer: "partner", partnerRequired: false }]);
  });

  it("refuses a workbook without the Tasks sheet", async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet("Sheet1");
    const parsed = await parseSignoffMatrix(Buffer.from(await wb.xlsx.writeBuffer()), "fr");
    expect(parsed.errors[0].message).toContain("Tasks");
  });
});

/* ---------------------- the database half (migration) ---------------------- */

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let engagementId: string;
let otherEngagementId: string;
const itemIds: Record<string, string> = {};

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1::uuid[])", [[ADMIN, PARTNER, PARTNER2, MANAGER, SENIOR, STAFF]]);
}

async function docFor(code: string): Promise<string> {
  as(ADMIN, "firm_admin");
  return generateDocument(itemIds[code], "en");
}

describe("sign-off governance against the database", () => {
  beforeAll(async () => {
    await removeFixture();
    await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Governance Firm', 'governance-test')", [TENANT]);
    const users: [string, string, string][] = [
      [ADMIN, "admin@gov.local", "firm_admin"],
      [PARTNER, "partner@gov.local", "partner"],
      [PARTNER2, "partner2@gov.local", "partner"],
      [MANAGER, "manager@gov.local", "manager"],
      [SENIOR, "senior@gov.local", "senior"],
      [STAFF, "staff@gov.local", "staff"],
    ];
    for (const [id, email, role] of users) {
      await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, $2, $2, 'x')", [id, email]);
      await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, $3)", [id, TENANT, role]);
    }
    const client = await admin.query<{ id: string }>(
      "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Governance SA', 'SA') RETURNING id",
      [TENANT],
    );
    as(ADMIN, "firm_admin");
    engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31", partnerId: ADMIN });
    otherEngagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2024, periodEnd: "2024-12-31", partnerId: ADMIN });
    // Creation now seats the engagement partner. These tests walk the seat
    // from empty (a file opened before the partner became mandatory), and the
    // administrator must stay off the team, so the seat is vacated here.
    await admin.query("DELETE FROM team_member WHERE engagement_id = ANY($1::uuid[])", [[engagementId, otherEngagementId]]);
    // execution work, so the phase gates stay out of the way
    await admin.query("UPDATE engagement SET phase = 'execution' WHERE id = ANY($1::uuid[])", [[engagementId, otherEngagementId]]);
    for (const item of await listFileItems(engagementId)) itemIds[item.code] = item.id;
    // the E4 lead schedules are fed by the trial balance (F004)
    await seedValidTb(admin, engagementId);
    await seedValidTb(admin, otherEngagementId);
  }, 60_000);

  afterEach(() => as(ADMIN, "firm_admin"));

  afterAll(async () => {
    await removeFixture();
    await admin.end();
    await closePool();
  });

  describe("F003 — exactly one engagement partner", () => {
    it("keeps the partner seat for firm partners and administrators", async () => {
      await expect(assignTeamMember(engagementId, MANAGER, "partner")).rejects.toThrow("partner-role-requires-partner-rank");
    });

    it("designates one partner, refuses a second, and the gate follows", async () => {
      expect((await acceptanceGates(engagementId)).find((g) => g.key === "engagement_partner_designated")?.ok).toBe(false);
      await assignTeamMember(engagementId, PARTNER, "partner");
      await expect(assignTeamMember(engagementId, PARTNER2, "partner")).rejects.toThrow("one-engagement-partner");
      expect((await acceptanceGates(engagementId)).find((g) => g.key === "engagement_partner_designated")?.ok).toBe(true);
    });

    it("never leaves the seat empty once it is accepted", async () => {
      await expect(removeTeamMember(engagementId, PARTNER)).rejects.toThrow("last-partner");
      await expect(assignTeamMember(engagementId, PARTNER, "director")).rejects.toThrow("last-partner");
    });

    it("staffs the rest of the team", async () => {
      await assignTeamMember(engagementId, MANAGER, "manager");
      await assignTeamMember(engagementId, SENIOR, "senior");
      await assignTeamMember(engagementId, STAFF, "staff");
      await assignTeamMember(engagementId, PARTNER2, "director");
    });
  });

  describe("F001/F002 — who signs what", () => {
    it("refuses a signer who is not an accepted member of the team", async () => {
      const doc = await docFor("E4.1");
      // the firm administrator sees every file but is not on this team
      await expect(signDocument(doc, "preparer")).rejects.toThrow("not-on-team-to-sign");
      await admin.query("UPDATE team_member SET status = 'invited' WHERE engagement_id = $1 AND user_id = $2", [engagementId, STAFF]);
      as(STAFF, "staff");
      await expect(signDocument(doc, "preparer")).rejects.toThrow("accept-engagement-first");
      await admin.query("UPDATE team_member SET status = 'accepted' WHERE engagement_id = $1 AND user_id = $2", [engagementId, STAFF]);
      await expect(signDocument(doc, "preparer")).resolves.toBe("preparer");
    });

    it("never lets the preparer review their own paper, even with the sole-practitioner flag stored", async () => {
      await admin.query(
        `INSERT INTO firm_signoff_policy (tenant_id, allow_sole_practitioner) VALUES ($1, true)
         ON CONFLICT (tenant_id) DO UPDATE SET allow_sole_practitioner = true`,
        [TENANT],
      );
      const doc = await docFor("E4.2");
      as(SENIOR, "senior");
      await signDocument(doc, "preparer");
      await expect(signDocument(doc, "reviewer")).rejects.toThrow("self-review");
      await admin.query("DELETE FROM firm_signoff_policy WHERE tenant_id = $1", [TENANT]);
    });

    it("applies the task's minimum reviewer role from the firm's rules", async () => {
      as(PARTNER, "partner");
      await saveTaskRules([{ code: "E4.1", minPreparer: null, minReviewer: "manager", partnerRequired: null }]);
      const doc = await docFor("E4.1");
      as(SENIOR, "senior");
      await expect(signDocument(doc, "reviewer")).rejects.toThrow("role-below-task-minimum-manager");
      as(MANAGER, "manager");
      await expect(signDocument(doc, "reviewer")).resolves.toBe("reviewer");
      expect((await getDocument(doc))?.status).toBe("signed");
    });

    it("applies the task's minimum preparer role", async () => {
      as(ADMIN, "firm_admin");
      await saveTaskRules([{ code: "E4.3", minPreparer: "senior", minReviewer: null, partnerRequired: null }]);
      const doc = await docFor("E4.3");
      as(STAFF, "staff");
      await expect(signDocument(doc, "preparer")).rejects.toThrow("role-below-task-minimum-senior");
      as(SENIOR, "senior");
      await expect(signDocument(doc, "preparer")).resolves.toBe("preparer");
    });
  });

  describe("F003 — partner sign-offs belong to the engagement partner or their delegate", () => {
    it("holds a partner-required paper open until the partner signs", async () => {
      as(PARTNER, "partner");
      await saveTaskRules([{ code: "E4.2", minPreparer: null, minReviewer: null, partnerRequired: true }]);
      const doc = await docFor("E4.2"); // prepared by SENIOR above
      as(MANAGER, "manager");
      await expect(signDocument(doc, "reviewer")).resolves.toBe("reviewer");
      expect((await getDocument(doc))?.status).toBe("draft");
      // a firm partner on the team who is not the engagement partner
      as(PARTNER2, "partner");
      await expect(signDocument(doc, "partner")).rejects.toThrow("not-engagement-partner");
      // the delegate may sign for the partner
      as(PARTNER, "partner");
      await setPartnerDelegate(engagementId, PARTNER2);
      expect((await engagementPartnerInfo(engagementId)).delegateId).toBe(PARTNER2);
      as(PARTNER2, "partner");
      await expect(signDocument(doc, "partner")).resolves.toBe("partner");
      expect((await getDocument(doc))?.status).toBe("signed");
    });

    it("refuses partner sign-offs until a partner is designated", async () => {
      await admin.query(
        "INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role, status) VALUES ($1, $2, $3, 'director', 'accepted')",
        [TENANT, otherEngagementId, PARTNER2],
      );
      const item = (await listFileItems(otherEngagementId)).find((i) => i.code === "E4.1")!;
      const doc = await generateDocument(item.id, "en");
      as(PARTNER2, "partner");
      await expect(signDocument(doc, "partner")).rejects.toThrow("designate-engagement-partner-first");
    });

    it("lets only the partner or a firm administrator delegate or transfer", async () => {
      as(MANAGER, "manager");
      await expect(setPartnerDelegate(engagementId, null)).rejects.toThrow("not-engagement-partner");
      await expect(transferEngagementPartner(engagementId, PARTNER2, "director")).rejects.toThrow("transfer-partner-forbidden");
    });

    it("transfers the seat in one step, the outgoing partner taking the role given", async () => {
      as(PARTNER, "partner");
      await expect(transferEngagementPartner(engagementId, MANAGER, "director")).rejects.toThrow(
        "partner-role-requires-partner-rank",
      );
      await transferEngagementPartner(engagementId, PARTNER2, "director");
      const seat = await engagementPartnerInfo(engagementId);
      expect(seat.partnerId).toBe(PARTNER2);
      // the new partner signs in their own right: the delegation to them lapses
      expect(seat.delegateId).toBeNull();
      const roles = await admin.query<{ user_id: string; team_role: string }>(
        "SELECT user_id, team_role FROM team_member WHERE engagement_id = $1 AND user_id = ANY($2::uuid[])",
        [engagementId, [PARTNER, PARTNER2]],
      );
      expect(Object.fromEntries(roles.rows.map((r) => [r.user_id, r.team_role]))).toEqual({
        [PARTNER]: "director",
        [PARTNER2]: "partner",
      });
      const logged = await admin.query(
        "SELECT 1 FROM activity_log WHERE engagement_id = $1 AND action = 'engagement_partner_transferred'",
        [engagementId],
      );
      expect(logged.rowCount).toBe(1);
    });
  });

  describe("F002 — assignment follows the same rules", () => {
    it("refuses the same person as preparer and approver", async () => {
      as(MANAGER, "manager");
      await assignTasks(engagementId, [itemIds["E4.4"]], SENIOR, "preparer");
      await expect(assignTasks(engagementId, [itemIds["E4.4"]], SENIOR, "approver")).rejects.toThrow(
        "preparer-equals-approver",
      );
    });

    it("refuses an approver below the task's minimum reviewer role", async () => {
      as(MANAGER, "manager");
      await expect(assignTasks(engagementId, [itemIds["E4.4"]], STAFF, "approver")).rejects.toThrow(
        "role-below-task-minimum-senior",
      );
      await expect(assignTasks(engagementId, [itemIds["E4.4"]], MANAGER, "approver")).resolves.toBe(1);
      // the preparer of E4.3 must be a senior (rule saved above)
      await expect(assignTasks(engagementId, [itemIds["E4.3"]], STAFF, "preparer")).rejects.toThrow(
        "role-below-task-minimum-senior",
      );
    });

    it("lets a firm that allows it have one person prepare and approve", async () => {
      as(ADMIN, "firm_admin");
      const { policy } = await getPolicy();
      await savePolicy({
        minReviewerRole: policy.minReviewerRole,
        requirePartnerOn: policy.requirePartnerOn,
        requireDistinctPreparerApprover: false,
      });
      as(MANAGER, "manager");
      await expect(assignTasks(engagementId, [itemIds["E4.4"]], MANAGER, "preparer")).resolves.toBe(1);
    });
  });

  describe("F002 — the policy is the firm's partners' and administrators'", () => {
    it("refuses a manager and never stores the sole-practitioner exemption", async () => {
      as(MANAGER, "manager");
      await expect(
        savePolicy({ minReviewerRole: "staff", requirePartnerOn: [], requireDistinctPreparerApprover: false }),
      ).rejects.toThrow("signoff-policy-partner-only");
      as(PARTNER2, "partner");
      await savePolicy({ minReviewerRole: "manager", requirePartnerOn: ["P1.1"], requireDistinctPreparerApprover: true });
      const stored = await admin.query<{ allow_sole_practitioner: boolean; min_reviewer_role: string }>(
        "SELECT allow_sole_practitioner, min_reviewer_role FROM firm_signoff_policy WHERE tenant_id = $1",
        [TENANT],
      );
      expect(stored.rows[0]).toEqual({ allow_sole_practitioner: false, min_reviewer_role: "manager" });
      await expect(
        savePolicy({ minReviewerRole: "manager", requirePartnerOn: ["Z9.9"], requireDistinctPreparerApprover: true }),
      ).rejects.toThrow("unknown-task-code");
    });
  });
});
