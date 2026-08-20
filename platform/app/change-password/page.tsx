import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import { getLocale } from "@/lib/locale";
import { PasswordError, changeOwnPassword } from "@/lib/password";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";

export const metadata = { title: "Change password · AuditISA" };

/**
 * Password self-service, and the only screen a temporary-password account can
 * reach — the proxy holds such a session here until it sets its own secret
 * (Phase 0 item 1). Reachable voluntarily by anyone signed in.
 */
export default async function ChangePasswordPage(props: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { error, ok } = await props.searchParams;
  const locale = await getLocale();
  const fr = locale === "fr";
  const forced = session.user.mustChangePassword;

  async function changeAction(formData: FormData) {
    "use server";
    try {
      await changeOwnPassword(
        String(formData.get("current") ?? ""),
        String(formData.get("next") ?? ""),
        String(formData.get("confirm") ?? ""),
      );
    } catch (e) {
      if (e instanceof PasswordError) redirect(`/change-password?error=${encodeURIComponent(e.message)}`);
      throw e;
    }
    // The JWT still carries the stale flag, so bounce through sign-out: the
    // next sign-in mints a token without it.
    redirect("/api/auth/signout?callbackUrl=/login");
  }

  const messages: Record<string, { en: string; fr: string }> = {
    "wrong-current": { en: "That is not your current password.", fr: "Ce n'est pas votre mot de passe actuel." },
    mismatch: { en: "The two new passwords do not match.", fr: "Les deux nouveaux mots de passe ne correspondent pas." },
    reused: { en: "Choose a password you have not just used.", fr: "Choisissez un mot de passe différent du précédent." },
    "too-short": {
      en: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
      fr: `Utilisez au moins ${MIN_PASSWORD_LENGTH} caractères.`,
    },
    "needs-mixed-case": { en: "Include both upper and lower case.", fr: "Incluez des majuscules et des minuscules." },
    "needs-digit": { en: "Include at least one digit.", fr: "Incluez au moins un chiffre." },
    "contains-email": { en: "Do not build it from your email address.", fr: "Ne le construisez pas à partir de votre adresse email." },
    "not-signed-in": { en: "Sign in again to continue.", fr: "Reconnectez-vous pour continuer." },
  };
  const shown = error ? (messages[error] ? (fr ? messages[error].fr : messages[error].en) : error) : null;

  const input =
    "w-full rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-emerald-600";
  const label = "block text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted";

  return (
    <main className="grid min-h-screen w-full place-items-center px-6 py-10">
      <div className="w-full max-w-[420px]">
        <Panel>
          <PanelHeader
            title={fr ? "Changer le mot de passe" : "Change password"}
            hint={
              forced
                ? fr
                  ? "Votre mot de passe provisoire doit être remplacé avant de continuer."
                  : "Your temporary password must be replaced before you continue."
                : fr
                  ? "Choisissez un nouveau mot de passe."
                  : "Choose a new password."
            }
          />
          <form action={changeAction} className="flex flex-col gap-3 p-4" data-testid="change-password-form">
            <div>
              <label className={label} htmlFor="current">
                {fr ? "Mot de passe actuel" : "Current password"}
              </label>
              <input id="current" name="current" type="password" required autoComplete="current-password" className={`mt-1 ${input}`} />
            </div>
            <div>
              <label className={label} htmlFor="next">
                {fr ? "Nouveau mot de passe" : "New password"}
              </label>
              <input id="next" name="next" type="password" required autoComplete="new-password" minLength={MIN_PASSWORD_LENGTH} className={`mt-1 ${input}`} />
              <p className="mt-1 text-[11.5px] text-muted">
                {fr
                  ? `Au moins ${MIN_PASSWORD_LENGTH} caractères, avec majuscules, minuscules et un chiffre.`
                  : `At least ${MIN_PASSWORD_LENGTH} characters, with upper and lower case and a digit.`}
              </p>
            </div>
            <div>
              <label className={label} htmlFor="confirm">
                {fr ? "Confirmer" : "Confirm"}
              </label>
              <input id="confirm" name="confirm" type="password" required autoComplete="new-password" className={`mt-1 ${input}`} />
            </div>

            {shown ? (
              <p role="alert" className="text-[12.5px] font-semibold text-rose" data-testid="change-password-error">
                {shown}
              </p>
            ) : null}
            {ok ? <p className="text-[12.5px] font-semibold text-emerald-700 dark:text-emerald-400">{ok}</p> : null}

            <button
              type="submit"
              data-testid="change-password-submit"
              className="mt-1 inline-flex min-h-[36px] items-center justify-center rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-800"
            >
              {fr ? "Enregistrer" : "Save"}
            </button>
          </form>
        </Panel>
      </div>
    </main>
  );
}
