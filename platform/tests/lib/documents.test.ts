import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// Fixed fixture ids for this suite (cleaned up before and after).
const TENANT = "cccccccc-cccc-cccc-cccc-cccccccccccc";
const USER = "cccccccc-cccc-cccc-cccc-ccccccccccc1";

// The documents module resolves the actor via requireTenant() -> auth(); mock
// the session so the state machine can be exercised directly against the DB.
vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: USER, tenantId: TENANT, role: "firm_admin", locale: "en" },
  })),
}));

import { auth } from "@/auth";
import { closePool } from "@/lib/db";
import {
  addReviewNote,
  checkinDocument,
  checkoutDocument,
  clearReviewNote,
  DocumentRuleError,
  generateDocument,
  getDocument,
  listReviewNotes,
  listSignoffs,
  listVersions,
  reopenDocument,
  restoreVersion,
  signDocument,
} from "@/lib/documents";
import { createEngagement, listFileItems } from "@/lib/engagements";
import { DEFAULT_FILE_INDEX } from "@/lib/file-index";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let engagementId: string;
let d31ItemId: string;
let documentId: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]); // cascades
  await admin.query("DELETE FROM app_user WHERE id = $1", [USER]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Docs Test Firm', 'docs-test')", [
    TENANT,
  ]);
  await admin.query(
    "INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'docs@test.local', 'Doc Tester', 'x')",
    [USER],
  );
  await admin.query(
    "INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')",
    [USER, TENANT],
  );
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Fixture SA', 'SA') RETURNING id",
    [TENANT],
  );
  engagementId = await createEngagement({
    clientId: client.rows[0].id,
    fiscalYear: 2025,
    periodEnd: "2025-12-31",
  });
});

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("engagement file index instantiation", () => {
  it("instantiates the full default index on engagement creation", async () => {
    const items = await listFileItems(engagementId);
    expect(items).toHaveLength(DEFAULT_FILE_INDEX.length);
    const d31 = items.find((item) => item.code === "P1.1");
    expect(d31).toBeDefined();
    expect(items.find((item) => item.code === "D2")).toBeUndefined();
    d31ItemId = d31!.id;
  });
});

describe("document lifecycle", () => {
  it("generates P1.1 from its template as version 1", async () => {
    documentId = await generateDocument(d31ItemId, "en");
    const document = await getDocument(documentId);
    expect(document?.currentVersion).toBe(1);
    expect(document?.status).toBe("draft");
    const versions = await listVersions(documentId);
    expect(versions[0].note).toBe("template:P1.1-acceptance@1");
    // Idempotent: generating again returns the same document.
    expect(await generateDocument(d31ItemId, "en")).toBe(documentId);
  });

  it("requires check-out before check-in, then creates version 2", async () => {
    const content = Buffer.from("PK-fake-docx-for-test");
    await expect(checkinDocument(documentId, content)).rejects.toThrow(DocumentRuleError);
    await checkoutDocument(documentId);
    const versionNo = await checkinDocument(documentId, content);
    expect(versionNo).toBe(2);
    const document = await getDocument(documentId);
    expect(document?.checkedOutBy).toBeNull();
  });

  it("restores an old version as a NEW version (history preserved)", async () => {
    const versionNo = await restoreVersion(documentId, 1);
    expect(versionNo).toBe(3);
    expect((await listVersions(documentId)).map((v) => v.versionNo)).toEqual([3, 2, 1]);
  });

  it("enforces preparer-first, blocks reviewer sign-off on open notes, then locks", async () => {
    await expect(signDocument(documentId, "reviewer")).rejects.toThrow(/preparer-first/);
    await signDocument(documentId, "preparer");

    await addReviewNote(documentId, "Please tighten the conclusion.");
    await expect(signDocument(documentId, "reviewer")).rejects.toThrow(/open-notes/);

    const note = (await listReviewNotes(documentId)).find((n) => n.status === "open");
    await clearReviewNote(note!.id, "Conclusion expanded.");
    await signDocument(documentId, "reviewer");

    const document = await getDocument(documentId);
    expect(document?.status).toBe("signed");
    // Signed = locked: no checkout, no restore.
    await expect(checkoutDocument(documentId)).rejects.toThrow(/signed-locked/);
    await expect(restoreVersion(documentId, 1)).rejects.toThrow(/signed-locked/);
  });

  it("reopen voids sign-offs, unlocks, and requires a reason", async () => {
    await expect(reopenDocument(documentId, "  ")).rejects.toThrow(/reason-required/);
    await reopenDocument(documentId, "New evidence received after sign-off.");
    const document = await getDocument(documentId);
    expect(document?.status).toBe("draft");
    const signoffs = await listSignoffs(documentId);
    expect(signoffs.every((s) => s.voidedAt !== null)).toBe(true);
    // Editable again.
    await checkoutDocument(documentId);
    const v = await checkinDocument(documentId, Buffer.from("post-reopen"));
    expect(v).toBe(4);
  });

  it("partner-only codes refuse a manager's approval and accept a partner's", async () => {
    const asRole = (role: string) =>
      vi.mocked(auth).mockResolvedValue({
        user: { id: USER, tenantId: TENANT, role, locale: "en" },
      } as never);
    const items = await listFileItems(engagementId);
    const s61 = items.find((item) => item.code === "S6.1");
    expect(s61).toBeDefined();
    asRole("manager");
    const documentId = await generateDocument(s61!.id, "en");
    await signDocument(documentId, "preparer");
    await expect(signDocument(documentId, "reviewer")).rejects.toThrow(/partner-only/);
    asRole("partner");
    await signDocument(documentId, "reviewer");
    asRole("firm_admin");
  });
});