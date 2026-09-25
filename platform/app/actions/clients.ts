"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FRAMEWORKS, isLegalForm, isSector, setClientArchived } from "@/lib/clients";
import { withTenant } from "@/lib/db";
import { ForbiddenError, requireTenant } from "@/lib/tenant";

/** Trimmed nullable text field ("" → NULL), length-capped. */
function text(formData: FormData, name: string, max = 200): string | null {
  const value = String(formData.get(name) ?? "")
    .trim()
    .slice(0, max);
  return value || null;
}

/**
 * Entity master data update (IA audit 5D identity panel). firm_admin only —
 * anyone else is bounced straight back to the record without touching the row.
 */
export async function updateClientMasterAction(clientId: string, formData: FormData): Promise<void> {
  const path = `/clients/${clientId}`;
  const { tenantId, role } = await requireTenant();
  if (role === "firm_admin") {
    const framework = text(formData, "framework");
    const sector = text(formData, "sector");
    // Name and legal form are corrected here too (UAT B97); an absent field
    // (an older form) leaves the stored value alone.
    const name = formData.has("name") ? text(formData, "name", 120) : undefined;
    if (name === null) redirect(`${path}?error=name-required`);
    const legalFormRaw = formData.get("legalForm");
    const legalForm = isLegalForm(legalFormRaw) ? legalFormRaw : null;
    await withTenant(tenantId, async (tx) => {
      await tx.query(
        `UPDATE client
            SET registration_number = $2, niu = $3, address = $4,
                year_end = $5, framework = $6, pie = $7, sector = $8,
                name = coalesce($9, name), legal_form = coalesce($10, legal_form)
          WHERE id = $1`,
        [
          clientId,
          text(formData, "registrationNumber"),
          text(formData, "niu"),
          text(formData, "address", 500),
          text(formData, "yearEnd", 40),
          framework && (FRAMEWORKS as readonly string[]).includes(framework) ? framework : null,
          formData.get("pie") === "on",
          isSector(sector) ? sector : null,
          name ?? null,
          legalForm,
        ],
      );
    });
    revalidatePath(path);
    revalidatePath("/clients");
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
