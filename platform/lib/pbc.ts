// Phase 9 (9.1/9.2): client portal PBC flow (spec §5.2/§2.3). Firm side
// raises PBC requests; the client's portal users (role 'client_user',
// membership scoped to ONE client, never the audit file) upload responses;
// the firm accepts an upload and can attach it to a working paper as a
// versioned document.

import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import type { PoolClient } from "pg";
import { recordActivity } from "@/lib/activity";
import { withTenant } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { canReview } from "@/lib/rbac";
import { requireTenant, requirePortalUser, ForbiddenError, requireWrite } from "@/lib/tenant";
import { checkUpload } from "@/lib/upload-safety";

export class PbcError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "PbcError";
  }
}

export interface PbcItem {
  id: string;
  engagementId: string;
  clientName: string;
  fiscalYear: number;
  title: string;
  note: string;
  status: "requested" | "uploaded" | "accepted";
  filename: string | null;
  documentId: string | null;
  /** YYYY-MM-DD — when the request was raised */
  createdAt: string;
  /** YYYY-MM-DD — when the client uploaded, if they have */
  uploadedAt: string | null;
  /** YYYY-MM-DD — the last reminder sent, and how many so far (UAT B112) */
  chasedAt: string | null;
  chaseCount: number;
}

const MAX_PBC_BYTES = 25 * 1024 * 1024;

/** Firm side: raise a PBC request and notify the client's portal users. */
export async function addPbcItem(engagementId: string, title: string, note: string): Promise<string> {
  const { tenantId } = await requireWrite();
  if (!title.trim()) throw new PbcError("fields-required");
  const { itemId, portalUsers } = await withTenant(tenantId, async (tx) => {
    const created = await tx.query<{ id: string }>(
      `INSERT INTO pbc_item (tenant_id, engagement_id, title, note)
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [tenantId, engagementId, title, note],
    );
    const users = await tx.query<{ user_id: string }>(
      `SELECT m.user_id FROM membership m
        WHERE m.tenant_id = $1 AND m.role = 'client_user'
          AND m.client_id = (SELECT client_id FROM engagement WHERE id = $2)`,
      [tenantId, engagementId],
    );
    return { itemId: created.rows[0].id, portalUsers: users.rows };
  });
  // the request is part of the audit trail (UAT run 2 B74)
  await recordActivity({
    engagementId,
    entityType: "pbc_item",
    entityId: itemId,
    action: "pbc_requested",
    summary: `PBC requested: ${title.trim()}`,
    after: { title: title.trim(), portalContacts: portalUsers.length },
  });
  for (const user of portalUsers) {
    await createNotification({
      tenantId,
      userId: user.user_id,
      kind: "pbc-requested",
      title: `PBC: ${title}`,
      body: note || "A document has been requested — please upload it on the portal.",
      // client_user recipients only ever see the portal, never the firm console.
      href: "/portal",
    });
  }
  return itemId;
}

/** Firm side: full list for an engagement. */
export async function listPbcItems(engagementId: string): Promise<PbcItem[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, (tx) => queryItems(tx, "fi.engagement_id = $1", [engagementId]));
}

/** Portal side: items across the client's engagements, scoped by clientId. */
export async function listPortalItems(clientId: string): Promise<PbcItem[]> {
  // Portal surface: the caller is a client_user, and may only ever see their own
  // client's items — the id is taken from the session, never from the argument.
  const { tenantId, clientId: own } = await requirePortalUser();
  if (clientId !== own) throw new ForbiddenError("not-your-client");
  return withTenant(tenantId, (tx) => queryItems(tx, "e.client_id = $1", [own]));
}

async function queryItems(tx: PoolClient, where: string, params: unknown[]): Promise<PbcItem[]> {
  const result = await tx.query<{
    id: string; engagement_id: string; client_name: string; fiscal_year: number;
    title: string; note: string; status: PbcItem["status"]; filename: string | null;
    document_id: string | null; created_at: string; uploaded_at: string | null;
    chased_at: string | null; chase_count: number;
  }>(
    `SELECT fi.id, fi.engagement_id, c.name AS client_name, e.fiscal_year,
            fi.title, fi.note, fi.status, fi.filename, fi.document_id,
            to_char(fi.created_at, 'YYYY-MM-DD') AS created_at,
            to_char(fi.uploaded_at, 'YYYY-MM-DD') AS uploaded_at,
            to_char(fi.chased_at, 'YYYY-MM-DD') AS chased_at,
            coalesce(fi.chase_count, 0)::int AS chase_count
       FROM pbc_item fi
       JOIN engagement e ON e.id = fi.engagement_id
       JOIN client c ON c.id = e.client_id
      WHERE ${where}
      ORDER BY fi.created_at`,
    params,
  );
  return result.rows.map((row) => ({
    id: row.id, engagementId: row.engagement_id, clientName: row.client_name,
    fiscalYear: row.fiscal_year, title: row.title, note: row.note, status: row.status,
    filename: row.filename, documentId: row.document_id,
    createdAt: row.created_at, uploadedAt: row.uploaded_at,
    chasedAt: row.chased_at, chaseCount: row.chase_count,
  }));
}

/**
 * Firm side: remind the client's portal users of a request they have not
 * answered (UAT B112). The reminder is a fresh portal notification, and the
 * item records when and how often it was chased.
 */
export async function chasePbc(itemId: string): Promise<void> {
  const { tenantId } = await requireWrite();
  const { title, note, portalUsers, engagementId } = await withTenant(tenantId, async (tx) => {
    // A reminder nobody can receive is not a chase (UAT run 2 B76): with no
    // portal contact for the client, refuse before counting anything.
    const contacts = await tx.query<{ n: string }>(
      `SELECT count(*)::text AS n FROM membership m
        WHERE m.tenant_id = $1 AND m.role = 'client_user'
          AND m.client_id = (SELECT e.client_id FROM pbc_item p JOIN engagement e ON e.id = p.engagement_id WHERE p.id = $2)`,
      [tenantId, itemId],
    );
    if (Number(contacts.rows[0]?.n ?? 0) === 0) throw new PbcError("no-portal-contact");
    const updated = await tx.query<{ title: string; note: string; engagement_id: string }>(
      `UPDATE pbc_item SET chased_at = now(), chase_count = coalesce(chase_count, 0) + 1
        WHERE id = $1 AND status = 'requested'
        RETURNING title, note, engagement_id`,
      [itemId],
    );
    const row = updated.rows[0];
    if (!row) throw new PbcError("wrong-status");
    const users = await tx.query<{ user_id: string }>(
      `SELECT m.user_id FROM membership m
        WHERE m.tenant_id = $1 AND m.role = 'client_user'
          AND m.client_id = (SELECT client_id FROM engagement WHERE id = $2)`,
      [tenantId, row.engagement_id],
    );
    return { title: row.title, note: row.note, portalUsers: users.rows, engagementId: row.engagement_id };
  });
  await recordActivity({
    engagementId,
    entityType: "pbc_item",
    entityId: itemId,
    action: "pbc_chased",
    summary: `PBC chased: ${title}`,
    meta: { portalContacts: portalUsers.length },
  });
  for (const user of portalUsers) {
    await createNotification({
      tenantId,
      userId: user.user_id,
      kind: "pbc-reminder",
      title: `Reminder — PBC: ${title}`,
      body: note || "This document is still outstanding — please upload it on the portal.",
      href: "/portal",
    });
  }
}

/** Portal side: upload the response. Only for the item's own client. */
export async function uploadPbc(
  itemId: string,
  clientId: string,
  file: { filename: string; mime: string; content: Buffer },
): Promise<void> {
  const { tenantId, userId, clientId: own } = await requirePortalUser();
  if (clientId !== own) throw new ForbiddenError("not-your-client");
  if (file.content.length === 0) throw new PbcError("empty-file");
  if (file.content.length > MAX_PBC_BYTES) throw new PbcError("file-too-large");
  // The same allowlist and byte-signature check as a task attachment: the
  // stored name and MIME come from what the bytes are, never from the
  // client's claim (UnsafeFileError propagates to the action).
  const checked = checkUpload(file.filename, file.content);
  await withTenant(tenantId, async (tx) => {
    const updated = await tx.query(
      `UPDATE pbc_item fi
          SET status = 'uploaded', filename = $3, mime = $4, content = $5,
              uploaded_by = $6, uploaded_at = now()
         FROM engagement e
        WHERE fi.id = $1 AND e.id = fi.engagement_id AND e.client_id = $2
          AND fi.status <> 'accepted'`,
      [itemId, clientId, checked.name, checked.mime, file.content, userId],
    );
    if (updated.rowCount === 0) throw new PbcError("not-found");
    // The client's upload goes on the engagement trail (UAT run 2 B74). Written
    // here, not through recordActivity, which refuses portal accounts; best
    // effort like recordActivity (a savepoint keeps the upload if it fails).
    await tx.query("SAVEPOINT pbc_trail");
    await tx.query(
      `INSERT INTO activity_log
         (tenant_id, engagement_id, user_id, acting_role, entity_type, entity_id, action, summary, meta, after_value, outcome)
       SELECT $1, p.engagement_id, $2, 'client_user', 'pbc_item', p.id, 'pbc_uploaded',
              'PBC uploaded by the client: ' || p.title || ' (' || $3 || ')', $4::jsonb, $4::jsonb, 'success'
         FROM pbc_item p WHERE p.id = $5`,
      [
        tenantId,
        userId,
        checked.name,
        JSON.stringify({ filename: checked.name, sha256: createHash("sha256").update(file.content).digest("hex"), bytes: file.content.length }),
        itemId,
      ],
    ).then(
      () => tx.query("RELEASE SAVEPOINT pbc_trail"),
      () => tx.query("ROLLBACK TO SAVEPOINT pbc_trail"),
    );
    const team = await tx.query<{ user_id: string; engagement_id: string }>(
      `SELECT tm.user_id, fi.engagement_id FROM team_member tm
        JOIN pbc_item fi ON fi.engagement_id = tm.engagement_id
       WHERE fi.id = $1`,
      [itemId],
    );
    for (const member of team.rows) {
      await createNotification({
        tenantId,
        userId: member.user_id,
        kind: "pbc-uploaded",
        title: `PBC uploaded: ${checked.name}`,
        href: `/engagements/${member.engagement_id}/pbc`,
      });
    }
  });
}

/**
 * File the upload's bytes as a working-paper document on a task. The bytes are
 * checked again on the way into the audit file (rows uploaded before the
 * portal applied the allowlist are refused here with UnsafeFileError), and
 * the stored name and MIME come from that check.
 */
async function filePbcAsDocument(
  tx: PoolClient,
  tenantId: string,
  userId: string,
  row: { engagement_id: string; title: string; filename: string | null; content: Buffer },
  attachFileItemId: string,
): Promise<string> {
  const checked = checkUpload(row.filename ?? row.title, row.content);
  const target = await tx.query(
    "SELECT 1 FROM file_item WHERE id = $1 AND engagement_id = $2",
    [attachFileItemId, row.engagement_id],
  );
  if (!target.rows[0]) throw new PbcError("not-found");
  const created = await tx.query<{ id: string }>(
    `INSERT INTO document (tenant_id, engagement_id, file_item_id, title, language, kind, created_by, current_version)
     VALUES ($1, $2, $3, $4, 'fr', 'workpaper', $5, 1) RETURNING id`,
    [tenantId, row.engagement_id, attachFileItemId, `PBC — ${row.title}`, userId],
  );
  const documentId = created.rows[0].id;
  await tx.query(
    `INSERT INTO document_version
       (tenant_id, document_id, version_no, mime, byte_size, sha256, content, note, created_by)
     VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8)`,
    [
      tenantId, documentId, checked.mime, row.content.length,
      createHash("sha256").update(row.content).digest("hex"), row.content,
      `pbc:${checked.name}`, userId,
    ],
  );
  return documentId;
}

/**
 * Firm side (reviewer+): accept the upload and attach it to a file item as a
 * versioned working-paper document (evidence, spec §5.2). The section is
 * required: an accepted upload attached nowhere was unreachable from the
 * file — no link, no download, no task carrying it.
 */
export async function acceptPbc(itemId: string, attachFileItemId?: string): Promise<string | null> {
  const { tenantId, userId, role } = await requireWrite();
  if (!canReview(role)) throw new PbcError("forbidden");
  if (!attachFileItemId) throw new PbcError("attach-required");
  const accepted = await withTenant(tenantId, async (tx) => {
    const item = await tx.query<{
      id: string; engagement_id: string; title: string; status: string;
      filename: string | null; mime: string | null; content: Buffer | null;
    }>(
      "SELECT id, engagement_id, title, status, filename, mime, content FROM pbc_item WHERE id = $1 FOR UPDATE",
      [itemId],
    );
    const row = item.rows[0];
    if (!row) throw new PbcError("not-found");
    if (row.status !== "uploaded" || !row.content) throw new PbcError("wrong-status");

    const documentId = await filePbcAsDocument(tx, tenantId, userId, { ...row, content: row.content }, attachFileItemId);
    await tx.query(
      "UPDATE pbc_item SET status = 'accepted', accepted_by = $2, accepted_at = now(), document_id = $3 WHERE id = $1",
      [itemId, userId, documentId],
    );
    return { documentId, engagementId: row.engagement_id, title: row.title };
  });
  await logPbcFiled("pbc_accepted", itemId, attachFileItemId, accepted);
  return accepted.documentId;
}

/** The acceptance / filing of an upload, with the task it went to (UAT run 2 B74). */
async function logPbcFiled(
  action: "pbc_accepted" | "pbc_attached",
  itemId: string,
  fileItemId: string,
  filed: { documentId: string; engagementId: string; title: string },
): Promise<void> {
  const { tenantId } = await requireTenant();
  const code = await withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ code: string }>("SELECT code FROM file_item WHERE id = $1", [fileItemId]);
    return r.rows[0]?.code ?? "";
  }).catch(() => "");
  await recordActivity({
    engagementId: filed.engagementId,
    entityType: "pbc_item",
    entityId: itemId,
    action,
    summary: `PBC ${action === "pbc_accepted" ? "accepted" : "filed"}: ${filed.title}${code ? ` → ${code}` : ""}`,
    after: { documentId: filed.documentId, code },
  });
}

/**
 * Firm side (reviewer+): attach an item that was accepted before the section
 * became mandatory — its bytes are still on the row, so it can be filed now.
 */
export async function attachAcceptedPbc(itemId: string, attachFileItemId: string): Promise<string> {
  const { tenantId, userId, role } = await requireWrite();
  if (!canReview(role)) throw new PbcError("forbidden");
  if (!attachFileItemId) throw new PbcError("attach-required");
  const filed = await withTenant(tenantId, async (tx) => {
    const item = await tx.query<{
      engagement_id: string; title: string; status: string; document_id: string | null;
      filename: string | null; content: Buffer | null;
    }>(
      "SELECT engagement_id, title, status, document_id, filename, content FROM pbc_item WHERE id = $1 FOR UPDATE",
      [itemId],
    );
    const row = item.rows[0];
    if (!row) throw new PbcError("not-found");
    if (row.status !== "accepted" || row.document_id || !row.content) throw new PbcError("wrong-status");
    const documentId = await filePbcAsDocument(tx, tenantId, userId, { ...row, content: row.content }, attachFileItemId);
    await tx.query("UPDATE pbc_item SET document_id = $2 WHERE id = $1", [itemId, documentId]);
    return { documentId, engagementId: row.engagement_id, title: row.title };
  });
  await logPbcFiled("pbc_attached", itemId, attachFileItemId, filed);
  return filed.documentId;
}

/**
 * Firm side: create a portal contact for a client — an app_user whose single
 * membership is role 'client_user' scoped to that client.
 */
export async function addPortalContact(
  clientId: string,
  input: { email: string; name: string; password: string },
): Promise<string> {
  const { tenantId, role } = await requireWrite();
  if (!canReview(role)) throw new PbcError("forbidden");
  const email = input.email.toLowerCase().trim();
  if (!email || !input.name.trim()) throw new PbcError("fields-required");
  if (input.password.length < 8) throw new PbcError("password-too-short");
  const hash = await bcrypt.hash(input.password, 10);
  return withTenant(tenantId, async (tx) => {
    const client = await tx.query("SELECT 1 FROM client WHERE id = $1", [clientId]);
    if (!client.rows[0]) throw new PbcError("not-found");
    const existing = await tx.query<{ id: string }>(
      "SELECT id FROM app_user WHERE lower(email) = $1",
      [email],
    );
    if (existing.rows[0]) throw new PbcError("email-taken");
    const user = await tx.query<{ id: string }>(
      "INSERT INTO app_user (email, name, password_hash) VALUES ($1, $2, $3) RETURNING id",
      [email, input.name, hash],
    );
    await tx.query(
      "INSERT INTO membership (user_id, tenant_id, role, client_id) VALUES ($1, $2, 'client_user', $3)",
      [user.rows[0].id, tenantId, clientId],
    );
    return user.rows[0].id;
  });
}

/** Portal contacts of a client (for the client admin page). */
export async function listPortalContacts(
  clientId: string,
): Promise<{ id: string; email: string; name: string | null }[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ id: string; email: string; name: string | null }>(
      `SELECT u.id, u.email, u.name
         FROM membership m JOIN app_user u ON u.id = m.user_id
        WHERE m.tenant_id = $1 AND m.role = 'client_user' AND m.client_id = $2
        ORDER BY u.email`,
      [tenantId, clientId],
    );
    return result.rows;
  });
}
