import { createHash } from "node:crypto";
import { withTenant } from "@/lib/db";
import { canSeeEngagement } from "@/lib/engagement-access";
import { exportFileIndex } from "@/lib/exports";
import { ForbiddenError, requireTenant } from "@/lib/tenant";
import { ZipWriter, safeZipPath, zipSegment } from "@/lib/zip";

/**
 * The complete audit file as a streamed ZIP: what a regulator or a successor
 * auditor should receive.
 *
 * What existed before was a status index — one worksheet naming the tasks and
 * who signed them, with not one byte of a working paper in it. A successor
 * receiving that learns which tasks exist and cannot read any of them.
 *
 * Three constraints shape the implementation, all from the box this runs on:
 *
 *  - The Next process is capped at MemoryMax=1200M, and evidence lives in the
 *    database as bytea. node-pg returns bytea over the TEXT protocol, so a
 *    25 MB attachment arrives as a ~50 MB hex string before decoding — about
 *    75 MB transient. So artefacts are fetched ONE AT A TIME, by id, and never
 *    aggregated in SQL. A json_agg of content columns would be fatal.
 *  - statement_timeout is 30s and idle_in_transaction 60s, so an export lasting
 *    minutes cannot sit inside one transaction. Each artefact gets its own
 *    withTenant, which is also what sets the row-level-security GUC.
 *  - The stream is pull-based: the next artefact is fetched only when the
 *    consumer asks for more, so a slow client cannot make the producer buffer
 *    the whole file.
 */

export class ExportError extends Error {}

/** Rows the manifest lists, and the hashes SHA256SUMS records. */
interface Recorded {
  path: string;
  bytes: number;
  sha256: string;
}

export interface BundleInfo {
  filename: string;
  stream: ReadableStream<Uint8Array>;
}

const enc = (s: string) => new TextEncoder().encode(s);
const json = (v: unknown) => enc(JSON.stringify(v, null, 2) + "\n");
const sha = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

/** Extension for a stored artefact, from its recorded MIME. */
function extensionFor(mime: string, fallback = "bin"): string {
  const map: Record<string, string> = {
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/pdf": "pdf",
    "text/csv": "csv",
    "text/plain": "txt",
    "image/png": "png",
    "image/jpeg": "jpg",
  };
  return map[mime] ?? fallback;
}

/**
 * Build the bundle. Returns a stream that produces the archive as it is asked
 * for; nothing but the central directory and the running hash list is retained.
 */
export async function exportEngagementBundle(engagementId: string): Promise<BundleInfo> {
  const { tenantId } = await requireTenant();
  if (!(await canSeeEngagement(engagementId))) throw new ForbiddenError("not-on-this-engagement");

  // withTenant, not pool: engagement and client are under FORCE row-level
  // security, and without the tenant GUC set the query returns nothing at all —
  // which surfaced as a puzzling 404 rather than an error.
  const header = await withTenant(tenantId, (tx) => tx.query<{
    id: string; name: string | null; client: string; fiscal_year: number;
    period_end: string; report_date: string | null; opinion: string | null;
    phase: string; archived_at: string | null; retention_until: string | null;
    firm: string; slug: string;
  }>(
    `SELECT e.id, e.name, c.name AS client, e.fiscal_year,
            e.period_end::text, e.report_date::text, e.opinion, e.phase,
            e.archived_at::text, e.retention_until::text,
            t.name AS firm, t.slug
       FROM engagement e
       JOIN client c ON c.id = e.client_id
       JOIN tenant t ON t.id = e.tenant_id
      WHERE e.id = $1 AND e.tenant_id = $2`,
    [engagementId, tenantId],
  ));
  const eng = header.rows[0];
  if (!eng) throw new ExportError("not-found");

  const slug = (eng.client || "engagement").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const filename = `auditisa-export-${slug}-FY${eng.fiscal_year}-${engagementId.slice(0, 8)}.zip`;

  const writer = new ZipWriter();
  const recorded: Recorded[] = [];
  const stamp = eng.archived_at ? new Date(eng.archived_at) : new Date();

  /** Emit one entry: header, then bytes, recording its hash. */
  function* put(path: string, body: Uint8Array): Generator<Uint8Array> {
    const clean = safeZipPath(path);
    yield writer.entry(clean, body, stamp);
    yield body;
    recorded.push({ path: clean, bytes: body.length, sha256: sha(body) });
  }

  async function* produce(): AsyncGenerator<Uint8Array> {
    /* ---- 00-index ---------------------------------------------------- */
    yield* put("00-index/engagement.json", json({
      id: eng.id,
      name: eng.name,
      client: eng.client,
      firm: eng.firm,
      fiscalYear: eng.fiscal_year,
      periodEnd: eng.period_end,
      reportDate: eng.report_date,
      opinion: eng.opinion,
      phase: eng.phase,
      archivedAt: eng.archived_at,
      retentionUntil: eng.retention_until,
      // Stated plainly rather than left to inference: an unarchived file is a
      // point-in-time copy and its contents can still change.
      complete: eng.archived_at !== null,
    }));

    const index = await exportFileIndex(engagementId).catch(() => null);
    if (index) yield* put(`00-index/${index.filename}`, new Uint8Array(index.content));

    /* ---- 10-working-papers ------------------------------------------- */
    const items = await withTenant(tenantId, (tx) =>
      tx.query<{ id: string; code: string; title_en: string }>(
        "SELECT id, code, title_en FROM file_item WHERE engagement_id = $1 ORDER BY sort_order",
        [engagementId],
      ).then((r) => r.rows),
    );

    // The answers under wp:<code> ARE the working papers.
    const answers = await withTenant(tenantId, (tx) =>
      tx.query<{ code: string; field_key: string; value: unknown; updated_at: string }>(
        `SELECT code, field_key, value, updated_at::text
           FROM form_response WHERE engagement_id = $1 ORDER BY code, field_key`,
        [engagementId],
      ).then((r) => r.rows),
    );
    const byCode = new Map<string, Record<string, unknown>>();
    for (const a of answers) {
      const bucket = byCode.get(a.code) ?? {};
      bucket[a.field_key] = a.value;
      byCode.set(a.code, bucket);
    }

    const conclusions = await withTenant(tenantId, (tx) =>
      tx.query<{ file_item_id: string; conclusion: string | null; objectives_achieved: boolean | null }>(
        `SELECT file_item_id, conclusion, objectives_achieved
           FROM section_conclusion WHERE engagement_id = $1`,
        [engagementId],
      ).then((r) => r.rows),
    );
    const conclusionOf = new Map(conclusions.map((c) => [c.file_item_id, c]));

    for (const item of items) {
      const folder = `10-working-papers/${zipSegment(`${item.code} ${item.title_en}`)}`;
      const paper = byCode.get(item.code);
      if (paper) yield* put(`${folder}/paper.json`, json({ code: item.code, title: item.title_en, answers: paper }));
      const conclusion = conclusionOf.get(item.id);
      if (conclusion) yield* put(`${folder}/conclusion.json`, json(conclusion));
    }

    /* ---- documents, one version's bytes at a time -------------------- */
    const documents = await withTenant(tenantId, (tx) =>
      tx.query<{ id: string; title: string; kind: string; code: string | null }>(
        `SELECT d.id, d.title, d.kind, fi.code
           FROM document d LEFT JOIN file_item fi ON fi.id = d.file_item_id
          WHERE d.engagement_id = $1 ORDER BY d.title`,
        [engagementId],
      ).then((r) => r.rows),
    );

    for (const doc of documents) {
      const folder = `10-working-papers/${zipSegment(doc.code ?? "_unfiled")}/documents/${zipSegment(doc.title)}`;
      const versions = await withTenant(tenantId, (tx) =>
        tx.query<{ version_no: number; mime: string; sha256: string | null; byte_size: number; note: string | null; created_at: string }>(
          `SELECT version_no, mime, sha256, byte_size, note, created_at::text
             FROM document_version WHERE document_id = $1 ORDER BY version_no`,
          [doc.id],
        ).then((r) => r.rows),
      );
      if (versions.length === 0) continue;
      yield* put(`${folder}/versions.json`, json(versions));

      for (const v of versions) {
        // One artefact, one transaction, one buffer. Never aggregated.
        const bytes = await withTenant(tenantId, (tx) =>
          tx.query<{ content: Buffer }>(
            "SELECT content FROM document_version WHERE document_id = $1 AND version_no = $2",
            [doc.id, v.version_no],
          ).then((r) => r.rows[0]?.content ?? null),
        );
        if (bytes) yield* put(`${folder}/v${v.version_no}.${extensionFor(v.mime)}`, new Uint8Array(bytes));
      }
    }

    /* ---- attachments, including removed ones ------------------------- */
    const attachments = await withTenant(tenantId, (tx) =>
      tx.query<{ id: string; name: string; mime: string; version: number; deleted_at: string | null; code: string | null }>(
        `SELECT ta.id, ta.name, ta.mime, ta.version, ta.deleted_at::text, fi.code
           FROM task_attachment ta LEFT JOIN file_item fi ON fi.id = ta.file_item_id
          WHERE ta.engagement_id = $1 ORDER BY ta.name, ta.version`,
        [engagementId],
      ).then((r) => r.rows),
    );
    if (attachments.length > 0) {
      yield* put("10-working-papers/_attachments.json", json(attachments));
      for (const a of attachments) {
        // Removed evidence goes in _removed/ rather than being omitted: an
        // inspection asks what was taken out as often as what remains.
        const folder = a.deleted_at
          ? `10-working-papers/${zipSegment(a.code ?? "_unfiled")}/attachments/_removed`
          : `10-working-papers/${zipSegment(a.code ?? "_unfiled")}/attachments`;
        const bytes = await withTenant(tenantId, (tx) =>
          tx.query<{ content: Buffer }>("SELECT content FROM task_attachment WHERE id = $1", [a.id])
            .then((r) => r.rows[0]?.content ?? null),
        );
        if (bytes) yield* put(`${folder}/${zipSegment(`v${a.version} ${a.name}`)}`, new Uint8Array(bytes));
      }
    }

    /* ---- 60-conclusion ----------------------------------------------- */
    for (const [name, sql] of [
      ["risks", "SELECT * FROM risk WHERE engagement_id = $1"],
      ["misstatements", "SELECT * FROM misstatement WHERE engagement_id = $1"],
      ["findings", "SELECT * FROM finding WHERE engagement_id = $1"],
      ["confirmations", "SELECT * FROM confirmation WHERE engagement_id = $1"],
      ["materiality", "SELECT * FROM materiality WHERE engagement_id = $1 ORDER BY version_no"],
      ["completion", "SELECT key, data, done_at FROM completion_record WHERE engagement_id = $1"],
    ] as const) {
      const rows = await withTenant(tenantId, (tx) => tx.query(sql, [engagementId]).then((r) => r.rows));
      yield* put(`60-conclusion/${name}.json`, json(rows));
    }

    /* ---- 80-people ---------------------------------------------------- */
    const team = await withTenant(tenantId, (tx) =>
      tx.query(
        `SELECT coalesce(u.name, u.email) AS person, tm.team_role, tm.status, tm.created_at::text
           FROM team_member tm JOIN app_user u ON u.id = tm.user_id
          WHERE tm.engagement_id = $1`,
        [engagementId],
      ).then((r) => r.rows),
    );
    yield* put("80-people/team.json", json(team));

    const signoffs = await withTenant(tenantId, (tx) =>
      tx.query(
        `SELECT d.title AS document, sg.role, sg.version_no,
                coalesce(u.name, u.email) AS signed_by, sg.signed_at::text,
                sg.content_hash, sg.voided_at::text, sg.void_reason,
                sg.invalidated_at::text, sg.invalidated_reason
           FROM signoff sg
           JOIN document d ON d.id = sg.document_id
           LEFT JOIN app_user u ON u.id = sg.user_id
          WHERE d.engagement_id = $1 ORDER BY sg.signed_at`,
        [engagementId],
      ).then((r) => r.rows),
    );
    yield* put("80-people/signoffs.json", json(signoffs));

    /* ---- 70-audit-trail, one line per entry --------------------------- */
    const trail = await withTenant(tenantId, (tx) =>
      tx.query(
        `SELECT al.created_at, al.action, al.entity_type, al.entity_id, al.summary,
                al.acting_role, al.outcome, coalesce(u.name, u.email) AS actor
           FROM activity_log al LEFT JOIN app_user u ON u.id = al.user_id
          WHERE al.engagement_id = $1 ORDER BY al.created_at`,
        [engagementId],
      ).then((r) => r.rows),
    );
    yield* put("70-audit-trail/activity.jsonl", enc(trail.map((r) => JSON.stringify(r)).join("\n") + "\n"));

    /* ---- the inventory, last, because it describes everything above --- */
    const manifest = {
      format: "auditisa-export/1",
      generatedAt: new Date().toISOString(),
      engagement: { id: eng.id, client: eng.client, fiscalYear: eng.fiscal_year, reportDate: eng.report_date },
      complete: eng.archived_at !== null,
      entryCount: recorded.length,
      totalBytes: recorded.reduce((n, r) => n + r.bytes, 0),
      files: recorded,
    };
    yield* put("manifest.json", json(manifest));

    // coreutils-checkable: `sha256sum -c SHA256SUMS` in the extracted folder.
    const sums = recorded
      .filter((r) => r.path !== "SHA256SUMS")
      .map((r) => `${r.sha256}  ${r.path}`)
      .join("\n") + "\n";
    yield* put("SHA256SUMS", enc(sums));

    yield* put("README.txt", enc(readme(eng, recorded.length)));

    yield writer.finish();
  }

  const iterator = produce();
  const stream = new ReadableStream<Uint8Array>({
    // pull, not start: the next artefact is fetched only when the consumer asks
    // for it, so a slow reader cannot make this buffer the whole file.
    async pull(controller) {
      try {
        const { value, done } = await iterator.next();
        if (done) controller.close();
        else controller.enqueue(value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      // The client went away mid-download; stop querying for artefacts nobody
      // will receive.
      await iterator.return?.(undefined);
    },
  });

  return { filename, stream };
}

function readme(eng: { client: string; fiscal_year: number; report_date: string | null; archived_at: string | null }, count: number): string {
  return `AuditISA — audit file export
============================

Client        : ${eng.client}
Financial year: ${eng.fiscal_year}
Report date   : ${eng.report_date ?? "not issued"}
Archived      : ${eng.archived_at ?? "NOT ARCHIVED — see the warning below"}
Files         : ${count}

WHAT THIS IS
------------
The audit file as held by AuditISA: the working papers and their answers, every
version of every document as the exact bytes that were signed, the evidence
attached to each task, the conclusions, the sign-offs, and the activity trail.

Folders are numbered so their order follows the audit rather than the alphabet.
Removed evidence appears under "_removed" rather than being left out — what was
taken out of a file is as much a question as what remains.

VERIFYING IT
------------
Every file is listed in manifest.json with its SHA-256. From the extracted
folder:

    sha256sum -c SHA256SUMS

manifest.json also records the total and the file count. Nothing here is
signed: this archive proves internal consistency, not origin.

Documents are the stored bytes, never re-rendered at export time, so a hash in
signoffs.json can be compared against the version it was taken over.

${eng.archived_at ? "" : `WARNING
-------
This engagement is NOT archived. This is a point-in-time copy and the file can
still change. An export for a regulator or a successor auditor should be taken
after archiving, when the contents are frozen.
`}`;
}
