// Task attachments: files uploaded against a task, versioned by filename.
// Re-uploading a name creates the next version — the edit-locally watcher
// records each local save this way. Reads and writes run under the tenant RLS
// context like every other tenant-scoped table.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export interface AttachmentRow {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  version: number;
  uploadedBy: string;
  uploadedAt: string;
}

/** Latest version of each filename on the task, newest upload first. */
export async function listAttachments(fileItemId: string): Promise<AttachmentRow[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{
      id: string;
      name: string;
      mime: string;
      size_bytes: number;
      version: number;
      uploaded_by_name: string;
      uploaded_at: string;
    }>(
      `SELECT DISTINCT ON (a.name)
              a.id, a.name, a.mime, a.size_bytes, a.version,
              coalesce(u.name, u.email) AS uploaded_by_name,
              to_char(a.uploaded_at, 'DD Mon YYYY HH24:MI') AS uploaded_at
         FROM task_attachment a
         JOIN app_user u ON u.id = a.uploaded_by
        WHERE a.file_item_id = $1
        ORDER BY a.name, a.version DESC`,
      [fileItemId],
    );
    return r.rows
      .map((row) => ({
        id: row.id,
        name: row.name,
        mime: row.mime,
        sizeBytes: row.size_bytes,
        version: row.version,
        uploadedBy: row.uploaded_by_name,
        uploadedAt: row.uploaded_at,
      }))
      .sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
  });
}

/** Store the next version of `name` on the task; returns the saved row. */
export async function saveAttachment(
  fileItemId: string,
  name: string,
  mime: string,
  content: Buffer,
): Promise<AttachmentRow> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const item = await tx.query<{ engagement_id: string }>(
      "SELECT engagement_id FROM file_item WHERE id = $1",
      [fileItemId],
    );
    if (item.rows.length === 0) throw new Error("task-not-found");
    const engagementId = item.rows[0].engagement_id;
    const r = await tx.query<{ id: string; version: number; uploaded_at: string }>(
      `INSERT INTO task_attachment
         (tenant_id, engagement_id, file_item_id, name, mime, size_bytes, version, content, uploaded_by)
       SELECT $1, $2, $3, $4, $5, $6,
              coalesce((SELECT max(version) FROM task_attachment
                         WHERE file_item_id = $3 AND name = $4), 0) + 1,
              $7, $8
       RETURNING id, version, to_char(uploaded_at, 'DD Mon YYYY HH24:MI') AS uploaded_at`,
      [tenantId, engagementId, fileItemId, name, mime, content.length, content, userId],
    );
    return {
      id: r.rows[0].id,
      name,
      mime,
      sizeBytes: content.length,
      version: r.rows[0].version,
      uploadedBy: "",
      uploadedAt: r.rows[0].uploaded_at,
    };
  });
}

/** One attachment with its bytes, for download. RLS scopes the read. */
export async function getAttachment(
  id: string,
): Promise<{ name: string; mime: string; content: Buffer } | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ name: string; mime: string; content: Buffer }>(
      "SELECT name, mime, content FROM task_attachment WHERE id = $1",
      [id],
    );
    return r.rows[0] ?? null;
  });
}

/**
 * Rename a document (every version of it, so the chain stays intact). The
 * extension is preserved when the new name omits one.
 */
export async function renameAttachment(id: string, newNameRaw: string): Promise<string> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const row = await tx.query<{ file_item_id: string; name: string }>(
      "SELECT file_item_id, name FROM task_attachment WHERE id = $1",
      [id],
    );
    if (!row.rows[0]) throw new Error("not-found");
    const { file_item_id, name } = row.rows[0];
    let next = newNameRaw.trim().replace(/[\/:*?"<>|]/g, "").slice(0, 120);
    if (!next) throw new Error("name-required");
    const oldExt = name.includes(".") ? name.slice(name.lastIndexOf(".")) : "";
    if (oldExt && !next.toLowerCase().endsWith(oldExt.toLowerCase())) next += oldExt;
    await tx.query(
      "UPDATE task_attachment SET name = $3 WHERE file_item_id = $1 AND name = $2",
      [file_item_id, name, next],
    );
    return next;
  });
}

/** Delete a document and all its versions from the task. */
export async function deleteAttachment(id: string): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    const row = await tx.query<{ file_item_id: string; name: string }>(
      "SELECT file_item_id, name FROM task_attachment WHERE id = $1",
      [id],
    );
    if (!row.rows[0]) throw new Error("not-found");
    await tx.query("DELETE FROM task_attachment WHERE file_item_id = $1 AND name = $2", [
      row.rows[0].file_item_id,
      row.rows[0].name,
    ]);
  });
}
