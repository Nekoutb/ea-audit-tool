import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "efefefef-efef-efef-efef-efefefefefef";
const USER = "efefefef-efef-efef-efef-efefefefef01";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: USER, tenantId: TENANT, role: "firm_admin", locale: "en" },
  })),
}));

import {
  addManualConfirmation,
  approveConfirmation,
  confirmationSummary,
  disposeReply,
  generateConfirmationLetter,
  generateSummaryWorkpaper,
  listConfirmationsFor,
  recordAlternative,
  recordReply,
  remindConfirmation,
  selectFromDataset,
  sendConfirmation,
} from "@/lib/confirmations";
import { closePool } from "@/lib/db";
import { createEngagement, listFileItems } from "@/lib/engagements";
import { evaluateB5 } from "@/lib/execution";
import { approveMateriality, createMaterialityVersion } from "@/lib/materiality";
import { createDataset } from "@/lib/subledgers";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let engagementId: string;
let e100: string;
let arDataset: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1", [USER]);
}

function byParty(list: Awaited<ReturnType<typeof listConfirmationsFor>>, party: string) {
  const found = list.find((confirmation) => confirmation.partyName === party);
  if (!found) throw new Error(`missing ${party}`);
  return found;
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Conf Firm', 'conf-test')", [TENANT]);
  await admin.query(
    "INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'conf@test.local', 'Conf Tester', 'x')",
    [USER],
  );
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')", [USER, TENANT]);
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Conf SA', 'SA') RETURNING id",
    [TENANT],
  );
  engagementId = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31" });
  e100 = (await listFileItems(engagementId)).find((item) => item.code === "E100")!.id;
  const version = await createMaterialityVersion(engagementId, {
    benchmark: "revenue", benchmarkAmount: 200_000_000, percentage: 1,
    justification: "Test.", performancePct: 75, trivialPct: 5,
  });
  await approveMateriality(engagementId, version);

  arDataset = await createDataset(
    engagementId, "ar_open_items", "ar.csv",
    Buffer.from(
      "Customer;Email;Amount\nACME;acme@x.test;5000000\nBeta;beta@x.test;2500000\nGamma;;900000\nNil Co;;0",
      "utf8",
    ),
  );
}, 30_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("6.1 selection", () => {
  it("selects above-threshold parties (+ nil balances when asked) and dedupes on re-run", async () => {
    const created = await selectFromDataset({
      engagementId, fileItemId: e100, datasetId: arDataset,
      ctype: "ar_positive", threshold: 1_000_000, includeNil: true,
    });
    expect(created).toBe(3); // ACME, Beta, Nil Co
    const again = await selectFromDataset({
      engagementId, fileItemId: e100, datasetId: arDataset,
      ctype: "ar_positive", threshold: 1_000_000, includeNil: true,
    });
    expect(again).toBe(0); // idempotent per (engagement, type, party)
    const list = await listConfirmationsFor(engagementId);
    expect(byParty(list, "ACME").bookAmount).toBe(5_000_000);
    expect(byParty(list, "ACME").partyEmail).toBe("acme@x.test");
  });
});

describe("6.2–6.4 letters + lifecycle", () => {
  it("generates a letter document and walks prepared → approved → sent", async () => {
    const list = await listConfirmationsFor(engagementId);
    const acme = byParty(list, "ACME");
    const documentId = await generateConfirmationLetter(acme.id, "fr");
    expect(documentId).toBeTruthy();
    await expect(sendConfirmation(acme.id)).rejects.toThrow("wrong-status"); // must approve first
    await approveConfirmation(acme.id);
    await sendConfirmation(acme.id);
    await remindConfirmation(acme.id);
    const after = byParty(await listConfirmationsFor(engagementId), "ACME");
    expect(after.status).toBe("sent");
    expect(after.reminderCount).toBe(1);
    expect(after.letterDocumentId).toBe(documentId);
  });
});

describe("6.6 reply evaluation + disposition", () => {
  it("zero difference reconciles; a difference is an exception; client error → B5", async () => {
    const list = await listConfirmationsFor(engagementId);
    const acme = byParty(list, "ACME"); // sent
    const reply = await recordReply(acme.id, 4_200_000); // book 5,000,000
    expect(reply.status).toBe("exception");
    expect(reply.difference).toBe(-800_000);

    await disposeReply(acme.id, "client_error");
    const b5 = await evaluateB5(engagementId);
    expect(b5.items.some((item) => item.description.includes("ACME") && item.amount === -800_000)).toBe(true);

    // Beta reconciles exactly.
    const beta = byParty(list, "Beta");
    await approveConfirmation(beta.id);
    await sendConfirmation(beta.id);
    const betaReply = await recordReply(beta.id, 2_500_000);
    expect(betaReply.status).toBe("reconciled");
  });
});

describe("6.7 alternative procedures + summary", () => {
  it("non-reply flows to alternative procedures and the summary counts it", async () => {
    await addManualConfirmation({
      engagementId, fileItemId: e100, ctype: "bank", partyName: "Banque Atlantique", bookAmount: 12_000_000,
    });
    const bank = byParty(await listConfirmationsFor(engagementId), "Banque Atlantique");
    await approveConfirmation(bank.id);
    await sendConfirmation(bank.id);
    await recordAlternative(bank.id, "Agreed closing balance to bank statement + subsequent transactions.");
    const after = byParty(await listConfirmationsFor(engagementId), "Banque Atlantique");
    expect(after.status).toBe("alternative");

    const summary = await confirmationSummary(engagementId);
    const bankRow = summary.find((row) => row.ctype === "bank")!;
    expect(bankRow.alternative).toBe(1);

    const documentId = await generateSummaryWorkpaper(engagementId, e100);
    const content = await admin.query<{ content: Buffer }>(
      "SELECT content FROM document_version WHERE document_id = $1",
      [documentId],
    );
    expect(content.rows[0].content.subarray(0, 2).toString("latin1")).toBe("PK");
  });
});
