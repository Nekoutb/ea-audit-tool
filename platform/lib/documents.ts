import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import { generateWorkpaperDocx } from "@/lib/docx";
import type { Locale } from "@/lib/i18n";
import { createNotification } from "@/lib/notifications";
import { canPartnerSignoff, canReview } from "@/lib/rbac";
import { applyOverride } from "@/lib/template-overrides";
import { templateFor } from "@/lib/templates";
import { requireTenant } from "@/lib/tenant";

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export type SignoffRole = "preparer" | "reviewer" | "partner";

export interface DocumentDetail {
  id: string;
  engagementId: string;
  fileItemCode: string;
  title: string;
  language: Locale;
  status: "draft" | "signed";
  currentVersion: number;
  checkedOutBy: string | null;
  checkedOutByName: string | null;
}

export interface VersionInfo {
  versionNo: number;
  byteSize: number;
  sha256: string;
  note: string | null;
  createdByName: string | null;
  createdAt: string;
}

export interface SignoffInfo {
  id: string;
  role: SignoffRole;
  versionNo: number;
  userName: string;
  signedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
}

export interface ReviewNoteInfo {
  id: string;
  authorName: string;
  body: string;
  response: string | null;
  status: "open" | "cleared";
  createdAt: string;
}

/** Domain-rule violation surfaced to the UI in plain language (never a bare 500). */
export class DocumentRuleError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "DocumentRuleError";
  }
}

function sha256Of(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

async function insertVersion(
  tx: PoolClient,
  tenantId: string,
  documentId: string,
  content: Buffer,
  note: string | null,
  userId: string,
): Promise<number> {
  const next = await tx.query<{ v: number }>(
    "SELECT coalesce(max(version_no), 0) + 1 AS v FROM document_version WHERE document_id = $1",
    [documentId],
  );
  const versionNo = next.rows[0].v;
  await tx.query(
    `INSERT INTO document_version
       (tenant_id, document_id, version_no, mime, byte_size, sha256, content, note, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [tenantId, documentId, versionNo, DOCX_MIME, content.length, sha256Of(content), content, note, userId],
  );
  await tx.query("UPDATE document SET current_version = $2 WHERE id = $1", [
    documentId,
    versionNo,
  ]);
  return versionNo;
}

/**
 * Instantiate a working paper for a file-index item from its template:
 * creates the document row and renders version 1 from merge fields.
 */
export async function generateDocument(fileItemId: string, locale: Locale): Promise<string> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const item = await tx.query<{
      id: string;
      engagement_id: string;
      code: string;
      title_en: string;
      title_fr: string;
      client_name: string;
      fiscal_year: number;
      period_end: string;
      user_name: string | null;
      user_email: string;
    }>(
      `SELECT fi.id, fi.engagement_id, fi.code, fi.title_en, fi.title_fr,
              c.name AS client_name, e.fiscal_year,
              to_char(e.period_end, 'YYYY-MM-DD') AS period_end,
              u.name AS user_name, u.email AS user_email
         FROM file_item fi
         JOIN engagement e ON e.id = fi.engagement_id
         JOIN client c ON c.id = e.client_id
         CROSS JOIN app_user u
        WHERE fi.id = $1 AND u.id = $2`,
      [fileItemId, userId],
    );
    const row = item.rows[0];
    if (!row) throw new DocumentRuleError("not-found");

    // kind filter matters: letters/leadsheets filed under the same index item
    // must not hijack the working paper. [Adversarial-review fix]
    const existing = await tx.query<{ id: string }>(
      "SELECT id FROM document WHERE file_item_id = $1 AND kind = 'workpaper' LIMIT 1",
      [fileItemId],
    );
    if (existing.rows[0]) return existing.rows[0].id;

    const title = locale === "fr" ? row.title_fr : row.title_en;
    // Firm-level template customization (Template management) applies to NEW
    // documents only; existing bytes stay frozen in document_version.
    const template = await applyOverride(tx, row.code, templateFor(row.code));
    const content = await generateWorkpaperDocx(
      template,
      {
        code: row.code,
        title,
        clientName: row.client_name,
        fiscalYear: row.fiscal_year,
        periodEnd: row.period_end,
        preparedBy: row.user_name ?? row.user_email,
      },
      locale,
    );

    const created = await tx.query<{ id: string }>(
      `INSERT INTO document (tenant_id, engagement_id, file_item_id, title, language, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [tenantId, row.engagement_id, fileItemId, title, locale, userId],
    );
    const documentId = created.rows[0].id;
    await insertVersion(
      tx,
      tenantId,
      documentId,
      content,
      `template:${template.id}@${template.version}`,
      userId,
    );
    return documentId;
  });
}

export async function getDocument(documentId: string): Promise<DocumentDetail | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string;
      engagement_id: string;
      code: string;
      title: string;
      language: Locale;
      status: "draft" | "signed";
      current_version: number;
      checked_out_by: string | null;
      checked_out_by_name: string | null;
    }>(
      `SELECT d.id, d.engagement_id, fi.code, d.title, d.language, d.status,
              d.current_version, d.checked_out_by,
              coalesce(u.name, u.email) AS checked_out_by_name
         FROM document d
         JOIN file_item fi ON fi.id = d.file_item_id
         LEFT JOIN app_user u ON u.id = d.checked_out_by
        WHERE d.id = $1`,
      [documentId],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      engagementId: row.engagement_id,
      fileItemCode: row.code,
      title: row.title,
      language: row.language,
      status: row.status,
      currentVersion: row.current_version,
      checkedOutBy: row.checked_out_by,
      checkedOutByName: row.checked_out_by_name,
    };
  });
}

export async function listVersions(documentId: string): Promise<VersionInfo[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      version_no: number;
      byte_size: number;
      sha256: string;
      note: string | null;
      created_by_name: string | null;
      created_at: string;
    }>(
      `SELECT v.version_no, v.byte_size, v.sha256, v.note,
              coalesce(u.name, u.email) AS created_by_name,
              to_char(v.created_at, 'YYYY-MM-DD HH24:MI') AS created_at
         FROM document_version v
         LEFT JOIN app_user u ON u.id = v.created_by
        WHERE v.document_id = $1
        ORDER BY v.version_no DESC`,
      [documentId],
    );
    return result.rows.map((row) => ({
      versionNo: row.version_no,
      byteSize: row.byte_size,
      sha256: row.sha256,
      note: row.note,
      createdByName: row.created_by_name,
      createdAt: row.created_at,
    }));
  });
}

export async function getVersionContent(
  documentId: string,
  versionNo: number,
): Promise<{ content: Buffer; mime: string; filename: string } | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ content: Buffer; mime: string; code: string; title: string }>(
      `SELECT v.content, v.mime, fi.code, d.title
         FROM document_version v
         JOIN document d ON d.id = v.document_id
         JOIN file_item fi ON fi.id = d.file_item_id
        WHERE v.document_id = $1 AND v.version_no = $2`,
      [documentId, versionNo],
    );
    const row = result.rows[0];
    if (!row) return null;
    const safeTitle = row.title.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 60);
    return {
      content: row.content,
      mime: row.mime,
      filename: `${row.code} ${safeTitle} v${versionNo}.docx`,
    };
  });
}

/** Check out for editing: single editor at a time; signed documents must be reopened first. */
export async function checkoutDocument(documentId: string): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ status: string; checked_out_by: string | null; archived_at: string | null }>(
      `SELECT d.status, d.checked_out_by, e.archived_at::text
         FROM document d JOIN engagement e ON e.id = d.engagement_id
        WHERE d.id = $1 FOR UPDATE OF d`,
      [documentId],
    );
    const row = result.rows[0];
    if (!row) throw new DocumentRuleError("not-found");
    // Post-archive modifications are impossible (spec §9.6).
    if (row.archived_at) throw new DocumentRuleError("archived");
    if (row.status === "signed") throw new DocumentRuleError("signed-locked");
    if (row.checked_out_by && row.checked_out_by !== userId)
      throw new DocumentRuleError("checked-out-by-other");
    await tx.query(
      "UPDATE document SET checked_out_by = $2, checked_out_at = now() WHERE id = $1",
      [documentId, userId],
    );
  });
}

export async function cancelCheckout(documentId: string): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      "UPDATE document SET checked_out_by = NULL, checked_out_at = NULL WHERE id = $1 AND checked_out_by = $2",
      [documentId, userId],
    );
  });
}

/** Check in an edited file as the next version and release the lock. */
export async function checkinDocument(documentId: string, content: Buffer): Promise<number> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ status: string; checked_out_by: string | null; archived_at: string | null }>(
      `SELECT d.status, d.checked_out_by, e.archived_at::text
         FROM document d JOIN engagement e ON e.id = d.engagement_id
        WHERE d.id = $1 FOR UPDATE OF d`,
      [documentId],
    );
    const row = result.rows[0];
    if (!row) throw new DocumentRuleError("not-found");
    if (row.archived_at) throw new DocumentRuleError("archived");
    if (row.status === "signed") throw new DocumentRuleError("signed-locked");
    if (row.checked_out_by !== userId) throw new DocumentRuleError("not-checked-out");
    const versionNo = await insertVersion(tx, tenantId, documentId, content, "check-in", userId);
    await tx.query(
      "UPDATE document SET checked_out_by = NULL, checked_out_at = NULL WHERE id = $1",
      [documentId],
    );
    return versionNo;
  });
}

/** Restore an old version by copying it forward as a new version (history is never rewritten). */
export async function restoreVersion(documentId: string, versionNo: number): Promise<number> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const doc = await tx.query<{ status: string; checked_out_by: string | null }>(
      "SELECT status, checked_out_by FROM document WHERE id = $1 FOR UPDATE",
      [documentId],
    );
    const row = doc.rows[0];
    if (!row) throw new DocumentRuleError("not-found");
    if (row.status === "signed") throw new DocumentRuleError("signed-locked");
    if (row.checked_out_by) throw new DocumentRuleError("checked-out");
    const source = await tx.query<{ content: Buffer }>(
      "SELECT content FROM document_version WHERE document_id = $1 AND version_no = $2",
      [documentId, versionNo],
    );
    if (!source.rows[0]) throw new DocumentRuleError("not-found");
    return insertVersion(
      tx,
      tenantId,
      documentId,
      source.rows[0].content,
      `restore of v${versionNo}`,
      userId,
    );
  });
}

export async function listSignoffs(documentId: string): Promise<SignoffInfo[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string;
      role: SignoffRole;
      version_no: number;
      user_name: string;
      signed_at: string;
      voided_at: string | null;
      void_reason: string | null;
    }>(
      `SELECT s.id, s.role, s.version_no, coalesce(u.name, u.email) AS user_name,
              to_char(s.signed_at, 'YYYY-MM-DD HH24:MI') AS signed_at,
              to_char(s.voided_at, 'YYYY-MM-DD HH24:MI') AS voided_at, s.void_reason
         FROM signoff s
         JOIN app_user u ON u.id = s.user_id
        WHERE s.document_id = $1
        ORDER BY s.signed_at`,
      [documentId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      role: row.role,
      versionNo: row.version_no,
      userName: row.user_name,
      signedAt: row.signed_at,
      voidedAt: row.voided_at,
      voidReason: row.void_reason,
    }));
  });
}

/**
 * Sign the current version. Two-stage minimum (spec §6.3): preparer first, then
 * reviewer — reviewer/partner require review authority, an active preparer
 * sign-off, and NO open review notes. The reviewer sign-off locks the document.
 */
export async function signDocument(documentId: string, role: SignoffRole): Promise<void> {
  const { tenantId, userId, role: userRole } = await requireTenant();
  if (role === "reviewer" && !canReview(userRole)) throw new DocumentRuleError("forbidden");
  if (role === "partner" && !canPartnerSignoff(userRole)) throw new DocumentRuleError("forbidden");

  await withTenant(tenantId, async (tx) => {
    const arch = await tx.query<{ archived_at: string | null }>(
      "SELECT e.archived_at::text FROM document d JOIN engagement e ON e.id = d.engagement_id WHERE d.id = $1",
      [documentId],
    );
    if (arch.rows[0]?.archived_at) throw new DocumentRuleError("archived");
    const doc = await tx.query<{ status: string; current_version: number; checked_out_by: string | null }>(
      "SELECT status, current_version, checked_out_by FROM document WHERE id = $1 FOR UPDATE",
      [documentId],
    );
    const row = doc.rows[0];
    if (!row) throw new DocumentRuleError("not-found");
    if (row.status === "signed") throw new DocumentRuleError("signed-locked");
    if (row.current_version === 0) throw new DocumentRuleError("no-version");
    if (row.checked_out_by) throw new DocumentRuleError("checked-out");

    const active = await tx.query<{ role: SignoffRole }>(
      "SELECT role FROM signoff WHERE document_id = $1 AND voided_at IS NULL",
      [documentId],
    );
    const activeRoles = new Set(active.rows.map((r) => r.role));
    if (activeRoles.has(role)) throw new DocumentRuleError("already-signed");
    if (role !== "preparer" && !activeRoles.has("preparer"))
      throw new DocumentRuleError("preparer-first");

    if (role !== "preparer") {
      const openNotes = await tx.query<{ n: string }>(
        "SELECT count(*)::text AS n FROM review_note WHERE document_id = $1 AND status = 'open'",
        [documentId],
      );
      if (Number(openNotes.rows[0].n) > 0) throw new DocumentRuleError("open-notes");
    }

    await tx.query(
      `INSERT INTO signoff (tenant_id, document_id, version_no, role, user_id)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, documentId, row.current_version, role, userId],
    );

    // The reviewer sign-off completes the two-stage minimum and locks the paper.
    if (role === "reviewer" || role === "partner") {
      await tx.query("UPDATE document SET status = 'signed' WHERE id = $1", [documentId]);
    }
  });
}

/**
 * Reopen a signed document with a reason: voids every active sign-off, unlocks
 * the paper, and notifies the signers whose sign-offs were voided (spec §9.5).
 */
export async function reopenDocument(documentId: string, reason: string): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  const signers: { user_id: string; title: string }[] = [];

  await withTenant(tenantId, async (tx) => {
    const doc = await tx.query<{ status: string; title: string }>(
      "SELECT status, title FROM document WHERE id = $1 FOR UPDATE",
      [documentId],
    );
    const row = doc.rows[0];
    if (!row) throw new DocumentRuleError("not-found");
    if (!reason.trim()) throw new DocumentRuleError("reason-required");

    const voided = await tx.query<{ user_id: string }>(
      `UPDATE signoff SET voided_at = now(), void_reason = $2
        WHERE document_id = $1 AND voided_at IS NULL
        RETURNING user_id`,
      [documentId, reason],
    );
    signers.push(...voided.rows.map((r) => ({ user_id: r.user_id, title: row.title })));
    await tx.query("UPDATE document SET status = 'draft' WHERE id = $1", [documentId]);
  });

  // Notify outside the transaction (notification failure must not roll back the reopen).
  for (const signer of signers) {
    if (signer.user_id === userId) continue;
    await createNotification({
      tenantId,
      userId: signer.user_id,
      kind: "signoff-voided",
      title: `Sign-off voided: ${signer.title}`,
      body: reason,
    });
  }
}

export async function listReviewNotes(documentId: string): Promise<ReviewNoteInfo[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string;
      author_name: string;
      body: string;
      response: string | null;
      status: "open" | "cleared";
      created_at: string;
    }>(
      `SELECT n.id, coalesce(u.name, u.email) AS author_name, n.body, n.response, n.status,
              to_char(n.created_at, 'YYYY-MM-DD HH24:MI') AS created_at
         FROM review_note n
         JOIN app_user u ON u.id = n.author_id
        WHERE n.document_id = $1
        ORDER BY n.created_at`,
      [documentId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      authorName: row.author_name,
      body: row.body,
      response: row.response,
      status: row.status,
      createdAt: row.created_at,
    }));
  });
}

export async function addReviewNote(documentId: string, body: string): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (!body.trim()) throw new DocumentRuleError("body-required");
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      "INSERT INTO review_note (tenant_id, document_id, author_id, body) VALUES ($1, $2, $3, $4)",
      [tenantId, documentId, userId, body],
    );
  });
}

export async function clearReviewNote(noteId: string, response: string): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  if (!response.trim()) throw new DocumentRuleError("response-required");
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `UPDATE review_note
          SET status = 'cleared', response = $2, cleared_at = now(), cleared_by = $3
        WHERE id = $1 AND status = 'open'`,
      [noteId, response, userId],
    );
  });
}
