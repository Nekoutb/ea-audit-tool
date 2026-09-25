import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Regressions for the access defects of the SECOND DEV user-acceptance run
// (batch hA): B01 read-only writes, B02 SCOT Studio ids from another file,
// B03 review notes answered/cleared through another engagement's URL, B04 a
// removed member keeping access through their tasks, B17 "add member"
// re-roling the EQR, B18 the EQR rewriting the papers they review.

const FIRM = "b7b7b7b7-b7b7-4b7b-8b7b-b7b7b7b7b7b7";
const ADMIN = "b7b7b7b7-b7b7-4b7b-8b7b-b7b7b7b7b701";
const MANAGER = "b7b7b7b7-b7b7-4b7b-8b7b-b7b7b7b7b702";
const STAFF = "b7b7b7b7-b7b7-4b7b-8b7b-b7b7b7b7b703";
const READER = "b7b7b7b7-b7b7-4b7b-8b7b-b7b7b7b7b704";
const EQR = "b7b7b7b7-b7b7-4b7b-8b7b-b7b7b7b7b705";
const MOVER = "b7b7b7b7-b7b7-4b7b-8b7b-b7b7b7b7b706";
const USERS = [ADMIN, MANAGER, STAFF, READER, EQR, MOVER];

let actor = { id: ADMIN, role: "firm_admin" };

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: actor.id, tenantId: FIRM, role: actor.role, locale: "en", clientId: null },
  })),
}));
vi.mock("@/lib/locale", () => ({ getLocale: vi.fn(async () => "en") }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`);
  }),
  notFound: vi.fn(() => {
    throw new Error("NOT_FOUND");
  }),
}));

import { addEstimateAction, addRelatedPartyAction, markNotApplicableAction, setMandateAction } from "@/app/actions/planning";
import { POST as scotsPost } from "@/app/api/engagements/[id]/scots/route";
import { closePool } from "@/lib/db";
import { canSeeEngagement } from "@/lib/engagement-access";
import { createEngagement, listFileItems } from "@/lib/engagements";
import { runSampling } from "@/lib/engines";
import { saveForm } from "@/lib/forms";
import { createScot, scotIdsBelongTo } from "@/lib/scots";
import { clearTaskNote, respondToTaskNote } from "@/lib/task-notes";
import { addTeamMemberByEmail, assignTask, assignTeamMember, listTeam, removeTeamMember } from "@/lib/team";
import { savePaper } from "@/lib/working-papers";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const as = (id: string, role: string) => {
  actor = { id, role };
};

let clientId: string;
let engA: string; // STAFF, READER (read_only), EQR, MOVER on the team
let engB: string; // MANAGER only
let itemA: string;
let itemB: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [FIRM]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1)", [USERS]);
}

const form = (fields: Record<string, string>): FormData => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'UAT2 Access', 'uat2-access')", [FIRM]);
  const users: [string, string, string][] = [
    [ADMIN, "admin@uat2-access.local", "firm_admin"],
    [MANAGER, "manager@uat2-access.local", "manager"],
    [STAFF, "staff@uat2-access.local", "staff"],
    [READER, "reader@uat2-access.local", "read_only"],
    [EQR, "eqr@uat2-access.local", "eqr_reviewer"],
    [MOVER, "mover@uat2-access.local", "staff"],
  ];
  for (const [id, email, role] of users) {
    await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, $2, $2, 'x')", [id, email]);
    await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, $3)", [id, FIRM, role]);
  }
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'UAT2 SA', 'SA') RETURNING id",
    [FIRM],
  );
  clientId = client.rows[0].id;
  as(ADMIN, "firm_admin");
  engA = await createEngagement({ clientId, fiscalYear: 2025, periodEnd: "2025-12-31" });
  engB = await createEngagement({ clientId, fiscalYear: 2024, periodEnd: "2024-12-31" });
  await assignTeamMember(engA, STAFF, "staff");
  await assignTeamMember(engA, READER, "staff");
  await assignTeamMember(engA, EQR, "eqr_reviewer");
  await assignTeamMember(engB, MANAGER, "manager");
  itemA = (await listFileItems(engA)).find((i) => i.code === "P3.2")!.id;
  itemB = (await listFileItems(engB)).find((i) => i.code === "P3.2")!.id;
}, 90_000);

afterEach(() => as(ADMIN, "firm_admin"));

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("B01 — a read-only account writes nothing", () => {
  it("refuses a working-paper save in the library", async () => {
    as(READER, "read_only");
    await expect(savePaper(engA, "S6.2", { conclusion: "RO write attempt" })).rejects.toThrow("read-only-role");
  });

  it("refuses the related-party and estimate '+' forms and the mandate form with the read-only banner", async () => {
    as(READER, "read_only");
    await expect(addRelatedPartyAction(engA, form({ name: "RO party", relationship: "Parent" }))).rejects.toThrow(
      /error=read-only-role/,
    );
    await expect(addEstimateAction(engA, form({ nature: "RO estimate" }))).rejects.toThrow(/error=read-only-role/);
    await expect(
      setMandateAction(engA, clientId, form({ mandateType: "statutes", mandateStartYear: "2024" })),
    ).rejects.toThrow(/error=read-only-role/);
    const rp = await admin.query("SELECT 1 FROM related_party WHERE engagement_id = $1", [engA]);
    const est = await admin.query("SELECT 1 FROM accounting_estimate WHERE engagement_id = $1", [engA]);
    expect(rp.rowCount).toBe(0);
    expect(est.rowCount).toBe(0);
  });

  it("refuses an engine run posted from a page action", async () => {
    as(READER, "read_only");
    await expect(runSampling({} as never)).rejects.toThrow("read-only-role");
  });
});

describe("B02 — SCOT Studio ids must belong to the engagement in the URL", () => {
  it("rejects a SCOT of another engagement and leaves it untouched", async () => {
    const scotA = await createScot(engA, { name: "Sales A", transactionType: "routine", strategy: "substantive" });
    const scotB = await createScot(engB, { name: "Sales B", transactionType: "routine", strategy: "substantive" });
    expect(await scotIdsBelongTo(engA, { scotIds: [scotA] })).toBe(true);
    expect(await scotIdsBelongTo(engA, { scotIds: [scotB] })).toBe(false);
    expect(await scotIdsBelongTo(engA, { scotIds: ["not-a-uuid"] })).toBe(false);

    as(STAFF, "staff");
    const post = (body: unknown) =>
      scotsPost(new Request("http://local/api", { method: "POST", body: JSON.stringify(body) }), {
        params: Promise.resolve({ id: engA }),
      });
    const renamed = await post({ op: "updateScot", scotId: scotB, name: "renamed via other engagement" });
    expect(renamed.status).toBe(404);
    const wcgw = await post({ op: "addWcgw", scotId: scotB, description: "injected", assertions: ["existence"] });
    expect(wcgw.status).toBe(404);
    const row = await admin.query<{ name: string }>("SELECT name FROM scot WHERE id = $1", [scotB]);
    expect(row.rows[0].name).toBe("Sales B");
    const w = await admin.query("SELECT 1 FROM wcgw WHERE scot_id = $1", [scotB]);
    expect(w.rowCount).toBe(0);
  });
});

describe("B03 — review notes are answered and cleared through their own engagement", () => {
  it("refuses a reply or a clear sent through another engagement's URL", async () => {
    const note = await admin.query<{ id: string }>(
      `INSERT INTO review_note (tenant_id, engagement_id, file_item_id, author_id, body, status)
       VALUES ($1, $2, $3, $4, 'Explain.', 'open') RETURNING id`,
      [FIRM, engB, itemB, MANAGER],
    );
    const noteId = note.rows[0].id;
    as(STAFF, "staff");
    await expect(respondToTaskNote(engA, noteId, "via another URL")).rejects.toThrow("not-found");
    await expect(respondToTaskNote(engB, noteId, "direct")).rejects.toThrow("not-on-this-engagement");
    as(ADMIN, "firm_admin");
    await expect(clearTaskNote(engA, noteId, "")).rejects.toThrow("not-found");
    const row = await admin.query<{ status: string; response: string | null }>(
      "SELECT status, response FROM review_note WHERE id = $1",
      [noteId],
    );
    expect(row.rows[0]).toEqual({ status: "open", response: null });
  });
});

describe("B04 — leaving the team ends access", () => {
  it("vacates the member's task seats so the file closes to them", async () => {
    await assignTeamMember(engA, MOVER, "staff");
    await assignTask(engA, itemA, MOVER);
    await admin.query("UPDATE file_item SET owner_id = $2 WHERE id = $1", [itemA, MOVER]);
    as(MOVER, "staff");
    expect(await canSeeEngagement(engA)).toBe(true);
    as(ADMIN, "firm_admin");
    await removeTeamMember(engA, MOVER);
    const item = await admin.query<{ assignee_user_id: string | null; owner_id: string | null }>(
      "SELECT assignee_user_id, owner_id FROM file_item WHERE id = $1",
      [itemA],
    );
    expect(item.rows[0]).toEqual({ assignee_user_id: null, owner_id: null });
    as(MOVER, "staff");
    expect(await canSeeEngagement(engA)).toBe(false);
  });
});

describe("B17 — 'add member' does not re-role someone already on the team", () => {
  it("refuses to turn the EQR into a team member", async () => {
    await expect(addTeamMemberByEmail(engA, "eqr@uat2-access.local", "staff", "UAT2 2025")).rejects.toThrow(
      "already-on-team",
    );
    const eqr = (await listTeam(engA)).find((m) => m.userId === EQR);
    expect(eqr?.teamRole).toBe("eqr_reviewer");
  });
});

describe("B18 — the EQR reviews but does not rewrite the team's work", () => {
  it("refuses the EQR's save on a team paper, the legacy form, N/A and assignment", async () => {
    as(EQR, "eqr_reviewer");
    await expect(savePaper(engA, "P1.3", { conclusion: "EQR edit probe" })).rejects.toThrow("eqr-read-only");
    await expect(saveForm(engA, "P3.2", {})).rejects.toThrow("eqr-read-only");
    await expect(assignTask(engA, itemA, null)).rejects.toThrow("eqr-read-only");
    await expect(markNotApplicableAction(engA, itemA, form({ naReason: "EQR probe" }))).rejects.toThrow(
      /error=eqr-read-only/,
    );
    await expect(addRelatedPartyAction(engA, form({ name: "EQR party", relationship: "Parent" }))).rejects.toThrow(
      /error=eqr-read-only/,
    );
  });

  it("still lets the EQR record their own review in C4.2", async () => {
    as(EQR, "eqr_reviewer");
    await expect(savePaper(engA, "C4.2", {})).resolves.toBeUndefined();
  });
});
