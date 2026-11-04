import bcrypt from "bcryptjs";
import { readFileSync } from "node:fs";
import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "7b7b7b7b-7b7b-4b7b-8b7b-7b7b7b7b7b7b";
const FIRM_USER = "7b7b7b7b-7b7b-4b7b-8b7b-7b7b7b7b7b01";
const OLD_CONTACT = "7b7b7b7b-7b7b-4b7b-8b7b-7b7b7b7b7b02";

let currentUser: { user: Record<string, unknown> } = {
  user: { id: FIRM_USER, tenantId: TENANT, role: "firm_admin", locale: "en", clientId: null },
};

vi.mock("@/lib/locale", () => ({ getLocale: async () => "fr" }));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => currentUser) }));

import { closePool } from "@/lib/db";
import { changeOwnPassword } from "@/lib/password";
import { addPortalContact, listPortalContacts, resendPortalInvite } from "@/lib/pbc";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let clientId: string;

async function cleanup(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE email LIKE '%@batch7-test.local'");
}

beforeAll(async () => {
  await cleanup();
  await admin.query("INSERT INTO tenant (id, name, slug, default_language) VALUES ($1, 'Batch7', 'batch7-test', 'en')", [TENANT]);
  await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'firm@batch7-test.local', 'Firm', 'x')", [FIRM_USER]);
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')", [FIRM_USER, TENANT]);
  const client = await admin.query<{ id: string }>("INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Client SA', 'SA') RETURNING id", [TENANT]);
  clientId = client.rows[0].id;
  // a contact as the old screen made them: a password the auditor typed
  await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'old@batch7-test.local', 'Old', $2)", [
    OLD_CONTACT,
    await bcrypt.hash("Auditor-typed-1", 4),
  ]);
  await admin.query("INSERT INTO membership (user_id, tenant_id, role, client_id) VALUES ($1, $2, 'client_user', $3)", [OLD_CONTACT, TENANT, clientId]);
});

afterAll(async () => {
  await cleanup();
  await admin.end();
  await closePool();
});

describe("F069 — the auditor no longer sets a portal password", () => {
  it("creates a new contact with a forced change, the firm's language and a link to /portal", async () => {
    const id = await addPortalContact(clientId, { email: "new@batch7-test.local", name: "New" });
    const user = await admin.query<{ must_change_password: boolean; preferred_language: string }>(
      "SELECT must_change_password, preferred_language FROM app_user WHERE id = $1",
      [id],
    );
    expect(user.rows[0].must_change_password).toBe(true);
    expect(user.rows[0].preferred_language).toBe("en"); // F086
    const invite = await admin.query<{ next_path: string }>("SELECT next_path FROM user_invite WHERE user_id = $1 AND used_at IS NULL", [id]);
    expect(invite.rows[0].next_path).toBe("/portal");
    const contacts = await listPortalContacts(clientId);
    expect(contacts.find((c) => c.id === id)?.pending).toBe(true);
  });

  it("re-sends a link, superseding the old one", async () => {
    const id = (await listPortalContacts(clientId)).find((c) => c.email === "new@batch7-test.local")!.id;
    await resendPortalInvite(clientId, id);
    const live = await admin.query("SELECT 1 FROM user_invite WHERE user_id = $1 AND used_at IS NULL", [id]);
    expect(live.rowCount).toBe(1);
  });

  it("migration: flags portal-only accounts, and their old password still reaches the change", async () => {
    const sql = readFileSync("migrations/20261105000001_portal_contacts_must_change.sql", "utf8");
    const up = sql.split(/^-- Up Migration\s*$/m)[1].split(/^-- Down Migration\s*$/m)[0];
    await admin.query(up);
    const old = await admin.query<{ must_change_password: boolean }>("SELECT must_change_password FROM app_user WHERE id = $1", [OLD_CONTACT]);
    expect(old.rows[0].must_change_password).toBe(true);
    const firm = await admin.query<{ must_change_password: boolean }>("SELECT must_change_password FROM app_user WHERE id = $1", [FIRM_USER]);
    expect(firm.rows[0].must_change_password).toBe(false);

    // the account is not locked out: the password they know opens the change
    currentUser = { user: { id: OLD_CONTACT, tenantId: TENANT, role: "client_user", locale: "fr", clientId } };
    await changeOwnPassword("Auditor-typed-1", "Their-Own-Secret-2026!", "Their-Own-Secret-2026!");
    const after = await admin.query<{ must_change_password: boolean }>("SELECT must_change_password FROM app_user WHERE id = $1", [OLD_CONTACT]);
    expect(after.rows[0].must_change_password).toBe(false);
    currentUser = { user: { id: FIRM_USER, tenantId: TENANT, role: "firm_admin", locale: "en", clientId: null } };
  });

  it("holds a flagged session on /change-password before any portal rule", () => {
    const proxy = readFileSync("proxy.ts", "utf8");
    expect(proxy.indexOf("mustChangePassword")).toBeGreaterThan(-1);
    expect(proxy.indexOf("mustChangePassword")).toBeLessThan(proxy.indexOf("ownPortalAction"));
  });
});

describe("F072 — the edge cannot rewrite signed-in pages", () => {
  it("sends no-transform on signed-in page navigations, not on the API", () => {
    const proxy = readFileSync("proxy.ts", "utf8");
    expect(proxy).toContain("no-transform");
    expect(proxy).toMatch(/req\.auth && isPageNavigation/);
  });
});
