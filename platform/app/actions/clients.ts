"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { FRAMEWORKS } from "@/lib/clients";
import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

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
    await withTenant(tenantId, async (tx) => {
      await tx.query(
        `UPDATE client
            SET registration_number = $2, niu = $3, address = $4,
                year_end = $5, framework = $6, pie = $7
          WHERE id = $1`,
        [
          clientId,
          text(formData, "registrationNumber"),
          text(formData, "niu"),
          text(formData, "address", 500),
          text(formData, "yearEnd", 40),
          framework && (FRAMEWORKS as readonly string[]).includes(framework) ? framework : null,
          formData.get("pie") === "on",
        ],
      );
    });
    revalidatePath(path);
  }
  redirect(path);
}
