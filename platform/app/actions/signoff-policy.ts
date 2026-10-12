"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { DEFAULT_FILE_INDEX } from "@/lib/file-index";
import { getLocale } from "@/lib/locale";
import { parseSignoffMatrix, type MatrixRowError } from "@/lib/signoff-matrix";
import { isLadderRole, requirePolicyEditor, savePolicy, saveTaskRules, type TaskRuleInput } from "@/lib/signoff-policy";

const PATH = "/settings/signoff";

/** Domain refusals come back as ?error=<code> banners, never a 500. */
function refusal(error: unknown): string | null {
  if (error instanceof Error && /^[a-z0-9-]+$/.test(error.message)) return error.message;
  return null;
}

/** (a) The firm's policy defaults. */
export async function saveSignoffPolicyAction(formData: FormData): Promise<void> {
  const codes = String(formData.get("requirePartnerOn") ?? "")
    .split(/[\s,;]+/)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean);
  try {
    await savePolicy({
      minReviewerRole: String(formData.get("minReviewerRole") ?? ""),
      requirePartnerOn: codes,
      requireDistinctPreparerApprover: formData.get("requireDistinct") === "on",
    });
  } catch (error) {
    const code = refusal(error);
    if (code) redirect(`${PATH}?error=${encodeURIComponent(code)}`);
    throw error;
  }
  revalidatePath(PATH);
  redirect(`${PATH}?saved=policy`);
}

/** (b) The per-task table: "" is the firm default, otherwise a ladder role / yes / no. */
export async function saveTaskRulesAction(formData: FormData): Promise<void> {
  const rules: TaskRuleInput[] = [];
  for (const { code } of DEFAULT_FILE_INDEX) {
    // only the rows the form carried: a partial post never resets the others
    if (!formData.has(`prep:${code}`)) continue;
    const prep = String(formData.get(`prep:${code}`) ?? "");
    const rev = String(formData.get(`rev:${code}`) ?? "");
    const partner = String(formData.get(`partner:${code}`) ?? "");
    rules.push({
      code,
      minPreparer: isLadderRole(prep) ? prep : null,
      minReviewer: isLadderRole(rev) ? rev : null,
      partnerRequired: partner === "yes" ? true : partner === "no" ? false : null,
    });
  }
  let changed = 0;
  try {
    changed = await saveTaskRules(rules);
  } catch (error) {
    const code = refusal(error);
    if (code) redirect(`${PATH}?error=${encodeURIComponent(code)}`);
    throw error;
  }
  revalidatePath(PATH);
  redirect(`${PATH}?saved=rules&n=${changed}`);
}

export interface MatrixImportState {
  status: "idle" | "saved" | "invalid";
  saved?: number;
  rows?: number;
  errors?: MatrixRowError[];
  error?: string;
}

/**
 * (c) Import a completed matrix. Every row is validated first; nothing is
 * saved unless the whole file is clean, and only columns I-K are read.
 */
export async function importSignoffMatrixAction(
  _previous: MatrixImportState,
  formData: FormData,
): Promise<MatrixImportState> {
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  try {
    await requirePolicyEditor();
  } catch (error) {
    return { status: "invalid", error: refusal(error) ?? "forbidden" };
  }
  const file = formData.get("matrix");
  if (!(file instanceof File) || file.size === 0) {
    return { status: "invalid", errors: [{ row: 0, message: locale === "fr" ? "Choisissez un fichier .xlsx." : "Choose an .xlsx file." }] };
  }
  if (file.size > 1024 * 1024) {
    return { status: "invalid", errors: [{ row: 0, message: locale === "fr" ? "Fichier trop volumineux (1 Mo maximum)." : "File too large (1 MB maximum)." }] };
  }
  const parsed = await parseSignoffMatrix(Buffer.from(await file.arrayBuffer()), locale);
  if (parsed.errors.length > 0) return { status: "invalid", errors: parsed.errors };
  try {
    const saved = await saveTaskRules(parsed.rules);
    revalidatePath(PATH);
    return { status: "saved", saved, rows: parsed.rules.length };
  } catch (error) {
    return { status: "invalid", error: refusal(error) ?? "import-failed" };
  }
}
