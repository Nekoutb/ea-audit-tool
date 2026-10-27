"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveSap, setSapThresholds } from "@/lib/sap";

/** Domain refusals come back as ?error=<code> banners, never a 500. */
async function guarded(path: string, fn: () => Promise<void>, successPath: string = path): Promise<never> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof Error && /^[a-z0-9-]+$/.test(error.message)) {
      const joiner = path.includes("?") ? "&" : "?";
      redirect(`${path}${joiner}error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  revalidatePath(path.split("?")[0]);
  redirect(successPath);
}

const num = (formData: FormData, key: string): number | null => {
  const raw = String(formData.get(key) ?? "").replace(/\s/g, "").replace(",", ".");
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : NaN;
};

/** One procedure of the substantive-analytics tool (F038), per index and assertion. */
export async function saveSapAction(engagementId: string, formData: FormData): Promise<void> {
  const indexCode = String(formData.get("indexCode") ?? "");
  const assertion = String(formData.get("assertion") ?? "");
  const path = `/engagements/${engagementId}/tools/sap?index=${encodeURIComponent(indexCode)}`;
  const text = (key: string): string | null => String(formData.get(key) ?? "").trim() || null;
  await guarded(path, async () => {
    const expected = num(formData, "expectedValue");
    const override = num(formData, "thresholdOverridePct");
    await saveSap({
      engagementId,
      indexCode,
      assertion,
      expectationModel: String(formData.get("expectationModel") ?? ""),
      inputs: text("inputs"),
      expectedValue: expected === null ? NaN : expected,
      dataReliability: text("dataReliability"),
      thresholdOverridePct: override === null ? null : override,
      thresholdOverrideReason: text("thresholdOverrideReason"),
      actualValue: num(formData, "actualValue"),
      investigation: text("investigation"),
      corroboration: text("corroboration"),
      conclusion: text("conclusion"),
    });
  }, `${path}#sap-${encodeURIComponent(assertion)}`);
}

/** The firm's threshold percentages, from Settings. */
export async function setSapThresholdsAction(formData: FormData): Promise<void> {
  await guarded(
    "/settings",
    () =>
      setSapThresholds({
        low: Number(formData.get("low")),
        moderate: Number(formData.get("moderate")),
        high: Number(formData.get("high")),
      }),
    "/settings?saved=sap",
  );
}
