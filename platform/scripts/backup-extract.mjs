// Extract one firm, or one engagement, to a local directory.
//
//   node scripts/backup-extract.mjs --tenant <uuid>     --out <dir> --credentials include|redact
//   node scripts/backup-extract.mjs --engagement <uuid> --out <dir>
//   node scripts/backup-extract.mjs --all-tenants       --out <dir> --credentials include
//   node scripts/backup-extract.mjs --rolling           --out <dir>   (open engagements that changed)
//   node scripts/backup-extract.mjs --check             (classification only, no output)
//
// Runs as the owner/superuser connection (DATABASE_URL). It must: `ea_app` is
// RLS-bound, so an extract taken as the application role would be silently
// near-empty — the worst way for a backup to fail.
//
// Writes plaintext to `--out`. Compression, encryption and upload are the shell
// wrapper's job (deploy/ea-audit-backup-*.sh), so this stays testable and holds
// no secret.

import { mkdir, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "dotenv";
import { connect, extract, sealDirectory } from "../lib/backup/extract.mjs";
import { assertClassified, classify } from "../lib/backup/scope.mjs";
import { buildManifest, readReleaseSha } from "../lib/backup/manifest.mjs";
import { engagementRollingKey, runId, slugify, tenantFullKey } from "../lib/backup/keys.mjs";

config();

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : (process.argv[i + 1] ?? true);
}
const flag = (name) => process.argv.includes(`--${name}`);

function die(message) {
  console.error(`backup-extract: ${message}`);
  process.exit(1);
}

/** Every file the extract produced, relative to its directory. */
async function producedFiles(dir) {
  const out = [];
  for (const sub of ["data", "digests", "schema"]) {
    let names = [];
    try {
      names = await readdir(path.join(dir, sub));
    } catch {
      continue;
    }
    for (const name of names) out.push(`${sub}/${name}`);
  }
  out.push("integrity.json");
  return out;
}

async function writeScope(client, outRoot, options, label) {
  const dir = path.join(outRoot, label);
  await mkdir(dir, { recursive: true });
  const result = await extract(client, dir, options);
  const files = await sealDirectory(dir, await producedFiles(dir));
  const manifest = buildManifest({
    kind: options.tenantId ? "tenant-full" : "engagement",
    runid: options.runid,
    keyId: options.keyId,
    scope: {
      tenantId: options.tenantId,
      engagementId: options.engagementId,
      credentials: options.credentials ?? null,
      identity: result.identity,
    },
    source: result.source,
    schema: result.schema,
    census: result.census,
    archived: result.archived,
    files: files.map((f) => ({ ...f, bytes: 0 })),
  });
  manifest.tables = result.tables.map((t) => ({
    table: t.table,
    rows: t.rows,
    where: t.where,
    format: t.format,
  }));
  manifest.referentialGaps = result.gaps;
  await writeFile(path.join(dir, "manifest.json"), JSON.stringify(manifest, null, 2), "utf8");
  console.log(
    `${label}: ${result.tables.reduce((n, t) => n + t.rows, 0)} rows in ${result.tables.length} tables` +
      (result.gaps.length ? `, ${result.gaps.length} referential gap(s)` : ""),
  );
  return { dir, manifest, result };
}

const client = await connect();
try {
  if (flag("check")) {
    const c = await classify(client);
    await assertClassified(client);
    console.log(
      `tables=${c.tables.length} tenant-scoped=${c.tenantScoped.length} engagement-scoped=${c.engagementScoped.length} ` +
        `via-parent=${c.children.length} reference=${c.reference.length} excluded=${c.notBackedUp.length} unclassified=0`,
    );
    process.exit(0);
  }

  const outRoot = arg("out");
  if (!outRoot) die("--out <dir> is required");
  const credentials = arg("credentials");
  const releaseSha = await readReleaseSha(process.env.EA_RELEASE_ROOT || "/opt/ea-audit-prod");
  const keyId = process.env.EA_BACKUP_KEY_ID ?? null;
  const stamp = runId();

  if (arg("tenant")) {
    if (!credentials) die("--credentials include|redact is required for a tenant extract");
    const tenantId = arg("tenant");
    const { manifest } = await writeScope(
      client,
      outRoot,
      { tenantId, credentials, keyId, releaseSha, runid: stamp },
      slugify(tenantId),
    );
    console.log(
      tenantFullKey({
        tenantId,
        tenantName: manifest.scope.identity?.name ?? tenantId,
        runid: stamp,
      }),
    );
  } else if (arg("engagement")) {
    const engagementId = arg("engagement");
    const { manifest } = await writeScope(
      client,
      outRoot,
      { engagementId, keyId, releaseSha, runid: stamp },
      slugify(engagementId),
    );
    const id = manifest.scope.identity;
    console.log(
      engagementRollingKey({
        tenantId: id.tenant_id,
        engagementId,
        clientName: id.name,
        fiscalYear: id.fiscal_year,
        runid: stamp,
      }),
    );
  } else if (flag("all-tenants")) {
    if (!credentials) die("--credentials include|redact is required");
    const { rows } = await client.query("SELECT id, name FROM tenant ORDER BY created_at");
    for (const t of rows) {
      await writeScope(
        client,
        outRoot,
        { tenantId: t.id, credentials, keyId, releaseSha, runid: stamp },
        slugify(t.id),
      );
    }
    console.log(`${rows.length} firm(s) extracted`);
  } else if (flag("rolling")) {
    // Only files that moved. activity_log is append-only, so it cannot be
    // rewritten to hide a change — which makes it the honest change signal.
    const { rows } = await client.query(
      `SELECT e.id, e.tenant_id
         FROM engagement e
         LEFT JOIN activity_log al ON al.engagement_id = e.id
        WHERE e.archived_at IS NULL
        GROUP BY e.id
       HAVING greatest(coalesce(max(al.created_at), e.created_at), e.created_at) > coalesce($1::timestamptz, 'epoch')`,
      [arg("since", null)],
    );
    for (const e of rows) {
      await writeScope(
        client,
        outRoot,
        { engagementId: e.id, keyId, releaseSha, runid: stamp },
        slugify(e.id),
      );
    }
    console.log(`${rows.length} open engagement(s) changed`);
  } else {
    die("one of --tenant, --engagement, --all-tenants, --rolling or --check is required");
  }
} finally {
  await client.end();
}
