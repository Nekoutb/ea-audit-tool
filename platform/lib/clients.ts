import { withTenant } from "@/lib/db";
import { canManageFirm } from "@/lib/rbac";
import { ForbiddenError, requireTenant, requireWrite } from "@/lib/tenant";

export type LegalForm = "SA" | "SARL" | "SAS" | "GIE" | "OTHER";

export const LEGAL_FORMS: readonly LegalForm[] = ["SA", "SARL", "SAS", "GIE", "OTHER"];

/** The legal form as the reader sees it: 'OTHER' reads 'Autre' / 'Other' (UAT B115). */
export function legalFormLabel(form: string, locale: "en" | "fr"): string {
  return form === "OTHER" ? (locale === "fr" ? "Autre" : "Other") : form;
}

export function isLegalForm(value: unknown): value is LegalForm {
  return typeof value === "string" && (LEGAL_FORMS as readonly string[]).includes(value);
}

/** Accounting frameworks selectable on the entity record (free-text column). */
export const FRAMEWORKS = ["SYSCOHADA", "IFRS", "Other"] as const;
export type Framework = (typeof FRAMEWORKS)[number];

/**
 * Sectors offered on the entity record (UAT B126); labels live in
 * messages/*.json under clients.sectors. Stored as the key.
 */
export const SECTORS = [
  "agriculture",
  "industry",
  "trade",
  "services",
  "financial",
  "telecom",
  "energy",
  "construction",
  "transport",
  "public",
  "other",
] as const;
export type Sector = (typeof SECTORS)[number];

export function isSector(value: unknown): value is Sector {
  return typeof value === "string" && (SECTORS as readonly string[]).includes(value);
}

export interface Client {
  id: string;
  name: string;
  legalForm: LegalForm;
  listed: boolean;
  coCac: boolean;
  engagementCount: number;
  /** Industry key (SECTORS), or null when not recorded. */
  sector?: string | null;
  /** Set when the client has been retired from the register (UAT B98). */
  archivedAt?: string | null;
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
  sector?: string | null;
  archived_at?: string | null;
}

/**
 * The register. Retired clients are left out unless asked for, and `q`
 * narrows by name, registration number or tax ID — a client with no
 * engagement used to be unfindable, since the global search indexes
 * engagements only (UAT B98).
 */
export async function listClients(options: { includeArchived?: boolean; q?: string } = {}): Promise<Client[]> {
  const { tenantId } = await requireTenant();
  const q = options.q?.trim() ?? "";
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<ClientRow>(
      `SELECT c.id, c.name, c.legal_form, c.listed, c.co_cac,
              c.registration_number, c.year_end, c.sector, c.archived_at::text,
              count(e.id)::text AS engagement_count
         FROM client c
         LEFT JOIN engagement e ON e.client_id = c.id
        WHERE ($1::boolean OR c.archived_at IS NULL)
          AND ($2 = '' OR c.name ILIKE '%' || $3 || '%' ESCAPE '\\'
               OR coalesce(c.registration_number, '') ILIKE '%' || $3 || '%' ESCAPE '\\'
               OR coalesce(c.niu, '') ILIKE '%' || $3 || '%' ESCAPE '\\')
        GROUP BY c.id
        ORDER BY c.name`,
      // % and _ are searched as themselves, not as wildcards (UAT B162)
      [options.includeArchived === true, q, q.replace(/[\\%_]/g, (c) => `\\${c}`)],
    );
    return result.rows.map((row) => ({
      id: row.id,
      name: row.name,
      legalForm: row.legal_form,
      listed: row.listed,
      coCac: row.co_cac,
      engagementCount: Number(row.engagement_count),
      registrationNumber: row.registration_number ?? null,
      yearEnd: row.year_end ?? null,
      sector: row.sector ?? null,
      archivedAt: row.archived_at ?? null,
    }));
  });
}

/** Retire a client from the register, or reinstate it. Firm admin only. */
export async function setClientArchived(id: string, archived: boolean): Promise<void> {
  const { tenantId, role } = await requireWrite();
  if (!canManageFirm(role)) throw new ForbiddenError("forbidden");
  await withTenant(tenantId, async (tx) => {
    const updated = await tx.query(
      `UPDATE client SET archived_at = CASE WHEN $2 THEN coalesce(archived_at, now()) ELSE NULL END WHERE id = $1`,
      [id, archived],
    );
    if ((updated.rowCount ?? 0) === 0) throw new Error("not-found");
  });
}

export async function getClient(id: string): Promise<Client | null> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<ClientRow>(
      `SELECT c.id, c.name, c.legal_form, c.listed, c.co_cac,
              c.registration_number, c.niu, c.address, c.year_end, c.framework, c.pie,
              c.sector, c.archived_at::text,
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
      sector: row.sector ?? null,
      archivedAt: row.archived_at ?? null,
    };
  });
}

export async function createClient(input: {
  name: string;
  legalForm: LegalForm;
  listed: boolean;
  coCac: boolean;
  sector?: Sector | null;
}): Promise<string> {
  const { tenantId } = await requireWrite();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ id: string }>(
      `INSERT INTO client (tenant_id, name, legal_form, listed, co_cac, sector)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [tenantId, input.name, input.legalForm, input.listed, input.coCac, input.sector ?? null],
    );
    return result.rows[0].id;
  });
}
