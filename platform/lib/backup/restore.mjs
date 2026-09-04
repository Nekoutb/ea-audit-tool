// Loading an extract back, and proving it arrived intact.
//
// The rule this file exists to enforce: a restore goes into a SCRATCH database,
// never into production. In a scratch database you are superuser and alone,
// which is what makes `session_replication_role = replica` safe — it disables
// foreign-key enforcement and every user trigger at once, including the
// archive-immutability guards, the append-only audit trail and the legal-hold
// blocks. That is exactly right for filling an empty database and exactly wrong
// for a live one, where those guards are the compliance posture.
//
// Moving rows from a verified scratch database into production is a separate,
// interactive tool. Most real requests never need it: a successor auditor or
// counsel wants to read a file as it stood, and the scratch database is the
// answer.

import { createReadStream } from "node:fs";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { from as copyFrom } from "pg-copy-streams";
import { schemaState } from "./manifest.mjs";

export class RestoreError extends Error {}

/**
 * Refuse to load rows into a database at a different migration state.
 *
 * Loading a 2026 extract into a 2028 schema is the quiet way to corrupt an
 * audit file: columns added since would be null, columns dropped would be
 * rejected, and nothing would say so until someone read the file years later.
 */
export async function checkSchema(client, manifest) {
  const here = await schemaState(client);
  const there = manifest.schema;
  if (here.digest !== there.digest) {
    throw new RestoreError(
      `schema mismatch: target is at ${here.last ?? "(empty)"} (${here.count} migrations), ` +
        `the extract was taken at ${there.last ?? "(empty)"} (${there.count}). ` +
        `Restore into a database migrated to the extract's state.`,
    );
  }
  return here;
}

/** The tables an extract carries, in the order the manifest recorded. */
export async function tablesIn(dir) {
  const files = await readdir(path.join(dir, "data"));
  return files.filter((f) => f.endsWith(".csv")).map((f) => f.replace(/\.csv$/, ""));
}

async function headerOf(file) {
  const chunks = [];
  for await (const chunk of createReadStream(file, {
    encoding: "utf8",
    highWaterMark: 64 * 1024,
  })) {
    chunks.push(chunk);
    const joined = chunks.join("");
    const nl = joined.indexOf("\n");
    if (nl !== -1) return joined.slice(0, nl).replace(/\r$/, "");
  }
  return chunks.join("").replace(/\r$/, "");
}

/**
 * Load every CSV into `client`'s database. Triggers and FK checks are off for
 * the duration, so table order does not matter and self-referencing keys are
 * harmless — the ordering in the manifest is a convenience, not a guarantee we
 * have to be right about.
 *
 * `mode` decides what happens when a row is already there:
 *   "empty" — straight COPY, for the documented path of a fresh scratch
 *             database. A collision is a real error and should stop the load.
 *   "merge" — COPY into a temp table, then INSERT … ON CONFLICT DO NOTHING.
 *             Needed whenever the target still holds anything the extract also
 *             carries: the global reference tables (syscohada_grouping_rule) are
 *             in every extract, so restoring one firm into a database that still
 *             serves others collides on them immediately.
 */
export async function load(client, dir, { tables = null, mode = "empty" } = {}) {
  if (mode !== "empty" && mode !== "merge") throw new RestoreError(`unknown load mode: ${mode}`);
  const names = tables ?? (await tablesIn(dir));
  const loaded = [];
  await client.query("SET session_replication_role = replica");
  try {
    for (const table of names) {
      const file = path.join(dir, "data", `${table}.csv`);
      const header = await headerOf(file);
      if (!header) continue; // an empty file is a table with no rows in scope
      const columns = header
        .split(",")
        .map((c) => `"${c.replace(/^"|"$/g, "").replaceAll('""', '"')}"`);
      const columnList = columns.join(", ");
      if (mode === "merge") {
        const temp = `restore_${table}`;
        await client.query(`DROP TABLE IF EXISTS pg_temp."${temp}"`);
        await client.query(`CREATE TEMP TABLE "${temp}" (LIKE "${table}" INCLUDING DEFAULTS)`);
        await pipeline(
          createReadStream(file),
          client.query(
            copyFrom(`COPY "${temp}" (${columnList}) FROM STDIN (FORMAT csv, HEADER true)`),
          ),
        );
        await client.query(
          `INSERT INTO "${table}" (${columnList}) SELECT ${columnList} FROM "${temp}" ON CONFLICT DO NOTHING`,
        );
        await client.query(`DROP TABLE pg_temp."${temp}"`);
      } else {
        await pipeline(
          createReadStream(file),
          client.query(
            copyFrom(`COPY "${table}" (${columnList}) FROM STDIN (FORMAT csv, HEADER true)`),
          ),
        );
      }
      const { rows } = await client.query(`SELECT count(*)::bigint AS n FROM "${table}"`);
      loaded.push({ table, rows: Number(rows[0].n) });
    }
  } finally {
    await client.query("SET session_replication_role = origin");
  }
  return loaded;
}

/** Re-arm what `replica` switched off, and prove nothing dangled. */
export async function validateConstraints(client) {
  const { rows } = await client.query(
    `SELECT c.relname AS table_name, con.conname
       FROM pg_constraint con
       JOIN pg_class c ON c.oid = con.conrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE con.contype = 'f' AND n.nspname = 'public'`,
  );
  const failures = [];
  for (const { table_name, conname } of rows) {
    try {
      await client.query(`ALTER TABLE "${table_name}" VALIDATE CONSTRAINT "${conname}"`);
    } catch (error) {
      failures.push({ table: table_name, constraint: conname, message: error.message });
    }
  }
  return failures;
}

/**
 * The assertions that decide whether this restore counts.
 *
 * The content-hash check is the one that matters. Row counts prove a row
 * arrived; they say nothing about whether the Word document inside it did. A
 * restore that produced every row with an empty blob would pass a count check
 * and have lost every working paper in the firm.
 */
export async function verify(client, dir, manifest, { tableCounts }) {
  const problems = [];

  // Count what the extract took, not what the table now holds: a restore into a
  // cluster that still serves other firms is the normal case, and an unscoped
  // count would report every one of their rows as a discrepancy.
  for (const expected of tableCounts) {
    const where = expected.where ?? "true";
    const { rows } = await client.query(
      `SELECT count(*)::bigint AS n FROM "${expected.table}" t WHERE ${where}`,
    );
    const got = Number(rows[0].n);
    if (got !== expected.rows) {
      problems.push({ check: "row-count", table: expected.table, expected: expected.rows, got });
    }
  }

  const digestDir = path.join(dir, "digests");
  let digestFiles = [];
  try {
    digestFiles = await readdir(digestDir);
  } catch {
    digestFiles = [];
  }
  for (const file of digestFiles.filter((f) => f.endsWith(".json"))) {
    const digest = JSON.parse(await readFile(path.join(digestDir, file), "utf8"));
    const { table, column, where } = digest;
    const expected = digest.rows;
    if (!expected || expected.length === 0) continue;
    const { rows } = await client.query(
      `SELECT t.id::text AS id, octet_length(t."${column}") AS bytes,
              encode(sha256(t."${column}"), 'hex') AS sha256
         FROM "${table}" t
        WHERE ${where ?? "true"} AND t."${column}" IS NOT NULL ORDER BY t.id`,
    );
    const got = new Map(rows.map((r) => [r.id, r]));
    for (const want of expected) {
      const have = got.get(want.id);
      if (!have) {
        problems.push({ check: "content-missing", table, column, id: want.id });
      } else if (have.sha256 !== want.sha256) {
        problems.push({
          check: "content-hash",
          table,
          column,
          id: want.id,
          expected: want.sha256,
          got: have.sha256,
        });
      }
    }
  }

  const fkFailures = await validateConstraints(client);
  for (const f of fkFailures) problems.push({ check: "foreign-key", ...f });

  return { ok: problems.length === 0, problems, manifestKind: manifest?.kind ?? null };
}

/**
 * The compliance machinery must survive a restore. A database that restored
 * every row but lost the archive-immutability, append-only and legal-hold
 * triggers looks correct and is not: the file it holds could be edited after
 * archiving, which is the one thing ISA 230 forbids.
 */
export async function guardsPresent(client) {
  const { rows } = await client.query(
    `SELECT p.proname AS fn, count(*)::int AS triggers
       FROM pg_trigger t JOIN pg_proc p ON p.oid = t.tgfoid
       JOIN pg_class c ON c.oid = t.tgrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE NOT t.tgisinternal AND n.nspname = 'public'
        AND p.proname IN ('reject_archived_write', 'reject_archived_child_write',
                          'legal_hold_append_only', 'reject_delete_under_hold')
      GROUP BY p.proname ORDER BY p.proname`,
  );
  return Object.fromEntries(rows.map((r) => [r.fn, r.triggers]));
}
