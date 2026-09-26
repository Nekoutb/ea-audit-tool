import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

// Regressions for the high-severity findings of the THIRD DEV user-acceptance
// run: B01 a review note raised on another engagement's task, B02 the team
// completing the EQR gate itself, B03 a team-role EQR rewriting the team's
// papers, B04 a read-only observer blocking the independence gate; and the
// partial fixes: concurrent edits of different fields, C5.8 contradicting the
// equity monitor.

const FIRM = "c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3";
const ADMIN = "c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c301";
const MANAGER = "c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c302";
const SENIOR = "c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c303"; // firm role senior, team role EQR on engA
const STAFF = "c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c304";
const READER = "c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c305";
const EQRF = "c3c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c306"; // firm role eqr_reviewer
const USERS = [ADMIN, MANAGER, SENIOR, STAFF, READER, EQRF];

let actor = { id: ADMIN, role: "firm_admin" };
let equityFigures: unknown = null;

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
// C5.8: the monitor's figures are stubbed; the rule under test is savePaper's
vi.mock("@/lib/legal", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/legal")>();
  return {
    ...mod,
    equityStatus: vi.fn(async (id: string) => (equityFigures as Awaited<ReturnType<typeof mod.equityStatus>>) ?? mod.equityStatus(id)),
  };
});

import { markNotApplicableAction } from "@/app/actions/planning";
import { POST as taskNotesPost } from "@/app/api/engagements/[id]/task-notes/route";
import { saveAttachment } from "@/lib/attachments";
import { completionGates } from "@/lib/completion";
import { closePool } from "@/lib/db";
import { generateDocument, signDocument } from "@/lib/documents";
import { createEngagement, listFileItems } from "@/lib/engagements";
import { saveForm } from "@/lib/forms";
import { acceptanceGates } from "@/lib/gates";
import { launchCampaign } from "@/lib/independence";
import { decodePaperDraft, encodePaperDraft } from "@/lib/paper-drafts";
import { paperKeys, requiredKeys } from "@/lib/papers/types";
import { addTaskNote } from "@/lib/task-notes";
import { addTeamMemberByEmail, assignTask, assignTeamMember, listTeam } from "@/lib/team";
import { EQR_C42_KEYS } from "@/lib/eqr";
import {
  loadPaper,
  paperBaseDigests,
  paperFor,
  paperVersion,
  savePaper,
  StaleEditConflict,
} from "@/lib/working-papers";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const as = (id: string, role: string) => {
  actor = { id, role };
};

let clientId: string;
let engA: string; // MANAGER, STAFF, SENIOR (team-role EQR)
let engB: string; // MANAGER only
let itemA: string;
let itemB: string;
let year = 2030;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [FIRM]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1)", [USERS]);
}

const form = (fields: Record<string, string>): FormData => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

async function item(engagementId: string, code: string): Promise<string | null> {
  const r = await admin.query<{ id: string }>(
    "SELECT id FROM file_item WHERE engagement_id = $1 AND code = $2",
    [engagementId, code],
  );
  return r.rows[0]?.id ?? null;
}

async function engagement(complexity?: "non_complex"): Promise<string> {
  year += 1;
  return createEngagement({ clientId, fiscalYear: year, periodEnd: `${year}-12-31`, ...(complexity ? { complexity } : {}) });
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'UAT3 High', 'uat3-high')", [FIRM]);
  const users: [string, string, string][] = [
    [ADMIN, "admin@uat3-high.local", "firm_admin"],
    [MANAGER, "manager@uat3-high.local", "manager"],
    [SENIOR, "senior@uat3-high.local", "senior"],
    [STAFF, "staff@uat3-high.local", "staff"],
    [READER, "reader@uat3-high.local", "read_only"],
    [EQRF, "eqrf@uat3-high.local", "eqr_reviewer"],
  ];
  for (const [id, email, role] of users) {
    await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, $2, $2, 'x')", [id, email]);
    await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, $3)", [id, FIRM, role]);
  }
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'UAT3 SA', 'SA') RETURNING id",
    [FIRM],
  );
  clientId = client.rows[0].id;
  as(ADMIN, "firm_admin");
  engA = await engagement();
  engB = await engagement();
  await assignTeamMember(engA, MANAGER, "manager");
  await assignTeamMember(engA, STAFF, "staff");
  await assignTeamMember(engA, SENIOR, "eqr_reviewer");
  await assignTeamMember(engB, MANAGER, "manager");
  await admin.query("UPDATE team_member SET status = 'accepted' WHERE engagement_id = ANY($1)", [[engA, engB]]);
  itemA = (await listFileItems(engA)).find((i) => i.code === "P3.2")!.id;
  itemB = (await listFileItems(engB)).find((i) => i.code === "P3.2")!.id;
}, 120_000);

afterEach(() => {
  as(ADMIN, "firm_admin");
  equityFigures = null;
});

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("B01 — a task note is raised only on a task of the engagement in the URL", () => {
  it("refuses another engagement's task, in the library and through the API", async () => {
    as(STAFF, "staff");
    await expect(addTaskNote(engA, itemB, "UAT3 XENG")).rejects.toThrow("not-found");
    await expect(addTaskNote(engB, itemB, "UAT3 XENG")).rejects.toThrow("not-on-this-engagement");
    const res = await taskNotesPost(
      new Request("http://local/api", { method: "POST", body: JSON.stringify({ fileItemId: itemB, body: "UAT3 XENG" }) }),
      { params: Promise.resolve({ id: engA }) },
    );
    expect(res.status).toBe(404);
    const notes = await admin.query("SELECT 1 FROM review_note WHERE file_item_id = $1", [itemB]);
    expect(notes.rowCount).toBe(0);
  });

  it("still raises a note on the engagement's own task", async () => {
    as(STAFF, "staff");
    await expect(addTaskNote(engA, itemA, "Own task")).resolves.toBeUndefined();
    const notes = await admin.query<{ engagement_id: string }>(
      "SELECT engagement_id FROM review_note WHERE file_item_id = $1",
      [itemA],
    );
    expect(notes.rows.map((r) => r.engagement_id)).toEqual([engA]);
    await admin.query("DELETE FROM review_note WHERE file_item_id = $1", [itemA]);
  });
});

describe("B03 — the team-role EQR is read-only on the team's work", () => {
  it("refuses a senior appointed as EQR: paper, form, assignment, N/A, evidence, sign-off", async () => {
    const doc = await generateDocument(itemA, "en");
    as(SENIOR, "senior");
    await expect(savePaper(engA, "P1.3", { key_findings: "EDITED BY senior" })).rejects.toThrow("eqr-read-only");
    await expect(saveForm(engA, "P3.2", {})).rejects.toThrow("eqr-read-only");
    await expect(assignTask(engA, itemA, null)).rejects.toThrow("eqr-read-only");
    await expect(markNotApplicableAction(engA, itemA, form({ naReason: "probe" }))).rejects.toThrow(
      /error=eqr-read-only/,
    );
    await expect(saveAttachment(itemA, "probe.txt", "text/plain", Buffer.from("x"))).rejects.toThrow("eqr-read-only");
    await expect(signDocument(doc, "preparer")).rejects.toThrow("forbidden");
    const saved = await admin.query(
      "SELECT 1 FROM form_response WHERE engagement_id = $1 AND code = 'wp:P1.3' AND field_key = 'key_findings'",
      [engA],
    );
    expect(saved.rowCount).toBe(0);
  });

  it("puts C4.2 on the file when the EQR is added through the team page", async () => {
    const id = await engagement("non_complex");
    expect(await item(id, "C4.2")).toBeNull();
    await addTeamMemberByEmail(id, "eqrf@uat3-high.local", "eqr_reviewer", "UAT3");
    expect(await item(id, "C4.2")).not.toBeNull();
  });
});

describe("B02 — only the appointed quality reviewer completes the EQR gate", () => {
  const values = (keys: string[]) =>
    Object.fromEntries(keys.map((k) => [k, k.startsWith("q_") || k.startsWith("c_") ? "yes" : "Done — see file."]));
  const required = () => requiredKeys(paperFor("C4.2"));
  const eqrGate = async () => (await completionGates(engA)).find((g) => g.key === "eqr_complete")?.ok;

  it("keeps the reviewer's part of C4.2 from the team and the team's part from the reviewer", async () => {
    await admin.query("UPDATE engagement SET phase = 'execution' WHERE id = $1", [engA]);
    as(MANAGER, "manager");
    await expect(savePaper(engA, "C4.2", { q_complete: "yes" })).rejects.toThrow("eqr-own-paper");
    await expect(savePaper(engA, "C4.2", values(required().filter((k) => !EQR_C42_KEYS.includes(k))))).resolves.toBeUndefined();
    expect(await eqrGate()).toBe(false);
    as(SENIOR, "senior");
    await expect(savePaper(engA, "C4.2", { q_planning: "no" })).rejects.toThrow("eqr-read-only");
    await expect(savePaper(engA, "C4.2", values(required().filter((k) => EQR_C42_KEYS.includes(k))))).resolves.toBeUndefined();
    // answered by the reviewer but not signed by them: still open
    expect(await eqrGate()).toBe(false);
  });

  it("refuses the 'eqr' sign-off to the team and grants it to the appointed reviewer", async () => {
    const c42 = await item(engA, "C4.2");
    const doc = await generateDocument(c42!, "en");
    as(MANAGER, "manager");
    await expect(signDocument(doc, "eqr")).rejects.toThrow("eqr-own-paper");
    // the team's own chips attest the governance communications, not the review
    await expect(signDocument(doc, "preparer")).resolves.toBe("preparer");
    expect(await eqrGate()).toBe(false);
    as(SENIOR, "senior");
    await expect(signDocument(doc, "reviewer")).rejects.toThrow("forbidden");
    await expect(signDocument(doc, "eqr")).resolves.toBe("eqr");
    expect(await eqrGate()).toBe(true);
  });

  it("does not accept a review answered by the team, even if the reviewer signs", async () => {
    // someone other than the reviewer last wrote q_resolved (e.g. a direct write)
    await admin.query(
      "UPDATE form_response SET updated_by = $2 WHERE engagement_id = $1 AND code = 'wp:C4.2' AND field_key = 'q_resolved'",
      [engA, MANAGER],
    );
    expect(await eqrGate()).toBe(false);
    await admin.query(
      "UPDATE form_response SET updated_by = $2 WHERE engagement_id = $1 AND code = 'wp:C4.2' AND field_key = 'q_resolved'",
      [engA, SENIOR],
    );
    expect(await eqrGate()).toBe(true);
  });
});

describe("B04 — a read-only observer does not block the independence gate", () => {
  it("counts only firm staff who declare independence", async () => {
    const id = await engagement();
    await assignTeamMember(id, MANAGER, "manager");
    await assignTeamMember(id, READER, "staff");
    const team = await listTeam(id);
    expect(team.find((m) => m.userId === READER)?.declaresIndependence).toBe(false);
    expect(team.find((m) => m.userId === MANAGER)?.declaresIndependence).toBe(true);
    await expect(launchCampaign(id, [READER])).rejects.toThrow("invalid-recipient");
    await launchCampaign(id, [MANAGER]);
    await admin.query(
      `UPDATE independence_confirmation SET status = 'completed'
        WHERE campaign_id IN (SELECT id FROM independence_campaign WHERE engagement_id = $1)`,
      [id],
    );
    const gate = (await acceptanceGates(id)).find((g) => g.key === "independence_complete");
    expect(gate?.ok).toBe(true);
  });
});

describe("firm.perf-concurrent — concurrent edits of different fields are all kept", () => {
  it("saves disjoint edits, holds back only a field both people changed", async () => {
    const code = "P3.1";
    const keys = [...paperKeys(paperFor(code))].filter((k) => k.startsWith("p_"));
    expect(keys.length).toBeGreaterThanOrEqual(2);
    const [k1, k2] = keys;
    const base = await paperVersion(engA, code);
    const loaded = await loadPaper(engA, code);
    const digests = JSON.parse(paperBaseDigests(loaded)) as Record<string, string>;
    // every field posted back, as the wizard does
    const posted = (changes: Record<string, string>) => ({
      ...Object.fromEntries([...paperKeys(paperFor(code))].map((k) => [k, loaded[k] ?? ""])),
      ...changes,
    });

    as(MANAGER, "manager");
    await savePaper(engA, code, posted({ key_findings: "Manager findings" }), base, digests);
    as(STAFF, "staff");
    await expect(savePaper(engA, code, posted({ [k1]: "Staff model" }), base, digests)).resolves.toBeUndefined();
    as(ADMIN, "firm_admin");
    const clash = savePaper(engA, code, posted({ key_findings: "Admin rewrite", [k2]: "Admin structure" }), base, digests);
    await expect(clash).rejects.toBeInstanceOf(StaleEditConflict);
    await clash.catch((error: StaleEditConflict) => {
      expect(error.keys).toEqual(["key_findings"]);
      expect(error.drafts).toEqual({ key_findings: "Admin rewrite" });
    });
    const now = await loadPaper(engA, code);
    expect(now.key_findings).toBe("Manager findings");
    expect(now[k1]).toBe("Staff model");
    expect(now[k2]).toBe("Admin structure");
    // without the digests the old whole-paper refusal still applies
    await expect(savePaper(engA, code, { [k2]: "x" }, base)).rejects.toThrow("stale-edit");
  });

  it("round-trips the held-back text through the draft cookie value", () => {
    const { value, truncated } = encodePaperDraft({ key_findings: "Texte conservé — 1" });
    expect(truncated).toBe(false);
    expect(decodePaperDraft(value)?.drafts).toEqual({ key_findings: "Texte conservé — 1" });
    const long = encodePaperDraft({ p_model: "x".repeat(10_000) });
    expect(long.truncated).toBe(true);
    expect(long.value.length).toBeLessThanOrEqual(3600);
    expect(decodePaperDraft("garbage")).toBeNull();
  });
});

describe("firm.stat.c5-8 — C5.8 cannot contradict the equity monitor", () => {
  it("refuses 'equity above half the capital' while the figures show a breach", async () => {
    equityFigures = {
      equity: 4_000_000, shareCapital: 10_000_000, halfCapital: 5_000_000, breach: true, hasTb: true, source: "pre_audit",
    };
    await expect(savePaper(engA, "C5.8", { q_above: "yes" })).rejects.toThrow("c58-equity-contradicts");
    await expect(savePaper(engA, "C5.8", { q_above: "no" })).resolves.toBeUndefined();
    equityFigures = {
      equity: 9_000_000, shareCapital: 10_000_000, halfCapital: 5_000_000, breach: false, hasTb: true, source: "pre_audit",
    };
    await expect(savePaper(engA, "C5.8", { q_above: "yes" })).resolves.toBeUndefined();
  });
});
