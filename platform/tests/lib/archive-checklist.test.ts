import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// The archive checklist reuses the gates the archive itself applies and adds
// the detail those gates only count: which task, which risk, which note, each
// with a link. These tests hold the two things a reviewer relies on — that
// every gate is on the board whether green or red, and that a red gate names
// its items and points at the place they are fixed.

const TENANT = "e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e201";
const USER = "e2e2e2e2-e2e2-4e2e-8e2e-e2e2e2e2e202";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: USER, tenantId: TENANT, role: "firm_admin", locale: "en", clientId: null },
  })),
}));

import { archiveChecklist } from "@/lib/archive-checklist";
import { closePool } from "@/lib/db";
import { createEngagement } from "@/lib/engagements";
import { paperFor, savePaper } from "@/lib/working-papers";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let engagementId: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1", [USER]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Archive Firm', 'archive-checklist-test')", [TENANT]);
  await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'archive@checklist.local', 'Archivist', 'x')", [USER]);
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')", [USER, TENANT]);
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Archive SA', 'SA') RETURNING id",
    [TENANT],
  );
  engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31" });
}, 60_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("the archive checklist on a fresh engagement", () => {
  it("shows every gate, grouped, and counts what would refuse the archive", async () => {
    const c = await archiveChecklist(engagementId, "en");
    expect(c.archivedAt).toBeNull();
    expect(c.groups.map((g) => g.key)).toEqual(["report", "completion", "papers", "review", "assembly"]);
    const keys = c.groups.flatMap((g) => g.gates.map((x) => x.key));
    // The archive gate that folds the completion gates is unfolded here.
    expect(keys).not.toContain("completion_gates");
    for (const k of ["report_issued", "sections_concluded", "risks_concluded", "papers_signed", "reviews_complete", "review_notes_cleared", "review_approval", "c62_checklist"]) {
      expect(keys, k).toContain(k);
    }
    // A fresh file cannot be archived, and the board says by how much.
    expect(c.blocking).toBeGreaterThan(0);
    const report = c.groups[0].gates.find((g) => g.key === "report_issued");
    expect(report?.ok).toBe(false);
    expect(report?.href).toBe(`/engagements/${engagementId}/conclusion`);
    expect(report?.blocking).toBe(true);
  });

  it("carries both languages on every gate", async () => {
    const c = await archiveChecklist(engagementId, "fr");
    for (const gate of c.groups.flatMap((g) => g.gates)) {
      expect(gate.labelEn.trim().length, gate.key).toBeGreaterThan(0);
      expect(gate.labelFr.trim().length, gate.key).toBeGreaterThan(0);
      expect(gate.labelFr, gate.key).not.toBe(gate.labelEn);
    }
  });

  it("names the task behind a failing paper gate and links to it", async () => {
    // Answering E3.1 makes it a task that holds work, so it owes a signed
    // paper — and the board has to say so by name, not by count.
    await savePaper(
      engagementId,
      "E3.1",
      Object.fromEntries((paperFor("E3.1").conclEn ?? []).map((_, i) => [`c_${i}`, "yes"])),
    );
    const c = await archiveChecklist(engagementId, "en");
    const signed = c.groups.flatMap((g) => g.gates).find((g) => g.key === "papers_signed");
    expect(signed?.ok).toBe(false);
    const e31 = signed?.items.find((i) => i.code === "E3.1");
    expect(e31).toBeDefined();
    expect(e31?.href).toMatch(new RegExp(`^/engagements/${engagementId}/sections/[0-9a-f-]{36}$`));
    expect(e31?.label).toMatch(/^E3\.1 — /);
    expect(signed?.pending).toBeGreaterThanOrEqual(signed?.items.length ?? 0);
  });

  it("says nothing behind a green gate", async () => {
    const c = await archiveChecklist(engagementId, "en");
    for (const gate of c.groups.flatMap((g) => g.gates).filter((g) => g.ok)) {
      expect(gate.items, gate.key).toEqual([]);
      expect(gate.pending, gate.key).toBe(0);
    }
  });
});
