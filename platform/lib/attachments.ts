// Task attachments: files uploaded against a task, versioned by filename.
// Re-uploading a name creates the next version — the edit-locally watcher
// records each local save this way. Reads and writes run under the tenant RLS
// context like every other tenant-scoped table.
//
// Evidence rules (assurance finding C1). Attachments are audit evidence, so:
//   * removal is a SOFT delete (deleted_at/deleted_by), never a DELETE;
//   * removal needs manager-level authority and an unarchived engagement;
//   * removal and restore are both written to the activity log;
//   * a removed document can be restored for 30 days.
// Every read path below filters deleted_at IS NULL so a soft-deleted document
// is invisible to list, get and download alike.

import { recordActivity } from "@/lib/activity";
import { withTenant } from "@/lib/db";
import { assertMutable } from "@/lib/mutability";
import { atLeast, type Role } from "@/lib/rbac";
import { requireTenant } from "@/lib/tenant";

/** Days a soft-deleted attachment stays restorable. */
export const RESTORE_WINDOW_DAYS = 30;

export class AttachmentPermissionError extends Error {
  constructor() {
    super("forbidden");
    this.name = "AttachmentPermissionError";
  }
}

/** Removing or restoring evidence is a manager-and-above act. */
function assertCanDelete(role: Role): void {
  if (!atLeast(role, "manager")) throw new AttachmentPermissionError();
}

/** Uploading/renaming evidence: any audit team member, never read-only or portal. */
function assertCanWrite(role: Role): void {
  if (!atLeast(role, "staff")) throw new AttachmentPermissionError();
}

export interface AttachmentRow {
  id: string;
  name: string;
  mime: string;
  sizeBytes: number;
  version: number;
  uploadedBy: string;
  uploadedAt: string;
}

/** Latest live version of each filename on the task, newest upload first. */
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
          AND a.deleted_at IS NULL
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
  const { tenantId, userId, role } = await requireTenant();
  assertCanWrite(role);
  return withTenant(tenantId, async (tx) => {
    const item = await tx.query<{ engagement_id: string }>(
      "SELECT engagement_id FROM file_item WHERE id = $1",
      [fileItemId],
    );
    if (item.rows.length === 0) throw new Error("task-not-found");
    const engagementId = item.rows[0].engagement_id;
    // max(version) deliberately ignores deleted_at: numbering keeps climbing
    // past a removed chain so a re-upload can never collide with it.
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

/** One live attachment with its bytes, for download. RLS scopes the read. */
export async function getAttachment(
  id: string,
): Promise<{ name: string; mime: string; content: Buffer } | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ name: string; mime: string; content: Buffer }>(
      "SELECT name, mime, content FROM task_attachment WHERE id = $1 AND deleted_at IS NULL",
      [id],
    );
    return r.rows[0] ?? null;
  });
}

/**
 * Rename a document (every live version of it, so the chain stays intact). The
 * extension is preserved when the new name omits one. Refused on an archived
 * engagement and for read-only/portal accounts.
 */
export async function renameAttachment(id: string, newNameRaw: string): Promise<string> {
  const { tenantId, role } = await requireTenant();
  assertCanWrite(role);
  const target = await withTenant(tenantId, async (tx) => {
    const row = await tx.query<{
      file_item_id: string;
      engagement_id: string;
      name: string;
    }>(
      `SELECT file_item_id, engagement_id, name
         FROM task_attachment
        WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return row.rows[0] ?? null;
  });
  if (!target) throw new Error("not-found");
  await assertMutable(target.engagement_id);

  let next = newNameRaw.trim().replace(/[\/:*?"<>|]/g, "").slice(0, 120);
  if (!next) throw new Error("name-required");
  const oldExt = target.name.includes(".") ? target.name.slice(target.name.lastIndexOf(".")) : "";
  if (oldExt && !next.toLowerCase().endsWith(oldExt.toLowerCase())) next += oldExt;

  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `UPDATE task_attachment SET name = $3
        WHERE file_item_id = $1 AND name = $2 AND deleted_at IS NULL`,
      [target.file_item_id, target.name, next],
    );
  });
  await recordActivity({
    engagementId: target.engagement_id,
    entityType: "attachment",
    entityId: id,
    action: "renamed",
    summary: `${target.name} → ${next}`,
    meta: { fileItemId: target.file_item_id, from: target.name, to: next },
  });
  return next;
}

/**
 * Soft-delete a document and all its versions: the rows stay, stamped with who
 * removed them and when, and disappear from every read path. Restorable for
 * RESTORE_WINDOW_DAYS. Manager-level role, unarchived engagement, logged.
 */
export async function deleteAttachment(id: string): Promise<void> {
  const { tenantId, userId, role } = await requireTenant();
  assertCanDelete(role);
  const target = await withTenant(tenantId, async (tx) => {
    const row = await tx.query<{
      file_item_id: string;
      engagement_id: string;
      name: string;
    }>(
      `SELECT file_item_id, engagement_id, name
         FROM task_attachment
        WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    return row.rows[0] ?? null;
  });
  if (!target) throw new Error("not-found");
  await assertMutable(target.engagement_id);

  const versions = await withTenant(tenantId, async (tx) => {
    const r = await tx.query(
      `UPDATE task_attachment
          SET deleted_at = now(), deleted_by = $3
        WHERE file_item_id = $1 AND name = $2 AND deleted_at IS NULL`,
      [target.file_item_id, target.name, userId],
    );
    return r.rowCount ?? 0;
  });

  await recordActivity({
    engagementId: target.engagement_id,
    entityType: "attachment",
    entityId: id,
    action: "deleted",
    summary: target.name,
    meta: {
      fileItemId: target.file_item_id,
      name: target.name,
      versions,
      restorableForDays: RESTORE_WINDOW_DAYS,
    },
  });
}

/**
 * Undo a soft delete inside the RESTORE_WINDOW_DAYS recovery window. Same
 * manager-level authority as the delete, and equally logged. Past the window
 * the rows stay in place but are no longer restorable from the application —
 * recovery becomes a deliberate, out-of-band act.
 */
export async function restoreAttachment(attachmentId: string): Promise<void> {
  const { tenantId, role } = await requireTenant();
  assertCanDelete(role);
  const target = await withTenant(tenantId, async (tx) => {
    const row = await tx.query<{
      file_item_id: string;
      engagement_id: string;
      name: string;
      expired: boolean;
    }>(
      `SELECT file_item_id, engagement_id, name,
              deleted_at < now() - ($2::int * interval '1 day') AS expired
         FROM task_attachment
        WHERE id = $1 AND deleted_at IS NOT NULL`,
      [attachmentId, RESTORE_WINDOW_DAYS],
    );
    return row.rows[0] ?? null;
  });
  if (!target) throw new Error("not-found");
  if (target.expired) throw new Error("restore-window-expired");
  await assertMutable(target.engagement_id);

  const versions = await withTenant(tenantId, async (tx) => {
    const r = await tx.query(
      `UPDATE task_attachment
          SET deleted_at = NULL, deleted_by = NULL
        WHERE file_item_id = $1 AND name = $2 AND deleted_at IS NOT NULL
          AND deleted_at >= now() - ($3::int * interval '1 day')`,
      [target.file_item_id, target.name, RESTORE_WINDOW_DAYS],
    );
    return r.rowCount ?? 0;
  });

  await recordActivity({
    engagementId: target.engagement_id,
    entityType: "attachment",
    entityId: attachmentId,
    action: "restored",
    summary: target.name,
    meta: { fileItemId: target.file_item_id, name: target.name, versions },
  });
}

/**
 * The engagement's other attachments, offered by the "attach an existing
 * file" picker: latest live version per (task, name), excluding this task's
 * own files. Small projection — never the bytes.
 */
export async function listEngagementAttachments(fileItemId: string): Promise<
  { id: string; name: string; sizeBytes: number; taskCode: string; uploadedAt: string }[]
> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ id: string; name: string; size_bytes: number; code: string; uploaded_at: string }>(
      `SELECT DISTINCT ON (ta.file_item_id, ta.name)
              ta.id, ta.name, ta.size_bytes, fi.code,
              to_char(ta.uploaded_at, 'DD Mon YYYY') AS uploaded_at
         FROM task_attachment ta
         JOIN file_item fi ON fi.id = ta.file_item_id
        WHERE ta.engagement_id = (SELECT engagement_id FROM file_item WHERE id = $1)
          AND ta.file_item_id <> $1
          AND ta.deleted_at IS NULL
        ORDER BY ta.file_item_id, ta.name, ta.version DESC`,
      [fileItemId],
    );
    return r.rows.map((row) => ({
      id: row.id,
      name: row.name,
      sizeBytes: row.size_bytes,
      taskCode: row.code,
      uploadedAt: row.uploaded_at,
    }));
  });
}

/**
 * Attach a file that already lives on another task of the same engagement:
 * copies the referenced version's bytes as this task's next version of that
 * name. Same write gate and archive discipline as a fresh upload.
 */
export async function copyAttachment(fileItemId: string, sourceAttachmentId: string): Promise<AttachmentRow> {
  const { tenantId } = await requireTenant();
  const source = await withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ name: string; mime: string; content: Buffer; engagement_id: string }>(
      `SELECT ta.name, ta.mime, ta.content, ta.engagement_id
         FROM task_attachment ta WHERE ta.id = $1 AND ta.deleted_at IS NULL`,
      [sourceAttachmentId],
    );
    if (!r.rows[0]) throw new Error("task-not-found");
    const target = await tx.query<{ engagement_id: string }>(
      "SELECT engagement_id FROM file_item WHERE id = $1",
      [fileItemId],
    );
    // an attachment never crosses engagements — same wall as everything else
    if (!target.rows[0] || target.rows[0].engagement_id !== r.rows[0].engagement_id) {
      throw new Error("task-not-found");
    }
    return r.rows[0];
  });
  return saveAttachment(fileItemId, source.name, source.mime, source.content);
}
