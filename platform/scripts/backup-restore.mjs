// Load an extract into a database and prove it arrived intact.
//
//   node scripts/backup-restore.mjs --dir <extract dir> --db <name> [--mode empty|merge]
//   node scripts/backup-restore.mjs --dir <extract dir> --db <name> --verify-only
//   node scripts/backup-restore.mjs --dir <extract dir> --check-schema --db <name>
//
// The target must be a SCRATCH database. This refuses to touch the production
// one by name, because `session_replication_role = replica` — which the load
// needs — switches off the archive-immutability, append-only and legal-hold
// triggers for the session. That is right in an empty database you own and
// catastrophic in a live one.

import { readFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import pg from "pg";
import { checkSchema, guardsPresent, load, verify } from "../lib/backup/restore.mjs";

config();

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (process.argv[i + 1] ?? true);
}
const flag = (name) => process.argv.includes(`--${name}`);

function die(message) {
  console.error(`backup-restore: ${message}`);
  process.exit(1);
}

const dir = arg("dir");
const db = arg("db");
if (!dir) die("--dir <extract dir> is required");
if (!db) die("--db <scratch database> is required");

// The refusal is by name and deliberately blunt. Anyone who genuinely wants to
// move rows into production uses the interactive merge tool, which remaps ids
// and never disables a trigger.
const PRODUCTION = new Set(["ea_audit", "postgres"]);
if (PRODUCTION.has(db) && !flag("verify-only")) {
  die(
    `refusing to load into "${db}". Restore into a scratch database, verify it, ` +
      `then move rows across with backup-merge.mjs if that is really what you want.`,
  );
}

const manifest = JSON.parse(await readFile(path.join(dir, "manifest.json"), "utf8"));
const base = process.env.DATABASE_URL;
if (!base) die("DATABASE_URL must be set");
const target = new URL(base);
target.pathname = `/${db}`;

const client = new pg.Client({ connectionString: target.toString(), statement_timeout: 0 });
await client.connect();
let failed = false;
try {
  await checkSchema(client, manifest);
  console.log(`schema matches: ${manifest.schema.last} (${manifest.schema.count} migrations)`);
  if (flag("check-schema")) process.exit(0);

  if (!flag("verify-only")) {
    const loaded = await load(client, dir, { mode: arg("mode", "empty") });
    console.log(`loaded ${loaded.length} table(s)`);
  }

  const report = await verify(client, dir, manifest, {
    tableCounts: manifest.tables.filter((t) => t.rows > 0),
  });
  const guards = await guardsPresent(client);
  console.log(
    `guards: ${
      Object.entries(guards)
        .map(([k, v]) => `${k}=${v}`)
        .join(" ") || "NONE"
    }`,
  );

  if (!report.ok) {
    failed = true;
    console.error(`FAILED with ${report.problems.length} problem(s):`);
    for (const p of report.problems.slice(0, 40)) console.error(`  ${JSON.stringify(p)}`);
    if (report.problems.length > 40) console.error(`  … and ${report.problems.length - 40} more`);
  } else {
    console.log(
      `OK — every row count and every content hash matched ` +
        `(${manifest.restore.wouldRestore.document_versions} document version(s), ` +
        `${manifest.restore.wouldRestore.attachments} attachment(s))`,
    );
  }
} finally {
  await client.end();
}
process.exit(failed ? 1 : 0);
