import Link from "next/link";
import { localizedTitle } from "@/lib/page-title";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { MfaConfirmForm, type MfaConfirmState } from "@/components/MfaConfirmForm";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import { getLocale } from "@/lib/locale";
import { MfaError, beginEnrolment, confirmEnrolment, disableMfa, mfaStatus } from "@/lib/mfa";
import { mfaDisabled } from "@/lib/mfa-policy";

export const generateMetadata = localizedTitle("Security", "Sécurité");

/**
 * Two-factor enrolment. The secret is shown once, as text in readable groups
 * plus the otpauth:// URI — every authenticator app accepts a typed setup key,
 * and a hand-rolled QR encoder is a lot of code to get silently wrong.
 *
 * Nothing is enforced until a working code proves the app is really configured,
 * so a half-finished enrolment cannot lock anyone out.
 */
export default async function SecurityPage(props: {
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const fr = locale === "fr";
  const status = await mfaStatus();

  // The secret is minted on demand rather than carried in the URL: a query
  // string reaches the access log, the browser history and any Referer.
  let enrolment: { secretFormatted: string; uri: string } | null = null;
  if (!status.enrolled) {
    enrolment = await beginEnrolment().catch(() => null);
  }

  // The recovery codes go back to the form's own state, never into the URL
  // (UAT B37): a query string reaches the history, the access log and any
  // Referer, and showed the codes again on every reload.
  async function confirmAction(_prev: MfaConfirmState, formData: FormData): Promise<MfaConfirmState> {
    "use server";
    try {
      const issued = await confirmEnrolment(String(formData.get("code") ?? ""));
      return { codes: issued };
    } catch (e) {
      if (e instanceof MfaError) return { error: e.message };
      throw e;
    }
  }

  async function disableAction(formData: FormData) {
    "use server";
    try {
      await disableMfa(String(formData.get("password") ?? ""));
    } catch (e) {
      if (e instanceof MfaError) redirect(`/security?error=${encodeURIComponent(e.message)}`);
      throw e;
    }
    redirect("/security");
  }

  const messages: Record<string, { en: string; fr: string }> = {
    "wrong-code": { en: "That code did not match. Check your app and try the current one.", fr: "Ce code ne correspond pas. Vérifiez votre application et saisissez le code actuel." },
    "wrong-password": { en: "That is not your current password.", fr: "Ce n'est pas votre mot de passe actuel." },
    "already-enrolled": { en: "Two-factor is already on for this account.", fr: "La double authentification est déjà active." },
    "no-enrolment-started": { en: "Start the setup again — the secret was not saved.", fr: "Recommencez la configuration — le secret n'a pas été enregistré." },
    "auth-secret-missing": { en: "Two-factor is not configured on this server.", fr: "La double authentification n'est pas configurée sur ce serveur." },
  };
  // An unknown code shows a generic line, never the URL's own text (UAT B137).
  const shown = error
    ? messages[error]
      ? fr ? messages[error].fr : messages[error].en
      : fr ? "L'opération a échoué. Réessayez." : "The operation failed. Try again."
    : null;
  const localised = Object.fromEntries(
    Object.entries(messages).map(([code, m]) => [code, fr ? m.fr : m.en]),
  );

  const input =
    "w-full rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-emerald-600";
  const label = "block text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted";

  return (
    <main className="min-h-screen w-full px-6 py-6">
      <AppNav locale={locale} />
      <h1 className="mt-5 text-[22px] font-semibold tracking-[-0.02em] text-ink">
        {fr ? "Sécurité du compte" : "Account security"}
      </h1>

      {shown ? (
        <p role="alert" className="mt-3 text-[13px] font-semibold text-rose" data-testid="security-error">
          {shown}
        </p>
      ) : null}

      <Panel className="mt-4 max-w-[560px]">
        <PanelHeader
          title={fr ? "Double authentification" : "Two-factor authentication"}
          hint={
            status.enrolled
              ? fr ? "active" : "on"
              : fr ? "inactive" : "off"
          }
        />

        {status.enrolled ? (
          <div className="mt-3">
            <p className="text-[13px] text-ink-soft" data-testid="mfa-on">
              {fr
                ? `Un code de votre application est demandé à chaque connexion. Codes de récupération restants : ${status.recoveryRemaining}.`
                : `A code from your app is required at every sign-in. Recovery codes left: ${status.recoveryRemaining}.`}
            </p>
            {mfaDisabled() ? (
              // The staging instance skips the challenge (lib/mfa-policy.ts);
              // the sentence above would otherwise promise a code that never
              // comes (UAT B162).
              <p className="mt-1 text-[12.5px] font-semibold text-warn" data-testid="mfa-disabled-here">
                {fr
                  ? "Désactivée sur ce site de test : la double authentification est enregistrée mais aucun code n'est demandé à la connexion ici."
                  : "Disabled on this test site: two-factor is enrolled but no code is asked for at sign-in here."}
              </p>
            ) : null}
            <form action={disableAction} className="mt-4 flex flex-wrap items-end gap-2">
              <div>
                <label className={label} htmlFor="pw">
                  {fr ? "Mot de passe actuel" : "Current password"}
                </label>
                <input id="pw" name="password" type="password" required autoComplete="current-password" className={`mt-1 ${input} w-[240px]`} />
              </div>
              <button
                type="submit"
                data-testid="mfa-disable"
                className="rounded-[var(--radius-atlas-sm)] border border-line-strong px-3 py-1.5 text-[13px] font-semibold text-rose transition hover:bg-surface-2"
              >
                {fr ? "Désactiver" : "Turn off"}
              </button>
            </form>
          </div>
        ) : enrolment ? (
          <div className="mt-3 flex flex-col gap-3">
            <ol className="flex list-decimal flex-col gap-2 pl-4 text-[13px] text-ink-soft">
              <li>
                {fr
                  ? "Dans votre application d'authentification, choisissez « saisir une clé de configuration »."
                  : "In your authenticator app, choose “enter a setup key”."}
              </li>
              <li>
                {fr ? "Saisissez cette clé :" : "Enter this key:"}
                <span
                  className="mt-1 block rounded-[var(--radius-atlas-xs)] bg-surface-2 px-2.5 py-1.5 font-mono text-[13.5px] tracking-[0.1em] text-ink"
                  data-testid="mfa-secret"
                >
                  {enrolment.secretFormatted}
                </span>
              </li>
              <li>{fr ? "Puis saisissez le code affiché :" : "Then enter the code it shows:"}</li>
            </ol>

            <MfaConfirmForm action={confirmAction} locale={fr ? "fr" : "en"} errorMessages={localised} />

            <details className="text-[12px] text-muted">
              <summary className="cursor-pointer">{fr ? "Lien de configuration" : "Setup link"}</summary>
              <code className="mt-1 block break-all text-[11.5px]">{enrolment.uri}</code>
            </details>
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-muted">
            {fr ? "Indisponible pour le moment." : "Not available right now."}
          </p>
        )}
      </Panel>

      <p className="mt-4 text-[12.5px] text-muted">
        <Link href="/change-password" className="font-semibold text-emerald-700 dark:text-emerald-400">
          {fr ? "Changer le mot de passe" : "Change password"}
        </Link>
      </p>
    </main>
  );
}
