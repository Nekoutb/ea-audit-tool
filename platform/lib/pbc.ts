// Phase 9 (9.1/9.2): client portal PBC flow (spec §5.2/§2.3). Firm side
// raises PBC requests; the client's portal users (role 'client_user',
// membership scoped to ONE client, never the audit file) upload responses;
// the firm accepts an upload and can attach it to a working paper as a
// versioned document.

import { createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { canReview } from "@/lib/rbac";
import { requireTenant } from "@/lib/tenant";

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
}

const MAX_PBC_BYTES = 25 * 1024 * 1024;

/** Firm side: raise a PBC request and notify the client's portal users. */
export async function addPbcItem(engagementId: string, title: string, note: string): Promise<string> {
  const { tenantId } = await requireTenant();
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
  for (const user of portalUsers) {
    await createNotification({
      tenantId,
      userId: user.user_id,
      kind: "pbc-requested",
      title: `PBC: ${title}`,
      body: note || "A document has been requested — please upload it on the portal.",
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
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, (tx) => queryItems(tx, "e.client_id = $1", [clientId]));
}

async function queryItems(tx: PoolClient, where: string, params: unknown[]): Promise<PbcItem[]> {
  const result = await tx.query<{
    id: string; engagement_id: string; client_name: string; fiscal_year: number;
    title: string; note: string; status: PbcItem["status"]; filename: string | null;
    document_id: string | null;
  }>(
    `SELECT fi.id, fi.engagement_id, c.name AS client_name, e.fiscal_year,
            fi.title, fi.note, fi.status, fi.filename, fi.document_id
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
  }));
}

/** Portal side: upload the response. Only for the item's own client. */
export async function uploadPbc(
  itemId: string,
  clientId: string,
  file: { filename: string; mime: string; content: Buffer },
): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (file.content.length === 0) throw new PbcError("empty-file");
  if (file.content.length > MAX_PBC_BYTES) throw new PbcError("file-too-large");
  await withTenant(tenantId, async (tx) => {
    const updated = await tx.query(
      `UPDATE pbc_item fi
          SET status = 'uploaded', filename = $3, mime = $4, content = $5,
              uploaded_by = $6, uploaded_at = now()
         FROM engagement e
        WHERE fi.id = $1 AND e.id = fi.engagement_id AND e.client_id = $2
          AND fi.status <> 'accepted'`,
      [itemId, clientId, file.filename, file.mime, file.content, userId],
    );
    if (updated.rowCount === 0) throw new PbcError("not-found");
    const team = await tx.query<{ user_id: string }>(
      `SELECT tm.user_id FROM team_member tm
        JOIN pbc_item fi ON fi.engagement_id = tm.engagement_id
       WHERE fi.id = $1`,
      [itemId],
    );
    for (const member of team.rows) {
      await createNotification({
        tenantId,
        userId: member.user_id,
        kind: "pbc-uploaded",
        title: `PBC uploaded: ${file.filename}`,
      });
    }
  });
}

/**
 * Firm side (reviewer+): accept the upload; optionally attach it to a file
 * item as a versioned working-paper document (evidence, spec §5.2).
 */
export async function acceptPbc(itemId: string, attachFileItemId?: string): Promise<string | null> {
  const { tenantId, userId, role } = await requireTenant();
  if (!canReview(role)) throw new PbcError("forbidden");
  return withTenant(tenantId, async (tx) => {
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

    let documentId: string | null = null;
    if (attachFileItemId) {
      const created = await tx.query<{ id: string }>(
        `INSERT INTO document (tenant_id, engagement_id, file_item_id, title, language, kind, created_by, current_version)
         VALUES ($1, $2, $3, $4, 'fr', 'workpaper', $5, 1) RETURNING id`,
        [tenantId, row.engagement_id, attachFileItemId, `PBC — ${row.title}`, userId],
      );
      documentId = created.rows[0].id;
      await tx.query(
        `INSERT INTO document_version
           (tenant_id, document_id, version_no, mime, byte_size, sha256, content, note, created_by)
         VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8)`,
        [
          tenantId, documentId, row.mime ?? "application/octet-stream", row.content.length,
          createHash("sha256").update(row.content).digest("hex"), row.content,
          `pbc:${row.filename ?? row.title}`, userId,
        ],
      );
    }
    await tx.query(
      "UPDATE pbc_item SET status = 'accepted', accepted_by = $2, accepted_at = now(), document_id = $3 WHERE id = $1",
      [itemId, userId, documentId],
    );
    return documentId;
  });
}

/**
 * Firm side: create a portal contact for a client — an app_user whose single
 * membership is role 'client_user' scoped to that client.
 */
export async function addPortalContact(
  clientId: string,
  input: { email: string; name: string; password: string },
): Promise<string> {
  const { tenantId, role } = await requireTenant();
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
