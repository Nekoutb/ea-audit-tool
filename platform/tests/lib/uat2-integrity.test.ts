import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// UAT run 2, data-integrity batch (hC): concurrent paper saves (B05), sign-offs
// voided when procedure results / steps / evidence change (B10), the C1.1
// register following the SAD (B11), the C4.1 threshold check agreeing with the
// SAD (B12) and the S5.4 JE design kept as history and voiding signatures (B16).
// B15 (toc-no-sample) is covered in toc-cra-writethrough.test.ts.

const TENANT = "d7d7d7d7-d7d7-4d7d-8d7d-d7d7d7d7d701";
const USER = "d7d7d7d7-d7d7-4d7d-8d7d-d7d7d7d7d702";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: USER, tenantId: TENANT, role: "firm_admin", locale: "en", clientId: null },
  })),
}));
// postSadEntry reads the locale cookie; there is no request here.
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
  headers: async () => new Headers(),
}));

import { closePool } from "@/lib/db";
import { createEngagement, listFileItems } from "@/lib/engagements";
import { saveAttachment } from "@/lib/attachments";
import { completionGates } from "@/lib/completion";
import { uncompleteStep } from "@/lib/execution";
import { recordSelectionDesign } from "@/lib/je-selection";
import { savePspResult } from "@/lib/psp";
import { postSadEntry, sadView } from "@/lib/sad";
import { paperContentHash, paperVersion, savePaper } from "@/lib/working-papers";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let engagementId: string;
let e4Code: string;
let e4ItemId: string;
let s54ItemId: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1", [USER]);
}

async function addStep(description: string): Promise<string> {
  const r = await admin.query<{ id: string }>(
    `INSERT INTO program_step (tenant_id, engagement_id, file_item_id, seq, description, assertions, source)
     VALUES ($1, $2, $3, (SELECT coalesce(max(seq), 0) + 10 FROM program_step WHERE file_item_id = $3), $4, '{}', 'custom') RETURNING id`,
    [TENANT, engagementId, e4ItemId, description],
  );
  return r.rows[0].id;
}

/** A P+R signature over the task's content as it stands now. */
async function signNow(fileItemId: string, code: string): Promise<string[]> {
  let doc = await admin.query<{ id: string }>("SELECT id FROM document WHERE file_item_id = $1", [fileItemId]);
  if (!doc.rows[0]) {
    doc = await admin.query<{ id: string }>(
      `INSERT INTO document (tenant_id, engagement_id, file_item_id, title, language, status, current_version, created_by)
       VALUES ($1, $2, $3, $4, 'en', 'signed', 1, $5) RETURNING id`,
      [TENANT, engagementId, fileItemId, `${code} paper`, USER],
    );
  }
  await admin.query("UPDATE document SET status = 'signed' WHERE id = $1", [doc.rows[0].id]);
  const hash = await paperContentHash(engagementId, code);
  const ids: string[] = [];
  for (const role of ["preparer", "reviewer"]) {
    const s = await admin.query<{ id: string }>(
      `INSERT INTO signoff (tenant_id, document_id, version_no, role, user_id, content_hash)
       VALUES ($1, $2, 1, $3, $4, $5) RETURNING id`,
      [TENANT, doc.rows[0].id, role, USER, hash],
    );
    ids.push(s.rows[0].id);
  }
  return ids;
}

async function activeSignoffs(ids: string[]): Promise<number> {
  const r = await admin.query<{ n: string }>(
    "SELECT count(*)::text AS n FROM signoff WHERE id = ANY($1::uuid[]) AND voided_at IS NULL",
    [ids],
  );
  return Number(r.rows[0].n);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Integrity Firm', 'uat2-integrity')", [TENANT]);
  await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'integrity@uat2.local', 'Integrity', 'x')", [USER]);
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')", [USER, TENANT]);
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Integrity SA', 'SA') RETURNING id",
    [TENANT],
  );
  engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31" });
  const items = await listFileItems(engagementId);
  const e4 = items.find((i) => i.code.startsWith("E4."))!;
  e4Code = e4.code;
  e4ItemId = e4.id;
  s54ItemId = items.find((i) => i.code === "S5.4")!.id;
  // PM 1 000 000, TE 750 000: the uncorrected-misstatement threshold is 250 000.
  await admin.query(
    `INSERT INTO materiality (tenant_id, engagement_id, version_no, benchmark, benchmark_amount, percentage, justification,
                              performance_pct, trivial_pct, overall, performance, trivial, status, approved_by, approved_at, created_by)
     VALUES ($1, $2, 1, 'revenue', 100000000, 1, 'test', 75, 5, 1000000, 750000, 50000, 'approved', $3, now(), $3)`,
    [TENANT, engagementId, USER],
  );
}, 60_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("B05 — a paper save built on a stale version is refused, not merged over", () => {
  it("refuses the second of two saves made from the same loaded version", async () => {
    const base = await paperVersion(engagementId, "C5.2");
    await savePaper(engagementId, "C5.2", { key_findings: "Manager's findings" }, base);
    await expect(savePaper(engagementId, "C5.2", { key_findings: "" }, base)).rejects.toThrow("stale-edit");
    const r = await admin.query<{ v: string }>(
      "SELECT value #>> '{}' AS v FROM form_response WHERE engagement_id = $1 AND code = 'wp:C5.2' AND field_key = 'key_findings'",
      [engagementId],
    );
    expect(r.rows[0].v).toBe("Manager's findings");
  });

  it("accepts a save made from the current version", async () => {
    const base = await paperVersion(engagementId, "C5.2");
    await savePaper(engagementId, "C5.2", { key_findings: "Updated after reload" }, base);
    expect(await paperVersion(engagementId, "C5.2")).not.toBe(base);
  });
});

describe("B10 — results, steps and evidence changed after sign-off void the signatures", () => {
  let stepId: string;
  beforeAll(async () => {
    stepId = await addStep("OSP-1 — Cut-off test");
  });

  it("a procedure finding edited after P+R voids both", async () => {
    await savePspResult(engagementId, e4Code, stepId, "No exception", "finding");
    const ids = await signNow(e4ItemId, e4Code);
    expect(await activeSignoffs(ids)).toBe(2);
    await savePspResult(engagementId, e4Code, stepId, "EXCEPTION found after review", "finding");
    expect(await activeSignoffs(ids)).toBe(0);
    const trail = await admin.query(
      "SELECT 1 FROM activity_log WHERE engagement_id = $1 AND action = 'signoff_invalidated'",
      [engagementId],
    );
    expect(trail.rowCount).toBeGreaterThan(0);
  });

  it("evidence uploaded after P+R voids both and is on the trail", async () => {
    const ids = await signNow(e4ItemId, e4Code);
    await saveAttachment(e4ItemId, "late-addition.txt", "text/plain", Buffer.from("late"));
    expect(await activeSignoffs(ids)).toBe(0);
    const trail = await admin.query(
      "SELECT 1 FROM activity_log WHERE engagement_id = $1 AND action = 'attachment_uploaded'",
      [engagementId],
    );
    expect(trail.rowCount).toBe(1);
  });

  it("a step reopened after P+R voids both", async () => {
    await admin.query("UPDATE program_step SET status = 'complete', conclusion = 'done' WHERE id = $1", [stepId]);
    const ids = await signNow(e4ItemId, e4Code);
    await uncompleteStep(stepId, engagementId);
    expect(await activeSignoffs(ids)).toBe(0);
  });
});

describe("B11/B12 — the C1.1 register and the C4.1 check follow the SAD", () => {
  let stepId: string;
  const b5 = async () => (await completionGates(engagementId)).find((g) => g.key === "b5_within_materiality")!.ok;
  const adjust = async (id: string, amount: string) => {
    await savePspResult(engagementId, e4Code, id, "6011", "adj_debit_account");
    await savePspResult(engagementId, e4Code, id, amount, "adj_debit_amount");
    await savePspResult(engagementId, e4Code, id, "4011", "adj_credit_account");
    await savePspResult(engagementId, e4Code, id, amount, "adj_credit_amount");
  };
  const registered = async (id: string) =>
    Number((await admin.query<{ a: string }>("SELECT amount::text AS a FROM misstatement WHERE program_step_id = $1", [id])).rows[0]?.a);

  beforeAll(async () => {
    stepId = await addStep("OSP-2 — Unrecorded supplier invoice");
    await adjust(stepId, "120000");
    await postSadEntry(engagementId, stepId);
  });

  it("posted at 120 000: within the 250 000 threshold", async () => {
    expect(await registered(stepId)).toBe(120000);
    expect(await b5()).toBe(true);
  });

  it("the adjustment raised to 300 000 re-posts the register and fails the check", async () => {
    await adjust(stepId, "300000");
    expect(await registered(stepId)).toBe(300000);
    const entry = (await sadView(engagementId)).entries.find((e) => e.stepId === stepId)!;
    expect(entry.posted).toBe(true);
    expect(entry.stale).toBe(false);
    expect(await b5()).toBe(false);
  });

  it("a register row that no longer matches the paper is flagged stale and fails the check", async () => {
    await admin.query("UPDATE misstatement SET amount = 120000 WHERE program_step_id = $1", [stepId]);
    const entry = (await sadView(engagementId)).entries.find((e) => e.stepId === stepId)!;
    expect(entry.stale).toBe(true);
    expect(await b5()).toBe(false);
    await postSadEntry(engagementId, stepId);
    expect((await sadView(engagementId)).entries.find((e) => e.stepId === stepId)!.stale).toBe(false);
  });

  it("an uncorrected SAD entry left unposted fails the check", async () => {
    await admin.query("UPDATE misstatement SET amount = 100000 WHERE program_step_id = $1", [stepId]);
    await adjust(stepId, "100000"); // back within the threshold, register in step
    expect(await b5()).toBe(true);
    const other = await addStep("OSP-3 — Judgmental provision");
    await adjust(other, "60000");
    expect(await b5()).toBe(false);
  });
});

describe("B16 — the S5.4 JE design is recorded on request, kept as history, and voids signatures", () => {
  const design = (criteria: string[], selectedLines: number) => ({
    datasetId: "00000000-0000-4000-8000-000000000000",
    criteria,
    params: {},
    userRules: [],
    selectedLines,
    populationLines: 128,
  });

  it("refuses to record a run that selected nothing", async () => {
    await expect(recordSelectionDesign(engagementId, design(["no-description"], 0))).rejects.toThrow("je-design-empty");
  });

  it("a second design keeps the first as history and voids the S5.4 signatures", async () => {
    await recordSelectionDesign(engagementId, design(["weekend-posting", "round-amount"], 60));
    const ids = await signNow(s54ItemId, "S5.4");
    await recordSelectionDesign(engagementId, design(["no-description"], 4));
    expect(await activeSignoffs(ids)).toBe(0);
    const r = await admin.query<{ field_key: string; v: string }>(
      "SELECT field_key, value #>> '{}' AS v FROM form_response WHERE engagement_id = $1 AND code = 'wp:S5.4' AND field_key LIKE 'je_design%'",
      [engagementId],
    );
    const history = JSON.parse(r.rows.find((x) => x.field_key === "je_design_history")!.v) as { criteria: string[] }[];
    expect(history).toHaveLength(1);
    expect(history[0].criteria).toEqual(["weekend-posting", "round-amount"]);
    expect(JSON.parse(r.rows.find((x) => x.field_key === "je_design")!.v).criteria).toEqual(["no-description"]);
  });
});
