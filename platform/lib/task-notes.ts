// Review notes raised on a task. A note is addressed to the task's assignee
// (or to whoever is named), so it also appears on that person's dashboard
// under Review notes. Notes are cleared, never deleted — the trail stays.

import { withTenant } from "@/lib/db";
import { atLeast } from "@/lib/rbac";
import { ForbiddenError, requireTenant, requireWrite } from "@/lib/tenant";
import { createNotification } from "@/lib/notifications";

export interface TaskNote {
  id: string;
  body: string;
  response: string | null;
  status: "open" | "cleared";
  authorName: string;
  assigneeName: string | null;
  createdAt: string;
  clearedAt: string | null;
}

export async function listTaskNotes(fileItemId: string): Promise<TaskNote[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{
      id: string;
      body: string;
      response: string | null;
      status: TaskNote["status"];
      author_name: string;
      assignee_name: string | null;
      created_at: string;
      cleared_at: string | null;
    }>(
      `SELECT n.id, n.body, n.response, n.status,
              coalesce(a.name, a.email) AS author_name,
              coalesce(u.name, u.email) AS assignee_name,
              to_char(n.created_at, 'DD Mon YYYY HH24:MI') AS created_at,
              to_char(n.cleared_at, 'DD Mon YYYY HH24:MI') AS cleared_at
         FROM review_note n
         JOIN app_user a ON a.id = n.author_id
         LEFT JOIN app_user u ON u.id = n.assignee_id
        WHERE n.file_item_id = $1
        ORDER BY n.status = 'cleared', n.created_at DESC`,
      [fileItemId],
    );
    return r.rows.map((row) => ({
      id: row.id,
      body: row.body,
      response: row.response,
      status: row.status,
      authorName: row.author_name,
      assigneeName: row.assignee_name,
      createdAt: row.created_at,
      clearedAt: row.cleared_at,
    }));
  });
}

/** Raise a note on a task; it lands on the assignee dashboard. */
export async function addTaskNote(
  engagementId: string,
  fileItemId: string,
  body: string,
): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  const text = body.trim();
  if (!text) throw new Error("note-required");
  const target = await withTenant(tenantId, async (tx) => {
    // the task assignee receives the note; a task with no assignee keeps it unaddressed
    let row: { user_id: string | null; email: string | null; code: string } | null = null;
    try {
      const r = await tx.query<{ user_id: string | null; email: string | null; code: string }>(
        `SELECT fi.assignee_user_id AS user_id, u.email, fi.code
           FROM file_item fi
           LEFT JOIN app_user u ON u.id = fi.assignee_user_id
          WHERE fi.id = $1`,
        [fileItemId],
      );
      row = r.rows[0] ?? null;
    } catch {
      const r = await tx.query<{ code: string }>("SELECT code FROM file_item WHERE id = $1", [fileItemId]);
      row = r.rows[0] ? { user_id: null, email: null, code: r.rows[0].code } : null;
    }
    await tx.query(
      `INSERT INTO review_note (tenant_id, document_id, file_item_id, engagement_id, author_id, assignee_id, body)
       VALUES ($1, NULL, $2, $3, $4, $5, $6)`,
      [tenantId, fileItemId, engagementId, userId, row?.user_id ?? null, text],
    );
    return row;
  });
  if (target?.user_id) {
    try {
      await createNotification({
        tenantId,
        userId: target.user_id,
        kind: "review_note",
        title: `Review note on ${target.code}`,
        body: text.slice(0, 400),
        href: `/engagements/${engagementId}/sections/${fileItemId}`,
      });
    } catch {
      // a failed notification must never lose the note
    }
  }
}

/** Answer and clear a note. */
export async function clearTaskNote(noteId: string, response: string): Promise<void> {
  const { tenantId, userId, role } = await requireWrite();
  await withTenant(tenantId, async (tx) => {
    // Clearing a note is not bookkeeping: an open note blocks both the reviewer
    // and partner signature (signDocument) and the archive gate
    // (review_notes_cleared). ISA 220 (Revised) para 29 puts the judgement that
    // a point is resolved with the reviewer, so a preparer must not close the
    // note raised against their own work. The author may always close their own
    // — a staff member who queried someone else's paper can withdraw it.
    const note = await tx.query<{ author_id: string | null }>(
      "SELECT author_id FROM review_note WHERE id = $1",
      [noteId],
    );
    const author = note.rows[0]?.author_id;
    if (author !== userId && !atLeast(role, "senior")) {
      throw new ForbiddenError("requires-senior-or-author");
    }
    await tx.query(
      `UPDATE review_note
          SET status = 'cleared', response = $2, cleared_at = now(), cleared_by = $3
        WHERE id = $1 AND status = 'open'`,
      [noteId, response.trim() || null, userId],
    );
  });
}

export interface MyTaskNote {
  id: string;
  body: string;
  code: string;
  taskTitle: string;
  engagementId: string;
  engagementName: string;
  fileItemId: string;
  authorName: string;
  createdAt: string;
}

/** Open notes addressed to the signed-in user, for their dashboard. */
export async function myOpenTaskNotes(limit = 12): Promise<MyTaskNote[]> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{
      id: string;
      body: string;
      code: string;
      title_en: string;
      engagement_id: string;
      engagement_name: string;
      file_item_id: string;
      author_name: string;
      created_at: string;
    }>(
      `SELECT n.id, n.body, fi.code, fi.title_en, n.engagement_id, n.file_item_id,
              coalesce(e.name, c.name) AS engagement_name,
              coalesce(a.name, a.email) AS author_name,
              to_char(n.created_at, 'DD Mon YYYY HH24:MI') AS created_at
         FROM review_note n
         JOIN file_item fi ON fi.id = n.file_item_id
         JOIN engagement e ON e.id = n.engagement_id
         JOIN client c ON c.id = e.client_id
         JOIN app_user a ON a.id = n.author_id
        WHERE n.assignee_id = $1 AND n.status = 'open'
        ORDER BY n.created_at DESC
        LIMIT $2`,
      [userId, limit],
    );
    return r.rows.map((row) => ({
      id: row.id,
      body: row.body,
      code: row.code,
      taskTitle: row.title_en,
      engagementId: row.engagement_id,
      engagementName: row.engagement_name,
      fileItemId: row.file_item_id,
      authorName: row.author_name,
      createdAt: row.created_at,
    }));
  });
}

export interface NoteRegisterRow {
  id: string;
  code: string;
  taskTitle: string;
  fileItemId: string;
  ownerName: string | null;
  authorName: string;
  body: string;
  response: string | null;
  status: "open" | "cleared";
  createdAt: string;
  clearedAt: string | null;
  /** hours from raising to clearing, null while open */
  resolutionHours: number | null;
  mine: boolean;
  forMe: boolean;
}

/** Every review note of the engagement, for the register panel. */
export async function noteRegister(engagementId: string): Promise<NoteRegisterRow[]> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{
      id: string;
      code: string;
      title_en: string;
      title_fr: string;
      file_item_id: string;
      owner_name: string | null;
      author_name: string;
      author_id: string;
      assignee_id: string | null;
      body: string;
      response: string | null;
      status: "open" | "cleared";
      created_at: string;
      cleared_at: string | null;
      hours: string | null;
    }>(
      `SELECT n.id, fi.code, fi.title_en, fi.title_fr, n.file_item_id,
              coalesce(u.name, u.email) AS owner_name,
              coalesce(a.name, a.email) AS author_name,
              n.author_id, n.assignee_id, n.body, n.response, n.status,
              to_char(n.created_at, 'DD Mon YYYY HH24:MI') AS created_at,
              to_char(n.cleared_at, 'DD Mon YYYY HH24:MI') AS cleared_at,
              round(extract(epoch FROM (n.cleared_at - n.created_at)) / 3600, 1)::text AS hours
         FROM review_note n
         JOIN file_item fi ON fi.id = n.file_item_id
         JOIN app_user a ON a.id = n.author_id
         LEFT JOIN app_user u ON u.id = n.assignee_id
        WHERE n.engagement_id = $1
        ORDER BY n.status = 'cleared', n.created_at DESC`,
      [engagementId],
    );
    return r.rows.map((row) => ({
      id: row.id,
      code: row.code,
      taskTitle: row.title_en,
      fileItemId: row.file_item_id,
      ownerName: row.owner_name,
      authorName: row.author_name,
      body: row.body,
      response: row.response,
      status: row.status,
      createdAt: row.created_at,
      clearedAt: row.cleared_at,
      resolutionHours: row.hours === null ? null : Number(row.hours),
      mine: row.author_id === userId,
      forMe: row.assignee_id === userId,
    }));
  });
}
