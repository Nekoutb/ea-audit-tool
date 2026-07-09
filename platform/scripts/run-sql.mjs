// Runs a .sql file against the database as the owner role (DATABASE_URL).
// Used for the RLS bootstrap and app-role scripts, which are plain SQL rather
// than tracked migrations. Avoids a psql-on-PATH dependency (works in CI too).
//
// Usage: node scripts/run-sql.mjs <path-to-sql-file>

import { readFileSync } from "node:fs";
import { config } from "dotenv";
import pg from "pg";

config();

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/run-sql.mjs <file.sql>");
  process.exit(1);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL must be set");
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
const client = new pg.Client({ connectionString });

try {
  await client.connect();
  await client.query(sql);
  console.log(`Applied ${file}`);
} catch (error) {
  console.error(`Failed to apply ${file}:`, error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
