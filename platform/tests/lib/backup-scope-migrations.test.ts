import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  BY_MEMBERSHIP,
  NOT_BACKED_UP,
  REFERENCE,
  TENANT_ROW,
} from "@/lib/backup/scope.mjs";

// The companion of tests/lib/backup-scope.test.ts, reading the migrations
// instead of a live database.
//
// `classify()` sorts the tables it finds in `information_schema`, so it only
// ever sees what the database it is pointed at happens to contain. A developer
// whose database is behind on migrations gets a clean pass on a table they just
// added — which is exactly what happened with public_holiday: it was added in
// 20260909000002, the local database never had it applied, the suite reported
// 598 green, and CI failed on the same guard a push later.
//
// This reads the migration files, so it needs no database and cannot be fooled
// by a stale one. It fails the moment a migration adds a table nothing will back
// up, which is while the migration is still being written.

const MIGRATIONS = path.resolve(__dirname, "../../migrations");

interface CreatedTable {
  table: string;
  file: string;
  body: string;
}

/** The forward half of a migration, comments stripped so they cannot match. */
function upMigration(sql: string): string {
  const down = sql.indexOf("-- Down Migration");
  return (down < 0 ? sql : sql.slice(0, down)).replace(/--[^\n]*/g, "");
}

/** Everything between the parentheses of a CREATE TABLE, nesting included. */
function tableBody(sql: string, openParen: number): string {
  let depth = 0;
  for (let i = openParen; i < sql.length; i += 1) {
    if (sql[i] === "(") depth += 1;
    else if (sql[i] === ")") {
      depth -= 1;
      if (depth === 0) return sql.slice(openParen, i + 1);
    }
  }
  return sql.slice(openParen);
}

function readMigrations() {
  const created = new Map<string, CreatedTable>();
  const dropped = new Set<string>();
  const gainedTenant = new Set<string>();

  for (const file of readdirSync(MIGRATIONS).sort()) {
    if (!file.endsWith(".sql")) continue;
    const sql = upMigration(readFileSync(path.join(MIGRATIONS, file), "utf8"));

    const create = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*\(/gi;
    let m: RegExpExecArray | null;
    while ((m = create.exec(sql))) {
      created.set(m[1], { table: m[1], file, body: tableBody(sql, create.lastIndex - 1) });
    }
    for (const d of sql.matchAll(/DROP\s+TABLE\s+(?:IF\s+EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)/gi)) {
      dropped.add(d[1]);
    }
    // A table may be created first and scoped later.
    for (const a of sql.matchAll(
      /ALTER\s+TABLE\s+(?:IF\s+EXISTS\s+)?([A-Za-z_][A-Za-z0-9_]*)[\s\S]{0,200}?ADD\s+COLUMN[\s\S]{0,80}?tenant_id/gi,
    )) {
      gainedTenant.add(a[1]);
    }
  }
  return { created, dropped, gainedTenant };
}

const NAMED = new Set<string>([
  ...Object.keys(BY_MEMBERSHIP),
  ...Object.keys(TENANT_ROW),
  ...REFERENCE,
  ...Object.keys(NOT_BACKED_UP),
]);

describe("backup scope, read from the migrations", () => {
  const { created, dropped, gainedTenant } = readMigrations();

  it("reads the migration history", () => {
    // If the parsing ever breaks, every assertion below passes vacuously.
    expect(created.size).toBeGreaterThan(50);
    expect(created.has("engagement")).toBe(true);
    expect(created.has("public_holiday")).toBe(true);
  });

  it("every table a migration creates is tenant-scoped or classified", () => {
    const undecided: string[] = [];
    for (const [table, { file, body }] of created) {
      if (dropped.has(table)) continue; // created and later removed
      if (/\btenant_id\b/.test(body) || gainedTenant.has(table)) continue; // scoped by its own column
      if (NAMED.has(table)) continue; // named in one of the three sets
      undecided.push(`${table} (added in ${file})`);
    }
    // Naming it in BY_MEMBERSHIP, REFERENCE or NOT_BACKED_UP is a decision about
    // whether a firm's data survives a restore. Leaving it out is not.
    expect(undecided).toEqual([]);
  });

  it("classifies nothing that no longer exists", () => {
    // A stale name in one of the sets is a quieter bug: it suggests a decision
    // was taken about a table that has since gone, and hides the next one.
    //
    // pgmigrations is the exception, and the only one: node-pg-migrate creates
    // its own bookkeeping table, so it appears in no migration yet is a real
    // table the classifier must still account for.
    const NOT_FROM_A_MIGRATION = new Set(["pgmigrations"]);
    const stale = [...NAMED].filter(
      (table) => !NOT_FROM_A_MIGRATION.has(table) && !created.has(table) && !dropped.has(table),
    );
    expect(stale).toEqual([]);
  });
});
