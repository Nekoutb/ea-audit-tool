import pg from "pg";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b1b1";
const USER = "b1b1b1b1-b1b1-4b1b-8b1b-b1b1b1b1b101";

let currentRole = "firm_admin";

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: USER, tenantId: TENANT, role: currentRole, locale: "en" },
  })),
}));

import {
  accentCss,
  accentShades,
  ACCENT_SHADES,
  DEFAULT_ACCENT,
  getBranding,
  letterheadFooter,
  letterheadParagraphs,
  updateBranding,
} from "@/lib/branding";
import { closePool } from "@/lib/db";
import { createEngagement } from "@/lib/engagements";
import { generateLetter } from "@/lib/letters";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = $1", [USER]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id, name, slug) VALUES ($1, 'Brand Firm', 'brand-test')", [TENANT]);
  await admin.query(
    "INSERT INTO app_user (id, email, name, password_hash) VALUES ($1, 'brand@test.local', 'Brand Tester', 'x')",
    [USER],
  );
  await admin.query("INSERT INTO membership (user_id, tenant_id, role) VALUES ($1, $2, 'firm_admin')", [USER, TENANT]);
}, 30_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

function luminance(hex: string): number {
  return (
    parseInt(hex.slice(1, 3), 16) * 0.299 +
    parseInt(hex.slice(3, 5), 16) * 0.587 +
    parseInt(hex.slice(5, 7), 16) * 0.114
  );
}

describe("accent → shade scale", () => {
  it("uses the accent verbatim as the 700 shade and darkens monotonically", () => {
    const scale = accentShades("#7C3AED");
    expect(scale[700]).toBe("#7c3aed");
    for (let index = 1; index < ACCENT_SHADES.length; index += 1) {
      const lighter = scale[ACCENT_SHADES[index - 1]];
      const darker = scale[ACCENT_SHADES[index]];
      expect(luminance(lighter)).toBeGreaterThan(luminance(darker));
    }
    for (const shade of ACCENT_SHADES) expect(scale[shade]).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("rejects malformed colours", () => {
    expect(() => accentShades("purple")).toThrow("invalid-color");
    expect(() => accentShades("#12345")).toThrow("invalid-color");
    expect(() => accentShades("#12345g")).toThrow("invalid-color");
  });

  it("emits a :root override for every emerald variable", () => {
    const css = accentCss("#1f6b56");
    expect(css).toContain(":root {");
    expect(css).toContain("--color-emerald-700: #1f6b56;");
    for (const shade of ACCENT_SHADES) expect(css).toContain(`--color-emerald-${shade}:`);
  });
});

describe("branding model", () => {
  it("defaults the display name to the tenant name", async () => {
    const branding = await getBranding();
    expect(branding.displayName).toBe("Brand Firm");
    expect(branding.accent).toBeNull();
    expect(branding.logo).toBeNull();
  });

  it("firm_admin updates; values round-trip merged with defaults", async () => {
    await updateBranding({
      displayName: "Cabinet FOKO & Associés",
      accent: "#7c3aed",
      letterhead1: "Rue de la Réunification, BP 1234",
      letterhead2: "Douala, Cameroun",
      footer: "Inscrit au tableau de l'ONECCA",
    });
    const branding = await getBranding();
    expect(branding.displayName).toBe("Cabinet FOKO & Associés");
    expect(branding.accent).toBe("#7c3aed");
    expect(branding.letterhead1).toContain("Réunification");
    expect(branding.footer).toContain("ONECCA");
  });

  it("partial updates keep other fields; empty accent resets to default", async () => {
    await updateBranding({ accent: "" });
    const branding = await getBranding();
    expect(branding.accent).toBeNull();
    expect(branding.displayName).toBe("Cabinet FOKO & Associés"); // untouched
  });

  it("normalizes the platform-default accent back to null (untouched picker)", async () => {
    await updateBranding({ accent: DEFAULT_ACCENT.toUpperCase() });
    expect((await getBranding()).accent).toBeNull();
    await updateBranding({ accent: "#7C3AED" }); // stored lowercased
    expect((await getBranding()).accent).toBe("#7c3aed");
    await updateBranding({ accent: "" });
  });

  it("validates colour, logo and text lengths", async () => {
    await expect(updateBranding({ accent: "red" })).rejects.toThrow("invalid-color");
    await expect(updateBranding({ logo: "data:image/svg+xml;base64,AAAA" })).rejects.toThrow("invalid-logo-type");
    await expect(
      updateBranding({ logo: `data:image/png;base64,${"A".repeat(300_000)}` }),
    ).rejects.toThrow("logo-too-large");
    await expect(updateBranding({ displayName: "x".repeat(200) })).rejects.toThrow("text-too-long");
  });

  it("refuses non-admin writes", async () => {
    currentRole = "partner";
    await expect(updateBranding({ displayName: "Nope" })).rejects.toThrow("forbidden");
    currentRole = "firm_admin";
  });
});

describe("letterhead block", () => {
  it("builds name + address lines and the footer only when configured", async () => {
    const branding = await getBranding();
    const head = letterheadParagraphs(branding);
    expect(head.length).toBe(4); // name + 2 address lines + spacer
    expect(letterheadFooter(branding).length).toBe(1);
    expect(letterheadFooter({ ...branding, footer: "" }).length).toBe(0);
  });

  it("branded letters still produce a valid .docx", async () => {
    const client = await admin.query<{ id: string }>(
      "INSERT INTO client (tenant_id, name, legal_form) VALUES ($1, 'Brand SA', 'SA') RETURNING id",
      [TENANT],
    );
    const engagementId = await createEngagement({
      clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31",
    });
    const documentId = await generateLetter(engagementId, "engagement", "fr");
    const content = await admin.query<{ content: Buffer }>(
      "SELECT content FROM document_version WHERE document_id = $1",
      [documentId],
    );
    expect(content.rows[0].content.subarray(0, 2).toString("latin1")).toBe("PK");
  });
});
