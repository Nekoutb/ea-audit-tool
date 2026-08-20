"use client";

// Onboarding an audit firm is four decisions, not six inputs on one line: who
// the firm is, who administers it, what address it sends from, and a last look
// before anything is written. Collisions are surfaced while the operator types
// — createFirm re-checks them inside its transaction, which is where they
// actually count.

import { useState, useTransition } from "react";
import type { Availability } from "@/lib/admin";

type Step = 0 | 1 | 2 | 3;

interface Draft {
  name: string;
  slug: string;
  slugTouched: boolean;
  adminName: string;
  adminEmail: string;
  language: "en" | "fr";
  mailLocal: string;
}

const EMPTY: Draft = {
  name: "",
  slug: "",
  slugTouched: false,
  adminName: "",
  adminEmail: "",
  language: "fr",
  mailLocal: "",
};

function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function FirmOnboardingWizard({
  domain,
  locale,
  createAction,
  checkAction,
}: {
  domain: string;
  locale: "en" | "fr";
  createAction: (formData: FormData) => Promise<void>;
  checkAction: (slug: string, mailLocal: string, adminEmail: string) => Promise<Availability>;
}) {
  const fr = locale === "fr";
  const [step, setStep] = useState<Step>(0);
  const [d, setD] = useState<Draft>(EMPTY);
  const [avail, setAvail] = useState<Availability | null>(null);
  const [checking, startCheck] = useTransition();
  const [submitting, startSubmit] = useTransition();

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setD((prev) => ({ ...prev, [key]: value }));
    setAvail(null);
  };

  const effectiveSlug = d.slugTouched ? slugify(d.slug) : slugify(d.name);
  const effectiveMail = (d.mailLocal.trim().toLowerCase() || effectiveSlug).slice(0, 64);

  const t = {
    title: fr ? "Intégrer un cabinet d'audit" : "Onboard an audit firm",
    steps: fr
      ? ["Cabinet", "Administrateur", "Communication", "Vérification"]
      : ["Firm", "Administrator", "Communication", "Review"],
    back: fr ? "Retour" : "Back",
    next: fr ? "Suivant" : "Next",
    create: fr ? "Créer le cabinet" : "Create firm",
    creating: fr ? "Création…" : "Creating…",
    checking: fr ? "Vérification…" : "Checking…",
    startOver: fr ? "Recommencer" : "Start over",
  };

  // ---- per-step validity ------------------------------------------------
  const stepProblem = (s: Step): string | null => {
    if (s === 0) {
      if (!d.name.trim()) return fr ? "Indiquez le nom du cabinet." : "Give the firm a name.";
      if (!effectiveSlug) return fr ? "Le slug ne peut pas être vide." : "The slug cannot be empty.";
      if (avail?.slugTaken) return fr ? "Ce slug est déjà utilisé." : "That slug is already taken.";
      return null;
    }
    if (s === 1) {
      if (!d.adminName.trim()) return fr ? "Indiquez le nom de l'administrateur." : "Give the administrator a name.";
      if (!EMAIL_RE.test(d.adminEmail.trim())) return fr ? "Adresse email invalide." : "That is not a valid email address.";
      return null;
    }
    if (s === 2) {
      if (avail && !avail.mailLocalValid) {
        return fr
          ? "Lettres, chiffres, point, tiret et tiret bas uniquement."
          : "Letters, digits, dot, hyphen and underscore only.";
      }
      if (avail?.mailTaken) return fr ? "Cette adresse d'envoi est prise." : "That sending address is taken.";
      return null;
    }
    return null;
  };

  const problem = stepProblem(step);

  const advance = () => {
    if (problem) return;
    // Steps 0 and 2 carry uniqueness constraints — confirm with the server
    // before moving on, so a collision is never discovered at the last step.
    if (step === 0 || step === 2) {
      startCheck(async () => {
        const result = await checkAction(effectiveSlug, effectiveMail, d.adminEmail.trim());
        setAvail(result);
        const blocked = step === 0 ? result.slugTaken : result.mailTaken || !result.mailLocalValid;
        if (!blocked) setStep((s) => (s + 1) as Step);
      });
      return;
    }
    setStep((s) => (s + 1) as Step);
  };

  const submit = () => {
    startSubmit(async () => {
      const fd = new FormData();
      fd.set("name", d.name.trim());
      fd.set("slug", effectiveSlug);
      fd.set("adminEmail", d.adminEmail.trim());
      fd.set("adminName", d.adminName.trim());
      fd.set("language", d.language);
      fd.set("mailLocal", effectiveMail);
      await createAction(fd);
    });
  };

  // ---- shared styles ----------------------------------------------------
  const input =
    "w-full rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-emerald-600";
  const label = "block text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted";
  const hint = "mt-1 text-[11.5px] text-muted";

  return (
    <div data-testid="firm-wizard">
      {/* step rail */}
      <ol className="flex flex-wrap items-center gap-1.5" aria-label={fr ? "Étapes" : "Steps"}>
        {t.steps.map((name, i) => {
          const state = i === step ? "current" : i < step ? "done" : "todo";
          return (
            <li key={name} className="flex items-center gap-1.5">
              <button
                type="button"
                // only backwards: a later step may depend on a check not yet run
                onClick={() => i < step && setStep(i as Step)}
                disabled={i >= step}
                aria-current={state === "current" ? "step" : undefined}
                data-testid={`wizard-step-${i}`}
                className={`flex items-center gap-1.5 rounded-[var(--radius-atlas-sm)] px-2 py-1 text-[11.5px] font-semibold transition ${
                  state === "current"
                    ? "bg-emerald-700 text-white"
                    : state === "done"
                      ? "text-emerald-700 hover:bg-surface-2 dark:text-emerald-400"
                      : "text-muted"
                } ${i < step ? "cursor-pointer" : "cursor-default"}`}
              >
                <span
                  className={`grid h-4 w-4 place-items-center rounded-full text-[10px] font-bold ${
                    state === "current"
                      ? "bg-white/25 text-white"
                      : state === "done"
                        ? "bg-emerald-700 text-white dark:bg-emerald-500 dark:text-black"
                        : "bg-line-strong text-muted"
                  }`}
                  aria-hidden="true"
                >
                  {state === "done" ? "✓" : i + 1}
                </span>
                {name}
              </button>
              {i < t.steps.length - 1 ? <span className="text-muted" aria-hidden="true">›</span> : null}
            </li>
          );
        })}
      </ol>

      <div className="mt-4 max-w-[520px]">
        {/* ---- step 0: the firm ---- */}
        {step === 0 ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className={label} htmlFor="w-name">
                {fr ? "Nom du cabinet" : "Firm name"}
              </label>
              <input
                id="w-name"
                className={`mt-1 ${input}`}
                value={d.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder={fr ? "Cabinet ECA" : "ECA Audit"}
                data-testid="wizard-name"
                autoFocus
              />
            </div>
            <div>
              <label className={label} htmlFor="w-slug">
                Slug
              </label>
              <input
                id="w-slug"
                className={`mt-1 ${input} font-mono`}
                value={d.slugTouched ? d.slug : effectiveSlug}
                onChange={(e) => {
                  setD((p) => ({ ...p, slug: e.target.value, slugTouched: true }));
                  setAvail(null);
                }}
                data-testid="wizard-slug"
              />
              <p className={hint}>
                {fr
                  ? "Dérivé du nom, modifiable. Identifie le cabinet en interne et sert de valeur par défaut à l'adresse d'envoi."
                  : "Derived from the name, editable. Identifies the firm internally and is the default for its sending address."}
              </p>
            </div>
          </div>
        ) : null}

        {/* ---- step 1: the administrator ---- */}
        {step === 1 ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className={label} htmlFor="w-admin-name">
                {fr ? "Nom de l'administrateur" : "Administrator name"}
              </label>
              <input
                id="w-admin-name"
                className={`mt-1 ${input}`}
                value={d.adminName}
                onChange={(e) => set("adminName", e.target.value)}
                data-testid="wizard-admin-name"
                autoFocus
              />
            </div>
            <div>
              <label className={label} htmlFor="w-admin-email">
                {fr ? "Email de l'administrateur" : "Administrator email"}
              </label>
              <input
                id="w-admin-email"
                type="email"
                className={`mt-1 ${input}`}
                value={d.adminEmail}
                onChange={(e) => set("adminEmail", e.target.value)}
                data-testid="wizard-admin-email"
              />
              <p className={hint}>
                {fr
                  ? "Reçoit l'email d'accueil et un mot de passe provisoire, à remplacer à la première connexion."
                  : "Receives the onboarding email and a temporary password, replaced at first sign-in."}
              </p>
            </div>
            <div>
              <span className={label}>{fr ? "Langue par défaut" : "Default language"}</span>
              <div className="mt-1 flex gap-1.5">
                {(["fr", "en"] as const).map((lang) => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => set("language", lang)}
                    data-testid={`wizard-lang-${lang}`}
                    className={`rounded-[var(--radius-atlas-sm)] border px-3 py-1.5 text-[12.5px] font-semibold transition ${
                      d.language === lang
                        ? "border-emerald-700 bg-emerald-700 text-white"
                        : "border-line-strong text-ink-soft hover:bg-surface-2"
                    }`}
                  >
                    {lang === "fr" ? "Français" : "English"}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        {/* ---- step 2: how the firm sends mail ---- */}
        {step === 2 ? (
          <div className="flex flex-col gap-3">
            <div>
              <label className={label} htmlFor="w-mail">
                {fr ? "Adresse d'envoi" : "Sending address"}
              </label>
              <div className="mt-1 flex items-center gap-1.5">
                <input
                  id="w-mail"
                  className={`${input} font-mono`}
                  value={d.mailLocal}
                  onChange={(e) => set("mailLocal", e.target.value)}
                  placeholder={effectiveSlug}
                  data-testid="wizard-mail-local"
                  autoFocus
                />
                <span className="whitespace-nowrap font-mono text-[12.5px] text-muted">@{domain}</span>
              </div>
              <p className={hint}>
                {fr ? "Les confirmations et demandes du cabinet partiront de " : "The firm's confirmations and requests will come from "}
                <span className="font-mono text-ink-soft" data-testid="wizard-mail-preview">
                  {effectiveMail || effectiveSlug}@{domain}
                </span>
                {fr
                  ? ". Le domaine est celui de la plateforme — un cabinet ne peut pas définir une adresse qui échouerait à la livraison."
                  : ". The domain is the platform's, so a firm cannot set a From that would fail to deliver."}
              </p>
            </div>
          </div>
        ) : null}

        {/* ---- step 3: review ---- */}
        {step === 3 ? (
          <div>
            <dl className="divide-y divide-line rounded-[var(--radius-atlas-sm)] border border-line-strong" data-testid="wizard-review">
              {[
                [fr ? "Cabinet" : "Firm", d.name.trim()],
                ["Slug", effectiveSlug],
                [fr ? "Administrateur" : "Administrator", `${d.adminName.trim()} · ${d.adminEmail.trim()}`],
                [fr ? "Langue" : "Language", d.language === "fr" ? "Français" : "English"],
                [fr ? "Adresse d'envoi" : "Sending address", `${effectiveMail}@${domain}`],
              ].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-4 px-3 py-2">
                  <dt className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">{k}</dt>
                  <dd className="text-right text-[13px] font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <p className={`${hint} mt-2`}>
              {avail?.emailExists
                ? fr
                  ? "Cette adresse a déjà un compte : l'administrateur gardera son mot de passe actuel et sera simplement rattaché au nouveau cabinet."
                  : "That address already has an account: the administrator keeps their current password and is simply attached to the new firm."
                : fr
                  ? "Un compte sera créé et l'email d'accueil envoyé. Le mot de passe provisoire n'est jamais affiché ici."
                  : "An account will be created and the onboarding email sent. The temporary password is never shown here."}
            </p>
          </div>
        ) : null}

        {problem ? (
          <p role="alert" className="mt-3 text-[12.5px] font-semibold text-rose" data-testid="wizard-problem">
            {problem}
          </p>
        ) : null}

        {/* ---- controls ---- */}
        <div className="mt-4 flex items-center gap-2">
          {step > 0 ? (
            <button
              type="button"
              onClick={() => setStep((s) => (s - 1) as Step)}
              className="rounded-[var(--radius-atlas-sm)] border border-line-strong px-3 py-1.5 text-[13px] font-semibold text-ink-soft transition hover:bg-surface-2"
              data-testid="wizard-back"
            >
              {t.back}
            </button>
          ) : null}

          {step < 3 ? (
            <button
              type="button"
              onClick={advance}
              disabled={Boolean(problem) || checking}
              className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-1.5 text-[13px] font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
              data-testid="wizard-next"
            >
              {checking ? t.checking : t.next}
            </button>
          ) : (
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-1.5 text-[13px] font-semibold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-45"
              data-testid="wizard-create"
            >
              {submitting ? t.creating : t.create}
            </button>
          )}

          {step > 0 ? (
            <button
              type="button"
              onClick={() => {
                setD(EMPTY);
                setAvail(null);
                setStep(0);
              }}
              className="ml-auto text-[12px] font-semibold text-muted underline-offset-2 transition hover:text-ink-soft hover:underline"
              data-testid="wizard-reset"
            >
              {t.startOver}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
