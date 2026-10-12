"use client";

import { useActionState } from "react";
import { importSignoffMatrixAction, type MatrixImportState } from "@/app/actions/signoff-policy";

const INITIAL: MatrixImportState = { status: "idle" };

/** Import a completed sign-off matrix and report every row's errors (F002). */
export function SignoffMatrixImport({
  locale,
  errorMessages,
}: {
  locale: "fr" | "en";
  /** planning.errors, for refusals such as signoff-policy-partner-only */
  errorMessages: Record<string, string>;
}) {
  const [state, action, pending] = useActionState(importSignoffMatrixAction, INITIAL);
  const fr = locale === "fr";
  return (
    <form action={action} className="flex flex-col gap-3" data-testid="signoff-matrix-import">
      <label className="flex flex-col gap-1 text-sm text-ink-soft">
        {fr ? "Importer une matrice complétée (Excel)" : "Import a completed matrix (Excel)"}
        <input
          type="file"
          name="matrix"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          required
          className="text-sm text-ink"
          data-testid="signoff-matrix-file"
        />
      </label>
      <div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-800 disabled:opacity-50"
          data-testid="signoff-matrix-submit"
        >
          {pending ? (fr ? "Import en cours…" : "Importing…") : fr ? "Importer" : "Import"}
        </button>
      </div>
      <div aria-live="polite">
        {state.status === "saved" ? (
          <p className="text-sm text-emerald-800 dark:text-emerald-300" data-testid="signoff-matrix-saved">
            {fr
              ? `Matrice importée : ${state.rows} ligne(s) lue(s), ${state.saved} règle(s) modifiée(s).`
              : `Matrix imported: ${state.rows} row(s) read, ${state.saved} rule(s) changed.`}
          </p>
        ) : null}
        {state.status === "invalid" ? (
          <div className="text-sm text-rose" data-testid="signoff-matrix-errors">
            <p className="font-semibold">
              {state.error
                ? (errorMessages[state.error] ?? state.error)
                : fr
                  ? "Rien n'a été enregistré : corrigez les lignes suivantes puis importez à nouveau."
                  : "Nothing was saved: correct the rows below and import again."}
            </p>
            {state.errors && state.errors.length > 0 ? (
              <ul className="mt-1 list-disc pl-5">
                {state.errors.map((e, i) => (
                  <li key={`${e.row}-${i}`}>
                    {e.row > 0 ? (fr ? `Ligne ${e.row} : ` : `Row ${e.row}: `) : ""}
                    {e.message}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </form>
  );
}
