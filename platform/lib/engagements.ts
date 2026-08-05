import type { PoolClient } from "pg";
import { type ComplexityAnswers, type EngagementComplexity } from "@/lib/complexity";
import { withTenant } from "@/lib/db";
import { itemsForComplexity, type Section } from "@/lib/file-index";
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
  /** User-defined engagement name (naming convention); null on legacy rows. */
  name: string | null;
  complexity: EngagementComplexity;
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
  name: string | null;
  complexity: EngagementComplexity;
}

function toSummary(row: EngagementRow): EngagementSummary {
  return {
    id: row.id,
    clientId: row.client_id,
    clientName: row.client_name,
    fiscalYear: row.fiscal_year,
    periodEnd: row.period_end,
    phase: row.phase,
    name: row.name,
    complexity: row.complexity,
  };
}

/** Register row: the summary plus the columns the engagements register scans. */
export interface EngagementRegisterRow extends EngagementSummary {
  partnerName: string | null;
  tasksDone: number;
  tasksTotal: number;
  lastActivity: string | null;
  reportDate: string | null;
  /** The signed-in user is on this engagement's team or owns tasks in it. */
  isMine: boolean;
}

export async function listEngagements(clientId?: string): Promise<EngagementRegisterRow[]> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<
      EngagementRow & {
        partner_name: string | null;
        tasks_done: string;
        tasks_total: string;
        last_activity: string | null;
        report_date: string | null;
        is_mine: boolean;
      }
    >(
      `SELECT e.id, e.client_id, c.name AS client_name, e.fiscal_year,
              to_char(e.period_end, 'YYYY-MM-DD') AS period_end, e.phase, e.name, e.complexity,
              (SELECT coalesce(u.name, u.email) FROM team_member tm
                 JOIN app_user u ON u.id = tm.user_id
                WHERE tm.engagement_id = e.id AND tm.team_role = 'partner'
                ORDER BY tm.created_at LIMIT 1) AS partner_name,
              (SELECT count(*) FROM file_item fi
                WHERE fi.engagement_id = e.id AND fi.conditional = false
                  AND EXISTS (SELECT 1 FROM document d
                               WHERE d.file_item_id = fi.id AND d.status = 'signed'))::text AS tasks_done,
              (SELECT count(*) FROM file_item fi
                WHERE fi.engagement_id = e.id AND fi.conditional = false)::text AS tasks_total,
              to_char((SELECT max(al.created_at) FROM activity_log al
                        WHERE al.engagement_id = e.id), 'YYYY-MM-DD') AS last_activity,
              to_char(e.report_date, 'YYYY-MM-DD') AS report_date,
              (EXISTS (SELECT 1 FROM team_member tm WHERE tm.engagement_id = e.id AND tm.user_id = $2)
               OR EXISTS (SELECT 1 FROM file_item fi WHERE fi.engagement_id = e.id AND fi.owner_id = $2)) AS is_mine
         FROM engagement e
         JOIN client c ON c.id = e.client_id
        WHERE ($1::uuid IS NULL OR e.client_id = $1)
        ORDER BY e.fiscal_year DESC, c.name`,
      [clientId ?? null, userId],
    );
    return result.rows.map((row) => ({
      ...toSummary(row),
      partnerName: row.partner_name,
      tasksDone: Number(row.tasks_done),
      tasksTotal: Number(row.tasks_total),
      lastActivity: row.last_activity,
      reportDate: row.report_date,
      isMine: row.is_mine,
    }));
  });
}

export async function getEngagement(id: string): Promise<EngagementSummary | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<EngagementRow>(
      `SELECT e.id, e.client_id, c.name AS client_name, e.fiscal_year,
              to_char(e.period_end, 'YYYY-MM-DD') AS period_end, e.phase, e.name, e.complexity
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
  complexity: EngagementComplexity,
): Promise<void> {
  let sortOrder = 0;
  for (const entry of itemsForComplexity(complexity)) {
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
 * Create an engagement and instantiate its A–F file index in the same
 * transaction (master spec §3): either both exist or neither does. The
 * complexity classification (from the creation assessment) scales how much of
 * the index is instantiated; the legacy quick path defaults to the full
 * (complex) documentation set — the conservative choice.
 */
export async function createEngagement(input: {
  clientId: string;
  fiscalYear: number;
  periodEnd: string;
  name?: string | null;
  complexity?: EngagementComplexity;
  complexityAnswers?: ComplexityAnswers | null;
  /** Optional engagement partner — becomes the default reviewer immediately. */
  partnerId?: string | null;
}): Promise<string> {
  const { tenantId } = await requireTenant();
  const complexity = input.complexity ?? "complex";
  const name = input.name?.trim().slice(0, 120) || null;
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ id: string }>(
      `INSERT INTO engagement (tenant_id, client_id, fiscal_year, period_end, name, complexity, complexity_answers)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [
        tenantId,
        input.clientId,
        input.fiscalYear,
        input.periodEnd,
        name,
        complexity,
        input.complexityAnswers ? JSON.stringify(input.complexityAnswers) : null,
      ],
    );
    const engagementId = result.rows[0].id;
    await instantiateFileIndex(tx, tenantId, engagementId, complexity);
    // Spec §3: two presumed ISA 240 risks are auto-seeded on every engagement.
    await seedPresumedRisks(tx, tenantId, engagementId);
    // Assign the engagement partner (default reviewer) when chosen at creation.
    if (input.partnerId) {
      await tx.query(
        `INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role)
         VALUES ($1, $2, $3, 'partner')
         ON CONFLICT (engagement_id, user_id) DO NOTHING`,
        [tenantId, engagementId, input.partnerId],
      );
    }
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
