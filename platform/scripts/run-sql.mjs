// Runs a .sql file against the database as the owner role (DATABASE_URL).
// Used for the RLS bootstrap and app-role scripts, which are plain SQL rather
// than tracked migrations. Avoids a psql-on-PATH dependency (works in CI too).
//
// Secrets are never written into those files. Where a script needs one it reads
// a session setting, which is established here from the environment before the
// file runs -- see db/create-app-role.sql.
//
// Usage: node scripts/run-sql.mjs <path-to-sql-file>
//   APP_ROLE_PASSWORD=<secret> node scripts/run-sql.mjs db/create-app-role.sql

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
  // set_config with a bind parameter keeps the secret out of the statement text
  // (and therefore out of pg_stat_activity and any statement log).
  if (process.env.APP_ROLE_PASSWORD) {
    await client.query("SELECT set_config('ea.app_password', $1, false)", [process.env.APP_ROLE_PASSWORD]);
  }
  await client.query(sql);
  console.log(`Applied ${file}`);
} catch (error) {
  console.error(`Failed to apply ${file}:`, error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
