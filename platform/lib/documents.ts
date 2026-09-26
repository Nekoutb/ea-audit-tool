import { createHash } from "node:crypto";
import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import { generateWorkpaperDocx } from "@/lib/docx";
import type { Locale } from "@/lib/i18n";
import { createNotification } from "@/lib/notifications";
import { atLeast, canPartnerSignoff, canReview, type Role } from "@/lib/rbac";
import { applyOverride } from "@/lib/template-overrides";
import { templateFor } from "@/lib/templates";
import { ForbiddenError, requireRole, requireTenant, requireWrite } from "@/lib/tenant";
import { hasBespokePaper, paperContentHashTx, paperFor, paperMissing } from "@/lib/working-papers";
import { visibleToUser } from "@/lib/engagement-access";
import { logReopen, logSignOff, logSignOffVoided, logVersionRestored, recordActivity } from "@/lib/activity";
import { loadBranding } from "@/lib/branding";
import { phaseOfTask } from "@/lib/engagement-dashboard";
import { phaseStillOpen } from "@/lib/gates";

export const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/**
 * "eqr" is the engagement quality reviewer's own sign-off: only on C4.2, only
 * by the appointed reviewer; the eqr_complete gate requires it (UAT run 3 B02).
 */
export type SignoffRole = "preparer" | "reviewer" | "partner" | "eqr";
const SIGNOFF_ROLES: readonly string[] = ["preparer", "reviewer", "partner", "eqr"];

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
  /** set when a later edit changed the content this signature attested to */
  invalidatedAt: string | null;
  invalidatedReason: string | null;
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
  const { tenantId, userId } = await requireWrite();
  const owner = await withTenant(tenantId, (tx) =>
    tx.query<{ engagement_id: string }>("SELECT engagement_id FROM file_item WHERE id = $1", [fileItemId]),
  );
  if (owner.rows[0]) {
    const { role } = await requireTenant();
    if (!(await visibleToUser(owner.rows[0].engagement_id, tenantId, userId, role))) {
      throw new ForbiddenError("not-on-this-engagement");
    }
  }
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
      archived_at: string | null;
      user_name: string | null;
      user_email: string;
    }>(
      `SELECT fi.id, fi.engagement_id, fi.code, fi.title_en, fi.title_fr,
              c.name AS client_name, e.fiscal_year,
              to_char(e.period_end, 'YYYY-MM-DD') AS period_end,
              e.archived_at::text AS archived_at,
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
    // Creating the paper is a write: a closed file gets the plain refusal, not
    // the archive trigger's 500 (UAT B42).
    if (row.archived_at) throw new DocumentRuleError("archived");

    const title = locale === "fr" ? row.title_fr : row.title_en;
    // Firm-level template customization (Template management) applies to NEW
    // documents only; existing bytes stay frozen in document_version.
    const template = await applyOverride(tx, row.code, templateFor(row.code));
    // The firm's letterhead in the header and footer of every paper (UAT B145).
    const branding = await loadBranding(tx, tenantId).catch(() => null);
    const content = await generateWorkpaperDocx(
      template,
      {
        code: row.code,
        title,
        clientName: row.client_name,
        fiscalYear: row.fiscal_year,
        periodEnd: row.period_end,
        preparedBy: row.user_name ?? row.user_email,
        extraRows: row.code === "S6.1" ? await strategyMemoRows(tx, row.engagement_id, locale) : undefined,
      },
      locale,
      branding,
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
    await recordActivity({
      engagementId: row.engagement_id,
      entityType: "document",
      entityId: documentId,
      action: "document_generated",
      summary: `${row.code} working paper generated (${template.id}@${template.version})`,
      after: { code: row.code, template: template.id, version: 1 },
    });
    return documentId;
  });
}

/**
 * The S6.1 memorandum's own figures (UAT B74): the approved materiality, the
 * significant risks, the scoped sections and the answers the preparer gave
 * on the S6.1 paper, merged into the identity block of the generated .docx.
 */
async function strategyMemoRows(
  tx: PoolClient,
  engagementId: string,
  locale: Locale,
): Promise<{ label: string; value: string }[]> {
  const fr = locale === "fr";
  const n = (x: string | number) => new Intl.NumberFormat("fr-FR").format(Number(x));
  const [m, risks, scoped, answers] = await Promise.all([
    tx.query<{ benchmark: string; percentage: string; overall: string; performance: string; trivial: string }>(
      `SELECT benchmark, percentage::text, overall::text, performance::text, trivial::text
         FROM materiality WHERE engagement_id = $1 AND status = 'approved'
        ORDER BY version_no DESC LIMIT 1`,
      [engagementId],
    ),
    tx.query<{ description: string }>(
      "SELECT description FROM risk WHERE engagement_id = $1 AND significant AND rebutted = false ORDER BY created_at LIMIT 12",
      [engagementId],
    ),
    tx.query<{ codes: string | null }>(
      `SELECT string_agg(code, ', ' ORDER BY sort_order) AS codes
         FROM file_item WHERE engagement_id = $1 AND section = 'E' AND material`,
      [engagementId],
    ),
    tx.query<{ field_key: string; value: string | null }>(
      "SELECT field_key, value #>> '{}' AS value FROM form_response WHERE engagement_id = $1 AND code = 'wp:S6.1'",
      [engagementId],
    ),
  ]);
  const a = Object.fromEntries(answers.rows.map((r) => [r.field_key, r.value ?? ""]));
  const mat = m.rows[0];
  return [
    {
      label: fr ? "Seuil de signification approuvé" : "Approved materiality",
      value: mat
        ? `${mat.benchmark} · ${mat.percentage} % · PM ${n(mat.overall)} · TE ${n(mat.performance)} · SAD ${n(mat.trivial)} FCFA`
        : fr ? "Non encore approuvé" : "Not approved yet",
    },
    {
      label: fr ? "Risques importants" : "Significant risks",
      value: risks.rows.length ? risks.rows.map((r) => r.description).join(" ; ") : "—",
    },
    { label: fr ? "Sections significatives (E)" : "Material sections (E)", value: scoped.rows[0]?.codes ?? "—" },
    { label: fr ? "Orientation donnée à l'équipe" : "Direction set for the team", value: a.direction?.trim() || "—" },
    { label: fr ? "Modifications de la stratégie" : "Changes to the strategy", value: a.changes?.trim() || "—" },
  ];
}

/**
 * Every entry point that takes a document id goes through here (UAT B03/B05).
 * The id alone used to be enough: anyone in the firm who had it could read or
 * work on a document of an engagement they were not staffed on, and the C5.6
 * letter on a fait délictueux — which ISA 250 / the OHADA statutory duty keeps
 * between the signing partner and the procureur — opened for a staff member.
 * An id that does not exist falls through so the caller's own not-found
 * handling still applies.
 */
export async function guardDocument(documentId: string): Promise<void> {
  const { tenantId, userId, role } = await requireTenant();
  const result = await withTenant(tenantId, (tx) =>
    tx.query<{ engagement_id: string; fait: boolean }>(
      `SELECT d.engagement_id,
              EXISTS (SELECT 1 FROM fait_delictueux f WHERE f.document_id = d.id) AS fait
         FROM document d WHERE d.id = $1`,
      [documentId],
    ),
  );
  const row = result.rows[0];
  if (!row) return;
  if (!(await visibleToUser(row.engagement_id, tenantId, userId, role))) {
    throw new ForbiddenError("not-on-this-engagement");
  }
  if (row.fait && !canPartnerSignoff(role)) throw new ForbiddenError("fait-partner-only");
}

export async function getDocument(documentId: string): Promise<DocumentDetail | null> {
  const { tenantId } = await requireTenant();
  await guardDocument(documentId);
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

/**
 * The documents filed on a task other than its own generated working paper:
 * accepted PBC uploads, generated letters, archived confirmations. The task
 * page lists them beside the attachments so evidence accepted through the
 * portal is found on the task it was accepted into, not only in the index.
 */
export async function listItemDocuments(
  fileItemId: string,
): Promise<{ id: string; title: string; kind: string; currentVersion: number; createdAt: string }[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ id: string; title: string; kind: string; current_version: number; created_at: string }>(
      `SELECT d.id, d.title, d.kind, d.current_version, to_char(d.created_at, 'DD Mon YYYY') AS created_at
         FROM document d
        WHERE d.file_item_id = $1 AND d.current_version > 0
          AND NOT (d.kind = 'workpaper' AND d.title NOT LIKE 'PBC — %')
        ORDER BY d.created_at DESC`,
      [fileItemId],
    );
    return result.rows.map((r) => ({ id: r.id, title: r.title, kind: r.kind, currentVersion: r.current_version, createdAt: r.created_at }));
  });
}

export async function listVersions(documentId: string): Promise<VersionInfo[]> {
  const { tenantId } = await requireTenant();
  await guardDocument(documentId);
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
  await guardDocument(documentId);
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ content: Buffer; mime: string; code: string; title: string; note: string | null }>(
      `SELECT v.content, v.mime, fi.code, d.title, v.note
         FROM document_version v
         JOIN document d ON d.id = v.document_id
         JOIN file_item fi ON fi.id = d.file_item_id
        WHERE v.document_id = $1 AND v.version_no = $2`,
      [documentId, versionNo],
    );
    const row = result.rows[0];
    if (!row) return null;
    // The dash in "PBC — title" is kept as a hyphen rather than dropped, and
    // the extension follows the bytes (a PBC upload keeps its own; a MIME we
    // know maps to its extension; a working paper is .docx) — UAT B110.
    const safeTitle = row.title.replace(/[—–]/g, "-").replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 60);
    const pbcName = row.note?.startsWith("pbc:") ? row.note.slice(4) : null;
    const pbcExt = pbcName ? /\.([A-Za-z0-9]{1,8})$/.exec(pbcName)?.[1]?.toLowerCase() : null;
    const MIME_EXT: Record<string, string> = {
      "application/pdf": "pdf",
      "text/csv": "csv",
      "application/vnd.ms-excel": "xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
      "image/png": "png",
      "image/jpeg": "jpg",
      "text/plain": "txt",
      [DOCX_MIME]: "docx",
    };
    const ext = pbcExt ?? MIME_EXT[row.mime] ?? "docx";
    return {
      content: row.content,
      mime: row.mime,
      filename: `${row.code} ${safeTitle} v${versionNo}.${ext}`,
    };
  });
}

/** Check out for editing: single editor at a time; signed documents must be reopened first. */
export async function checkoutDocument(documentId: string): Promise<void> {
  const { tenantId, userId } = await requireWrite();
  await guardDocument(documentId);
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
  const { tenantId, userId } = await requireWrite();
  await guardDocument(documentId);
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      "UPDATE document SET checked_out_by = NULL, checked_out_at = NULL WHERE id = $1 AND checked_out_by = $2",
      [documentId, userId],
    );
  });
}

/** Check in an edited file as the next version and release the lock. */
export async function checkinDocument(documentId: string, content: Buffer): Promise<number> {
  const { tenantId, userId } = await requireWrite();
  await guardDocument(documentId);
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
  await guardDocument(documentId);
  const restoredAs = await withTenant(tenantId, async (tx) => {
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
  await logVersionRestored(documentId, versionNo, restoredAs);
  return restoredAs;
}

export async function listSignoffs(documentId: string): Promise<SignoffInfo[]> {
  const { tenantId } = await requireTenant();
  await guardDocument(documentId);
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string;
      role: SignoffRole;
      version_no: number;
      user_name: string;
      signed_at: string;
      voided_at: string | null;
      void_reason: string | null;
      invalidated_at: string | null;
      invalidated_reason: string | null;
    }>(
      `SELECT s.id, s.role, s.version_no, coalesce(u.name, u.email) AS user_name,
              to_char(s.signed_at AT TIME ZONE $2, 'YYYY-MM-DD HH24:MI') || ' ' || $3 AS signed_at,
              to_char(s.voided_at AT TIME ZONE $2, 'YYYY-MM-DD HH24:MI') || ' ' || $3 AS voided_at, s.void_reason,
              to_char(s.invalidated_at AT TIME ZONE $2, 'YYYY-MM-DD HH24:MI') || ' ' || $3 AS invalidated_at,
              s.invalidated_reason
         FROM signoff s
         JOIN app_user u ON u.id = s.user_id
        WHERE s.document_id = $1
        ORDER BY s.signed_at`,
      // Shown in the firm's zone with its label, not as bare UTC (UAT B133).
      [documentId, "Africa/Douala", "WAT"],
    );
    return result.rows.map((row) => ({
      id: row.id,
      role: row.role,
      versionNo: row.version_no,
      userName: row.user_name,
      signedAt: row.signed_at,
      voidedAt: row.voided_at,
      voidReason: row.void_reason,
      invalidatedAt: row.invalidated_at,
      invalidatedReason: row.invalidated_reason,
    }));
  });
}

/**
 * Another member of the firm carries review authority (senior and above), i.e.
 * someone other than this user could review the work. Where nobody else can —
 * a sole practitioner — the self-review refusal would make the file impossible
 * to complete, so the rule stands down there and the signature record (which
 * carries the user on every role) shows preparer and reviewer are the same
 * person. Exported for the section-conclusion chain in lib/execution.ts.
 */
export async function hasOtherReviewer(
  tx: PoolClient,
  tenantId: string,
  userId: string,
): Promise<boolean> {
  const result = await tx.query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM membership
      WHERE tenant_id = $1 AND user_id <> $2
        AND role IN ('senior', 'manager', 'eqr_reviewer', 'partner', 'firm_admin')`,
    [tenantId, userId],
  );
  return Number(result.rows[0].n) > 0;
}

/**
 * Sign the current version. Two-stage minimum (spec §6.3): preparer first, then
 * reviewer — reviewer/partner require review authority, an active preparer
 * sign-off, and NO open review notes. The reviewer sign-off locks the document.
 *
 * Two integrity rules on top (assurance findings C4 / H1):
 *  - no self-review: the holder of the active preparer sign-off cannot also
 *    sign as reviewer or partner while anyone else in the firm could review;
 *  - the signature is bound to the paper's content by content_hash, so a later
 *    edit voids it (see invalidateStaleSignoffs in lib/working-papers.ts)
 *    instead of leaving an attestation standing over content nobody signed.
 */
/** Tasks whose approval belongs to the audit partner alone (operator rule). */
export const PARTNER_ONLY_APPROVAL = new Set(["P5.2", "P7.2", "S6.1", "S6.2", "S3.1", "C1.1"]);

/**
 * Papers whose phase gate looks for a PARTNER signature (lib/gates.ts). A
 * reviewer sign-off on them must not lock the paper — the partner still has
 * to sign — and a partner pressing the list's R chip is recorded as the
 * partner they are, so the gate sees it (UAT B20).
 */
export const PARTNER_GATED = new Set(["P1.1", "P2.2", "P5.2", "S3.1", "P7.2"]);

/**
 * Papers whose screen is the structured board alone (embedOnly on the section
 * page): the questionnaire is never shown, so completeness is the board's own
 * (embeddedWorkGap), not the paper's keys — which nobody can answer (UAT run 2 B08).
 */
export const EMBED_ONLY_PAPERS = new Set(["S1.2", "S1.3", "S2.1", "S2.2"]);

/** Tasks whose screen is not the questionnaire, so completeness is judged elsewhere. */
function completenessExempt(code: string): boolean {
  return code.startsWith("E4.") || code === "P7.2" || EMBED_ONLY_PAPERS.has(code) || !hasBespokePaper(code);
}

/** The S1.3 walkthrough answers every SCOT needs (the form on WalkthroughBoard — keep in sync). */
export const WALKTHROUGH_KEYS = [
  "flow_initiation", "flow_recording", "flow_processing", "flow_reporting", "people", "documents", "systems",
  "wt_item", "wt_trace", "wt_evidence", "wt_exceptions", "wt_design", "wt_implemented", "wt_conclusion",
] as const;

/**
 * What the structured board of an embed-only paper still lacks, as the
 * refusal code to raise — null when the work is complete:
 *  - S1.3: every SCOT carries every walkthrough answer;
 *  - S1.2: every SCOT has at least one what-can-go-wrong;
 *  - S2.1: every control selected for testing answers a WCGW, and every SCOT
 *    on a controls strategy has a control selected;
 *  - S2.2: every control selected for testing has its test designed.
 */
export async function embeddedWorkGap(tx: PoolClient, engagementId: string, code: string): Promise<string | null> {
  const n = async (sql: string, params: unknown[]): Promise<number> =>
    Number((await tx.query<{ n: string }>(sql, params)).rows[0]?.n ?? 0);
  if (code === "S1.3") {
    const open = await n(
      `SELECT count(*)::text AS n
         FROM scot s CROSS JOIN unnest($2::text[]) AS k(key)
        WHERE s.engagement_id = $1
          AND NOT EXISTS (SELECT 1 FROM form_response fr
                           WHERE fr.engagement_id = s.engagement_id AND fr.code = 'wt:' || s.id
                             AND fr.field_key = k.key AND btrim(coalesce(fr.value #>> '{}', '')) <> '')`,
      [engagementId, [...WALKTHROUGH_KEYS]],
    );
    return open > 0 ? "walkthrough-incomplete" : null;
  }
  if (code === "S1.2") {
    const bare = await n(
      `SELECT count(*)::text AS n FROM scot s
        WHERE s.engagement_id = $1 AND NOT EXISTS (SELECT 1 FROM wcgw w WHERE w.scot_id = s.id)`,
      [engagementId],
    );
    return bare > 0 ? "wcgw-missing" : null;
  }
  if (code === "S2.1") {
    const unlinked = await n(
      `SELECT count(*)::text AS n FROM scot_control c JOIN scot s ON s.id = c.scot_id
        WHERE s.engagement_id = $1 AND c.selected_for_testing
          AND NOT EXISTS (SELECT 1 FROM wcgw_control wc WHERE wc.control_id = c.id)`,
      [engagementId],
    );
    const unselected = await n(
      `SELECT count(*)::text AS n FROM scot s
        WHERE s.engagement_id = $1 AND s.strategy = 'controls'
          AND NOT EXISTS (SELECT 1 FROM scot_control c WHERE c.scot_id = s.id AND c.selected_for_testing)`,
      [engagementId],
    );
    return unlinked + unselected > 0 ? "control-selection-incomplete" : null;
  }
  if (code === "S2.2") {
    const undesigned = await n(
      `SELECT count(*)::text AS n FROM scot_control c JOIN scot s ON s.id = c.scot_id
        WHERE s.engagement_id = $1 AND c.selected_for_testing
          AND btrim(coalesce(c.test_design, '')) = ''`,
      [engagementId],
    );
    return undesigned > 0 ? "test-design-missing" : null;
  }
  return null;
}

/** Returns the sign-off tier actually recorded (a partner's R on a gated paper is "partner"). */
export async function signDocument(documentId: string, requested: SignoffRole): Promise<SignoffRole> {
  const { tenantId, userId, role: userRole } = await requireWrite();
  await guardDocument(documentId);
  if (!SIGNOFF_ROLES.includes(requested)) throw new DocumentRuleError("forbidden");
  // The EQR reviews the file independently of the team (ISQM 2 ¶18): signing
  // it as preparer, reviewer or partner would make them part of the work they
  // are there to challenge (UAT B11). Their one sign-off is "eqr", on C4.2.
  // (Checked again inside the transaction for the team-role EQR, UAT run 3 B03.)
  if (userRole === "eqr_reviewer" && requested !== "eqr") throw new DocumentRuleError("forbidden");
  // Named refusals (UAT B129): the banner says which rank the role needs.
  if (requested === "reviewer" && !canReview(userRole)) throw new DocumentRuleError("requires-senior");
  if (requested === "partner" && !canPartnerSignoff(userRole)) throw new DocumentRuleError("requires-partner");
  let role: SignoffRole = requested;

  const logged = await withTenant(tenantId, async (tx) => {
    const arch = await tx.query<{ archived_at: string | null }>(
      "SELECT e.archived_at::text FROM document d JOIN engagement e ON e.id = d.engagement_id WHERE d.id = $1",
      [documentId],
    );
    if (arch.rows[0]?.archived_at) throw new DocumentRuleError("archived");
    const doc = await tx.query<{
      status: string;
      current_version: number;
      checked_out_by: string | null;
      engagement_id: string;
      code: string;
      section: string;
      kind: string;
      title: string;
      file_item_id: string;
      phase: string;
    }>(
      `SELECT d.status, d.current_version, d.checked_out_by, d.engagement_id, fi.code, fi.section,
              d.kind, d.title, d.file_item_id, e.phase
         FROM document d
         JOIN file_item fi ON fi.id = d.file_item_id
         JOIN engagement e ON e.id = d.engagement_id
        WHERE d.id = $1 FOR UPDATE OF d`,
      [documentId],
    );
    const row = doc.rows[0];
    if (!row) throw new DocumentRuleError("not-found");
    // The quality review is the appointed reviewer's own (ISQM 2 ¶24-27, UAT
    // run 3 B02/B03): the "eqr" sign-off is theirs alone and only on C4.2, and
    // the EQR — by firm role or by team role — signs nothing else. The team's
    // P/R on C4.2 attest its governance communications; they do not stand in
    // for the review, which the completion gate reads from the "eqr" sign-off.
    {
      const { actsAsEqrTx, isAppointedEqrTx, EQR_PAPER } = await import("@/lib/eqr");
      if (role === "eqr") {
        if (row.code !== EQR_PAPER) throw new DocumentRuleError("forbidden");
        if (!(await isAppointedEqrTx(tx, row.engagement_id, userId))) throw new DocumentRuleError("eqr-own-paper");
      } else if (await actsAsEqrTx(tx, row.engagement_id, userId, userRole)) {
        throw new DocumentRuleError("forbidden");
      }
    }
    // the team's reviewer signature locks the paper; the reviewer's own
    // sign-off is added over it (it attests the review, not the team's work)
    if (row.status === "signed" && role !== "eqr") throw new DocumentRuleError("signed-locked");
    // Gates, not guidance (UAT B15): nothing of a later phase is signed while
    // an earlier phase's gates are still open.
    const stillOpen = phaseStillOpen(phaseOfTask(row.section, row.code), row.phase, row.code);
    if (stillOpen) throw new DocumentRuleError(stillOpen);
    if (role === "reviewer" && PARTNER_GATED.has(row.code) && canPartnerSignoff(userRole)) role = "partner";
    // Partner-only approvals: these tasks carry the judgments only the audit
    // partner may approve — a manager's review sign-off is refused outright.
    if ((role === "reviewer" || role === "partner") && PARTNER_ONLY_APPROVAL.has(row.code) && !canPartnerSignoff(userRole)) {
      throw new DocumentRuleError("partner-only");
    }
    if (row.current_version === 0) throw new DocumentRuleError("no-version");
    if (row.checked_out_by) throw new DocumentRuleError("checked-out");
    // P2.1 concludes on the team's independence: it cannot be reviewed or
    // approved while a confirmation is outstanding or an exception has no
    // partner disposition (IESBA Code, ISQM 1 ¶29).
    if (row.code === "P2.1" && role !== "preparer") {
      const { independenceOpenTx } = await import("@/lib/independence");
      if (await independenceOpenTx(tx, row.engagement_id)) throw new DocumentRuleError("independence-open");
    }

    // A member who has not accepted the engagement (still invited, or
    // declined) signs nothing on it (UAT B133). Someone with no team row at
    // all is not blocked here: engagement access is guarded upstream.
    const membership = await tx.query<{ status: string }>(
      "SELECT coalesce(status, 'accepted') AS status FROM team_member WHERE engagement_id = $1 AND user_id = $2",
      [row.engagement_id, userId],
    );
    const teamStatus = membership.rows[0]?.status;
    if (teamStatus === "invited" || teamStatus === "declined") {
      throw new DocumentRuleError("accept-engagement-first");
    }

    const active = await tx.query<{ role: SignoffRole; user_id: string }>(
      "SELECT role, user_id FROM signoff WHERE document_id = $1 AND voided_at IS NULL AND invalidated_at IS NULL",
      [documentId],
    );
    const activeRoles = new Set(active.rows.map((r) => r.role));
    if (activeRoles.has(role)) throw new DocumentRuleError("already-signed");
    if (role !== "preparer" && role !== "eqr" && !activeRoles.has("preparer"))
      throw new DocumentRuleError("preparer-first");

    // A blank paper carries nothing to attest to (UAT B17): every procedure,
    // evaluation and conclusion is answered, and every "No" explained, before
    // the preparer hands off or a reviewer signs. An explicit N/A counts.
    if (row.kind === "workpaper" && !completenessExempt(row.code)) {
      const answers = await tx.query<{ field_key: string; value: string | null }>(
        "SELECT field_key, value #>> '{}' AS value FROM form_response WHERE engagement_id = $1 AND code = $2",
        [row.engagement_id, `wp:${row.code}`],
      );
      const values = Object.fromEntries(answers.rows.map((r) => [r.field_key, r.value ?? ""]));
      if (paperMissing(paperFor(row.code), values).length > 0) throw new DocumentRuleError("paper-incomplete");
    }
    if (row.kind === "workpaper" && EMBED_ONLY_PAPERS.has(row.code)) {
      const gap = await embeddedWorkGap(tx, row.engagement_id, row.code);
      if (gap) throw new DocumentRuleError(gap);
    }
    // The approval of the plan is the partner's signature on the P7.2 summary,
    // which requires every confirmation and deliverable; the row's R/P chip
    // cannot stand in for it with the summary unapproved (UAT run 2 B07).
    if (row.code === "P7.2" && role !== "preparer") {
      const { rasPartnerApprovedTx } = await import("@/lib/planning-ras");
      if (!(await rasPartnerApprovedTx(tx, row.engagement_id))) throw new DocumentRuleError("ras-not-approved");
    }

    if (role !== "preparer" && role !== "eqr") {
      // ISA 220 (Revised) ¶29: the work of the preparer is reviewed by someone
      // else. Refuse the reviewer/partner signature to the preparer themselves.
      const preparer = active.rows.find((r) => r.role === "preparer");
      if (
        preparer &&
        preparer.user_id === userId &&
        (await hasOtherReviewer(tx, tenantId, userId))
      ) {
        throw new DocumentRuleError("self-review");
      }

      // Notes hang on the document OR on its task (two stores, one paper):
      // either kind blocks the reviewer while open (UAT B18).
      const openNotes = await tx.query<{ n: string }>(
        `SELECT count(*)::text AS n FROM review_note
          WHERE status = 'open' AND (document_id = $1 OR file_item_id = $2)`,
        [documentId, row.file_item_id],
      );
      if (Number(openNotes.rows[0].n) > 0) throw new DocumentRuleError("open-notes");
    }

    // Bind the signature to the paper content as it stands right now.
    const contentHash = await paperContentHashTx(tx, row.engagement_id, row.code);
    await tx.query(
      `INSERT INTO signoff (tenant_id, document_id, version_no, role, user_id, content_hash)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, documentId, row.current_version, role, userId, contentHash],
    );

    // The reviewer sign-off completes the two-stage minimum and locks the
    // paper — except on the partner-gated papers, which stay open until the
    // partner's own signature is recorded (UAT B20).
    // (The EQR's own sign-off does not lock the paper: the team still signs
    // its governance communications on C4.2, and the gate reads the "eqr" row.)
    if (role === "partner" || (role === "reviewer" && !PARTNER_GATED.has(row.code))) {
      await tx.query("UPDATE document SET status = 'signed' WHERE id = $1", [documentId]);
    }
    return { engagementId: row.engagement_id, title: `${row.code} ${row.title}`, versionNo: row.current_version };
  });
  await logSignOff(documentId, role, logged);
  return role;
}

/**
 * Reopen a signed document with a reason: voids every active sign-off, unlocks
 * the paper, and notifies the signers whose sign-offs were voided (spec §9.5).
 */
/** Lowest firm rank that could have produced each sign-off tier. */
const SIGNOFF_TIER_FLOOR: Record<string, Role | undefined> = {
  preparer: "staff",
  reviewer: "senior",
  partner: "partner",
  eqr: "partner",
};

export async function reopenDocument(documentId: string, reason: string): Promise<void> {
  // Un-signing is the mirror of signing and must not be cheaper than it.
  // signDocument refuses a reviewer signature below senior and a partner
  // signature below partner; without a floor here, a preparer could void both.
  const { tenantId, userId, role } = await requireRole("manager");
  await guardDocument(documentId);
  const signers: { user_id: string; title: string }[] = [];
  let reopenedGate: { engagementId: string; code: string; phase: string; fileItemId: string | null } | null = null;
  // what the trail entries name (UAT B62: they were stored with no engagement)
  // (a holder rather than a `let`: TS does not see assignments made inside the
  // transaction callback, so a plain variable would still read as null here)
  const reopened: { engagementId?: string; title?: string } = {};

  await withTenant(tenantId, async (tx) => {
    const doc = await tx.query<{ status: string; title: string; engagement_id: string; kind: string; code: string | null; file_item_id: string | null; phase: string }>(
      `SELECT d.status, d.title, d.engagement_id, d.kind, fi.code, d.file_item_id, e.phase
         FROM document d
         JOIN engagement e ON e.id = d.engagement_id
         LEFT JOIN file_item fi ON fi.id = d.file_item_id
        WHERE d.id = $1 FOR UPDATE OF d`,
      [documentId],
    );
    const row = doc.rows[0];
    if (!row) throw new DocumentRuleError("not-found");
    if (!reason.trim()) throw new DocumentRuleError("reason-required");
    reopened.engagementId = row.engagement_id;
    reopened.title = row.code ? `${row.code} ${row.title}` : row.title;
    // Voiding the partner signature on a gating paper after its phase has
    // closed leaves the engagement past a gate it no longer satisfies; the
    // phase does not move back, so the event is flagged and logged (UAT B99).
    const gatePhase = row.kind === "workpaper" && row.code ? GATE_PAPER_PHASE[row.code] : undefined;
    if (gatePhase && PHASE_ORDER.indexOf(row.phase) > PHASE_ORDER.indexOf(gatePhase)) {
      reopenedGate = { engagementId: row.engagement_id, code: row.code!, phase: row.phase, fileItemId: row.file_item_id };
    }

    // Once the report is signed, reopening a paper is a post-report-date change
    // to the audit documentation (ISA 230 para 16) and is the partner's call.
    const eng = await tx.query<{ report_date: string | null }>(
      "SELECT report_date::text FROM engagement WHERE id = $1",
      [row.engagement_id],
    );
    if (eng.rows[0]?.report_date && !canPartnerSignoff(role)) {
      throw new ForbiddenError("requires-partner-after-report-date");
    }

    // Dominance: you may not void an attestation more senior than your own.
    // signoff.role is the sign-off TIER (preparer/reviewer/partner), so it maps
    // to the lowest firm rank that could have made it — the same floors
    // signDocument enforces when the signature is created.
    const held = await tx.query<{ role: string }>(
      "SELECT DISTINCT role FROM signoff WHERE document_id = $1 AND voided_at IS NULL",
      [documentId],
    );
    for (const h of held.rows) {
      const floor = SIGNOFF_TIER_FLOOR[h.role];
      if (floor && !atLeast(role, floor)) {
        throw new ForbiddenError("cannot-void-more-senior-signoff");
      }
    }

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
      href: `/documents/${documentId}`,
    });
  }
  await logSignOffVoided(documentId, reason, {
    engagementId: reopened.engagementId,
    title: reopened.title,
    voidedUserIds: signers.map((s) => s.user_id),
  });
  await logReopen(documentId, reason, { engagementId: reopened.engagementId, title: reopened.title });
  if (reopenedGate) {
    const g: { engagementId: string; code: string; phase: string; fileItemId: string | null } = reopenedGate;
    const gatePhase = GATE_PAPER_PHASE[g.code];
    await recordActivity({
      engagementId: g.engagementId,
      entityType: "file_item",
      entityId: g.fileItemId,
      action: "gate_reopened",
      summary: `${g.code} reopened while the engagement is in ${g.phase}: the ${gatePhase} gate is no longer satisfied`,
      meta: { code: g.code, phase: g.phase, reason },
    });
    // The engagement partner decides what the reopening means for the phase.
    const partners = await withTenant(tenantId, (tx) =>
      tx.query<{ user_id: string }>(
        "SELECT user_id FROM team_member WHERE engagement_id = $1 AND team_role = 'partner'",
        [g.engagementId],
      ).then((r) => r.rows),
    );
    for (const p of partners) {
      if (p.user_id === userId) continue;
      await createNotification({
        tenantId,
        userId: p.user_id,
        kind: "gate-reopened",
        title: `${g.code} reopened after ${gatePhase} closed`,
        body: reason,
        href: `/engagements/${g.engagementId}/${gatePhase}`,
      });
    }
  }
}

/** Gating working papers and the phase each one closes (lib/gates.ts). */
const GATE_PAPER_PHASE: Record<string, string> = {
  "P1.1": "acceptance",
  "P2.2": "planning",
  "P5.2": "planning",
  "S3.1": "planning",
};
const PHASE_ORDER = ["acceptance", "planning", "execution", "conclusion", "archived"];

export async function listReviewNotes(documentId: string): Promise<ReviewNoteInfo[]> {
  const { tenantId } = await requireTenant();
  await guardDocument(documentId);
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
           -- notes raised on the task itself belong to the same paper (UAT B18)
           OR n.file_item_id = (SELECT d.file_item_id FROM document d WHERE d.id = $1)
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
  const { tenantId, userId } = await requireWrite();
  await guardDocument(documentId);
  if (!body.trim()) throw new DocumentRuleError("body-required");
  const target = await withTenant(tenantId, async (tx) => {
    const doc = await tx.query<{
      engagement_id: string;
      file_item_id: string | null;
      code: string | null;
      archived_at: string | null;
      preparer_id: string | null;
      assignee_id: string | null;
    }>(
      `SELECT d.engagement_id, d.file_item_id, fi.code, e.archived_at::text AS archived_at,
              (SELECT s.user_id FROM signoff s
                WHERE s.document_id = d.id AND s.role = 'preparer' AND s.voided_at IS NULL
                ORDER BY s.signed_at DESC LIMIT 1) AS preparer_id,
              fi.assignee_user_id AS assignee_id
         FROM document d
         JOIN engagement e ON e.id = d.engagement_id
         LEFT JOIN file_item fi ON fi.id = d.file_item_id
        WHERE d.id = $1`,
      [documentId],
    );
    const row = doc.rows[0];
    if (!row) throw new DocumentRuleError("not-found");
    // A closed file takes no notes: the plain refusal, not the trigger's 500 (UAT B42).
    if (row.archived_at) throw new DocumentRuleError("archived");
    // Addressed to the active preparer, else the task's assignee (UAT B147);
    // engagement_id set so the register finds it (UAT B18).
    const addressee = row.preparer_id ?? row.assignee_id ?? null;
    await tx.query(
      `INSERT INTO review_note (tenant_id, document_id, engagement_id, author_id, assignee_id, body)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenantId, documentId, row.engagement_id, userId, addressee, body],
    );
    return { ...row, addressee };
  });
  await recordActivity({
    engagementId: target.engagement_id,
    entityType: "document",
    entityId: documentId,
    action: "review_note_raised",
    summary: `Review note raised on ${target.code ?? "document"}`,
    meta: { fileItemId: target.file_item_id },
  });
  if (target.addressee && target.addressee !== userId) {
    try {
      await createNotification({
        tenantId,
        userId: target.addressee,
        kind: "review_note",
        title: `Review note on ${target.code ?? "a document"}`,
        body: body.trim().slice(0, 400),
        href: `/documents/${documentId}`,
      });
    } catch {
      // a failed notification must never lose the note
    }
  }
}

/**
 * Whether `userId` is the one whose work a note on this paper reviews: the
 * holder of the active preparer sign-off, or failing one the task's owner.
 * Such a person answers the note; only the reviewer side clears it (ISA 220
 * (Revised) ¶29 — UAT B19).
 */
export async function isPreparerOfNote(
  tx: PoolClient,
  noteId: string,
  userId: string,
): Promise<boolean> {
  const r = await tx.query<{ n: string }>(
    `SELECT count(*)::text AS n
       FROM review_note rn
       LEFT JOIN document d ON d.id = rn.document_id
       LEFT JOIN file_item fi ON fi.id = coalesce(rn.file_item_id, d.file_item_id)
      WHERE rn.id = $1
        AND (fi.owner_id = $2
             OR EXISTS (SELECT 1 FROM signoff s
                          JOIN document d2 ON d2.id = s.document_id
                         WHERE d2.file_item_id = fi.id AND s.role = 'preparer'
                           AND s.voided_at IS NULL AND s.user_id = $2))`,
    [noteId, userId],
  );
  return Number(r.rows[0]?.n ?? 0) > 0;
}

export async function clearReviewNote(noteId: string, response: string): Promise<void> {
  const { tenantId, userId, role } = await requireWrite();
  if (!response.trim()) throw new DocumentRuleError("response-required");
  const noteDoc = await withTenant(tenantId, (tx) =>
    tx.query<{ document_id: string }>("SELECT document_id FROM review_note WHERE id = $1", [noteId]),
  );
  if (noteDoc.rows[0]) await guardDocument(noteDoc.rows[0].document_id);
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
    // Author, or manager+ who did not prepare the paper (UAT B19): the
    // preparer replies through respondToReviewNote and the reviewer confirms.
    if (author !== userId) {
      if (!atLeast(role, "manager")) throw new ForbiddenError("requires-manager-or-author");
      if (await isPreparerOfNote(tx, noteId, userId)) throw new ForbiddenError("not-preparer-clears");
    }
    await tx.query(
      `UPDATE review_note
          SET status = 'cleared', response = coalesce(response || E'\n', '') || $2, cleared_at = now(), cleared_by = $3
        WHERE id = $1 AND status = 'open'`,
      [noteId, response, userId],
    );
  });
}
