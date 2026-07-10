"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { advanceAlerte, resumeAlerte, startAlerte } from "@/lib/alerte";
import { recordCompletion } from "@/lib/completion";
import {
  addConvention,
  type ConventionCapacity,
  equityCheck,
  generateArticle715Report,
  generateDeadlines,
  generateIrregularitiesLetter,
  generateRapportSpecial,
  generateTitresAttestation,
  markDeadlineDone,
  revealFait,
  setShareCapital,
} from "@/lib/legal";

async function guarded(path: string, fn: () => Promise<string | void>): Promise<never> {
  let target = path;
  try {
    const result = await fn();
    if (typeof result === "string") target = result;
  } catch (error) {
    if (error instanceof Error && /^[a-z0-9-]+$/.test(error.message)) {
      redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  revalidatePath(path);
  redirect(target);
}

const pagePath = (engagementId: string): string => `/engagements/${engagementId}/legal`;

export async function generateDeadlinesAction(engagementId: string): Promise<void> {
  await guarded(pagePath(engagementId), async () => {
    await generateDeadlines(engagementId);
  });
}

export async function markDeadlineDoneAction(engagementId: string, key: string): Promise<void> {
  await guarded(pagePath(engagementId), () => markDeadlineDone(engagementId, key));
}

export async function addConventionAction(engagementId: string, formData: FormData): Promise<void> {
  await guarded(pagePath(engagementId), async () => {
    const amountRaw = String(formData.get("amountsPeriod") ?? "").trim();
    await addConvention(engagementId, {
      parties: String(formData.get("parties") ?? ""),
      interested: String(formData.get("interested") ?? ""),
      capacity: String(formData.get("capacity") ?? "director") as ConventionCapacity,
      nature: String(formData.get("nature") ?? ""),
      terms: String(formData.get("terms") ?? ""),
      amountsPeriod: amountRaw ? Number(amountRaw) : undefined,
      continuing: formData.get("continuing") === "on",
      boardAuthRef: String(formData.get("boardAuthRef") ?? ""),
      notifiedAt: String(formData.get("notifiedAt") ?? ""),
    });
  });
}

export async function rapportSpecialAction(engagementId: string): Promise<void> {
  await guarded(pagePath(engagementId), async () => {
    const documentId = await generateRapportSpecial(engagementId);
    return `/documents/${documentId}`;
  });
}

export async function article715Action(engagementId: string): Promise<void> {
  await guarded(pagePath(engagementId), async () => {
    const documentId = await generateArticle715Report(engagementId);
    return `/documents/${documentId}`;
  });
}

export async function startAlerteAction(engagementId: string, formData: FormData): Promise<void> {
  await guarded(pagePath(engagementId), async () => {
    await startAlerte(engagementId, String(formData.get("note") ?? ""));
  });
}

export async function advanceAlerteAction(
  engagementId: string,
  alerteId: string,
  formData: FormData,
): Promise<void> {
  await guarded(pagePath(engagementId), () =>
    advanceAlerte(alerteId, String(formData.get("toStage") ?? ""), String(formData.get("note") ?? ""), {
      satisfactory: formData.get("satisfactory") === "on",
    }),
  );
}

export async function resumeAlerteAction(
  engagementId: string,
  alerteId: string,
  formData: FormData,
): Promise<void> {
  await guarded(pagePath(engagementId), () =>
    resumeAlerte(alerteId, String(formData.get("note") ?? "")),
  );
}

export async function revealFaitAction(engagementId: string, formData: FormData): Promise<void> {
  await guarded(pagePath(engagementId), async () => {
    const documentId = await revealFait(engagementId, String(formData.get("description") ?? ""));
    return `/documents/${documentId}`;
  });
}

export async function irregularitiesAction(engagementId: string, formData: FormData): Promise<void> {
  await guarded(pagePath(engagementId), async () => {
    const target = formData.get("target") === "board" ? "board" : "ag";
    const documentId = await generateIrregularitiesLetter(
      engagementId,
      target,
      String(formData.get("points") ?? ""),
    );
    return `/documents/${documentId}`;
  });
}

export async function titresAttestationAction(engagementId: string): Promise<void> {
  await guarded(pagePath(engagementId), async () => {
    const documentId = await generateTitresAttestation(engagementId);
    return `/documents/${documentId}`;
  });
}

export async function equityCheckAction(engagementId: string): Promise<void> {
  await guarded(pagePath(engagementId), async () => {
    const check = await equityCheck(engagementId);
    if (!check.hasTb) throw new Error("no-tb");
    if (check.shareCapital === null) throw new Error("share-capital-required");
  });
}

export async function setShareCapitalAction(engagementId: string, formData: FormData): Promise<void> {
  await guarded(pagePath(engagementId), () =>
    setShareCapital(engagementId, Number(formData.get("amount"))),
  );
}

export async function cocacAction(engagementId: string, formData: FormData): Promise<void> {
  await guarded(pagePath(engagementId), async () => {
    const key = String(formData.get("key") ?? "");
    if (!["worksplit", "crossreview", "disagreement"].includes(key)) throw new Error("invalid-key");
    await recordCompletion(engagementId, `f8_${key}`, {
      text: String(formData.get("text") ?? ""),
      confirmed: formData.get("confirmed") === "on",
    });
  });
}
