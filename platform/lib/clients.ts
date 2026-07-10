import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export type LegalForm = "SA" | "SARL" | "SAS" | "GIE" | "OTHER";

export const LEGAL_FORMS: readonly LegalForm[] = ["SA", "SARL", "SAS", "GIE", "OTHER"];

export function isLegalForm(value: unknown): value is LegalForm {
  return typeof value === "string" && (LEGAL_FORMS as readonly string[]).includes(value);
}

export interface Client {
  id: string;
  name: string;
  legalForm: LegalForm;
  listed: boolean;
  coCac: boolean;
  engagementCount: number;
}

interface ClientRow {
  id: string;
  name: string;
  legal_form: LegalForm;
  listed: boolean;
  co_cac: boolean;
  engagement_count: string;
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
