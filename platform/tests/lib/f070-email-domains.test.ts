// F070 (firm decision 2026-10-27): engagement-team invitations only to the
// firm's allowed email domains; exact, case-insensitive; no subdomains; an
// empty list keeps today's behaviour; client portal contacts are exempt.

import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "f0700000-0000-4000-8000-000000000000";
const ADMIN = "f0700000-0000-4000-8000-000000000001";
const MANAGER = "f0700000-0000-4000-8000-000000000002";
const OFF_DOMAIN = "f0700000-0000-4000-8000-000000000003";

let actor = { id: ADMIN, role: "firm_admin" };

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: actor.id, tenantId: TENANT, role: actor.role, locale: "en", clientId: null },
  })),
}));

vi.mock("@/lib/locale", () => ({ getLocale: vi.fn(async () => "en") }));

import { closePool } from "@/lib/db";
import { emailDomain, emailDomainAllowed, getAllowedDomains, parseDomainList, setAllowedDomains } from "@/lib/email-domains";
import { createEngagement } from "@/lib/engagements";
import { addPortalContact } from "@/lib/pbc";
import { addTeamMemberByEmail, assignTeamMember, listTeam } from "@/lib/team";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const as = (id: string, role: string) => { actor = { id, role }; };
let engagementId: string;
let clientId: string;
const NEW_EMAILS = ["new.colleague@eca-cm.com", "free@any-domain.org", "client@client-sa.cm"];

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1) OR lower(email) = ANY($2)", [[ADMIN, MANAGER, OFF_DOMAIN], NEW_EMAILS]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Domain Firm', 'f070-test')", [TENANT]);
  for (const [id, email, role] of [
    [ADMIN, "admin@eca.com", "firm_admin"],
    [MANAGER, "manager@ECA.com", "manager"],
    [OFF_DOMAIN, "someone@gmail.com", "staff"],
  ]) {
    await admin.query("INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, $2, $2, 'x')", [id, email]);
    await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, $3)", [id, TENANT, role]);
  }
  as(ADMIN, "firm_admin");
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Domain SA', 'SA') RETURNING id",
    [TENANT],
  );
  clientId = client.rows[0].id;
  engagementId = await createEngagement({ clientId, fiscalYear: 2025, periodEnd: "2025-12-31", partnerId: ADMIN });
}, 60_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("the domain rule (pure)", () => {
  it("parses one or several domains, lower-cased and de-duplicated", () => {
    expect(parseDomainList("ECA.com\n@eca-cm.com, eca.com")).toEqual(["eca-cm.com", "eca.com"]);
    expect(parseDomainList("  ")).toEqual([]);
    expect(() => parseDomainList("not a domain!")).toThrow("invalid-email-domain");
  });

  it("matches exactly and ignores case; subdomains do not match", () => {
    const allowed = ["eca.com", "eca-cm.com"];
    expect(emailDomain("A.B@Eca.Com")).toBe("eca.com");
    expect(emailDomainAllowed("someone@ECA.COM", allowed)).toBe(true);
    expect(emailDomainAllowed("someone@eca-cm.com", allowed)).toBe(true);
    expect(emailDomainAllowed("someone@audit.eca.com", allowed)).toBe(false);
    expect(emailDomainAllowed("someone@eca.com.attacker.net", allowed)).toBe(false);
    expect(emailDomainAllowed("someone@gmail.com", allowed)).toBe(false);
    // an empty list keeps today's behaviour
    expect(emailDomainAllowed("someone@gmail.com", [])).toBe(true);
  });
});

describe("Settings: the firm's list (firm administrator)", () => {
  it("is set by the firm administrator only", async () => {
    as(MANAGER, "manager");
    await expect(setAllowedDomains("eca.com")).rejects.toThrow();
    as(ADMIN, "firm_admin");
    expect(await getAllowedDomains()).toEqual([]);
  });
});

describe("inviting into an engagement team", () => {
  it("with an empty list, any domain may still be invited (today's behaviour)", async () => {
    as(ADMIN, "firm_admin");
    await addTeamMemberByEmail(engagementId, "free@any-domain.org", "staff", "Domain SA 2025");
    expect((await listTeam(engagementId)).some((m) => m.email === "free@any-domain.org")).toBe(true);
  });

  it("refuses an address outside the list with email-domain-not-allowed, provisioning nothing", async () => {
    as(ADMIN, "firm_admin");
    expect(await setAllowedDomains("eca.com\neca-cm.com")).toEqual(["eca-cm.com", "eca.com"]);
    await expect(addTeamMemberByEmail(engagementId, "intruder@gmail.com", "staff", "Domain SA 2025")).rejects.toThrow(
      "email-domain-not-allowed",
    );
    await expect(addTeamMemberByEmail(engagementId, "x@audit.eca.com", "staff", "Domain SA 2025")).rejects.toThrow(
      "email-domain-not-allowed",
    );
    const provisioned = await admin.query("SELECT 1 FROM app_user WHERE lower(email) IN ('intruder@gmail.com', 'x@audit.eca.com')");
    expect(provisioned.rowCount).toBe(0);
  });

  it("refuses an existing firm user from another domain on the other team paths too", async () => {
    as(ADMIN, "firm_admin");
    await expect(assignTeamMember(engagementId, OFF_DOMAIN, "staff")).rejects.toThrow("email-domain-not-allowed");
  });

  it("an unknown address on an allowed domain still gets an account and an invitation", async () => {
    as(ADMIN, "firm_admin");
    await addTeamMemberByEmail(engagementId, "New.Colleague@ECA-CM.com", "staff", "Domain SA 2025", "New Colleague");
    const member = (await listTeam(engagementId)).find((m) => m.email === "new.colleague@eca-cm.com");
    expect(member?.status).toBe("invited");
    // an existing colleague on an allowed domain, whatever the case of the stored address
    await assignTeamMember(engagementId, MANAGER, "manager");
  });

  it("does not apply to client portal contacts", async () => {
    as(ADMIN, "firm_admin");
    const id = await addPortalContact(clientId, { email: "client@client-sa.cm", name: "Client Contact", password: "long-enough-1" });
    expect(id).toBeTruthy();
  });
});
