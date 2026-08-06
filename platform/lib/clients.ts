import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export type LegalForm = "SA" | "SARL" | "SAS" | "GIE" | "OTHER";

export const LEGAL_FORMS: readonly LegalForm[] = ["SA", "SARL", "SAS", "GIE", "OTHER"];

export function isLegalForm(value: unknown): value is LegalForm {
  return typeof value === "string" && (LEGAL_FORMS as readonly string[]).includes(value);
}

/** Accounting frameworks selectable on the entity record (free-text column). */
export const FRAMEWORKS = ["SYSCOHADA", "IFRS", "Other"] as const;
export type Framework = (typeof FRAMEWORKS)[number];

export interface Client {
  id: string;
  name: string;
  legalForm: LegalForm;
  listed: boolean;
  coCac: boolean;
  engagementCount: number;
  /** Entity master data (IA audit 5D) — selected by getClient only. */
  registrationNumber?: string | null;
  niu?: string | null;
  address?: string | null;
  yearEnd?: string | null;
  framework?: string | null;
  pie?: boolean;
}

interface ClientRow {
  id: string;
  name: string;
  legal_form: LegalForm;
  listed: boolean;
  co_cac: boolean;
  engagement_count: string;
  registration_number?: string | null;
  niu?: string | null;
  address?: string | null;
  year_end?: string | null;
  framework?: string | null;
  pie?: boolean;
}

export async function listClients(): Promise<Client[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<ClientRow>(
      `SELECT c.id, c.name, c.legal_form, c.listed, c.co_cac,
              count(e.id)::text AS engagement_count
         FROM client c
         LEFT JOIN engagement e ON e.client_id = c.id
        GROUP BY c.id
        ORDER BY c.name`,
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      legalForm: row.legal_form,
      listed: row.listed,
      coCac: row.co_cac,
      engagementCount: Number(row.engagement_count),
    }));
  });
}

export async function getClient(id: string): Promise<Client | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<ClientRow>(
      `SELECT c.id, c.name, c.legal_form, c.listed, c.co_cac,
              c.registration_number, c.niu, c.address, c.year_end, c.framework, c.pie,
              count(e.id)::text AS engagement_count
         FROM client c
         LEFT JOIN engagement e ON e.client_id = c.id
        WHERE c.id = $1
        GROUP BY c.id`,
      [id],
    );
    const row = result.rows[0];
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      legalForm: row.legal_form,
      listed: row.listed,
      coCac: row.co_cac,
      engagementCount: Number(row.engagement_count),
      registrationNumber: row.registration_number ?? null,
      niu: row.niu ?? null,
      address: row.address ?? null,
      yearEnd: row.year_end ?? null,
      framework: row.framework ?? null,
      pie: row.pie ?? false,
    };
  });
}

export async function createClient(input: {
  name: string;
  legalForm: LegalForm;
  listed: boolean;
  coCac: boolean;
}): Promise<string> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ id: string }>(
      `INSERT INTO client (tenant_id, name, legal_form, listed, co_cac)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [tenantId, input.name, input.legalForm, input.listed, input.coCac],
    );
    return result.rows[0].id;
  });
}
