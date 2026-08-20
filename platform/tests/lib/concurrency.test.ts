import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "c9c9c9c9-c9c9-4c9c-8c9c-c9c9c9c9c9c9";
const ALICE = "c9c9c9c9-c9c9-4c9c-8c9c-c9c9c9c9c901";
const BOB = "c9c9c9c9-c9c9-4c9c-8c9c-c9c9c9c9c902";

let actor = ALICE;

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: actor, tenantId: TENANT, role: "manager", locale: "en", clientId: null },
  })),
}));

import { closePool } from "@/lib/db";
import { createEngagement } from "@/lib/engagements";
import { ConcurrentEditError, loadForm, saveForm } from "@/lib/forms";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let engagementId: string;

// A form that exists in FORM_DEFINITIONS with plain text fields.
const CODE = "P3.1";

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1)", [[ALICE, BOB]]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Race Firm', 'race-test')", [TENANT]);
  await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1,'alice@race.local','Alice','x')", [ALICE]);
  await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1,'bob@race.local','Bob','x')", [BOB]);
  for (const u of [ALICE, BOB]) {
    await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'manager')", [u, TENANT]);
  }
  actor = ALICE;
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Race SA', 'SA') RETURNING id",
    [TENANT],
  );
  engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31" });
}, 40_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

/** Field keys really present on the form under test. */
async function twoFieldKeys(): Promise<[string, string]> {
  const { FORM_DEFINITIONS } = await import("@/lib/forms");
  const def = FORM_DEFINITIONS[CODE];
  const text = def.fields.filter((f) => f.type === "text");
  expect(text.length).toBeGreaterThanOrEqual(2);
  return [text[0].key, text[1].key];
}

describe("saveForm — two people on one paper", () => {
  it("refuses a save when the other person changed the same field", async () => {
    const [field] = await twoFieldKeys();

    actor = ALICE;
    const alicesView = await loadForm(engagementId, CODE);

    // Bob gets there first.
    actor = BOB;
    await saveForm(engagementId, CODE, { [field]: "Bob's wording" });

    // Alice saves against the stale baseline.
    actor = ALICE;
    await expect(
      saveForm(engagementId, CODE, { [field]: "Alice's wording" }, alicesView.revision),
    ).rejects.toThrow(ConcurrentEditError);

    // Bob's text survives — Alice's save was refused, not merged.
    const after = await loadForm(engagementId, CODE);
    expect(after.values[field]).toBe("Bob's wording");
  });

  it("names the field and the person, so the message can be useful", async () => {
    const [field] = await twoFieldKeys();
    actor = ALICE;
    const base = await loadForm(engagementId, CODE);
    actor = BOB;
    await saveForm(engagementId, CODE, { [field]: `Bob again ${Date.now()}` });
    actor = ALICE;
    await saveForm(engagementId, CODE, { [field]: "Alice again" }, base.revision).catch((e: unknown) => {
      expect(e).toBeInstanceOf(ConcurrentEditError);
      const err = e as ConcurrentEditError;
      expect(err.fields).toContain(field);
      expect(err.by).toBe("Bob");
    });
  });

  it("allows two people editing DIFFERENT fields of the same paper", async () => {
    // The common case, and it must not be treated as a clash.
    const [a, b] = await twoFieldKeys();
    actor = ALICE;
    const base = await loadForm(engagementId, CODE);
    actor = BOB;
    await saveForm(engagementId, CODE, { [b]: "Bob's other field" });
    actor = ALICE;
    await expect(saveForm(engagementId, CODE, { [a]: "Alice's field" }, base.revision)).resolves.toBeUndefined();
    const after = await loadForm(engagementId, CODE);
    expect(after.values[a]).toBe("Alice's field");
    expect(after.values[b]).toBe("Bob's other field");
  });

  it("does not clash when the other save stored the same value", async () => {
    const [field] = await twoFieldKeys();
    actor = ALICE;
    const base = await loadForm(engagementId, CODE);
    actor = BOB;
    await saveForm(engagementId, CODE, { [field]: "identical text" });
    actor = ALICE;
    await expect(
      saveForm(engagementId, CODE, { [field]: "identical text" }, base.revision),
    ).resolves.toBeUndefined();
  });

  it("does not clash with the editor's own earlier save", async () => {
    const [field] = await twoFieldKeys();
    actor = ALICE;
    const base = await loadForm(engagementId, CODE);
    await saveForm(engagementId, CODE, { [field]: "first pass" });
    await expect(
      saveForm(engagementId, CODE, { [field]: "second pass" }, base.revision),
    ).resolves.toBeUndefined();
  });

  it("saves unconditionally when no baseline is supplied", async () => {
    const [field] = await twoFieldKeys();
    actor = BOB;
    await saveForm(engagementId, CODE, { [field]: "bob overwrites" });
    actor = ALICE;
    await expect(saveForm(engagementId, CODE, { [field]: "no baseline" })).resolves.toBeUndefined();
  });

  it("hands back a revision that moves after a write", async () => {
    const [field] = await twoFieldKeys();
    actor = ALICE;
    const before = await loadForm(engagementId, CODE);
    await saveForm(engagementId, CODE, { [field]: `moved ${Date.now()}` });
    const after = await loadForm(engagementId, CODE);
    expect(after.revision > before.revision).toBe(true);
  });
});
