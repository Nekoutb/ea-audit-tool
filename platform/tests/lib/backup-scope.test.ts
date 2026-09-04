import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// The assertion db/rls.sql never had.
//
// That file carries a literal list of table names and a comment asking future
// phases to keep it current (db/rls.sql:17-18). Nobody did, and nobody noticed,
// because nothing failed when a table was missed. The backup has the same
// shape of risk with a worse consequence — a table nobody classified is a table
// that silently never gets backed up — so the classification is derived from
// the catalog and this test fails the build the moment a new table has no
// decided fate.

import { assertClassified, classify, uuidLiteral, NOT_BACKED_UP } from "@/lib/backup/scope.mjs";

const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let client: pg.PoolClient;

beforeAll(async () => {
  client = await admin.connect();
}, 60_000);

afterAll(async () => {
  client?.release();
  await admin.end();
});

describe("backup scope classification", () => {
  it("classifies every table in the schema", async () => {
    const { unclassified } = await classify(client);
    expect(unclassified).toEqual([]);
    await expect(assertClassified(client)).resolves.toBeUndefined();
  });

  it("covers the four columns that hold uploaded file bytes", async () => {
    const { tenantScoped, engagementScoped } = await classify(client);
    // Word, PowerPoint and PDF evidence lives in these and nowhere else.
    for (const table of ["document_version", "task_attachment", "evidence", "pbc_item"]) {
      const reachable =
        tenantScoped.includes(table) ||
        engagementScoped.includes(table) ||
        (await classify(client)).children.some((c) => c.table === table);
      expect(reachable, `${table} must be reachable by some scope`).toBe(true);
    }
  });

  it("reads the engagement child tables from the archive-lock triggers", async () => {
    const { children } = await classify(client);
    // Derived from pg_trigger, not restated — so it cannot drift from the guard.
    expect(children.length).toBeGreaterThan(0);
    const tables = children.map((c) => c.table);
    expect(tables).toContain("document_version");
    for (const c of children) {
      expect(c.lookup).toMatch(/\$1/);
      expect(c.column).toMatch(/^[a-z_][a-z0-9_]*$/);
    }
  });

  it("gives a reason for every table it declines to back up", () => {
    for (const [table, reason] of Object.entries(NOT_BACKED_UP)) {
      expect(reason, `${table} needs a reason, not just an exclusion`).toBeTruthy();
      expect(String(reason).length).toBeGreaterThan(20);
    }
  });

  it("refuses anything that is not a uuid, because the id becomes SQL text", () => {
    expect(uuidLiteral("6f9619ff-8b86-4d011-b42d-00c04fc964ff".replace("4d011", "4d01"))).toContain(
      "::uuid",
    );
    for (const bad of ["", "1; DROP TABLE tenant", "not-a-uuid", null, undefined, 42]) {
      // @ts-expect-error deliberately wrong types
      expect(() => uuidLiteral(bad)).toThrow(/not a uuid/);
    }
  });
});
