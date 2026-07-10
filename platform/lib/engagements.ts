import type { PoolClient } from "pg";
import { withTenant } from "@/lib/db";
import { DEFAULT_FILE_INDEX, type Section } from "@/lib/file-index";
import { seedPresumedRisks } from "@/lib/risks";
import { requireTenant } from "@/lib/tenant";

export type EngagementPhase = "acceptance" | "planning" | "execution" | "conclusion" | "archived";

export interface EngagementSummary {
  id: string;
  clientId: string;
  clientName: string;
  fiscalYear: number;
  periodEnd: string;
  phase: EngagementPhase;
}

export interface FileItem {
  id: string;
  code: string;
  section: Section;
  titleEn: string;
  titleFr: string;
  conditional: boolean;
  ownerId: string | null;
  ownerName: string | null;
  documentId: string | null;
  documentStatus: "draft" | "signed" | null;
  documentVersion: number | null;
}

interface EngagementRow {
  id: string;
  client_id: string;
  client_name: string;
  fiscal_year: number;
  period_end: string;
  phase: EngagementPhase;
}

function toSummary(row: EngagementRow): EngagementSummary {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    fiscalYear: row.fiscal_year,
    periodEnd: row.period_end,
    phase: row.phase,
  };
}

export async function listEngagements(clientId?: string): Promise<EngagementSummary[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<EngagementRow>(
      `SELECT e.id, e.client_id, c.name AS client_name, e.fiscal_year,
              to_char(e.period_end, 'YYYY-MM-DD') AS period_end, e.phase
         FROM engagement e
         JOIN client c ON c.id = e.client_id
        WHERE ($1::uuid IS NULL OR e.client_id = $1)
        ORDER BY e.fiscal_year DESC, c.name`,
      [clientId ?? null],
    );
    return result.rows.map(toSummary);
  });
}

export async function getEngagement(id: string): Promise<EngagementSummary | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<EngagementRow>(
      `SELECT e.id, e.client_id, c.name AS client_name, e.fiscal_year,
              to_char(e.period_end, 'YYYY-MM-DD') AS period_end, e.phase
         FROM engagement e
         JOIN client c ON c.id = e.client_id
        WHERE e.id = $1`,
      [id],
    );
    return result.rows[0] ? toSummary(result.rows[0]) : null;
  });
}

async function instantiateFileIndex(
  tx: PoolClient,
  tenantId: string,
  engagementId: string,
): Promise<void> {
  let sortOrder = 0;
  for (const entry of DEFAULT_FILE_INDEX) {
    sortOrder += 10;
    await tx.query(
      `INSERT INTO file_item
         (tenant_id, engagement_id, code, section, title_en, title_fr, sort_order, conditional)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        tenantId,
        engagementId,
        entry.code,
        entry.section,
        entry.titleEn,
        entry.titleFr,
        sortOrder,
        entry.conditional ?? false,
      ],
    );
  }
}

/**
 * Create an engagement and instantiate the full default A–F file index for it
 * in the same transaction (master spec §3): either both exist or neither does.
 */
export async function createEngagement(input: {
  clientId: string;
  fiscalYear: number;
  periodEnd: string;
}): Promise<string> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ id: string }>(
      `INSERT INTO engagement (tenant_id, client_id, fiscal_year, period_end)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [tenantId, input.clientId, input.fiscalYear, input.periodEnd],
    );
    const engagementId = result.rows[0].id;
    await instantiateFileIndex(tx, tenantId, engagementId);
    // Spec §3: two presumed ISA 240 risks are auto-seeded on every engagement.
    await seedPresumedRisks(tx, tenantId, engagementId);
    return engagementId;
  });
}

/** The engagement's file index with each item's (single) document, if any. */
export async function listFileItems(engagementId: string): Promise<FileItem[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{
      id: string;
      code: string;
      section: Section;
      title_en: string;
      title_fr: string;
      conditional: boolean;
      owner_id: string | null;
      owner_name: string | null;
      document_id: string | null;
      document_status: "draft" | "signed" | null;
      document_version: number | null;
    }>(
      `SELECT fi.id, fi.code, fi.section, fi.title_en, fi.title_fr, fi.conditional,
              fi.owner_id, (SELECT coalesce(name, email) FROM app_user WHERE id = fi.owner_id) AS owner_name,
              d.id AS document_id, d.status AS document_status,
              d.current_version AS document_version
         FROM file_item fi
         LEFT JOIN LATERAL (
           SELECT id, status, current_version
             FROM document
            WHERE file_item_id = fi.id AND kind = 'workpaper'
            ORDER BY created_at
            LIMIT 1
         ) d ON true
        WHERE fi.engagement_id = $1
        ORDER BY fi.sort_order`,
      [engagementId],
    );
    return result.rows.map((row) => ({
      id: row.id,
      code: row.code,
      section: row.section,
      titleEn: row.title_en,
      titleFr: row.title_fr,
      conditional: row.conditional,
      ownerId: row.owner_id,
      ownerName: row.owner_name,
      documentId: row.document_id,
      documentStatus: row.document_status,
      documentVersion: row.document_version,
    }));
  });
}
