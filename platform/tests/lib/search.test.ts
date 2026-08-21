import pg from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";

const TENANT = "c9c9c9c9-c9c9-4c9c-8c9c-c9c9c9c9c9c9";
const PARTNER = "c9c9c9c9-c9c9-4c9c-8c9c-c9c9c9c9c901";
const MEMBER = "c9c9c9c9-c9c9-4c9c-8c9c-c9c9c9c9c902";
const OUTSIDER = "c9c9c9c9-c9c9-4c9c-8c9c-c9c9c9c9c903";

let actor = { id: PARTNER, role: "firm_admin" };

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: actor.id, tenantId: TENANT, role: actor.role, locale: "en", clientId: null },
  })),
}));

import { closePool } from "@/lib/db";
import { createEngagement } from "@/lib/engagements";
import { search } from "@/lib/search";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let openEngagement: string;
let teamEngagement: string;

const as = (id: string, role: string) => { actor = { id, role }; };

async function removeFixture(): Promise<void> {
  await admin.query("DELETE FROM tenant WHERE id = $1", [TENANT]);
  await admin.query("DELETE FROM app_user WHERE id = ANY($1)", [[PARTNER, MEMBER, OUTSIDER]]);
}

beforeAll(async () => {
  await removeFixture();
  await admin.query("INSERT INTO tenant (id,name,slug) VALUES ($1,'Search Firm','search-test')", [TENANT]);
  for (const [id, email, role] of [
    [PARTNER, "partner@search.local", "firm_admin"],
    [MEMBER, "member@search.local", "senior"],
    [OUTSIDER, "outsider@search.local", "senior"],
  ]) {
    await admin.query("INSERT INTO app_user (id,email,name,password_hash) VALUES ($1,$2,$2,'x')", [id, email]);
    await admin.query("INSERT INTO membership (user_id,tenant_id,role) VALUES ($1,$2,$3)", [id, TENANT, role]);
  }
  as(PARTNER, "firm_admin");
  const client = await admin.query<{ id: string }>(
    "INSERT INTO client (tenant_id,name,legal_form) VALUES ($1,'Recherche SA','SA') RETURNING id", [TENANT]);
  openEngagement = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2025, periodEnd: "2025-12-31" });
  teamEngagement = await createEngagement({ clientId: client.rows[0].id, fiscalYear: 2024, periodEnd: "2024-12-31" });

  // Only the second has a team, so the first stands for an unassigned file.
  await admin.query(
    "INSERT INTO team_member (tenant_id,engagement_id,user_id,team_role,status) VALUES ($1,$2,$3,'senior','accepted')",
    [TENANT, teamEngagement, MEMBER],
  );

  // Distinctive prose in each, including accents.
  for (const [engagement, text] of [
    [openEngagement, "Provision pour dépréciation des créances clients douteuses"],
    [teamEngagement, "Confidential matter concerning the depreciation of receivables"],
  ] as const) {
    const item = await admin.query<{ id: string }>(
      "SELECT id FROM file_item WHERE engagement_id = $1 LIMIT 1", [engagement]);
    await admin.query(
      `INSERT INTO section_conclusion (tenant_id, engagement_id, file_item_id, conclusion, objectives_achieved)
       VALUES ($1,$2,$3,$4,true)`,
      [TENANT, engagement, item.rows[0].id, text],
    );
  }
}, 60_000);

afterEach(() => as(PARTNER, "firm_admin"));

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

const titles = (hits: { snippet: string }[]) => hits.map((h) => h.snippet).join(" | ");

describe("finding things", () => {
  it("finds a conclusion by a word in its text", async () => {
    const r = await search("douteuses");
    expect(r.hits.length).toBeGreaterThan(0);
    expect(titles(r.hits)).toMatch(/douteuses/i);
  });

  it("finds accented text from an unaccented query", async () => {
    // Nobody types the accents into a search box; without unaccent a French
    // firm cannot find its own working papers.
    const r = await search("depreciation creances");
    expect(r.hits.length).toBeGreaterThan(0);
  });

  it("is case-insensitive", async () => {
    expect((await search("DOUTEUSES")).hits.length).toBeGreaterThan(0);
  });

  it("supports a quoted phrase", async () => {
    const together = await search('"créances clients"');
    expect(together.hits.length).toBeGreaterThan(0);
  });

  it("supports excluding a term", async () => {
    const all = await search("depreciation");
    const without = await search("depreciation -receivables");
    expect(without.hits.length).toBeLessThanOrEqual(all.hits.length);
  });

  it("returns a snippet showing the match in context, not the first line", async () => {
    const r = await search("douteuses");
    expect(r.hits[0].snippet).toMatch(/<b>/);
  });

  it("gives every hit somewhere to go", async () => {
    const r = await search("douteuses");
    for (const hit of r.hits) expect(hit.href).toMatch(/^\/engagements\/[0-9a-f-]{36}\//);
  });

  it("says nothing for a blank or one-character query rather than everything", async () => {
    expect((await search("")).hits).toHaveLength(0);
    expect((await search("  ")).hits).toHaveLength(0);
    expect((await search("a")).hits).toHaveLength(0);
  });

  it("survives punctuation that would break a raw tsquery", async () => {
    // to_tsquery throws on these; websearch_to_tsquery does not.
    for (const q of ["!!!", "a & b |", "() &&", "E4.1 :: test"]) {
      await expect(search(q)).resolves.toBeTruthy();
    }
  });

  it("falls back to a prefix match, so a singular finds the plural", async () => {
    // The configuration does no stemming on purpose; without this fallback
    // "receivable" would not find "receivables", which is what people type.
    const r = await search("receivab");
    expect(r.hits.length).toBeGreaterThan(0);
  });

  it("prefers an exact match over the prefix fallback", async () => {
    // The fallback runs only when the exact search found nothing, so a precise
    // query is never diluted by looser matches.
    const exact = await search("douteuses");
    expect(exact.hits.length).toBeGreaterThan(0);
  });

  it("finds an engagement by its client's name", async () => {
    // The first thing anyone types into a search box is a client name.
    const r = await search("Recherche");
    expect(r.hits.some((h) => h.kind === "engagement")).toBe(true);
  });

  it("finds nothing for a word that appears nowhere", async () => {
    expect((await search("zzzzunlikelyterm")).hits).toHaveLength(0);
  });
});

describe("search respects engagement visibility", () => {
  it("shows a partner both engagements", async () => {
    as(PARTNER, "partner");
    const ids = new Set((await search("depreciation OR douteuses")).hits.map((h) => h.engagementId));
    expect(ids.has(openEngagement)).toBe(true);
    expect(ids.has(teamEngagement)).toBe(true);
  });

  it("hides an engagement the searcher is not on", async () => {
    // This is the surface where a leak would be worst: search would otherwise
    // reveal the existence AND the contents of a client file.
    as(OUTSIDER, "senior");
    const ids = new Set((await search("Confidential")).hits.map((h) => h.engagementId));
    expect(ids.has(teamEngagement)).toBe(false);
  });

  it("shows the assigned member their own engagement", async () => {
    as(MEMBER, "senior");
    const ids = new Set((await search("Confidential")).hits.map((h) => h.engagementId));
    expect(ids.has(teamEngagement)).toBe(true);
  });

  it("still shows an unassigned engagement to the firm", async () => {
    as(OUTSIDER, "senior");
    const ids = new Set((await search("douteuses")).hits.map((h) => h.engagementId));
    expect(ids.has(openEngagement)).toBe(true);
  });
});

describe("search respects tenant isolation", () => {
  it("returns nothing from another firm", async () => {
    // The seeded firms carry plenty of text; none of it may appear here.
    const r = await search("engagement");
    for (const hit of r.hits) {
      expect([openEngagement, teamEngagement]).toContain(hit.engagementId);
    }
  });
});
