// F061 (firm decision 2026-10-27): tests-of-controls samples are drawn on the
// server from a stored seed; every draw is kept; a redraw needs a reason; once
// testing has started only the team's manager rank and above may redraw.

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "f0610000-0000-4000-8000-000000000000";
const PARTNER = "f0610000-0000-4000-8000-000000000001";
const MANAGER = "f0610000-0000-4000-8000-000000000002";
const STAFF = "f0610000-0000-4000-8000-000000000003";
const OUTSIDER = "f0610000-0000-4000-8000-000000000004";

let actor = { id: PARTNER, role: "partner" };

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: actor.id, tenantId: TENANT, role: actor.role, locale: "en", clientId: null },
  })),
}));

import { closePool } from "@/lib/db";
import { createEngagement } from "@/lib/engagements";
import { seededRandom } from "@/lib/engines";
import { addControl, addWcgw, createScot, drawTocSampleForControl, listTocDraws, updateControl } from "@/lib/scots";
import { drawTocSample, seededRng, tocTestingStarted } from "@/lib/toc-sampling";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const as = (id: string, role: string) => { actor = { id, role }; };
let engagementId: string;
let controlId: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1)", [[PARTNER, MANAGER, STAFF, OUTSIDER]]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Draw Firm', 'f061-test')", [TENANT]);
  for (const [id, email, role] of [
    [PARTNER, "partner@f061.local", "partner"],
    [MANAGER, "manager@f061.local", "manager"],
    [STAFF, "staff@f061.local", "staff"],
    [OUTSIDER, "outsider@f061.local", "manager"],
  ]) {
    await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, $2, $2, 'x')", [id, email]);
    await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, $3)", [id, TENANT, role]);
  }
  as(PARTNER, "partner");
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Draw SA', 'SA') RETURNING id",
    [TENANT],
  );
  engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31", partnerId: PARTNER });
  for (const [id, teamRole] of [[MANAGER, "manager"], [STAFF, "staff"]]) {
    await admin.query(
      "INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role, status) VALUES ($1, $2, $3, $4, 'accepted')",
      [TENANT, engagementId, id, teamRole],
    );
  }
  const scotId = await createScot(engagementId, { name: "Sales", transactionType: "routine", strategy: "controls" });
  const wcgwId = await addWcgw(scotId, "Sales recorded without delivery", ["E"]);
  controlId = await addControl(scotId, { name: "Delivery note matched", controlType: "manual", frequency: "daily", wcgwIds: [wcgwId] });
}, 60_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("the seeded draw (pure)", () => {
  it("is reproducible from its seed", () => {
    const a = drawTocSample(650, 25, seededRng("seed-1", seededRandom));
    const b = drawTocSample(650, 25, seededRng("seed-1", seededRandom));
    const c = drawTocSample(650, 25, seededRng("seed-2", seededRandom));
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
    expect(new Set(a).size).toBe(25);
  });

  it("knows when testing has started", () => {
    expect(tocTestingStarted(null)).toBe(false);
    expect(tocTestingStarted({ rows: [{ results: { a: "" } }] })).toBe(false);
    expect(tocTestingStarted({ rows: [{ results: { a: "pass" } }] })).toBe(true);
  });
});

describe("drawing on the server (F061)", () => {
  it("draws from a stored seed, and the first draw needs no reason", async () => {
    as(STAFF, "staff");
    const draw = await drawTocSampleForControl(engagementId, controlId, { population: 300, sampleSize: 25, rule: "Daily → 25" });
    expect(draw.drawNo).toBe(1);
    expect(draw.items).toHaveLength(25);
    // the stored seed reproduces the stored items
    expect(drawTocSample(300, 25, seededRng(draw.seed, seededRandom))).toEqual(draw.items);
    const control = await admin.query<{ toc_sample_items: number[]; sample_size: number; toc_population: number }>(
      "SELECT toc_sample_items, sample_size, toc_population FROM scot_control WHERE id = $1",
      [controlId],
    );
    expect(control.rows[0]).toMatchObject({ toc_sample_items: draw.items, sample_size: 25, toc_population: 300 });
  });

  it("refuses a redraw without a written reason", async () => {
    as(STAFF, "staff");
    await expect(drawTocSampleForControl(engagementId, controlId, { population: 300, sampleSize: 25 })).rejects.toThrow(
      "redraw-reason-required",
    );
    await expect(
      drawTocSampleForControl(engagementId, controlId, { population: 300, sampleSize: 25, reason: "  " }),
    ).rejects.toThrow("redraw-reason-required");
  });

  it("allows a redraw with a reason before testing starts, keeping the earlier draw", async () => {
    as(STAFF, "staff");
    const second = await drawTocSampleForControl(engagementId, controlId, {
      population: 320,
      sampleSize: 25,
      reason: "Population corrected to the full year",
    });
    expect(second.drawNo).toBe(2);
    as(MANAGER, "manager");
    const history = (await listTocDraws(engagementId)).get(controlId) ?? [];
    expect(history.map((d) => d.drawNo)).toEqual([2, 1]);
    expect(history[0]).toMatchObject({ reason: "Population corrected to the full year", drawnByName: "staff@f061.local" });
    expect(history[1].reason).toBeNull();
  });

  it("once an item is tested, only manager rank and above may redraw — still with a reason", async () => {
    as(MANAGER, "manager");
    await updateControl(controlId, {
      tocGrid: { attributes: ["Matched"], rows: [{ ref: "1", date: "", desc: "", results: { Matched: "pass" } }] } as never,
    });
    as(STAFF, "staff");
    await expect(
      drawTocSampleForControl(engagementId, controlId, { population: 320, sampleSize: 25, reason: "Want other items" }),
    ).rejects.toThrow("redraw-after-testing-manager-only");
    as(MANAGER, "manager");
    await expect(drawTocSampleForControl(engagementId, controlId, { population: 320, sampleSize: 25 })).rejects.toThrow(
      "redraw-reason-required",
    );
    const third = await drawTocSampleForControl(engagementId, controlId, {
      population: 320,
      sampleSize: 25,
      reason: "Sample frame excluded the December batch",
    });
    expect(third.drawNo).toBe(3);
    expect(((await listTocDraws(engagementId)).get(controlId) ?? []).length).toBe(3);
  });

  it("keeps the history append-only", async () => {
    await expect(admin.query("UPDATE toc_sample_draw SET reason = 'x' WHERE control_id = $1", [controlId])).rejects.toThrow(
      /append-only/,
    );
    await expect(admin.query("DELETE FROM toc_sample_draw WHERE control_id = $1", [controlId])).rejects.toThrow(/append-only/);
  });

  it("is for the engagement's team only", async () => {
    as(OUTSIDER, "manager");
    await expect(
      drawTocSampleForControl(engagementId, controlId, { population: 320, sampleSize: 25, reason: "Outside" }),
    ).rejects.toThrow("not-on-this-engagement");
  });

  it("no longer takes items from the client", async () => {
    as(MANAGER, "manager");
    const before = await admin.query<{ toc_sample_items: number[] }>("SELECT toc_sample_items FROM scot_control WHERE id = $1", [controlId]);
    await updateControl(controlId, { tocSampleItems: [1, 2, 3] } as never);
    const after = await admin.query<{ toc_sample_items: number[] }>("SELECT toc_sample_items FROM scot_control WHERE id = $1", [controlId]);
    expect(after.rows[0].toc_sample_items).toEqual(before.rows[0].toc_sample_items);
  });
});
