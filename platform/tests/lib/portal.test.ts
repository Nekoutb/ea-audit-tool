import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "9a9a9a9a-9a9a-4a9a-8a9a-9a9a9a9a9a9a";
const FIRM_USER = "9a9a9a9a-9a9a-4a9a-8a9a-9a9a9a9a9a01";

let currentUser = {
  user: { id: FIRM_USER, tenantId: TENANT, role: "firm_admin", locale: "en", clientId: null as string | null },
};

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => currentUser),
}));

import { engagementDashboard, firmDashboard } from "@/lib/dashboards";
import { closePool } from "@/lib/db";
import { createEngagement, listFileItems } from "@/lib/engagements";
import { exportFileIndex } from "@/lib/exports";
import { generateLeadSchedule } from "@/lib/leadsheets";
import {
  acceptPbc,
  addPbcItem,
  addPortalContact,
  listPbcItems,
  listPortalContacts,
  listPortalItems,
  uploadPbc,
} from "@/lib/pbc";
import { importTrialBalance } from "@/lib/tb";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });

let clientId: string;
let otherClientId: string;
let engagementId: string;
let portalUserId: string;

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM app_user WHERE email LIKE '%@portal-test.local'");
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1", [FIRM_USER]);
}

function asFirm(): void {
  currentUser = {
    user: { id: FIRM_USER, tenantId: TENANT, role: "firm_admin", locale: "en", clientId: null },
  };
}

// Restore the firm identity even when a test fails part-way: without this a
// leaked client_user session runs the remaining tests, which is precisely how
// the missing role check went unnoticed.
afterEach(() => asFirm());

function asPortal(): void {
  currentUser = {
    user: { id: portalUserId, tenantId: TENANT, role: "client_user", locale: "fr", clientId },
  };
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Portal Firm', 'portal-test')", [TENANT]);
  await admin.query(
    "INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'firm@portal-test.local', 'Portal Firm User', 'x')",
    [FIRM_USER],
  );
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')", [FIRM_USER, TENANT]);
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form, mandate_type, mandate_start_year) VALUES ($1, 'Portal SA', 'SA', 'ago', 2025) RETURNING id",
    [TENANT],
  );
  clientId = client.rows[0].id;
  const other = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Other SA', 'SA') RETURNING id",
    [TENANT],
  );
  otherClientId = other.rows[0].id;
  engagementId = await createEngagement({ clientId, fiscalYear: 2025, periodEnd: "2025-12-31" });
}, 30_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("9.1 portal contacts + auth scoping", () => {
  it("creates a client_user membership scoped to ONE client", async () => {
    portalUserId = await addPortalContact(clientId, {
      email: "Contact@portal-test.local",
      name: "Mme Contact",
      password: "s3cret-pass",
    });
    const membership = await admin.query<{ role: string; client_id: string }>(
      "SELECT role, client_id FROM membership WHERE user_id = $1",
      [portalUserId],
    );
    expect(membership.rows[0]).toEqual({ role: "client_user", client_id: clientId });
    const contacts = await listPortalContacts(clientId);
    expect(contacts.some((contact) => contact.email === "contact@portal-test.local")).toBe(true);
    // Password is stored hashed, never in clear.
    const stored = await admin.query<{ password_hash: string }>(
      "SELECT password_hash FROM app_user WHERE id = $1",
      [portalUserId],
    );
    expect(stored.rows[0].password_hash).not.toContain("s3cret");
    expect(stored.rows[0].password_hash.startsWith("$2")).toBe(true);
  });

  it("rejects weak passwords and duplicate emails", async () => {
    await expect(
      addPortalContact(clientId, { email: "x@portal-test.local", name: "X", password: "short" }),
    ).rejects.toThrow("password-too-short");
    await expect(
      addPortalContact(clientId, { email: "contact@portal-test.local", name: "Dup", password: "longenough" }),
    ).rejects.toThrow("email-taken");
  });
});

describe("9.1/9.2 PBC flow: requested → uploaded → accepted + attach", () => {
  let itemId: string;

  it("firm raises a request; the portal user is notified and sees it", async () => {
    itemId = await addPbcItem(engagementId, "Grand livre 2025", "Format CSV ou Excel.");
    const notified = await admin.query(
      "SELECT 1 FROM notification WHERE user_id = $1 AND kind = 'pbc-requested'",
      [portalUserId],
    );
    expect(notified.rows.length).toBe(1);

    asPortal();
    const items = await listPortalItems(clientId);
    expect(items.length).toBe(1);
    expect(items[0].status).toBe("requested");
    asFirm();
  });

  it("the portal user uploads; another client's id cannot touch the item", async () => {
    asPortal();
    await expect(
      uploadPbc(itemId, otherClientId, {
        filename: "gl.csv", mime: "text/csv", content: Buffer.from("a;b\n1;2", "utf8"),
      }),
    ).rejects.toThrow("not-your-client"); // refused from the session, before any query
    await uploadPbc(itemId, clientId, {
      filename: "gl.csv", mime: "text/csv", content: Buffer.from("Compte;Montant\n411;100", "utf8"),
    });
    const items = await listPortalItems(clientId);
    expect(items[0].status).toBe("uploaded");
    expect(items[0].filename).toBe("gl.csv");
    asFirm();
  });

  it("the firm accepts and attaches the upload as a working-paper document", async () => {
    const e100 = (await listFileItems(engagementId)).find((item) => item.code === "E4.1")!.id;
    const documentId = await acceptPbc(itemId, e100);
    expect(documentId).toBeTruthy();
    const doc = await admin.query<{ kind: string; title: string }>(
      "SELECT kind, title FROM document WHERE id = $1",
      [documentId],
    );
    expect(doc.rows[0].kind).toBe("workpaper");
    expect(doc.rows[0].title).toContain("PBC");
    const items = await listPbcItems(engagementId);
    expect(items[0].status).toBe("accepted");
    expect(items[0].documentId).toBe(documentId);
  });
});

describe("9.3/9.4/9.5 dashboards", () => {
  it("engagement dashboard aggregates steps, risks, C1.1 and PBC", async () => {
    const dash = await engagementDashboard(engagementId);
    expect(dash.phase).toBe("acceptance");
    expect(dash.risks.identified).toBe(2); // presumed ISA 240 pair
    expect(dash.pbcOpen).toBe(0); // accepted above
    expect(dash.b5.materiality).toBeNull();
  });

  it("firm dashboard rolls up phases, deadlines, mandates and portfolio risks", async () => {
    const firm = await firmDashboard();
    expect(firm.byPhase.some((entry) => entry.phase === "acceptance" && entry.count >= 1)).toBe(true);
    expect(firm.mandateExpiries.some((entry) => entry.clientName === "Portal SA" && entry.expiryYear === 2030)).toBe(true);
    expect(firm.significantRisks.length).toBeGreaterThanOrEqual(2);
  });
});

describe("9.6 regulator export", () => {
  it("produces a real xlsx of the file index with statuses", async () => {
    const result = await exportFileIndex(engagementId);
    expect(result).not.toBeNull();
    expect(result!.filename).toBe("file-index-2025.xlsx");
    expect(result!.content.subarray(0, 2).toString("latin1")).toBe("PK");
    expect(result!.content.length).toBeGreaterThan(5_000);
  });
});

describe("9.7 performance", () => {
  it("imports a 5,000-row TB well under the 30s budget", async () => {
    const rows = ["Compte;Libellé;Mouvement débit;Mouvement crédit"];
    for (let index = 0; index < 2_500; index += 1) {
      const account = `4110${String(index).padStart(4, "0")}`;
      rows.push(`${account};Client ${index};${1_000 + index};0`);
    }
    for (let index = 0; index < 2_499; index += 1) {
      const account = `7010${String(index).padStart(4, "0")}`;
      rows.push(`${account};Vente ${index};0;${1_000 + index}`);
    }
    const total = 2_500 * 1_000 + (2_500 * 2_499) / 2 - (2_499 * 1_000 + (2_499 * 2_498) / 2);
    rows.push(`701099999;Équilibrage;0;${total}`);

    const started = Date.now();
    const result = await importTrialBalance(engagementId, "big-tb.csv", Buffer.from(rows.join("\n"), "utf8"));
    const elapsed = Date.now() - started;
    expect(result.summary.status).toBe("valid");
    expect(elapsed).toBeLessThan(30_000);
  }, 60_000);

  it("regenerates a lead schedule under the 10s budget", async () => {
    const e100 = (await listFileItems(engagementId)).find((item) => item.code === "E4.1")!.id;
    const started = Date.now();
    const result = await generateLeadSchedule(e100, "en");
    const elapsed = Date.now() - started;
    expect(result.documentId).toBeTruthy();
    expect(elapsed).toBeLessThan(10_000);
  }, 30_000);
});
