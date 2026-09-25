"use client";

// Two-factor confirmation with the recovery codes returned straight to this
// component's state (UAT B37): they never travel in the URL, so they are not
// in the address bar, the history, the access log or any Referer, and a reload
// shows them no more.

import { useActionState } from "react";

export interface MfaConfirmState {
  codes?: string[];
  error?: string;
}

export function MfaConfirmForm({
  action,
  locale,
  errorMessages,
}: {
  action: (prev: MfaConfirmState, formData: FormData) => Promise<MfaConfirmState>;
  locale: "en" | "fr";
  /** the page's own wording per error code; unknown codes fall back to a generic line */
  errorMessages: Record<string, string>;
}) {
  const fr = locale === "fr";
  const [state, formAction, pending] = useActionState(action, {} as MfaConfirmState);
  const input =
    "w-full rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-emerald-600";
  const label = "block text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted";

  if (state.codes && state.codes.length > 0) {
    return (
      <div
        className="mt-3 rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2/50 px-4 py-3"
        data-testid="recovery-codes"
      >
        <p className="text-[13px] font-semibold text-ink">
          {fr ? "Codes de récupération" : "Recovery codes"}{" "}
          <span className="font-normal text-muted">
            — {fr ? "affichés une seule fois" : "shown once and never again"}
          </span>
        </p>
        <p className="mt-2 text-[12.5px] text-ink-soft">
          {fr
            ? "Conservez-les hors de votre téléphone. Chacun fonctionne une fois, à la place du code d'authentification, si vous perdez l'accès à votre application."
            : "Keep these somewhere other than your phone. Each works once, in place of the authentication code, if you lose access to your app."}
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-1.5 font-mono text-[13px] text-ink">
          {state.codes.map((c) => (
            <li key={c} className="rounded-[var(--radius-atlas-xs)] bg-surface-2 px-2 py-1 text-center tracking-[0.12em]">
              {c}
            </li>
          ))}
        </ul>
        <a href="/security" className="mt-3 inline-block text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-400">
          {fr ? "J'ai noté ces codes" : "I have saved these"}
        </a>
      </div>
    );
  }

  const shown = state.error
    ? (errorMessages[state.error] ?? (fr ? "L'activation a échoué. Réessayez." : "Enrolment failed. Try again."))
    : null;

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2" data-testid="mfa-confirm-form">
      <div>
        <label className={label} htmlFor="code">
          {fr ? "Code à six chiffres" : "Six-digit code"}
        </label>
        <input
          id="code"
          name="code"
          inputMode="numeric"
          maxLength={7}
          required
          autoComplete="one-time-code"
          data-testid="mfa-code"
          className={`mt-1 ${input} w-[150px] tracking-[0.25em]`}
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        data-testid="mfa-enable"
        className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-1.5 text-[13px] font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-50"
      >
        {fr ? "Activer" : "Turn on"}
      </button>
      {shown ? (
        <p role="alert" className="w-full text-[12.5px] font-semibold text-rose" data-testid="security-error">
          {shown}
        </p>
      ) : null}
    </form>
  );
}
