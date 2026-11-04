import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";
import ts from "typescript";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The firm's rule: only an accepted member of an engagement's team may touch it
// (F008). The proxy reads the id in the URL; a Server Action is posted to the URL
// of whichever page rendered it and carries its real target in its arguments, so
// uat.staff could post to their own engagement's URL and write to another one
// (DEV re-test of 8725e6a, D1). These tests hold the rule where it now lives, on
// the id the code is about to act on, and walk the library and the action list
// so that a function added later is covered without anyone remembering.

const FIRM = "d7d7d7d7-d7d7-4d7d-8d7d-d7d7d7d7d701";
const ACTOR = "d7d7d7d7-d7d7-4d7d-8d7d-d7d7d7d7d702"; // on engagement A only
const PARTNER = "d7d7d7d7-d7d7-4d7d-8d7d-d7d7d7d7d703"; // on engagement B
const INVITED = "d7d7d7d7-d7d7-4d7d-8d7d-d7d7d7d7d704"; // invited to B, not yet answered

let actor = { id: ACTOR, role: "firm_admin" };
const as = (id: string, role: string) => {
  actor = { id, role };
};

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: actor.id, tenantId: FIRM, role: actor.role, locale: "en", clientId: null },
  })),
  signOut: vi.fn(),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (to: string) => {
    throw new Error(`NEXT_REDIRECT ${to}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
  headers: async () => new Headers(),
}));

import { closePool } from "@/lib/db";
import { createEngagement, listFileItems } from "@/lib/engagements";
import { requireChildRead, requireChildWrite, requireEngagementRead, requireEngagementWrite } from "@/lib/engagement-access";
import { linkEvidence } from "@/lib/execution";
import { addRisk, listRisks, updateRisk } from "@/lib/risks";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let clientId: string;
let engA: string;
let engB: string;
let itemA: string;
let stepA: string;
const b: Record<string, string> = {};

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [FIRM]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1)", [[ACTOR, PARTNER, INVITED]]);
}

async function insert(sql: string, params: unknown[]): Promise<string> {
  const r = await admin.query<{ id: string }>(`${sql} RETURNING id`, params);
  return r.rows[0].id;
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Guard Firm', 'guard-test')", [FIRM]);
  for (const [id, email, role] of [
    [ACTOR, "actor@guard.local", "firm_admin"],
    [PARTNER, "partner@guard.local", "partner"],
    [INVITED, "invited@guard.local", "staff"],
  ]) {
    await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, $2, $2, 'x')", [id, email]);
    await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, $3)", [id, FIRM, role]);
  }
  clientId = await insert("INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Guard SA', 'SA')", [FIRM]);
  const otherClient = await insert("INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Other SA', 'SA')", [FIRM]);
  as(ACTOR, "firm_admin");
  engA = await createEngagement({ clientId, fiscalYear: 2025, periodEnd: "2025-12-31", partnerId: ACTOR });
  as(PARTNER, "partner");
  engB = await createEngagement({ clientId: otherClient, fiscalYear: 2025, periodEnd: "2025-12-31", partnerId: PARTNER });
  // open at its most exposed: fieldwork, every phase gate behind it
  await admin.query("UPDATE engagement SET phase = 'execution' WHERE id = $1", [engB]);
  await admin.query(
    "INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role, status) VALUES ($1, $2, $3, 'staff', 'invited')",
    [FIRM, engB, INVITED],
  );
  as(ACTOR, "firm_admin");
  itemA = (await listFileItems(engA))[0].id;
  as(PARTNER, "partner");
  stepA = await insert(
    "INSERT INTO program_step (tenant_id, engagement_id, file_item_id, seq, description) VALUES ($1, $2, $3, 1, 'A step')",
    [FIRM, engA, itemA],
  );
  const itemsB = await listFileItems(engB);
  const eng = [FIRM, engB];
  b.item = itemsB[0].id;
  b.client = otherClient;
  b.document = await insert("INSERT INTO document (tenant_id, engagement_id, file_item_id, title) VALUES ($1, $2, $3, 'Doc')", [...eng, b.item]);
  b.step = await insert("INSERT INTO program_step (tenant_id, engagement_id, file_item_id, seq, description) VALUES ($1, $2, $3, 1, 'Step')", [...eng, b.item]);
  b.risk = await insert("INSERT INTO risk (tenant_id, engagement_id, description) VALUES ($1, $2, 'A risk')", eng);
  b.potential = await insert("INSERT INTO potential_risk (tenant_id, engagement_id, description, source_code) VALUES ($1, $2, 'Lead', 'P3.2')", eng);
  b.finding = await insert("INSERT INTO finding (tenant_id, engagement_id, route, title) VALUES ($1, $2, 'c1', 'Finding')", eng);
  b.misstatement = await insert("INSERT INTO misstatement (tenant_id, engagement_id, description, amount, mtype) VALUES ($1, $2, 'M', 10, 'factual')", eng);
  b.pbc = await insert("INSERT INTO pbc_item (tenant_id, engagement_id, title) VALUES ($1, $2, 'PBC')", eng);
  b.note = await insert("INSERT INTO review_note (tenant_id, engagement_id, file_item_id, author_id, body, status) VALUES ($1, $2, $3, $4, 'Note', 'open')", [...eng, b.item, PARTNER]);
  b.time = await insert("INSERT INTO time_entry (tenant_id, engagement_id, user_id, entry_date, hours) VALUES ($1, $2, $3, '2025-06-30', 1)", [...eng, PARTNER]);
  b.dataset = await insert("INSERT INTO sub_ledger_dataset (tenant_id, engagement_id, kind, name, source_filename, source_sha256) VALUES ($1, $2, 'ar_open_items', 'AR', 'ar.csv', 'x')", eng);
  b.run = await insert("INSERT INTO automation_run (tenant_id, engagement_id, engine) VALUES ($1, $2, 'sampling')", eng);
  b.scot = await insert("INSERT INTO scot (tenant_id, engagement_id, name) VALUES ($1, $2, 'Sales')", eng);
  b.control = await insert("INSERT INTO scot_control (tenant_id, scot_id, name) VALUES ($1, $2, 'Approve')", [FIRM, b.scot]);
  b.wcgw = await insert("INSERT INTO wcgw (tenant_id, scot_id, description) VALUES ($1, $2, 'Wrong')", [FIRM, b.scot]);
  b.alerte = await insert("INSERT INTO alerte (tenant_id, engagement_id, variant) VALUES ($1, $2, 'sa')", eng);
  b.attachment = await insert(
    "INSERT INTO task_attachment (tenant_id, engagement_id, file_item_id, name, mime, size_bytes, version, content, uploaded_by) VALUES ($1, $2, $3, 'a.pdf', 'application/pdf', 1, 1, 'x', $4)",
    [...eng, b.item, PARTNER],
  );
  as(ACTOR, "firm_admin");
}, 120_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

/** Every row of engagement B and its client, hashed: any write through any path shows. */
async function snapshotB(): Promise<Record<string, string>> {
  const tables = await admin.query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.columns
      WHERE table_schema = 'public' AND column_name = 'engagement_id'`,
  );
  const out: Record<string, string> = {};
  for (const { table_name } of tables.rows) {
    const r = await admin.query<{ h: string }>(
      `SELECT count(*)::text || ':' || coalesce(md5(string_agg(t::text, '|' ORDER BY t::text)), '') AS h
         FROM "${table_name}" t WHERE t.engagement_id = $1`,
      [engB],
    );
    out[table_name] = r.rows[0].h;
  }
  const direct = await admin.query<{ e: string; c: string }>(
    `SELECT (SELECT md5(e::text) FROM engagement e WHERE e.id = $1) AS e,
            (SELECT md5(c::text) FROM client c WHERE c.id = $2) AS c`,
    [engB, b.client],
  );
  out.__engagement = direct.rows[0].e;
  out.__client = direct.rows[0].c;
  // rows that hold no engagement_id of their own
  for (const [table, parent, id] of [["scot_control", "scot_id", b.scot], ["wcgw", "scot_id", b.scot], ["signoff", "document_id", b.document], ["document_version", "document_id", b.document], ["risk_section", "risk_id", b.risk], ["risk_response", "risk_id", b.risk]] as const) {
    const r = await admin.query<{ h: string }>(
      `SELECT count(*)::text || ':' || coalesce(md5(string_agg(t::text, '|' ORDER BY t::text)), '') AS h FROM ${table} t WHERE t.${parent} = $1`,
      [id],
    );
    out[`__${table}`] = r.rows[0].h;
  }
  return out;
}

/** A form carrying the target's ids and a plausible value under every other name. */
function formFor(): FormData {
  const ids: Record<string, string> = {
    engagementId: engB,
    fileItemId: b.item,
    itemId: b.item,
    stepId: b.step,
    riskId: b.risk,
    datasetId: b.dataset,
    statementsDatasetId: b.dataset,
    ledgerDatasetId: b.dataset,
    scotControlId: b.control,
    id: b.time,
    userId: PARTNER,
    partnerId: PARTNER,
    newUserId: PARTNER,
    documentId: b.document,
    kind: "party",
    route: "c1",
    role: "assignee",
    group: "e1",
    level: "assertion",
    mandateType: "statutes",
    likelihood: "high",
    magnitude: "high",
    conclusion: "accept",
    parentId: "",
  };
  const value = (name: string): string => {
    if (name in ids) return ids[name];
    if (/date|At$|On$|periodEnd|reviewedTo/i.test(name)) return "2025-06-30";
    if (/amount|hours|year|threshold|capital|value|expectation|tolerance|size|misstatement|Value/i.test(name)) return "2026";
    return "Crafted text long enough for any length check";
  };
  return {
    get: (name: string) => value(name),
    getAll: (name: string) => [value(name)],
    has: () => true,
    entries: () => [["c_key", "Crafted"]][Symbol.iterator](),
    forEach: () => undefined,
    [Symbol.iterator]: () => [["c_key", "Crafted"]][Symbol.iterator](),
  } as unknown as FormData;
}

/** What each argument of an action is, by its parameter's name: all of them B's. */
function argumentsFor(params: string[]): unknown[] {
  const byName: Record<string, unknown> = {
    engagementId: engB,
    fileItemId: b.item,
    itemId: b.item,
    itemIds: [b.item],
    documentId: b.document,
    noteId: b.note,
    findingId: b.finding,
    runId: b.run,
    stepId: b.step,
    misstatementId: b.misstatement,
    riskId: b.risk,
    alerteId: b.alerte,
    id: b.potential,
    userId: PARTNER,
    clientId: b.client,
    journalId: b.document,
    versionNo: 1,
    role: "preparer",
    kind: "engagement_letter",
    key: "agm",
    index: "E",
    indexCode: "E",
    code: "P3.1",
    sourceCode: "P3.2",
    asPartner: false,
    corrected: true,
    material: true,
    engagementName: "Crafted",
    formData: formFor(),
  };
  return params.map((p) => byName[p] ?? "crafted");
}

function paramsOf(fn: (...args: never[]) => unknown): string[] {
  const m = /^[^(]*\(([^)]*)\)/.exec(fn.toString());
  return (m?.[1] ?? "")
    .split(",")
    .map((p) => p.trim().split(/[\s=]/)[0])
    .filter(Boolean);
}

/**
 * Actions the walk leaves out, with why. Everything else in app/actions is
 * called, so a new action is covered the day it is written.
 */
const NOT_WALKED: Record<string, string> = {
  // firm-level settings and records, not an engagement's
  updateBrandingAction: "firm settings",
  setAllowedDomainsAction: "firm settings",
  setRetentionYearsAction: "firm settings",
  setSapThresholdsAction: "firm settings",
  saveSignoffPolicyAction: "firm settings",
  saveTaskRulesAction: "firm settings",
  importSignoffMatrixAction: "firm settings",
  saveTemplateAction: "firm settings",
  resetTemplateAction: "firm settings",
  inviteUserAction: "firm users",
  resendInviteAction: "firm users",
  resetPasswordAction: "firm users",
  changeRoleAction: "firm users",
  removeUserAction: "firm users",
  createClientAction: "client register",
  updateClientMasterAction: "client register",
  setClientArchivedAction: "client register",
  addPortalContactAction: "client record",
  resendPortalInviteAction: "client record",
  addOverrideAction: "client-level account mapping",
  deactivateOverrideAction: "client-level account mapping",
  // creates its own file: there is no existing id to carry
  createEngagementAction: "no engagement id",
  // the reader's own
  setLocale: "own preference",
  sendTestNotification: "own notification",
  markRead: "own notification",
  // an invited member's answer, tested below
  respondEngagementAction: "deliberate exception",
  // a portal account's own path, refused to firm staff by requirePortalUser
  uploadPbcAction: "portal",
};

describe("the walk over every server action", () => {
  it("leaves engagement B untouched, whatever a firm administrator off its team posts", async () => {
    const dir = join(process.cwd(), "app", "actions");
    const walked: string[] = [];
    const wrote: string[] = [];
    const seen = new Set<string>();
    let before = await snapshotB();
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts"))) {
      const mod = (await import(`@/app/actions/${file.replace(/\.ts$/, "")}`)) as Record<string, unknown>;
      for (const [name, fn] of Object.entries(mod)) {
        if (typeof fn !== "function") continue;
        seen.add(name);
        if (name in NOT_WALKED) continue;
        as(ACTOR, "firm_admin");
        await (fn as (...a: unknown[]) => Promise<unknown>)(...argumentsFor(paramsOf(fn as never))).catch(() => undefined);
        walked.push(name);
        const after = await snapshotB();
        const changed = Object.keys(after).filter((k) => after[k] !== before[k]);
        if (changed.length > 0) wrote.push(`${name} wrote ${changed.join(", ")}`);
        before = after;
      }
    }
    expect(wrote).toEqual([]);
    expect(walked.length).toBeGreaterThan(100);
    // a stale exclusion would quietly hide a renamed action
    expect(Object.keys(NOT_WALKED).filter((n) => !seen.has(n))).toEqual([]);
  }, 300_000);
});

describe("the cases the DEV re-test found", () => {
  const form = (fields: Record<string, string>): FormData => {
    const f = new FormData();
    for (const [k, v] of Object.entries(fields)) f.append(k, v);
    return f;
  };

  it("refuses a discussion comment carrying another engagement's id", async () => {
    const { addCommentAction } = await import("@/app/actions/comments");
    as(ACTOR, "staff");
    await expect(addCommentAction(form({ engagementId: engB, body: "Crafted" }))).rejects.toThrow(/not-on-this-engagement/);
    const n = await admin.query("SELECT 1 FROM comment WHERE engagement_id = $1", [engB]);
    expect(n.rowCount).toBe(0);
    // and a member still can, on their own file
    await expect(addCommentAction(form({ engagementId: engA, body: "Mine" }))).rejects.toThrow(/NEXT_REDIRECT/);
    const mine = await admin.query("SELECT 1 FROM comment WHERE engagement_id = $1", [engA]);
    expect(mine.rowCount).toBe(1);
  });

  it("refuses a risk added to, or changed on, another engagement", async () => {
    as(ACTOR, "staff");
    const count = async () => (await admin.query("SELECT 1 FROM risk WHERE engagement_id = $1", [engB])).rowCount;
    const before = await count();
    const input = { description: "Crafted", source: "s", category: "error", level: "fs", likelihood: "high", magnitude: "high", significant: false, factors: [], index: "UA", assertions: [] };
    await expect(addRisk(engB, input as never)).rejects.toThrow("not-on-this-engagement");
    await expect(updateRisk(b.risk, { description: "Crafted" })).rejects.toThrow("not-on-this-engagement");
    await expect(listRisks(engB)).rejects.toThrow("not-on-this-engagement");
    expect(await count()).toBe(before);
    const { addRiskAction } = await import("@/app/actions/planning");
    await expect(addRiskAction(engB, form({ description: "Crafted", source: "s", category: "error", level: "fs" }))).rejects.toThrow(/NEXT_REDIRECT.*error=/);
    expect(await count()).toBe(before);
    await expect(addRisk(engA, input as never)).resolves.toBeTruthy();
  });

  it("refuses a due date on another engagement's task, and files the trail on the task's own", async () => {
    const { setDueDateAction } = await import("@/app/actions/audit-file");
    as(ACTOR, "staff");
    const back = `/engagements/${engA}/tasks`;
    // the crafted case: A's URL, B's task
    await expect(
      setDueDateAction(form({ fileItemId: b.item, engagementId: engA, returnTo: back, dueDate: "2026-01-31" })),
    ).rejects.toThrow(/error=not-on-this-engagement/);
    const due = await admin.query<{ due_date: string | null }>("SELECT due_date FROM file_item WHERE id = $1", [b.item]);
    expect(due.rows[0].due_date).toBeNull();
    // A's task, B's id in the form: the row changes on A and the trail stays on A
    const logged = async () => (await admin.query("SELECT 1 FROM activity_log WHERE engagement_id = $1", [engB])).rowCount;
    const before = await logged();
    await expect(
      setDueDateAction(form({ fileItemId: itemA, engagementId: engB, returnTo: back, dueDate: "2026-01-31" })),
    ).rejects.toThrow(/NEXT_REDIRECT/);
    expect(await logged()).toBe(before);
    const onA = await admin.query("SELECT 1 FROM activity_log WHERE engagement_id = $1 AND action = 'due_date_set'", [engA]);
    expect(onA.rowCount).toBe(1);
  });

  it("refuses evidence that writes to, or points at, another engagement", async () => {
    as(ACTOR, "staff");
    const count = async (e: string) => (await admin.query("SELECT 1 FROM evidence WHERE engagement_id = $1", [e])).rowCount;
    await expect(linkEvidence(b.step, "document", b.document, "Crafted")).rejects.toThrow("not-on-this-engagement");
    await expect(linkEvidence(stepA, "document", b.document, "Crafted")).rejects.toThrow("not-on-this-engagement");
    await expect(linkEvidence(stepA, "dataset", b.dataset, "Crafted")).rejects.toThrow("not-on-this-engagement");
    expect(await count(engA)).toBe(0);
    expect(await count(engB)).toBe(0);
  });

  it("refuses a sign-off whose form names one file and whose task is on another", async () => {
    const { signOffPreparerAction } = await import("@/app/actions/audit-file");
    as(ACTOR, "manager");
    const before = await admin.query("SELECT 1 FROM activity_log WHERE engagement_id = $1", [engB]);
    await expect(signOffPreparerAction(form({ fileItemId: itemA, engagementId: engB, phase: "planning" }))).rejects.toThrow(/not-on-this-engagement/);
    await expect(signOffPreparerAction(form({ fileItemId: b.item, engagementId: engA, phase: "planning" }))).rejects.toThrow(/not-found/);
    const after = await admin.query("SELECT 1 FROM activity_log WHERE engagement_id = $1", [engB]);
    expect(after.rowCount).toBe(before.rowCount);
  });

  it("does not let a mandate be set on a client through another file's form", async () => {
    const { setMandateAction } = await import("@/app/actions/planning");
    as(ACTOR, "manager");
    await expect(
      setMandateAction(engA, b.client, form({ mandateType: "ago", mandateStartYear: "2020" })),
    ).rejects.toThrow(/NEXT_REDIRECT/);
    const r = await admin.query<{ mandate_type: string | null }>("SELECT mandate_type FROM client WHERE id = $1", [b.client]);
    expect(r.rows[0].mandate_type).not.toBe("ago");
  });
});

describe("the helpers", () => {
  it("read and write follow the membership of the id given, not of any other", async () => {
    as(ACTOR, "staff");
    await expect(requireEngagementWrite(engA)).resolves.toMatchObject({ userId: ACTOR });
    await expect(requireEngagementRead(engB)).rejects.toThrow("not-on-this-engagement");
    await expect(requireEngagementWrite(engB)).rejects.toThrow("not-on-this-engagement");
    await expect(requireChildRead("file_item", b.item)).rejects.toThrow("not-on-this-engagement");
    await expect(requireChildWrite("scot_control", b.control)).rejects.toThrow("not-on-this-engagement");
    await expect(requireChildWrite("wcgw", b.wcgw)).rejects.toThrow("not-on-this-engagement");
    await expect(requireChildWrite("task_attachment", b.attachment)).rejects.toThrow("not-on-this-engagement");
    await expect(requireChildRead("file_item", itemA)).resolves.toMatchObject({ userId: ACTOR });
  });

  it("a read-only member reads but does not write", async () => {
    as(ACTOR, "read_only");
    await expect(requireEngagementRead(engA)).resolves.toMatchObject({ userId: ACTOR });
    await expect(requireEngagementWrite(engA)).rejects.toThrow("read-only-role");
    await expect(requireChildWrite("file_item", itemA)).rejects.toThrow("read-only-role");
  });

  it("an unknown id falls through to the caller's own not-found", async () => {
    as(ACTOR, "staff");
    await expect(requireChildRead("file_item", "00000000-0000-4000-8000-000000000000")).resolves.toMatchObject({ userId: ACTOR });
    await expect(requireChildRead("file_item", "not-a-uuid")).resolves.toMatchObject({ userId: ACTOR });
  });

  it("a portal account stays refused here and keeps its own path", async () => {
    as(ACTOR, "client_user");
    await expect(requireEngagementRead(engA)).rejects.toThrow("portal-account");
    await expect(requireChildRead("pbc_item", b.pbc)).rejects.toThrow("portal-account");
  });
});

describe("the deliberate exception: an invited member answers", () => {
  it("can decline, though they are not an accepted member, and cannot do anything else", async () => {
    const { respondEngagementAction } = await import("@/app/actions/team-independence");
    const { addCommentAction } = await import("@/app/actions/comments");
    const { myInvitation } = await import("@/lib/team");
    as(INVITED, "staff");
    await expect(myInvitation(engB)).resolves.toMatchObject({ teamRole: "staff" });
    const f = new FormData();
    f.append("engagementId", engB);
    f.append("body", "Crafted");
    await expect(addCommentAction(f)).rejects.toThrow(/not-on-this-engagement/);
    const decline = new FormData();
    decline.append("reason", "Conflict of interest");
    await expect(respondEngagementAction(engB, false, decline)).rejects.toThrow(/NEXT_REDIRECT \/dashboard/);
    const row = await admin.query<{ status: string }>("SELECT status FROM team_member WHERE engagement_id = $1 AND user_id = $2", [engB, INVITED]);
    expect(row.rows[0].status).toBe("declined");
  });
});

describe("the walk over the library", () => {
  // Names that carry an engagement, or something belonging to one.
  const ID_PARAM = /^(engagementId|fileItemId|documentId|stepId|programStepId|riskId|findingId|noteId|runId|datasetId|alerteId|scotId|controlId|wcgwId|journalId|attachmentId|sourceAttachmentId|misstatementId)$/;
  const GUARD = /\b(requireEngagement(Read|Write|Access)|requireChild(Read|Write)|requireStepAccess|requireTeamManager|guardDocument|guardFileItem|guardAttachment|requirePortalUser|assertNoteReachable|visibleToUser|canSeeEngagement)\(/;
  /** Takes such an id, and rightly does not check it itself. */
  const EXEMPT: Record<string, string> = {
    canSeeEngagement: "the check itself",
    requireEngagementAccess: "the check itself",
    requireEngagementRead: "the check itself",
    requireEngagementWrite: "the check itself",
    requireStepAccess: "the check itself",
    visibleToUser: "the check itself",
    invitationPending: "the check itself",
    guardDocument: "the check itself",
    requireTeamManager: "the check itself",
    myInvitation: "an invited member's own invitation",
    myTeamStatus: "the reader's own team row",
    respondToEngagement: "an invited member's answer",
    carryForwardOnCreation: "a file this request has just created",
    priorYearOnCreation: "a file this request has just created",
    assertMutable: "a guard inside functions already checked",
    activeHold: "a guard inside functions already checked",
    assertNotHeld: "a guard inside functions already checked",
    enqueueBackup: "a job queued by a function already checked, named by tenant",
    recordActivity: "writes the trail of a function already checked",
    logArchive: "writes the trail of a function already checked",
    logEngagementFinalised: "writes the trail of a function already checked",
    logSignOff: "writes the trail of a function already checked",
    logSignOffVoided: "writes the trail of a function already checked",
    logReopen: "writes the trail of a function already checked",
    logVersionRestored: "writes the trail of a function already checked",
    logAttachment: "writes the trail of a function already checked",
    logMaterialityChange: "writes the trail of a function already checked",
    logMisstatementChange: "writes the trail of a function already checked",
    logExport: "writes the trail of a function already checked",
    exportItgcWorkbook: "delegates to itgcView",
    exportJeWorkbook: "delegates to jeView",
    exportTocWorkbook: "delegates to tocView",
    exportTocSampleWorkbook: "delegates to tocSampleView",
    exportTodWorkbook: "delegates to todSideView",
  };

  it("every exported function taking such an id checks it, or is named here with why", () => {
    const missing: string[] = [];
    for (const entry of readdirSync("lib", { recursive: true, encoding: "utf8" })) {
      if (!/\.ts$/.test(entry)) continue;
      const path = join("lib", entry);
      const source = ts.createSourceFile(path, readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true);
      source.forEachChild((node) => {
        if (!ts.isFunctionDeclaration(node) || !node.body || !node.name) return;
        if (!node.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) return;
        const params = node.parameters.map((p) => p.name.getText());
        // a transaction or a tenant in first place: called with context the caller has already established
        if (["tx", "client", "tenantId"].includes(params[0] ?? "")) return;
        const takesId =
          params.some((p) => ID_PARAM.test(p)) ||
          node.parameters.some((p) => p.name.getText() === "input" && /\b(engagementId|fileItemId)\b/.test(p.type?.getText() ?? ""));
        if (!takesId || node.name.text in EXEMPT) return;
        if (!GUARD.test(node.body.getText())) missing.push(`${path}: ${node.name.text}`);
      });
    }
    expect(missing).toEqual([]);
  });
});
