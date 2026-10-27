import pg from "pg";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// The firm's governance decisions of 2026-10-27:
//   F002 the default sign-off matrix (lib/signoff-policy.ts)
//   F004 tool-fed papers refuse every sign-off until the tool output exists
//        (lib/tool-fed-papers.ts)
//   F005 eligibility of the engagement quality reviewer (lib/team.ts)
//   F006 the Forms assignment matrix never offers one person on both sides
//        (components/FormsAssignRow.tsx)
//
// The successful EQR appointment writes team_member.eqr_declared_at/by, so it
// needs migrations/20261027000001_eqr_objectivity_declaration.sql applied; the
// refusals are raised before that write and run on any database.

const TENANT = "6b6b6b6b-6b6b-4b6b-8b6b-6b6b6b6b6b6b";
const ADMIN = "6b6b6b6b-6b6b-4b6b-8b6b-6b6b6b6b6b01";
const PARTNER = "6b6b6b6b-6b6b-4b6b-8b6b-6b6b6b6b6b02";
const PARTNER2 = "6b6b6b6b-6b6b-4b6b-8b6b-6b6b6b6b6b03";
const PARTNER3 = "6b6b6b6b-6b6b-4b6b-8b6b-6b6b6b6b6b04";
const PARTNER4 = "6b6b6b6b-6b6b-4b6b-8b6b-6b6b6b6b6b05";
const MANAGER = "6b6b6b6b-6b6b-4b6b-8b6b-6b6b6b6b6b06";
const SENIOR = "6b6b6b6b-6b6b-4b6b-8b6b-6b6b6b6b6b07";
const STAFF = "6b6b6b6b-6b6b-4b6b-8b6b-6b6b6b6b6b08";
const EQRF = "6b6b6b6b-6b6b-4b6b-8b6b-6b6b6b6b6b09";
/** a manager of the firm who is not on the engagement's team */
const OUTSIDER = "6b6b6b6b-6b6b-4b6b-8b6b-6b6b6b6b6b10";
const USERS = [ADMIN, PARTNER, PARTNER2, PARTNER3, PARTNER4, MANAGER, SENIOR, STAFF, EQRF, OUTSIDER];

let actor = { id: ADMIN, role: "firm_admin" };

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: actor.id, tenantId: TENANT, role: actor.role, locale: "en", clientId: null },
  })),
}));

import { FormsAssignRow } from "@/components/FormsAssignRow";
import { closePool } from "@/lib/db";
import { generateDocument, signDocument } from "@/lib/documents";
import { createEngagement, listFileItems } from "@/lib/engagements";
import { DEFAULT_FILE_INDEX } from "@/lib/file-index";
import {
  DEFAULT_REQUIRE_PARTNER_ON,
  PARTNER_GATED,
  PARTNER_ONLY_APPROVAL,
  defaultPolicy,
  effectiveTaskRule,
  teamRank,
} from "@/lib/signoff-policy";
import { addTeamMemberByEmail, assignTeamMember } from "@/lib/team";
import { isToolFedPaper, toolOutputsFor, toolOutputsMissing } from "@/lib/tool-fed-papers";
import en from "@/messages/en.json";
import fr from "@/messages/fr.json";
import { seedApprovedMateriality, seedSadConclusion, seedValidTb } from "./tool-output-fixtures";

const as = (id: string, role: string) => {
  actor = { id, role };
};

/* ------------------------------ F002 — pure ------------------------------ */

describe("F002 — the default sign-off matrix", () => {
  const rule = (code: string) => effectiveTaskRule(defaultPolicy(), new Map(), code);
  const pr = (code: string) => {
    const r = rule(code);
    return [r.minPreparer, r.minReviewer, r.partnerRequired];
  };

  it("applies each task family's minimums", () => {
    expect(pr("P1.3")).toEqual(["manager", "partner", false]);
    expect(pr("P2.1")).toEqual(["manager", "partner", false]);
    expect(pr("P3.1")).toEqual(["senior", "manager", false]);
    expect(pr("P6.1")).toEqual(["senior", "manager", false]);
    expect(pr("S1.1")).toEqual(["senior", "manager", false]);
    expect(pr("S5.5")).toEqual(["senior", "manager", false]);
    expect(pr("E1.2")).toEqual(["staff", "senior", false]);
    expect(pr("E4.20")).toEqual(["staff", "senior", false]);
    expect(pr("E6.9")).toEqual(["staff", "senior", false]);
    expect(pr("C2.2")).toEqual(["senior", "manager", false]);
    expect(pr("C3.1")).toEqual(["senior", "manager", false]);
    expect(pr("C6.1")).toEqual(["manager", "partner", false]);
  });

  it("raises the three sensitive execution papers to senior / manager", () => {
    for (const code of ["E3.1", "E6.3", "E6.10"]) expect(pr(code)).toEqual(["senior", "manager", false]);
  });

  it("puts the partner's sign-off on the matrix's list and on every C5.x", () => {
    for (const code of ["P1.1", "P2.2", "P5.2", "P7.2", "S3.1", "S6.1", "S6.2", "C1.1", "C6.2"]) {
      expect(rule(code).partnerRequired).toBe(true);
    }
    const c5 = DEFAULT_FILE_INDEX.map((e) => e.code).filter((c) => c.startsWith("C5."));
    expect(c5.length).toBeGreaterThan(0);
    for (const code of c5) expect(pr(code)).toEqual(["manager", "partner", true]);
    expect(pr("P1.1")).toEqual(["manager", "partner", true]);
    expect(pr("S3.1")).toEqual(["senior", "manager", true]);
    expect(pr("C1.1")).toEqual(["senior", "manager", true]);
    expect(pr("C6.2")).toEqual(["manager", "partner", true]);
  });

  it("keeps C4.2 off the partner list (its own sign-off is the EQR's)", () => {
    expect(rule("C4.2").partnerRequired).toBe(false);
  });

  it("keeps every code the older operator sets gated", () => {
    for (const code of [...PARTNER_GATED, ...PARTNER_ONLY_APPROVAL]) {
      expect(DEFAULT_REQUIRE_PARTNER_ON).toContain(code);
      expect(rule(code).partnerRequired).toBe(true);
    }
  });

  it("never sets a reviewer minimum below the preparer minimum", () => {
    for (const { code } of DEFAULT_FILE_INDEX) {
      const r = rule(code);
      expect(teamRank(r.minReviewer), code).toBeGreaterThanOrEqual(teamRank(r.minPreparer));
    }
    // nor through a firm's own rule
    const rules = new Map([["E4.1", { minPreparer: "manager" as const, minReviewer: "senior" as const, partnerRequired: null }]]);
    expect(effectiveTaskRule(defaultPolicy(), rules, "E4.1").minReviewer).toBe("manager");
  });

  it("treats the firm policy as a floor and an addition, a task rule as the override", () => {
    const policy = { ...defaultPolicy(), minReviewerRole: "director" as const, requirePartnerOn: ["E4.1"] };
    expect(effectiveTaskRule(policy, new Map(), "E4.1")).toEqual({
      minPreparer: "staff",
      minReviewer: "director",
      partnerRequired: true,
    });
    // a matrix minimum above the floor stands
    expect(effectiveTaskRule(policy, new Map(), "P1.3").minReviewer).toBe("partner");
    // the policy list does not lift a matrix partner sign-off; a task rule does
    expect(effectiveTaskRule({ ...defaultPolicy(), requirePartnerOn: [] }, new Map(), "C5.2").partnerRequired).toBe(true);
    const lifted = new Map([["C5.2", { minPreparer: null, minReviewer: null, partnerRequired: false }]]);
    expect(effectiveTaskRule(defaultPolicy(), lifted, "C5.2").partnerRequired).toBe(false);
  });
});

/* ------------------------------ F004 — pure ------------------------------ */

describe("F004 — the tool-fed papers mapping", () => {
  it("names what each paper waits for", () => {
    expect(toolOutputsFor("P6.1")).toEqual(["materiality"]);
    expect(toolOutputsFor("P6.2")).toEqual(["tb", "materiality"]);
    expect(toolOutputsFor("C1.1")).toEqual(["tb", "materiality", "sad"]);
    for (let n = 1; n <= 34; n += 1) expect(toolOutputsFor(`E4.${n}`)).toEqual(["tb"]);
    // leases and the TFT tie-out carry no lead index
    expect(isToolFedPaper("E4.35")).toBe(false);
    expect(isToolFedPaper("E4.36")).toBe(false);
    expect(isToolFedPaper("P3.1")).toBe(false);
    expect(isToolFedPaper("C4.2")).toBe(false);
  });

  it("has an English and a French message for every refusal", () => {
    for (const key of ["tool-output-missing", "tool-output-missing-materiality", "tool-output-missing-tb", "tool-output-missing-sad"]) {
      for (const messages of [en, fr]) {
        expect((messages.document.errors as Record<string, string>)[key], key).toBeTruthy();
        expect((messages.planning.errors as Record<string, string>)[key], key).toBeTruthy();
      }
    }
    expect(en.document.errors["tool-output-missing-materiality"]).toContain("P6.1");
  });
});

/* ------------------------------ F005 — messages ------------------------------ */

describe("F005 — the EQR refusals are worded in both languages", () => {
  it("has the four codes", () => {
    for (const key of ["eqr-rank", "eqr-on-team", "eqr-cooling-off", "eqr-declaration-required"]) {
      expect((en.planning.errors as Record<string, string>)[key], key).toBeTruthy();
      expect((fr.planning.errors as Record<string, string>)[key], key).toBeTruthy();
    }
  });
});

/* ------------------------------ F006 — the row ------------------------------ */

describe("F006 — the Forms assignment row", () => {
  const team = [
    { userId: "u-a", userName: "Alice" },
    { userId: "u-b", userName: "Bruno" },
    { userId: "u-c", userName: "Chantal" },
  ];
  const render = (preparerUserId: string | null, approverUserId: string | null) =>
    renderToStaticMarkup(
      createElement(FormsAssignRow, {
        code: "E4.1",
        action: async () => {},
        team,
        preparerUserId,
        approverUserId,
        labels: { preparer: "Preparer", approver: "Approver", conflict: en.planning.errors["assignment-preparer-is-approver"] },
        selectClass: "",
        okClass: "",
      }),
    );
  const select = (html: string, role: string) =>
    html.match(new RegExp(`<select[^>]*data-testid="assign-${role}-E4.1"[^>]*>(.*?)</select>`))?.[1] ?? "";

  it("does not offer the preparer as approver, nor the approver as preparer", () => {
    const html = render("u-a", "u-b");
    expect(select(html, "approver")).not.toContain('value="u-a"');
    expect(select(html, "approver")).toContain('value="u-c"');
    expect(select(html, "preparer")).not.toContain('value="u-b"');
    expect(select(html, "preparer")).toContain('value="u-c"');
    expect(html).toContain('data-conflict="false"');
  });

  it("shows a stored preparer-equals-approver row in red with the reason, values kept", () => {
    const html = render("u-a", "u-a");
    expect(html).toContain('data-conflict="true"');
    expect(html).toContain("assign-conflict-E4.1");
    expect(html).toContain("The same person is preparer and approver");
    expect(select(html, "preparer")).toContain('value="u-a"');
    expect(select(html, "approver")).toContain('value="u-a"');
  });
});

/* ------------------------------ the database half ------------------------------ */

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let clientId: string;
let engagementId: string;
const itemIds: Record<string, string> = {};

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1::uuid[])", [USERS]);
  await admin.query("DELETE FROM app_user WHERE lower(email) = 'unknown-eqr@batch1.local'");
}

async function docFor(code: string): Promise<string> {
  as(ADMIN, "firm_admin");
  return generateDocument(itemIds[code], "en");
}

/** The refusal code of a sign-off attempt, or "ok". */
async function attempt(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "ok";
  } catch (error) {
    return (error as { code?: string; message?: string }).code ?? (error as Error).message;
  }
}

async function seat(engagement: string, userId: string, teamRole: string): Promise<void> {
  await admin.query(
    `INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role, status)
     VALUES ($1, $2, $3, $4, 'accepted')
     ON CONFLICT (engagement_id, user_id) DO UPDATE SET team_role = EXCLUDED.team_role, status = 'accepted'`,
    [TENANT, engagement, userId, teamRole],
  );
}

describe("governance batch 1 against the database", () => {
  beforeAll(async () => {
    await removeFixture();
    await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Batch1 Firm', 'batch1-governance')", [TENANT]);
    const users: [string, string][] = [
      [ADMIN, "firm_admin"],
      [PARTNER, "partner"],
      [PARTNER2, "partner"],
      [PARTNER3, "partner"],
      [PARTNER4, "partner"],
      [MANAGER, "manager"],
      [SENIOR, "senior"],
      [STAFF, "staff"],
      [EQRF, "eqr_reviewer"],
      [OUTSIDER, "manager"],
    ];
    for (const [id, role] of users) {
      const email = `${id.slice(-2)}@batch1.local`;
      await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, $2, $2, 'x')", [id, email]);
      await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, $3)", [id, TENANT, role]);
    }
    const client = await admin.query<{ id: string }>(
      "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Batch1 SA', 'SA') RETURNING id",
      [TENANT],
    );
    clientId = client.rows[0].id;
    as(ADMIN, "firm_admin");
    engagementId = await createEngagement({ clientId, fiscalYear: 2025, periodEnd: "2025-12-31", partnerId: PARTNER });
    // earlier files of the same client, each with its accepted engagement partner
    await createEngagement({ clientId, fiscalYear: 2024, periodEnd: "2024-12-31", partnerId: PARTNER2 });
    await createEngagement({ clientId, fiscalYear: 2023, periodEnd: "2023-12-31", partnerId: PARTNER3 });
    await createEngagement({ clientId, fiscalYear: 2022, periodEnd: "2022-12-31", partnerId: PARTNER4 });
    await seat(engagementId, MANAGER, "manager");
    await seat(engagementId, SENIOR, "senior");
    await seat(engagementId, STAFF, "staff");
    // execution work, so the phase gates stay out of the way
    await admin.query("UPDATE engagement SET phase = 'execution' WHERE id = $1", [engagementId]);
    for (const item of await listFileItems(engagementId)) itemIds[item.code] = item.id;
  }, 120_000);

  afterEach(() => as(ADMIN, "firm_admin"));

  afterAll(async () => {
    await removeFixture();
    await admin.end();
    await closePool();
  });

  describe("F002 — the matrix is what signing enforces", () => {
    it("refuses a staff preparer on the fraud paper and a senior reviewer on it", async () => {
      const doc = await docFor("E3.1");
      as(STAFF, "staff");
      expect(await attempt(() => signDocument(doc, "preparer"))).toBe("role-below-task-minimum-senior");
      as(SENIOR, "senior");
      expect(await attempt(() => signDocument(doc, "reviewer"))).toBe("role-below-task-minimum-manager");
    });

    it("keeps the OHADA legal papers for a manager preparer", async () => {
      const doc = await docFor("C5.2");
      as(SENIOR, "senior");
      expect(await attempt(() => signDocument(doc, "preparer"))).toBe("role-below-task-minimum-manager");
      as(MANAGER, "manager");
      expect(await attempt(() => signDocument(doc, "reviewer"))).toBe("role-below-task-minimum-partner");
    });
  });

  describe("F004 — tool-fed papers wait for their tool's output", () => {
    it("lists every tool-fed paper as missing on a file with no output", async () => {
      const missing = await toolOutputsMissing(TENANT, engagementId, ["P6.1", "P6.2", "C1.1", "E4.1", "E4.36", "P3.1"]);
      expect(Object.fromEntries(missing)).toEqual({
        "P6.1": "tool-output-missing-materiality",
        "P6.2": "tool-output-missing-tb",
        "C1.1": "tool-output-missing-tb",
        "E4.1": "tool-output-missing-tb",
      });
    });

    it("P6.2 waits for the trial balance, then for the approved materiality", async () => {
      const doc = await docFor("P6.2");
      as(SENIOR, "senior");
      expect(await attempt(() => signDocument(doc, "preparer"))).toBe("tool-output-missing-tb");
      await seedValidTb(admin, engagementId);
      expect(await attempt(() => signDocument(doc, "preparer"))).toBe("tool-output-missing-materiality");
    });

    it("refuses the preparer, the reviewer and the partner on a lead schedule without a valid TB", async () => {
      const doc = await docFor("E4.1");
      as(STAFF, "staff");
      // the TB seeded above is valid: the preparer signs
      expect(await attempt(() => signDocument(doc, "preparer"))).toBe("ok");
      // an invalid current version is no TB to agree to
      await admin.query(
        `UPDATE trial_balance_version v SET validation_status = 'invalid'
           FROM trial_balance tb WHERE v.trial_balance_id = tb.id AND tb.engagement_id = $1`,
        [engagementId],
      );
      as(SENIOR, "senior");
      expect(await attempt(() => signDocument(doc, "reviewer"))).toBe("tool-output-missing-tb");
      as(PARTNER, "partner");
      expect(await attempt(() => signDocument(doc, "partner"))).toBe("tool-output-missing-tb");
      expect((await toolOutputsMissing(TENANT, engagementId, ["E4.1"])).get("E4.1")).toBe("tool-output-missing-tb");
      await admin.query(
        `UPDATE trial_balance_version v SET validation_status = 'valid'
           FROM trial_balance tb WHERE v.trial_balance_id = tb.id AND tb.engagement_id = $1`,
        [engagementId],
      );
      as(SENIOR, "senior");
      expect(await attempt(() => signDocument(doc, "reviewer"))).toBe("ok");
    });

    it("P6.1 waits for an approved materiality version, a draft is not enough", async () => {
      const doc = await docFor("P6.1");
      as(SENIOR, "senior");
      expect(await attempt(() => signDocument(doc, "preparer"))).toBe("tool-output-missing-materiality");
      await seedApprovedMateriality(admin, engagementId);
      await admin.query("UPDATE materiality SET status = 'draft' WHERE engagement_id = $1", [engagementId]);
      expect(await attempt(() => signDocument(doc, "preparer"))).toBe("tool-output-missing-materiality");
      await admin.query("UPDATE materiality SET status = 'approved' WHERE engagement_id = $1", [engagementId]);
      // past the tool: the questionnaire is what is still missing
      expect(await attempt(() => signDocument(doc, "preparer"))).not.toMatch(/^tool-output-missing/);
    });

    it("C1.1 waits for the team's conclusion in the SAD tool", async () => {
      const doc = await docFor("C1.1");
      as(SENIOR, "senior");
      expect(await attempt(() => signDocument(doc, "preparer"))).toBe("tool-output-missing-sad");
      await seedSadConclusion(admin, engagementId);
      expect(await attempt(() => signDocument(doc, "preparer"))).not.toMatch(/^tool-output-missing/);
      expect((await toolOutputsMissing(TENANT, engagementId, ["P6.1", "P6.2", "C1.1"])).size).toBe(0);
    });
  });

  describe("F005 — who may be appointed engagement quality reviewer", () => {
    const appoint = (userId: string, eqrDeclaration?: boolean) =>
      attempt(() => assignTeamMember(engagementId, userId, "eqr_reviewer", eqrDeclaration === undefined ? undefined : { eqrDeclaration }));

    it("requires partner rank or the firm role of EQR reviewer", async () => {
      expect(await appoint(OUTSIDER, true)).toBe("eqr-rank");
      // a firm administrator ranks as a partner: past the rank, the declaration is next
      expect(await appoint(ADMIN)).toBe("eqr-declaration-required");
    });

    it("refuses an account the team page would provision (a staff account)", async () => {
      as(PARTNER, "partner");
      expect(
        await attempt(() =>
          addTeamMemberByEmail(engagementId, "unknown-eqr@batch1.local", "eqr_reviewer", "Batch1", undefined, { eqrDeclaration: true }),
        ),
      ).toBe("eqr-rank");
      const made = await admin.query("SELECT 1 FROM app_user WHERE lower(email) = 'unknown-eqr@batch1.local'");
      expect(made.rowCount).toBe(0);
    });

    it("refuses a member of the team in another role", async () => {
      expect(await appoint(PARTNER, true)).toBe("eqr-on-team");
    });

    it("applies the two-year cooling-off of a former engagement partner of the client", async () => {
      // engagement partner on the 2024 file, and on the 2023 file (exactly two years before: inclusive)
      expect(await appoint(PARTNER2, true)).toBe("eqr-cooling-off");
      expect(await appoint(PARTNER3, true)).toBe("eqr-cooling-off");
      // the 2022 file is outside the two years
      expect(await appoint(PARTNER4)).toBe("eqr-declaration-required");
    });

    it("needs the objectivity declaration, then records who made it and when", async () => {
      expect(await appoint(EQRF)).toBe("eqr-declaration-required");
      expect(await appoint(EQRF, false)).toBe("eqr-declaration-required");
      expect(await appoint(EQRF, true)).toBe("ok");
      const row = await admin.query<{ team_role: string; declared: boolean; eqr_declared_by: string }>(
        `SELECT team_role, eqr_declared_at IS NOT NULL AS declared, eqr_declared_by
           FROM team_member WHERE engagement_id = $1 AND user_id = $2`,
        [engagementId, EQRF],
      );
      expect(row.rows[0]).toEqual({ team_role: "eqr_reviewer", declared: true, eqr_declared_by: ADMIN });
    });
  });
});
