import type { ReactNode } from "react";
import { canWrite, type Role } from "@/lib/rbac";

/**
 * A page's live forms, for a role that may read them but not change them: a
 * disabled fieldset disables every control inside (links stay usable) and a line
 * says why. The library refuses the write anyway (requireWrite); this is what
 * the read-only account sees instead of a form that answers with a refusal.
 */
export function ReadOnlyFieldset({
  role,
  locale,
  children,
}: {
  role: Role;
  locale: string;
  children: ReactNode;
}) {
  const readOnly = !canWrite(role);
  return (
    <fieldset disabled={readOnly} className="contents" data-testid="read-only-fieldset" data-read-only={String(readOnly)}>
      {readOnly ? (
        <p
          className="mt-3 rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2 px-3 py-2 text-[12.5px] text-ink-soft"
          data-testid="read-only-note"
        >
          {locale === "fr"
            ? "Votre rôle permet de consulter ce dossier mais pas de le modifier."
            : "Your role can view this file but not change it."}
        </p>
      ) : null}
      {children}
    </fieldset>
  );
}
