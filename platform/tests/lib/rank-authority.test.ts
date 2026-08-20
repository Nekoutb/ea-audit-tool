import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d4d4";
const PARTNER = "d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d401";
const STAFFER = "d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d402";
const EQR = "d4d4d4d4-d4d4-4d4d-8d4d-d4d4d4d4d403";

let actor = { id: PARTNER, role: "firm_admin" };

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: actor.id, tenantId: TENANT, role: actor.role, locale: "en", clientId: null },
  })),
}));

import { closePool } from "@/lib/db";
import { recordCompletion } from "@/lib/completion";
import { createEngagement, listFileItems } from "@/lib/engagements";
import { saveRasAnswer, signRas } from "@/lib/planning-ras";
import { clearTaskNote } from "@/lib/task-notes";
import { assignTeamMember } from "@/lib/team";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let engagementId: string;
let fileItemId: string;

const as = (id: string, role: string) => {
  actor = { id, role };
};
const asPartner = () => as(PARTNER, "firm_admin");

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1)", [[PARTNER, STAFFER, EQR]]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Rank Firm', 'rank-test')", [TENANT]);
  for (const [id, email, name] of [
    [PARTNER, "partner@rank.local", "The Partner"],
    [STAFFER, "staff@rank.local", "A Staffer"],
    [EQR, "eqr@rank.local", "Quality Reviewer"],
  ]) {
    await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, $2, $3, 'x')", [id, email, name]);
  }
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')", [PARTNER, TENANT]);
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'staff')", [STAFFER, TENANT]);
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'eqr_reviewer')", [EQR, TENANT]);

  asPartner();
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Rank SA', 'SA') RETURNING id",
    [TENANT],
  );
  engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31" });
  fileItemId = (await listFileItems(engagementId)).find((i) => i.code === "E4.1")!.id;
  await assignTeamMember(engagementId, PARTNER, "partner");
}, 40_000);

// A leaked identity would run later assertions as the wrong role and hide
// exactly what these tests exist to prove.
afterEach(() => asPartner());

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("recordCompletion — writing the key IS passing the gate", () => {
  it("refuses a staff member", async () => {
    as(STAFFER, "staff");
    await expect(recordCompletion(engagementId, "fs_tieout", { note: "x" })).rejects.toThrow("requires-senior");
  });

  it("admits a senior", async () => {
    as(STAFFER, "senior");
    await expect(recordCompletion(engagementId, "fs_tieout", { note: "done" })).resolves.toBeUndefined();
  });

  it("reserves partner_conclusion to a partner", async () => {
    as(STAFFER, "manager");
    await expect(recordCompletion(engagementId, "partner_conclusion", {})).rejects.toThrow("forbidden");
  });

  it("refuses the archive manifest as a system-owned key", async () => {
    // completion_record is exempt from the archive triggers so archiveEngagement
    // can write it — which makes this check the only thing protecting the record
    // of what the file contained when it closed.
    await expect(recordCompletion(engagementId, "archive_manifest", { forged: true })).rejects.toThrow("system-key");
  });

  it("still allows points_forward, which is written for next year's file", async () => {
    await expect(recordCompletion(engagementId, "points_forward", { note: "carry" })).resolves.toBeUndefined();
  });
});

describe("clearTaskNote — the reviewer decides a point is resolved", () => {
  async function openNote(authorId: string): Promise<string> {
    const r = await admin.query<{ id: string }>(
      `INSERT INTO review_note (tenant_id, engagement_id, file_item_id, author_id, body, status)
       VALUES ($1, $2, $3, $4, 'Explain the sample selection.', 'open') RETURNING id`,
      [TENANT, engagementId, fileItemId, authorId],
    );
    return r.rows[0].id;
  }

  it("refuses a staff member clearing someone else's note", async () => {
    const noteId = await openNote(PARTNER);
    as(STAFFER, "staff");
    await expect(clearTaskNote(noteId, "Done.")).rejects.toThrow("requires-senior-or-author");
  });

  it("lets the author withdraw their own note whatever their rank", async () => {
    const noteId = await openNote(STAFFER);
    as(STAFFER, "staff");
    await expect(clearTaskNote(noteId, "Withdrawn.")).resolves.toBeUndefined();
    const row = await admin.query<{ status: string }>("SELECT status FROM review_note WHERE id = $1", [noteId]);
    expect(row.rows[0].status).toBe("cleared");
  });

  it("lets a senior clear a note they did not raise", async () => {
    const noteId = await openNote(PARTNER);
    as(STAFFER, "senior");
    await expect(clearTaskNote(noteId, "Resolved.")).resolves.toBeUndefined();
  });
});

describe("P7.2 planning summary — attestations carry the signature's authority", () => {
  it("refuses a staff member answering a partner attestation", async () => {
    as(STAFFER, "staff");
    await expect(saveRasAnswer(engagementId, "b17", "yes")).rejects.toThrow("requires-partner");
  });

  it("refuses a manager answering a quality-reviewer attestation", async () => {
    // manager and eqr_reviewer both rank 4, so a rank floor would admit this —
    // Section C is decided by identity instead.
    as(STAFFER, "manager");
    await expect(saveRasAnswer(engagementId, "c1", "yes")).rejects.toThrow("eqr-must-be-the-quality-reviewer");
  });

  it("refuses the engagement partner answering a quality-reviewer attestation", async () => {
    await expect(saveRasAnswer(engagementId, "c1", "yes")).rejects.toThrow("eqr-must-be-the-quality-reviewer");
  });

  it("lets the off-team quality reviewer answer Section C", async () => {
    as(EQR, "eqr_reviewer");
    await expect(saveRasAnswer(engagementId, "c1", "yes")).resolves.toBeUndefined();
  });

  it("lets a senior answer a Section A line", async () => {
    as(STAFFER, "senior");
    await expect(saveRasAnswer(engagementId, "a1", "yes")).resolves.toBeUndefined();
  });

  it("lets a partner answer a Section B line", async () => {
    await expect(saveRasAnswer(engagementId, "b17", "yes")).resolves.toBeUndefined();
  });
});

describe("signRas — ISQM 2 §19 is an identity rule, not a rank", () => {
  it("refuses the engagement partner signing as quality reviewer", async () => {
    // partner ranks ABOVE eqr_reviewer, so atLeast() alone would allow this.
    await expect(signRas(engagementId, "eqr")).rejects.toThrow("eqr-must-be-the-quality-reviewer");
  });

  it("refuses a quality reviewer who is on the engagement team", async () => {
    await admin.query(
      "INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role) VALUES ($1, $2, $3, 'manager')",
      [TENANT, engagementId, EQR],
    );
    as(EQR, "eqr_reviewer");
    await expect(signRas(engagementId, "eqr")).rejects.toThrow("eqr-cannot-be-on-the-team");
    await admin.query("DELETE FROM team_member WHERE engagement_id = $1 AND user_id = $2", [engagementId, EQR]);
  });

  it("admits an off-team quality reviewer", async () => {
    as(EQR, "eqr_reviewer");
    await expect(signRas(engagementId, "eqr")).resolves.toBeUndefined();
  });

  it("refuses a staff member signing the fieldwork tier", async () => {
    as(STAFFER, "staff");
    await expect(signRas(engagementId, "fieldwork")).rejects.toThrow("requires-senior");
  });
});
