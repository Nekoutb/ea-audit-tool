// Phase 9 (9.6): regulator export — the full file index with statuses as a
// real .xlsx workbook (code, titles, owner, document state, sign-offs,
// section conclusion state).

import ExcelJS from "exceljs";
import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export async function exportFileIndex(
  engagementId: string,
): Promise<{ filename: string; content: Buffer } | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const engagement = await tx.query<{ client_name: string; fiscal_year: number; phase: string }>(
      `SELECT c.name AS client_name, e.fiscal_year, e.phase
         FROM engagement e JOIN client c ON c.id = e.client_id WHERE e.id = $1`,
      [engagementId],
    );
    if (!engagement.rows[0]) return null;

    const items = await tx.query<{
      code: string; title_en: string; title_fr: string; section: string;
      owner: string | null; doc_status: string | null; doc_version: number | null;
      preparer: string | null; reviewer: string | null; partner: string | null;
      conclusion_state: string | null;
    }>(
      `SELECT fi.code, fi.title_en, fi.title_fr, fi.section,
              (SELECT coalesce(name, email) FROM app_user WHERE id = fi.owner_id) AS owner,
              d.status AS doc_status, d.current_version AS doc_version,
              (SELECT coalesce(u.name, u.email) FROM signoff s JOIN app_user u ON u.id = s.user_id
                WHERE s.document_id = d.id AND s.role = 'preparer' AND s.voided_at IS NULL LIMIT 1) AS preparer,
              (SELECT coalesce(u.name, u.email) FROM signoff s JOIN app_user u ON u.id = s.user_id
                WHERE s.document_id = d.id AND s.role = 'reviewer' AND s.voided_at IS NULL LIMIT 1) AS reviewer,
              (SELECT coalesce(u.name, u.email) FROM signoff s JOIN app_user u ON u.id = s.user_id
                WHERE s.document_id = d.id AND s.role = 'partner' AND s.voided_at IS NULL LIMIT 1) AS partner,
              (SELECT CASE WHEN sc.partner_reviewed_by IS NOT NULL THEN 'partner-reviewed'
                           WHEN sc.reviewed_by IS NOT NULL THEN 'reviewed'
                           ELSE 'prepared' END
                 FROM section_conclusion sc WHERE sc.file_item_id = fi.id) AS conclusion_state
         FROM file_item fi
         LEFT JOIN LATERAL (
           SELECT id, status, current_version FROM document
            WHERE file_item_id = fi.id AND kind = 'workpaper'
            ORDER BY created_at LIMIT 1
         ) d ON true
        WHERE fi.engagement_id = $1
        ORDER BY fi.sort_order`,
      [engagementId],
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("File index");
    sheet.columns = [
      { header: "Code", key: "code", width: 8 },
      { header: "Title (EN)", key: "titleEn", width: 45 },
      { header: "Titre (FR)", key: "titleFr", width: 45 },
      { header: "Section", key: "section", width: 8 },
      { header: "Owner", key: "owner", width: 22 },
      { header: "Document", key: "docStatus", width: 12 },
      { header: "Version", key: "docVersion", width: 8 },
      { header: "Preparer", key: "preparer", width: 22 },
      { header: "Reviewer", key: "reviewer", width: 22 },
      { header: "Partner", key: "partner", width: 22 },
      { header: "Conclusion", key: "conclusion", width: 18 },
    ];
    sheet.getRow(1).font = { bold: true };
    sheet.insertRow(1, [
      `${engagement.rows[0].client_name} — FY ${engagement.rows[0].fiscal_year} — phase: ${engagement.rows[0].phase}`,
    ]);
    sheet.getRow(1).font = { bold: true, size: 13 };
    for (const item of items.rows) {
      sheet.addRow({
        code: item.code, titleEn: item.title_en, titleFr: item.title_fr, section: item.section,
        owner: item.owner ?? "", docStatus: item.doc_status ?? "—", docVersion: item.doc_version ?? "",
        preparer: item.preparer ?? "", reviewer: item.reviewer ?? "", partner: item.partner ?? "",
        conclusion: item.conclusion_state ?? "",
      });
    }
    const content = Buffer.from(await workbook.xlsx.writeBuffer());
    return {
      filename: `file-index-${engagement.rows[0].fiscal_year}.xlsx`,
      content,
    };
  });
}
