import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Regressions for the access defects the DEV user-acceptance run found
// (B01 cross-firm oversight, B02 team changes by anyone, B03/B05 documents by
// id, B11 EQR signing team tiers, B24 creator locked out of their own file).

const FIRM_A = "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e5e5";
const FIRM_B = "e6e6e6e6-e6e6-4e6e-8e6e-e6e6e6e6e6e6";
const ADMIN_A = "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e501";
const MANAGER = "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e502";
const STAFF = "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e503";
const EQR = "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e504";
const OUTSIDER = "e5e5e5e5-e5e5-4e5e-8e5e-e5e5e5e5e505";
const ADMIN_B = "e6e6e6e6-e6e6-4e6e-8e6e-e6e6e6e6e601";

let actor = { id: ADMIN_A, role: "firm_admin", tenantId: FIRM_A };

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: actor.id, tenantId: actor.tenantId, role: actor.role, locale: "en", clientId: null },
  })),
}));

import { closePool } from "@/lib/db";
import { generateDocument, getDocument, signDocument } from "@/lib/documents";
import { canSeeEngagement } from "@/lib/engagement-access";
import { createEngagement, listFileItems } from "@/lib/engagements";
import { assignTeamMember, listTeam, removeTeamMember } from "@/lib/team";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const as = (id: string, role: string, tenantId = FIRM_A) => {
  actor = { id, role, tenantId };
};

let engagementId: string;
let documentId: string;
let clientId: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = ANY($1)", [[FIRM_A, FIRM_B]]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1)", [[ADMIN_A, MANAGER, STAFF, EQR, OUTSIDER, ADMIN_B]]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'UAT Fix A', 'uat-fix-a'), ($2, 'UAT Fix B', 'uat-fix-b')", [
    FIRM_A,
    FIRM_B,
  ]);
  const users: [string, string, string, string][] = [
    [ADMIN_A, "admin@fix-a.local", "firm_admin", FIRM_A],
    [MANAGER, "manager@fix-a.local", "manager", FIRM_A],
    [STAFF, "staff@fix-a.local", "staff", FIRM_A],
    [EQR, "eqr@fix-a.local", "eqr_reviewer", FIRM_A],
    [OUTSIDER, "outsider@fix-a.local", "staff", FIRM_A],
    [ADMIN_B, "admin@fix-b.local", "firm_admin", FIRM_B],
  ];
  for (const [id, email, role, tenant] of users) {
    await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, $2, $2, 'x')", [id, email]);
    await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, $3)", [id, tenant, role]);
  }
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Fix SA', 'SA') RETURNING id",
    [FIRM_A],
  );
  clientId = client.rows[0].id;
  as(ADMIN_A, "firm_admin");
  engagementId = await createEngagement({ clientId, fiscalYear: 2025, periodEnd: "2025-12-31" });
  await assignTeamMember(engagementId, STAFF, "staff");
  const item = (await listFileItems(engagementId)).find((i) => i.code === "P1.1")!;
  documentId = await generateDocument(item.id, "en");
}, 60_000);

afterEach(() => as(ADMIN_A, "firm_admin"));

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("B01 — oversight covers the caller's own firm only", () => {
  it("a firm admin of another firm cannot see the engagement", async () => {
    as(ADMIN_B, "firm_admin", FIRM_B);
    expect(await canSeeEngagement(engagementId)).toBe(false);
  });

  it("the database refuses a row filed by another firm against it", async () => {
    await expect(
      admin.query(
        "INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value) VALUES ($1, $2, 'D3.1', 'k', '{}')",
        [FIRM_B, engagementId],
      ),
    ).rejects.toThrow("engagement-tenant-mismatch");
  });
});

describe("B02 — only a manager or above changes the team", () => {
  it("refuses a staff member adding, promoting or removing colleagues", async () => {
    as(STAFF, "staff");
    await expect(assignTeamMember(engagementId, OUTSIDER, "staff")).rejects.toThrow("team-manager-only");
    await expect(assignTeamMember(engagementId, STAFF, "partner")).rejects.toThrow("team-manager-only");
    await expect(removeTeamMember(engagementId, STAFF)).rejects.toThrow("team-manager-only");
  });

  it("refuses the EQR, who must stay independent of the team", async () => {
    as(EQR, "eqr_reviewer");
    await expect(assignTeamMember(engagementId, OUTSIDER, "staff")).rejects.toThrow("team-manager-only");
  });

  it("lets a manager staff the file but not hand out the partner seat", async () => {
    await assignTeamMember(engagementId, MANAGER, "manager");
    as(MANAGER, "manager");
    await expect(assignTeamMember(engagementId, OUTSIDER, "partner")).rejects.toThrow("partner-only-team-role");
    await expect(assignTeamMember(engagementId, OUTSIDER, "senior")).resolves.toBeUndefined();
    await expect(removeTeamMember(engagementId, OUTSIDER)).resolves.toBeUndefined();
  });
});

describe("B03/B05 — documents are gated by engagement and the C5.6 letter by rank", () => {
  it("hides a document from a firm member who is not on the engagement", async () => {
    as(OUTSIDER, "staff");
    await expect(getDocument(documentId)).rejects.toThrow("not-on-this-engagement");
  });

  it("keeps a fait délictueux letter to partners, even for the team", async () => {
    await admin.query(
      "INSERT INTO fait_delictueux (tenant_id, engagement_id, description, document_id) VALUES ($1, $2, 'x', $3)",
      [FIRM_A, engagementId, documentId],
    );
    as(STAFF, "staff");
    await expect(getDocument(documentId)).rejects.toThrow("fait-partner-only");
    as(ADMIN_A, "firm_admin");
    expect((await getDocument(documentId))?.id).toBe(documentId);
    await admin.query("DELETE FROM fait_delictueux WHERE document_id = $1", [documentId]);
  });
});

describe("B11 — the EQR does not sign team tiers", () => {
  it("refuses a preparer signature from the EQR", async () => {
    as(EQR, "eqr_reviewer");
    await expect(signDocument(documentId, "preparer")).rejects.toThrow();
  });
});

describe("B24 — whoever opens the file is on its team", () => {
  it("adds a manager who creates an engagement to its team", async () => {
    as(MANAGER, "manager");
    const created = await createEngagement({ clientId, fiscalYear: 2026, periodEnd: "2026-12-31" });
    const team = await listTeam(created);
    expect(team.some((m) => m.userId === MANAGER && m.teamRole === "manager")).toBe(true);
  });
});
