// The manifest: what an object is, what it would restore, and whether it
// arrived intact.
//
// Two manifests exist for a reason. The PLAINTEXT one travels beside the
// encrypted object and hashes the *ciphertext*, so an operator can list a
// prefix, check integrity and answer "what would this put back?" without the
// decryption key. The counts and ids it carries are metadata, never content.
// The ENCRYPTED one carries the plaintext hashes and the row census, and is
// only readable by someone who could read the data anyway.
//
// The shape deliberately parallels the engagement export's manifest
// (format "auditisa-export/1", lib/export-bundle.ts) so an operator learns one
// convention, and SHA256SUMS is emitted in the same coreutils-checkable form.

import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";

export const MANIFEST_FORMAT = "auditisa-backup/1";

/** sha256 of a file, streamed — these run beside a 1200 MB-capped app. */
export async function hashFile(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

export function hashBuffer(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

/**
 * `sha256sum -c SHA256SUMS` must work with nothing but coreutils — no bespoke
 * verifier, no Node, on a rescue box that has neither.
 */
export function sha256sums(entries) {
  return entries.map((e) => `${e.sha256}  ${e.path}`).join("\n") + "\n";
}

/**
 * Which schema the object was taken at. A restore that loads these rows into a
 * differently-migrated database is the quiet way to corrupt a file, so the
 * restore tool refuses on a mismatch rather than trying to reconcile.
 */
export async function schemaState(client) {
  const { rows } = await client.query("SELECT name FROM pgmigrations ORDER BY id");
  const names = rows.map((r) => r.name);
  return {
    count: names.length,
    last: names.at(-1) ?? null,
    digest: hashBuffer(Buffer.from(names.join("\n"), "utf8")),
  };
}

/** Server identity, so an object found in three years explains its own origin. */
export async function sourceState(client, { releaseSha = null } = {}) {
  const { rows } = await client.query(
    `SELECT current_database() AS database,
            current_setting('server_version_num')::int AS server_version_num,
            current_setting('server_version') AS server_version,
            now() AS generated_at`,
  );
  return {
    database: rows[0].database,
    serverVersion: rows[0].server_version,
    serverVersionNum: rows[0].server_version_num,
    releaseSha,
    generatedAt: new Date(rows[0].generated_at).toISOString(),
  };
}

/** Read `<root>/current/RELEASE` if it exists — best effort, never fatal. */
export async function readReleaseSha(root) {
  try {
    return (await readFile(`${root}/current/RELEASE`, "utf8")).trim() || null;
  } catch {
    return null;
  }
}

/**
 * The human-facing half: what a restore of this object would put back. This is
 * the reason the plaintext manifest exists at all — an operator holding a key
 * they cannot decrypt still needs to know which object to fetch.
 */
export async function restoreCensus(client, { tenantId = null, engagementId = null }) {
  // One CTE naming the engagements in scope, so tenant and engagement scope
  // differ in exactly one predicate and every count below is written once.
  const { rows } = await client.query(
    `WITH scoped AS (
       SELECT e.id, e.client_id, e.archived_at
         FROM engagement e
        WHERE ($1::uuid IS NULL OR e.tenant_id = $1)
          AND ($2::uuid IS NULL OR e.id = $2)
     )
     SELECT
       (SELECT count(DISTINCT client_id) FROM scoped) AS clients,
       (SELECT count(*) FROM scoped) AS engagements,
       (SELECT count(*) FROM scoped WHERE archived_at IS NOT NULL) AS archived,
       (SELECT count(*) FROM document d JOIN scoped s ON s.id = d.engagement_id) AS documents,
       (SELECT count(*) FROM document_version v JOIN document d ON d.id = v.document_id
          JOIN scoped s ON s.id = d.engagement_id) AS document_versions,
       (SELECT count(*) FROM task_attachment a JOIN scoped s ON s.id = a.engagement_id) AS attachments,
       (SELECT count(*) FROM evidence ev JOIN scoped s ON s.id = ev.engagement_id) AS evidence,
       (SELECT count(*) FROM pbc_item p JOIN scoped s ON s.id = p.engagement_id) AS pbc_items,
       (SELECT count(*) FROM activity_log l JOIN scoped s ON s.id = l.engagement_id) AS activity_entries,
       (SELECT count(*) FROM legal_hold h JOIN scoped s ON s.id = h.engagement_id
         WHERE h.released_at IS NULL) AS active_legal_holds,
       (SELECT count(*) FROM membership m WHERE $1::uuid IS NOT NULL AND m.tenant_id = $1) AS people`,
    [tenantId, engagementId],
  );
  return Object.fromEntries(Object.entries(rows[0]).map(([k, v]) => [k, Number(v)]));
}

/** The archived files inside an object, with the dates that drive Object Lock. */
export async function archivedEngagements(client, { tenantId = null, engagementId = null }) {
  const { rows } = await client.query(
    `SELECT e.id, c.name AS client, e.fiscal_year, e.archived_at, e.retention_until,
            EXISTS (SELECT 1 FROM completion_record r
                     WHERE r.engagement_id = e.id AND r.key = 'archive_manifest') AS has_manifest,
            EXISTS (SELECT 1 FROM legal_hold h
                     WHERE h.engagement_id = e.id AND h.released_at IS NULL) AS under_legal_hold
       FROM engagement e JOIN client c ON c.id = e.client_id
      WHERE e.archived_at IS NOT NULL AND ($1::uuid IS NULL OR e.tenant_id = $1)
        AND ($2::uuid IS NULL OR e.id = $2)
      ORDER BY e.archived_at`,
    [tenantId, engagementId],
  );
  return rows.map((r) => ({
    id: r.id,
    client: r.client,
    fiscalYear: r.fiscal_year,
    archivedAt: r.archived_at ? new Date(r.archived_at).toISOString() : null,
    retentionUntil: r.retention_until
      ? new Date(r.retention_until).toISOString().slice(0, 10)
      : null,
    hasArchiveManifest: r.has_manifest,
    underLegalHold: r.under_legal_hold,
  }));
}

/** Assemble the plaintext manifest. `files` hash the ciphertext as uploaded. */
export function buildManifest({
  kind,
  runid,
  scope,
  source,
  schema,
  census,
  archived,
  files,
  keyId,
  consistency,
}) {
  return {
    format: MANIFEST_FORMAT,
    kind,
    runId: runid,
    keyId,
    generatedAt: new Date().toISOString(),
    consistency: consistency ?? "snapshot",
    scope,
    source,
    schema,
    restore: { wouldRestore: census, archivedEngagements: archived },
    files,
    entryCount: files.length,
    totalBytes: files.reduce((n, f) => n + f.bytes, 0),
  };
}
