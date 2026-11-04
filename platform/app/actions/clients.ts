"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBranding } from "@/lib/branding";
import { FRAMEWORKS, canEditClient, isGovernanceMode, isLegalForm, isRegulator, isSector, setClientArchived } from "@/lib/clients";
import { parseAmount } from "@/lib/amount";
import { applyNamingConvention } from "@/lib/complexity";
import { withTenant } from "@/lib/db";
import { getLocale } from "@/lib/locale";
import { ForbiddenError, requireTenant } from "@/lib/tenant";

/** Trimmed nullable text field ("" → NULL), length-capped. */
function text(formData: FormData, name: string, max = 200): string | null {
  const value = String(formData.get(name) ?? "")
    .trim()
    .slice(0, max);
  return value || null;
}

/**
 * Entity master data update (IA audit 5D identity panel). firm_admin and
 * partners (F074) — anyone else is bounced straight back to the record without touching the row.
 */
export async function updateClientMasterAction(clientId: string, formData: FormData): Promise<void> {
  const path = `/clients/${clientId}`;
  const { tenantId, role } = await requireTenant();
  if (canEditClient(role)) {
    // The framework is required (F074); a value from before the single-framework
    // rule (F073) may stay as it is, but cannot be newly chosen.
    const framework = text(formData, "framework");
    if (!framework) redirect(`${path}?error=framework-required`);
    const shareCapital = parseAmount(formData.get("shareCapital"));
    const governanceRaw = formData.get("governanceMode");
    const regulatorRaw = formData.get("regulator");
    const sector = text(formData, "sector");
    // Name and legal form are corrected here too (UAT B97); an absent field
    // (an older form) leaves the stored value alone.
    const name = formData.has("name") ? text(formData, "name", 120) : undefined;
    if (name === null) redirect(`${path}?error=name-required`);
    const legalFormRaw = formData.get("legalForm");
    const legalForm = isLegalForm(legalFormRaw) ? legalFormRaw : null;
    const naming = (await getBranding()).engagementNaming;
    const namingLocale = await getLocale();
    await withTenant(tenantId, async (tx) => {
      const before = await tx.query<{ name: string; framework: string | null }>("SELECT name, framework FROM client WHERE id = $1", [clientId]);
      const oldName = before.rows[0]?.name ?? null;
      await tx.query(
        `UPDATE client
            SET registration_number = $2, niu = $3, address = $4,
                year_end = $5, framework = $6, pie = $7, sector = $8,
                name = coalesce($9, name), legal_form = coalesce($10, legal_form),
                share_capital = $11, co_cac = $12, governance_mode = $13, regulator = $14
          WHERE id = $1`,
        [
          clientId,
          text(formData, "registrationNumber"),
          text(formData, "niu"),
          text(formData, "address", 500),
          text(formData, "yearEnd", 40),
          (FRAMEWORKS as readonly string[]).includes(framework) ? framework : (before.rows[0]?.framework ?? null),
          formData.get("pie") === "on",
          isSector(sector) ? sector : null,
          name ?? null,
          legalForm,
          shareCapital !== null && shareCapital > 0 ? shareCapital : null,
          formData.get("coCac") === "on",
          isGovernanceMode(governanceRaw) ? governanceRaw : null,
          isRegulator(regulatorRaw) ? regulatorRaw : null,
        ],
      );
      // UAT B116: a corrected client name also corrects the titles of its
      // acceptance/planning engagements — only those still carrying the name
      // the firm's convention produced from the old client name (a title the
      // team chose by hand is left alone).
      if (name && oldName && name !== oldName) {
        const engagements = await tx.query<{ id: string; name: string | null; fiscal_year: number; nature: string | null; period_end: string }>(
          `SELECT id, name, fiscal_year, nature, to_char(period_end, 'YYYY-MM-DD') AS period_end
             FROM engagement WHERE client_id = $1 AND phase IN ('acceptance', 'planning')`,
          [clientId],
        );
        for (const e of engagements.rows) {
          const parts = { periodEnd: e.period_end, nature: e.nature ?? "statutory_audit" };
          const generated = (["en", "fr"] as const).map((l) => applyNamingConvention(naming, oldName, e.fiscal_year, parts, l));
          if (e.name !== null && !generated.includes(e.name)) continue;
          await tx.query("UPDATE engagement SET name = $2 WHERE id = $1", [
            e.id,
            applyNamingConvention(naming, name, e.fiscal_year, parts, namingLocale),
          ]);
        }
      }
    });
    revalidatePath(path);
    revalidatePath("/clients");
    revalidatePath("/engagements");
  }
  redirect(path);
}

/** Retire a client from the register, or reinstate it (UAT B98). Firm admin only. */
export async function setClientArchivedAction(clientId: string, archived: boolean): Promise<void> {
  const path = `/clients/${clientId}`;
  try {
    await setClientArchived(clientId, archived);
  } catch (error) {
    if (error instanceof ForbiddenError) redirect(`${path}?error=read-only-role`);
    if (error instanceof Error && /^[a-z0-9-]+$/.test(error.message)) {
      redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  revalidatePath(path);
  revalidatePath("/clients");
  redirect(path);
}
