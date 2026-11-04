import { withTenant } from "@/lib/db";
import { canManageFirm } from "@/lib/rbac";
import { ForbiddenError, requireTenant, requireWrite } from "@/lib/tenant";

// The legal forms live in lib/legal-forms.ts (client-safe) since F052 added
// SA_AG and the organ vocabulary; re-exported here for the server callers.
export { LEGAL_FORMS, isLegalForm, legalFormLabel, type LegalForm } from "@/lib/legal-forms";
import type { LegalForm } from "@/lib/legal-forms";

/**
 * Accounting frameworks selectable on a client or an engagement (F073): the
 * firm works under SYSCOHADA révisé, système normal, only. A value stored before
 * this rule (IFRS, Other) stays on the record and shows as it was.
 */
export const FRAMEWORKS = ["SYSCOHADA"] as const;
export type Framework = (typeof FRAMEWORKS)[number];
export const DEFAULT_FRAMEWORK: Framework = "SYSCOHADA";

export function frameworkLabel(raw: string | null | undefined, locale: "en" | "fr"): string | null {
  if (!raw) return null;
  if (raw === "SYSCOHADA") return locale === "fr" ? "SYSCOHADA révisé — système normal" : "SYSCOHADA revised — normal system";
  if (raw === "Other") return locale === "fr" ? "Autre" : "Other";
  return raw;
}

/** How the entity is run (F074). The legal form names the organs; this is the actual set-up. */
export const GOVERNANCE_MODES = ["ca_pdg", "ca_dg", "administrateur_general", "gerance"] as const;
export type GovernanceMode = (typeof GOVERNANCE_MODES)[number];
export const GOVERNANCE_LABELS: Record<GovernanceMode, { en: string; fr: string }> = {
  ca_pdg: { en: "Board with chair and CEO (PDG)", fr: "Conseil d'administration avec PDG" },
  ca_dg: { en: "Board with a CEO (PCA + DG)", fr: "Conseil d'administration avec PCA et DG" },
  administrateur_general: { en: "Sole director (administrateur général)", fr: "Administrateur général" },
  gerance: { en: "Management by gérant(s)", fr: "Gérance" },
};
export function isGovernanceMode(value: unknown): value is GovernanceMode {
  return typeof value === "string" && (GOVERNANCE_MODES as readonly string[]).includes(value);
}

/** Sector regulators offered on the client record (F074). */
export const REGULATORS = ["COBAC", "CIMA", "COSUMAF", "CRCA", "BEAC", "ARSEL", "ART", "OTHER"] as const;
export const REGULATOR_LABELS: Record<(typeof REGULATORS)[number], { en: string; fr: string }> = {
  COBAC: { en: "COBAC (banking)", fr: "COBAC (banque)" },
  CIMA: { en: "CIMA (insurance)", fr: "CIMA (assurance)" },
  COSUMAF: { en: "COSUMAF (capital markets)", fr: "COSUMAF (marché financier)" },
  CRCA: { en: "CRCA (cooperatives)", fr: "CRCA (coopératives)" },
  BEAC: { en: "BEAC", fr: "BEAC" },
  ARSEL: { en: "ARSEL (electricity)", fr: "ARSEL (électricité)" },
  ART: { en: "ART (telecoms)", fr: "ART (télécommunications)" },
  OTHER: { en: "Other", fr: "Autre" },
};
export function isRegulator(value: unknown): value is (typeof REGULATORS)[number] {
  return typeof value === "string" && (REGULATORS as readonly string[]).includes(value);
}

/** Who may correct the client record (F074): firm admins and partners. */
export function canEditClient(role: string | null | undefined): boolean {
  return role === "firm_admin" || role === "partner";
}

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
  shareCapital?: string | null;
  governanceMode?: string | null;
  regulator?: string | null;
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
  share_capital?: string | null;
  governance_mode?: string | null;
  regulator?: string | null;
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
              c.sector, c.archived_at::text, c.share_capital::text, c.governance_mode, c.regulator,
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
      shareCapital: row.share_capital ?? null,
      governanceMode: row.governance_mode ?? null,
      regulator: row.regulator ?? null,
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
      `INSERT INTO client (tenant_id, name, legal_form, listed, co_cac, sector, framework)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [tenantId, input.name, input.legalForm, input.listed, input.coCac, input.sector ?? null, DEFAULT_FRAMEWORK],
    );
    return result.rows[0].id;
  });
}
