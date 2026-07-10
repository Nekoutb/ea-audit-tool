"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { addOverride, createJournal, deactivateOverride, postJournal, type JournalLineInput } from "@/lib/tb";

async function guarded(path: string, fn: () => Promise<void>): Promise<never> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof Error && /^[a-z0-9-]+$/.test(error.message)) {
      redirect(`${path}?error=${encodeURIComponent(error.message)}`);
    }
    throw error;
  }
  revalidatePath(path);
  redirect(path);
}

/**
 * Journal lines arrive as a plain-text block, one line each:
 *   account;label;debit;credit
 * (label optional, amounts in FCFA — friendly enough for v1, replaced by a
 * dynamic grid later.)
 */
export async function createJournalAction(engagementId: string, formData: FormData): Promise<void> {
  const path = `/engagements/${engagementId}/data`;
  const description = String(formData.get("description") ?? "");
  const raw = String(formData.get("lines") ?? "");
  const lines: JournalLineInput[] = raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [account, label, debit, credit] = line.split(";").map((cell) => cell.trim());
      return {
        account: account ?? "",
        label: label || undefined,
        debit: Number(debit ?? 0) || 0,
        credit: Number(credit ?? 0) || 0,
      };
    });
  await guarded(path, async () => {
    await createJournal(engagementId, description, lines);
  });
}

export async function postJournalAction(
  engagementId: string,
  journalId: string,
  formData: FormData,
): Promise<void> {
  const path = `/engagements/${engagementId}/data`;
  const kind = String(formData.get("kind") ?? "adjusted") === "final" ? "final" : "adjusted";
  await guarded(path, async () => {
    await postJournal(journalId, kind);
  });
}

export async function addOverrideAction(
  engagementId: string,
  clientId: string,
  formData: FormData,
): Promise<void> {
  const path = `/engagements/${engagementId}/data`;
  await guarded(path, () =>
    addOverride(clientId, {
      matchType: String(formData.get("matchType") ?? "prefix") === "exact" ? "exact" : "prefix",
      accountPrefix: String(formData.get("accountPrefix") ?? ""),
      sectionCode: String(formData.get("sectionCode") ?? ""),
      rationale: String(formData.get("rationale") ?? ""),
    }),
  );
}

export async function deactivateOverrideAction(engagementId: string, id: string): Promise<void> {
  await guarded(`/engagements/${engagementId}/data`, () => deactivateOverride(id));
}
