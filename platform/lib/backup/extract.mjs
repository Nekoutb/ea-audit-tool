// Streaming row-level extraction, one scope at a time.
//
// Why COPY rather than SELECT: every uploaded Word, PowerPoint and PDF lives in
// a bytea column, and node-pg returns bytea over the TEXT protocol — a 25 MB
// attachment arrives as a ~50 MB hex string before decoding, about 75 MB
// transient (lib/export-bundle.ts:18-22 documents the same trap for the export
// bundle). COPY streams server-side and the client never materialises a row, so
// memory is flat regardless of how much evidence a firm has accumulated.
//
// Why CSV rather than FORMAT binary: bytea renders as \x<hex>, twice the bytes,
// which zstd gives back for free. In exchange the artefact is inspectable, and
// restorable across a major-version upgrade, and not welded to the exact column
// order and type OIDs of the day it was taken — the right trade for something
// that may be opened in 2036. Revisit per table above roughly 10 GB.
//
// Why its own client and not the pool: the app pool is capped at 10 connections
// with a 30-second statement_timeout baked into its client options
// (lib/db.ts:75-91). A backup must not compete for those, and a large COPY must
// not be killed by a timeout meant for web requests.

import { createWriteStream } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import pg from "pg";
import { to as copyTo } from "pg-copy-streams";
import { byteaColumns, engagementPlan, tenantPlan, uuidLiteral } from "./scope.mjs";
import {
  archivedEngagements,
  buildManifest,
  hashFile,
  restoreCensus,
  schemaState,
  sha256sums,
  sourceState,
} from "./manifest.mjs";

/**
 * A dedicated superuser connection. `postgres` is required, not preferred:
 * `ea_app` is RLS-bound by design, so an extract taken as that role would be
 * silently near-empty — the worst possible failure for a backup.
 */
export async function connect(connectionString = process.env.DATABASE_URL) {
  if (!connectionString)
    throw new Error("DATABASE_URL must be set (the owner/superuser connection)");
  const client = new pg.Client({
    connectionString,
    application_name: process.env.PG_APPLICATION_NAME || "ea-audit-backup",
    // Deliberately unbounded: these are long, single-purpose, off-peak reads.
    statement_timeout: 0,
    idle_in_transaction_session_timeout: 0,
  });
  await client.connect();
  return client;
}

/**
 * The columns worth carrying. Generated columns (`search_vector` and friends)
 * are excluded: PostgreSQL refuses to COPY into one, so including it would
 * produce an extract that cannot be restored — and the database recomputes it
 * from the columns that are here anyway.
 */
async function columnsOf(client, table) {
  const { rows } = await client.query(
    `SELECT a.attname AS name, format_type(a.atttypid, a.atttypmod) AS type, a.attnotnull AS notnull
       FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
       JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1 AND a.attnum > 0 AND NOT a.attisdropped
        AND a.attgenerated = ''
      ORDER BY a.attnum`,
    [table],
  );
  return rows;
}

/**
 * One table's rows, streamed to `<dir>/data/<table>.csv`.
 *
 * `redact` nulls named columns in the projection rather than after the fact, so
 * a secret never leaves the server at all.
 */
async function copyTable(client, dir, { table, where, redact = [], viaParent = null }) {
  const cols = await columnsOf(client, table);
  const projection = cols
    .map((c) => (redact.includes(c.name) ? `NULL::${c.type} AS "${c.name}"` : `t."${c.name}"`))
    .join(", ");
  const predicate = where("t");
  const sql = `COPY (SELECT ${projection} FROM "${table}" t WHERE ${predicate}) TO STDOUT (FORMAT csv, HEADER true)`;
  const file = path.join(dir, "data", `${table}.csv`);
  await pipeline(client.query(copyTo(sql)), createWriteStream(file));
  const { rows } = await client.query(
    `SELECT count(*)::bigint AS n FROM "${table}" t WHERE ${predicate}`,
  );
  return {
    table,
    rows: Number(rows[0].n),
    // The predicate travels with the record so a verification can count exactly
    // what was taken. Counting the whole table only works in an empty scratch
    // database; a restore into a cluster still serving other firms would look
    // wrong for a reason that has nothing to do with the restore. It holds ids,
    // never a secret.
    where: predicate,
    columns: cols.map((c) => ({ name: c.name, type: c.type, notnull: c.notnull })),
    redacted: redact,
    format: "csv",
    viaParent,
  };
}

/**
 * Per-row content digests for the four bytea columns.
 *
 * This is what makes a restore verifiable at all. A row count proves nothing
 * about a file: a dump that restored every row with an empty blob would pass a
 * count check and lose every working paper. Computed in the database so the
 * bytes never cross the wire.
 */
async function byteaDigests(client, dir, plan) {
  const wanted = await byteaColumns(client);
  const inScope = wanted.filter((w) => plan.some((p) => p.table === w.table));
  const out = {};
  for (const { table, column } of inScope) {
    const where = plan.find((p) => p.table === table).where("t");
    const { rows } = await client.query(
      `SELECT t.id::text AS id,
              octet_length(t."${column}") AS bytes,
              encode(sha256(t."${column}"), 'hex') AS sha256
         FROM "${table}" t
        WHERE ${where} AND t."${column}" IS NOT NULL
        ORDER BY t.id`,
    );
    out[`${table}.${column}`] = rows;
    await writeFile(
      path.join(dir, "digests", `${table}.${column}.json`),
      JSON.stringify({ table, column, where, rows }, null, 2),
      "utf8",
    );
  }
  return out;
}

/**
 * Foreign keys pointing outside the extract. Reported, never silently repaired:
 * widening the query to pull a missing parent in is how another firm's app_user
 * row ends up inside this firm's object. The restorer decides what to do, and
 * most such keys are ON DELETE SET NULL anyway.
 */
async function referentialGaps(client, plan) {
  const tables = new Set(plan.map((p) => p.table));
  const { rows: fks } = await client.query(
    `SELECT con.conname, ch.relname AS child, pa.relname AS parent,
            (SELECT a.attname FROM pg_attribute a WHERE a.attrelid = con.conrelid AND a.attnum = con.conkey[1]) AS child_col,
            (SELECT a.attname FROM pg_attribute a WHERE a.attrelid = con.confrelid AND a.attnum = con.confkey[1]) AS parent_col
       FROM pg_constraint con
       JOIN pg_class ch ON ch.oid = con.conrelid
       JOIN pg_class pa ON pa.oid = con.confrelid
       JOIN pg_namespace n ON n.oid = ch.relnamespace
      WHERE con.contype = 'f' AND n.nspname = 'public' AND array_length(con.conkey, 1) = 1`,
  );
  const gaps = [];
  for (const fk of fks) {
    if (!tables.has(fk.child)) continue;
    const childWhere = plan.find((p) => p.table === fk.child).where("t");
    const parentEntry = plan.find((p) => p.table === fk.parent);
    const parentWhere = parentEntry ? parentEntry.where("t2") : "false";
    const { rows } = await client.query(
      `SELECT count(*)::bigint AS n FROM "${fk.child}" t
        WHERE ${childWhere} AND t."${fk.child_col}" IS NOT NULL
          AND NOT EXISTS (SELECT 1 FROM "${fk.parent}" t2
                           WHERE t2."${fk.parent_col}" = t."${fk.child_col}"
                             AND ${parentWhere})`,
    );
    const missing = Number(rows[0].n);
    if (missing > 0) {
      gaps.push({
        constraint: fk.conname,
        child: fk.child,
        column: fk.child_col,
        parent: fk.parent,
        missing,
      });
    }
  }
  return gaps;
}

/**
 * Extract one scope into `dir`. Everything runs inside a single REPEATABLE READ
 * READ ONLY transaction, so every table sees the same instant — a backup
 * stitched from several moments can be internally inconsistent in ways that only
 * surface during the restore, years later.
 */
export async function extract(
  client,
  dir,
  { tenantId = null, engagementId = null, credentials, keyId = null, releaseSha = null },
) {
  if (!tenantId && !engagementId) throw new Error("extract needs a tenantId or an engagementId");
  await mkdir(path.join(dir, "data"), { recursive: true });
  await mkdir(path.join(dir, "digests"), { recursive: true });
  await mkdir(path.join(dir, "schema"), { recursive: true });

  await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
  let result;
  try {
    const plan = tenantId
      ? await tenantPlan(client, tenantId, { credentials })
      : await engagementPlan(client, engagementId);

    const tables = [];
    for (const entry of plan) tables.push(await copyTable(client, dir, entry));

    const digests = await byteaDigests(client, dir, plan);
    const gaps = await referentialGaps(client, plan);
    const schema = await schemaState(client);
    const source = await sourceState(client, { releaseSha });
    const census = await restoreCensus(client, { tenantId, engagementId });
    const archived = await archivedEngagements(client, { tenantId, engagementId });

    const { rows: idRows } = await client.query(
      tenantId
        ? `SELECT t.name, t.slug, t.retention_years FROM tenant t WHERE t.id = ${uuidLiteral(tenantId)}`
        : `SELECT c.name, e.fiscal_year, e.tenant_id, e.archived_at
             FROM engagement e JOIN client c ON c.id = e.client_id
            WHERE e.id = ${uuidLiteral(engagementId)}`,
    );

    await writeFile(
      path.join(dir, "schema", "pgmigrations.json"),
      JSON.stringify(schema, null, 2),
      "utf8",
    );
    await writeFile(
      path.join(dir, "schema", "columns.json"),
      JSON.stringify(Object.fromEntries(tables.map((t) => [t.table, t.columns])), null, 2),
      "utf8",
    );
    await writeFile(
      path.join(dir, "integrity.json"),
      JSON.stringify({ gaps, digests: Object.keys(digests) }, null, 2),
      "utf8",
    );

    result = {
      identity: idRows[0] ?? null,
      tables,
      gaps,
      schema,
      source,
      census,
      archived,
      manifest: buildManifest({
        kind: tenantId ? "tenant-full" : "engagement",
        runid: null,
        keyId,
        scope: { tenantId, engagementId, credentials: credentials ?? null },
        source,
        schema,
        census,
        archived,
        files: [],
      }),
    };
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  }
  return result;
}

/** Hash every produced file and write SHA256SUMS, relative to `dir`. */
export async function sealDirectory(dir, relativePaths) {
  const entries = [];
  for (const rel of relativePaths.sort()) {
    entries.push({ path: rel, sha256: await hashFile(path.join(dir, rel)) });
  }
  await writeFile(path.join(dir, "SHA256SUMS"), sha256sums(entries), "utf8");
  return entries;
}
