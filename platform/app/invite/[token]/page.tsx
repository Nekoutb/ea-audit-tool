import { redirect } from "next/navigation";
import { SubmitButton } from "@/components/SubmitButton";
import { acceptInvite, inviteTarget, InviteError } from "@/lib/invites";
import { MIN_PASSWORD_LENGTH } from "@/lib/password-policy";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Choose your password · AuditISA" };

/**
 * Where a new colleague lands from their invitation: they choose a password
 * before signing in for the first time.
 *
 * Nothing here signs anybody in. The token proves control of the mailbox, which
 * is enough to set a password; it is not enough to open the audit file, so the
 * last step is still a real sign-in with the password they just chose.
 */
async function acceptAction(token: string, formData: FormData): Promise<void> {
  "use server";
  try {
    const target = await acceptInvite(
      token,
      String(formData.get("password") ?? ""),
      String(formData.get("confirm") ?? ""),
    );
    const next = target.nextPath ? `&next=${encodeURIComponent(target.nextPath)}` : "";
    redirect(`/login?email=${encodeURIComponent(target.email)}${next}&ready=1`);
  } catch (error) {
    if (error instanceof InviteError) {
      redirect(`/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(error.message)}`);
    }
    throw error; // NEXT_REDIRECT on success must propagate
  }
}

export default async function InvitePage(props: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { token } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const fr = locale === "fr";
  const target = await inviteTarget(token);

  const field =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  // One message for expired, spent and never-existed alike: telling them apart
  // would turn this page into a way of testing which tokens are real.
  if (!target) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
        <div className="w-full max-w-sm rounded-[var(--radius-atlas)] border border-line bg-surface p-8 shadow-[var(--shadow-atlas)]">
          <h1 className="text-xl font-semibold text-ink">
            {fr ? "Lien non valable" : "This link is no longer valid"}
          </h1>
          <p className="mt-3 text-sm text-muted">
            {fr
              ? "Cette invitation a expiré ou a déjà servi. Demandez à l'administrateur de votre cabinet de vous en envoyer une nouvelle."
              : "This invitation has expired or has already been used. Ask your firm administrator to send you a new one."}
          </p>
          <a
            href="/login"
            className="mt-5 inline-block text-sm text-emerald-700 hover:underline dark:text-emerald-500"
          >
            {fr ? "Aller à la connexion" : "Go to sign-in"}
          </a>
        </div>
      </main>
    );
  }

  const messages: Record<string, { en: string; fr: string }> = {
    mismatch: {
      en: "The two passwords do not match.",
      fr: "Les deux mots de passe ne correspondent pas.",
    },
    "invalid-or-expired": {
      en: "This invitation has expired or has already been used.",
      fr: "Cette invitation a expiré ou a déjà servi.",
    },
    "too-short": {
      en: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
      fr: `Utilisez au moins ${MIN_PASSWORD_LENGTH} caractères.`,
    },
    "needs-mixed-case": {
      en: "Use both upper and lower case letters.",
      fr: "Utilisez des majuscules et des minuscules.",
    },
    "needs-digit": { en: "Include at least one digit.", fr: "Incluez au moins un chiffre." },
    "contains-email": {
      en: "Do not build the password out of your email address.",
      fr: "N'utilisez pas votre adresse e-mail dans le mot de passe.",
    },
  };
  const shown = error
    ? messages[error]
      ? fr
        ? messages[error].fr
        : messages[error].en
      : error
    : null;

  return (
    <main className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm rounded-[var(--radius-atlas)] border border-line bg-surface p-8 shadow-[var(--shadow-atlas)]">
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-500">
          AuditISA
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-ink">
          {fr ? "Choisissez votre mot de passe" : "Choose your password"}
        </h1>
        <p className="mt-1 text-sm text-muted">
          {fr ? "Pour " : "For "}
          <b className="text-ink">{target.email}</b>
        </p>

        <form action={acceptAction.bind(null, token)} className="mt-6 flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink-soft">
              {fr ? "Nouveau mot de passe" : "New password"}
            </span>
            <input
              type="password"
              name="password"
              required
              autoComplete="new-password"
              autoFocus
              minLength={MIN_PASSWORD_LENGTH}
              className={field}
              data-testid="invite-password"
            />
            <span className="text-[11.5px] text-muted">
              {fr
                ? `Au moins ${MIN_PASSWORD_LENGTH} caractères, majuscules et minuscules, au moins un chiffre.`
                : `At least ${MIN_PASSWORD_LENGTH} characters, upper and lower case, and at least one digit.`}
            </span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-ink-soft">
              {fr ? "Confirmez le mot de passe" : "Confirm password"}
            </span>
            <input
              type="password"
              name="confirm"
              required
              autoComplete="new-password"
              minLength={MIN_PASSWORD_LENGTH}
              className={field}
              data-testid="invite-confirm"
            />
          </label>
          {shown ? (
            <p role="alert" className="text-sm text-rose" data-testid="invite-error">
              {shown}
            </p>
          ) : null}
          <SubmitButton
            className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800"
            testId="invite-submit"
          >
            {fr ? "Enregistrer et se connecter" : "Save and sign in"}
          </SubmitButton>
        </form>
      </div>
    </main>
  );
}
