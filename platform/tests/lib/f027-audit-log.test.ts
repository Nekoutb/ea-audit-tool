// F027 (firm decision 2026-10-27): the firm-wide audit log, for the firm
// administrator only, and the full before/after history of working-paper
// answers (form_response trigger, migration 20261027000002).

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "f0270000-0000-4000-8000-000000000000";
const ADMIN = "f0270000-0000-4000-8000-000000000001";
const MANAGER = "f0270000-0000-4000-8000-000000000002";
const OUTSIDER = "f0270000-0000-4000-8000-000000000003";

let actor = { id: ADMIN, role: "firm_admin" };

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: actor.id, tenantId: TENANT, role: actor.role, locale: "en", clientId: null },
  })),
}));

import { answerHistory, answerText, cleanFilters, csvCell, firmActivityCsv, firmActivityForExport, listFirmActivity } from "@/lib/audit-log";
import { closePool, withTenant } from "@/lib/db";
import { createEngagement } from "@/lib/engagements";
import { saveForm } from "@/lib/forms";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const as = (id: string, role: string) => { actor = { id, role }; };
let engagementId: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1)", [[ADMIN, MANAGER, OUTSIDER]]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Log Firm', 'f027-test')", [TENANT]);
  for (const [id, email, role] of [
    [ADMIN, "admin@f027.local", "firm_admin"],
    [MANAGER, "manager@f027.local", "manager"],
    [OUTSIDER, "outsider@f027.local", "manager"],
  ]) {
    await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, $2, $2, 'x')", [id, email]);
    await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, $3)", [id, TENANT, role]);
  }
  as(ADMIN, "firm_admin");
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Log SA', 'SA') RETURNING id",
    [TENANT],
  );
  engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31", partnerId: ADMIN });
  await admin.query(
    "INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role, status) VALUES ($1, $2, $3, 'manager', 'accepted')",
    [TENANT, engagementId, MANAGER],
  );
}, 60_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("answer history (form_response trigger)", () => {
  it("records each changed field with its old and new value, and the writer", async () => {
    as(MANAGER, "manager");
    await saveForm(engagementId, "P3.1", { ownership_governance: "Family-owned SA" });
    await saveForm(engagementId, "P3.1", { ownership_governance: "Listed SA" });
    // saving the same value again is not a change
    await saveForm(engagementId, "P3.1", { ownership_governance: "Listed SA" });
    const history = await answerHistory(engagementId);
    const field = history.find((h) => h.code === "P3.1" && h.field === "ownership_governance");
    expect(field?.changes).toHaveLength(2);
    // newest first
    expect(field?.changes[0]).toMatchObject({ before: "Family-owned SA", after: "Listed SA", userName: "manager@f027.local" });
    expect(field?.changes[1]).toMatchObject({ before: null, after: "Family-owned SA" });
  });

  it("records a delete-then-insert replace once, as old → new", async () => {
    await withTenant(TENANT, async (tx) => {
      await tx.query("DELETE FROM form_response WHERE engagement_id = $1 AND code = 'P3.1' AND field_key = 'ownership_governance'", [engagementId]);
      await tx.query(
        `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by)
         VALUES ($1, $2, 'P3.1', 'ownership_governance', $3, $4)`,
        [TENANT, engagementId, JSON.stringify("Cooperative"), MANAGER],
      );
    });
    // and a replace by the SAME value records nothing
    await withTenant(TENANT, async (tx) => {
      await tx.query("DELETE FROM form_response WHERE engagement_id = $1 AND code = 'P3.1' AND field_key = 'ownership_governance'", [engagementId]);
      await tx.query(
        `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by)
         VALUES ($1, $2, 'P3.1', 'ownership_governance', $3, $4)`,
        [TENANT, engagementId, JSON.stringify("Cooperative"), MANAGER],
      );
    });
    as(MANAGER, "manager");
    const field = (await answerHistory(engagementId)).find((h) => h.field === "ownership_governance");
    expect(field?.changes).toHaveLength(3);
    expect(field?.changes[0]).toMatchObject({ before: "Listed SA", after: "Cooperative", userName: "manager@f027.local" });
  });

  it("records a cleared answer, and skips a value carried forward from the prior year", async () => {
    await withTenant(TENANT, async (tx) => {
      await tx.query("DELETE FROM form_response WHERE engagement_id = $1 AND code = 'P3.1' AND field_key = 'ownership_governance'", [engagementId]);
      await tx.query(
        `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by, carried_forward)
         VALUES ($1, $2, 'P3.1', 'business_model', $3, $4, true)`,
        [TENANT, engagementId, JSON.stringify("Rolled"), MANAGER],
      );
    });
    as(MANAGER, "manager");
    const history = await answerHistory(engagementId);
    expect(history.find((h) => h.field === "ownership_governance")?.changes[0]).toMatchObject({ before: "Cooperative", after: null });
    expect(history.find((h) => h.field === "business_model")).toBeUndefined();
  });

  it("is for the engagement's team only", async () => {
    as(OUTSIDER, "manager");
    await expect(answerHistory(engagementId)).rejects.toThrow("not-on-this-engagement");
  });

  it("renders a stored answer as text", () => {
    expect(answerText(JSON.stringify("abc"))).toBe("abc");
    expect(answerText(JSON.stringify(true))).toBe("true");
    expect(answerText(null)).toBeNull();
  });
});

describe("the firm audit log (Settings > Audit log)", () => {
  it("is refused to everyone but the firm administrator", async () => {
    as(MANAGER, "manager");
    await expect(listFirmActivity({})).rejects.toThrow("firm-admin-only");
    await expect(firmActivityForExport({})).rejects.toThrow("firm-admin-only");
    as(ADMIN, "partner");
    await expect(listFirmActivity({})).rejects.toThrow("firm-admin-only");
  });

  it("lists the firm's activity, filtered by action, user, engagement and dates", async () => {
    as(ADMIN, "firm_admin");
    const all = await listFirmActivity({});
    expect(all.total).toBeGreaterThan(0);
    const answers = await listFirmActivity({ action: "answer_changed" });
    expect(answers.rows.length).toBeGreaterThanOrEqual(4);
    expect(answers.rows.every((r) => r.action === "answer_changed" && r.engagementId === engagementId)).toBe(true);
    expect(answers.rows[0].engagementName).toBeTruthy();
    const byManager = await listFirmActivity({ userId: MANAGER, entityType: "form_response" });
    expect(byManager.rows.every((r) => r.userId === MANAGER)).toBe(true);
    const byEngagement = await listFirmActivity({ engagementId });
    expect(byEngagement.rows.every((r) => r.engagementId === engagementId)).toBe(true);
    const future = await listFirmActivity({ from: "2999-01-01" });
    expect(future.total).toBe(0);
    const today = new Date().toISOString().slice(0, 10);
    expect((await listFirmActivity({ from: today, to: today })).total).toBe(all.total);
  });

  it("paginates", async () => {
    as(ADMIN, "firm_admin");
    const page = await listFirmActivity({}, 999);
    // a page past the end is clamped to the last one
    expect(page.page).toBe(page.pages);
  });

  it("exports the filtered set as CSV", async () => {
    as(ADMIN, "firm_admin");
    const rows = await firmActivityForExport({ action: "answer_changed" });
    const csv = firmActivityCsv(rows);
    expect(csv.startsWith("﻿at,user,role,engagement")).toBe(true);
    expect(csv).toContain("answer_changed");
    expect(csv).toContain("Listed SA");
  });

  it("drops malformed filters rather than trusting them", () => {
    const f = cleanFilters({ userId: "x'; drop", engagementId: "firm", from: "2026-13", action: "answer_changed" });
    expect(f).toEqual({ userId: null, engagementId: "firm", from: null, to: null, entityType: null, action: "answer_changed" });
    expect(csvCell("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
  });
});
