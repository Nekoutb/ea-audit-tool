// Account mail — the emails that give someone the tool: a new account, an
// engagement they were added to, a password reset, platform-admin access,
// a firm's first sign-in. Pure: subject, plain text and HTML from a few facts,
// in the inviter's language.
//
// Every one of them carries a real link to the sign-in page with the email
// already filled in (/login?email=…), an HTML button for it, and — where an
// account was just provisioned — the temporary password that must be replaced
// at first sign-in. The password never rides in the link: a link that signs
// someone in by itself is a weaker control than a password they must change.

export type MailLocale = "en" | "fr";

export interface AccountMailFacts {
  /** the recipient's address, as the account was created */
  email: string;
  /** the recipient's name, when known */
  name?: string | null;
  firmName?: string | null;
  /** who did it, when known */
  inviterName?: string | null;
  /** present when an account was just provisioned or reset */
  tempPassword?: string | null;
  /** the engagement, for engagement invitations */
  engagementName?: string | null;
  engagementId?: string | null;
  /** the team role on that engagement, spelled out */
  roleLabel?: string | null;
}

export type AccountMailKind =
  "new-account" | "added-to-engagement" | "password-reset" | "admin-access" | "firm-onboarded";

export interface AccountMail {
  subject: string;
  body: string;
  html: string;
}

export function appUrl(): string {
  return (process.env.APP_URL ?? "https://www.auditisa.com").replace(/\/$/, "");
}

/**
 * The sign-in page with the email pre-filled; the password field gets the cursor.
 *
 * `next` is where to land once signed in. Every account email points here rather
 * than at the destination itself: a link straight to an engagement only works
 * for someone who already has a live session, and for the person the email was
 * actually written for it lands on a sign-in page with no explanation.
 */
export function loginUrl(email: string, next?: string | null): string {
  const url = `${appUrl()}/login?email=${encodeURIComponent(email.trim().toLowerCase())}`;
  const path = safeNext(next);
  return path === "/" ? url : `${url}&next=${encodeURIComponent(path)}`;
}

/**
 * Only a path on this site.
 *
 * Lives here, beside loginUrl, so the email that writes a destination and the
 * sign-in form that acts on one share a single rule. Absolute URLs and
 * protocol-relative "//host" are rejected: an account email is exactly where
 * someone would try that, because the sign-in page looks legitimate and the
 * redirect happens after the password has been typed.
 */
export function safeNext(value: unknown): string {
  const next = typeof value === "string" ? value.trim() : "";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

interface Rendered {
  greeting: string;
  intro: string[];
  button: { label: string; url: string };
  fields: { label: string; value: string; mono?: boolean }[];
  notes: string[];
  fallbackLabel: string;
}

function render(subject: string, r: Rendered): AccountMail {
  // Blocks separated by exactly one blank line, with empty ones dropped.
  // Composing this as a chain of sections each ending in a blank line left a
  // three-newline gap wherever a section was empty - an email with no notes,
  // for instance.
  const body =
    [
      r.greeting,
      ...r.intro,
      `${r.button.label}: ${r.button.url}`,
      r.fields.map((f) => `${f.label}: ${f.value}`).join("\n"),
      ...r.notes,
      `${r.fallbackLabel}: ${r.button.url}`,
    ]
      .filter((block) => block.trim().length > 0)
      .join("\n\n") + "\n";

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f3f4f2;font-family:Segoe UI,Arial,sans-serif;color:#1c1c1a">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e3e6ea;border-radius:12px;padding:28px 32px">
  <p style="margin:0 0 18px;font-size:11px;letter-spacing:.14em;font-weight:700;color:#0f6e56">AUDITISA</p>
  <p style="margin:0 0 14px;font-size:15px">${esc(r.greeting)}</p>
  ${r.intro.map((p) => `<p style="margin:0 0 12px;font-size:14px;line-height:1.55">${esc(p)}</p>`).join("")}
  <p style="margin:22px 0"><a href="${esc(r.button.url)}" style="display:inline-block;background:#0f6e56;color:#ffffff;text-decoration:none;font-weight:700;font-size:14px;padding:11px 20px;border-radius:8px">${esc(r.button.label)}</a></p>
  ${r.fields.length ? `<table style="border-collapse:collapse;margin:0 0 18px;font-size:14px">${r.fields.map((f) => `<tr><td style="padding:5px 14px 5px 0;color:#6b7280;white-space:nowrap">${esc(f.label)}</td><td style="padding:5px 0;${f.mono ? "font-family:Consolas,Menlo,monospace;font-size:15px;letter-spacing:.04em" : ""}"><b>${esc(f.value)}</b></td></tr>`).join("")}</table>` : ""}
  ${r.notes.map((n) => `<p style="margin:0 0 10px;font-size:13px;line-height:1.5;color:#4b5563">${esc(n)}</p>`).join("")}
  <p style="margin:18px 0 0;font-size:12px;color:#8a8a86;line-height:1.5">${esc(r.fallbackLabel)}:<br><a href="${esc(r.button.url)}" style="color:#0f6e56;word-break:break-all">${esc(r.button.url)}</a></p>
</div>
<p style="max-width:560px;margin:14px auto 0;font-size:11px;color:#8a8a86;text-align:center">AuditISA — ${esc(appUrl())}</p>
</body></html>`;
  return { subject, body, html };
}

export class AccountMailError extends Error {}

/** The two kinds whose entire purpose is to carry a password cannot be sent without one. */
export type ProvisioningKind = "new-account" | "password-reset";

export function accountMail(
  kind: ProvisioningKind,
  facts: AccountMailFacts & { tempPassword: string },
  locale: MailLocale,
): AccountMail;
// The general overload deliberately EXCLUDES the two provisioning kinds. With
// `AccountMailKind` here, a call missing the password would fall through to
// this signature and compile happily — the first overload would never bite.
export function accountMail(
  kind: Exclude<AccountMailKind, ProvisioningKind>,
  facts: AccountMailFacts,
  locale: MailLocale,
): AccountMail;
export function accountMail(
  kind: AccountMailKind,
  facts: AccountMailFacts,
  locale: MailLocale,
): AccountMail {
  const fr = locale === "fr";
  const T = (en: string, frText: string) => (fr ? frText : en);
  const name = facts.name?.trim() || facts.email;
  const firm = facts.firmName?.trim() || "";
  const by = facts.inviterName?.trim() || "";
  const greeting = T(`Hello ${name},`, `Bonjour ${name},`);
  const signIn = loginUrl(facts.email);
  const fallback = T(
    "If the button does not open, copy this address into your browser",
    "Si le bouton ne s'ouvre pas, copiez cette adresse dans votre navigateur",
  );
  const credentials = (temp: string) => [
    { label: T("Email", "Email"), value: facts.email },
    { label: T("Temporary password", "Mot de passe temporaire"), value: temp, mono: true },
  ];
  const firstSignIn = T(
    "At first sign-in you will be asked to choose your own password; the temporary one stops working after that.",
    "À la première connexion, vous choisirez votre propre mot de passe ; le mot de passe temporaire cesse alors de fonctionner.",
  );
  const unexpected = T(
    "If you did not expect this email, ignore it — nothing happens without the password above.",
    "Si vous n'attendiez pas cet email, ignorez-le — rien ne se passe sans le mot de passe ci-dessus.",
  );

  // Rendering "Temporary password:" followed by nothing would lock the recipient
  // out with no way to tell why, so these two kinds fail loudly instead. The
  // overloads above catch it at compile time; this catches a value that was
  // typed as a string and turned out to be empty.
  if ((kind === "new-account" || kind === "password-reset") && !facts.tempPassword?.trim()) {
    throw new AccountMailError(`${kind} needs a temporary password`);
  }
  const openWithTemp = T(
    "Open AuditISA with the button below — your email is already filled in — and enter the temporary password.",
    "Ouvrez AuditISA avec le bouton ci-dessous — votre email est déjà renseigné — et saisissez le mot de passe temporaire.",
  );

  switch (kind) {
    case "new-account": {
      const subject = T(
        `Your AuditISA account${firm ? ` — ${firm}` : ""}`,
        `Votre compte AuditISA${firm ? ` — ${firm}` : ""}`,
      );
      const who = by
        ? T(`${by} has created your AuditISA account`, `${by} a créé votre compte AuditISA`)
        : T(
            "An AuditISA account has been created for you",
            "Un compte AuditISA a été créé pour vous",
          );
      const intro = [
        `${who}${firm ? T(` at ${firm}`, ` chez ${firm}`) : ""}.` +
          (facts.engagementName
            ? T(
                ` You have been added to the engagement "${facts.engagementName}"${facts.roleLabel ? ` as ${facts.roleLabel}` : ""}.`,
                ` Vous avez été ajouté(e) à la mission « ${facts.engagementName} »${facts.roleLabel ? ` en tant que ${facts.roleLabel}` : ""}.`,
              )
            : ""),
        openWithTemp,
      ];
      return render(subject, {
        greeting,
        intro,
        button: { label: T("Open AuditISA", "Ouvrir AuditISA"), url: signIn },
        fields: credentials(facts.tempPassword ?? ""),
        notes: [firstSignIn, unexpected],
        fallbackLabel: fallback,
      });
    }
    case "added-to-engagement": {
      const subject = T(
        `${firm ? `${firm} — ` : ""}you have been added to ${facts.engagementName ?? "an engagement"}`,
        `${firm ? `${firm} — ` : ""}vous avez été ajouté(e) à ${facts.engagementName ?? "une mission"}`,
      );
      // The sign-in page carrying the engagement, never the engagement itself:
      // the old link worked only for someone who already had a live session.
      const dash = facts.engagementId
        ? loginUrl(facts.email, `/engagements/${facts.engagementId}/dashboard`)
        : signIn;
      return render(subject, {
        greeting,
        intro: [
          `${by ? T(`${by} has added you`, `${by} vous a ajouté(e)`) : T("You have been added", "Vous avez été ajouté(e)")}${T(` to the engagement "${facts.engagementName}"`, ` à la mission « ${facts.engagementName} »`)}${facts.roleLabel ? T(` as ${facts.roleLabel}`, ` en tant que ${facts.roleLabel}`) : ""}${firm ? T(` at ${firm}`, ` chez ${firm}`) : ""}.`,
          T(
            "Open the button below and sign in with your password — you will land on the engagement, where you can accept or decline it. If you have forgotten your password, ask your firm administrator to reset it.",
            "Ouvrez le bouton ci-dessous et connectez-vous avec votre mot de passe — vous arriverez sur la mission, que vous pourrez accepter ou décliner. Si vous avez oublié votre mot de passe, demandez à l'administrateur du cabinet de le réinitialiser.",
          ),
        ],
        button: {
          label: T("Sign in and open the engagement", "Se connecter et ouvrir la mission"),
          url: dash,
        },
        fields: [
          ...(firm ? [{ label: T("Firm", "Cabinet"), value: firm }] : []),
          { label: T("Email", "Email"), value: facts.email },
        ],
        notes: [],
        fallbackLabel: fallback,
      });
    }
    case "password-reset": {
      const subject = T(
        "Your AuditISA password has been reset",
        "Votre mot de passe AuditISA a été réinitialisé",
      );
      return render(subject, {
        greeting,
        intro: [
          `${by ? T(`${by}, firm administrator, has reset your AuditISA password`, `${by}, administrateur du cabinet, a réinitialisé votre mot de passe AuditISA`) : T("A firm administrator has reset your AuditISA password", "Un administrateur du cabinet a réinitialisé votre mot de passe AuditISA")}.`,
          openWithTemp,
        ],
        button: { label: T("Open AuditISA", "Ouvrir AuditISA"), url: signIn },
        fields: credentials(facts.tempPassword ?? ""),
        notes: [
          firstSignIn,
          T(
            "If you did not expect this, contact your firm administrator: any session opened with the old password has been closed.",
            "Si vous n'attendiez pas cette réinitialisation, contactez l'administrateur du cabinet : toute session ouverte avec l'ancien mot de passe a été fermée.",
          ),
        ],
        fallbackLabel: fallback,
      });
    }
    case "admin-access": {
      const subject = T(
        "AuditISA — platform administrator access",
        "AuditISA — accès administrateur de la plateforme",
      );
      const provisioned = Boolean(facts.tempPassword);
      return render(subject, {
        greeting,
        intro: [
          T(
            "You have been granted platform administrator access on AuditISA.",
            "L'accès administrateur de la plateforme AuditISA vous a été accordé.",
          ),
          provisioned
            ? openWithTemp
            : T(
                "Use your existing password — the admin console is now available from your account.",
                "Utilisez votre mot de passe habituel — la console d'administration est désormais disponible depuis votre compte.",
              ),
        ],
        button: { label: T("Open AuditISA", "Ouvrir AuditISA"), url: signIn },
        fields: provisioned
          ? credentials(facts.tempPassword ?? "")
          : [{ label: T("Email", "Email"), value: facts.email }],
        notes: provisioned ? [firstSignIn] : [],
        fallbackLabel: fallback,
      });
    }
    case "firm-onboarded": {
      // The first thing a new firm ever receives from the product, and most of
      // them work in French — so this one is translated like the rest.
      const firmLabel = firm || T("your firm", "votre cabinet");
      const subject = T(
        `Welcome to AuditISA — ${firmLabel} is onboarded`,
        `Bienvenue sur AuditISA — ${firmLabel} est enregistré`,
      );
      const provisioned = Boolean(facts.tempPassword);
      const thenSetUp = T(
        "Then create your clients and audit engagements and invite your team.",
        "Créez ensuite vos clients et vos missions d'audit, et invitez votre équipe.",
      );
      return render(subject, {
        greeting,
        intro: [
          T(
            `Your audit firm "${firmLabel}" has been set up on AuditISA.`,
            `Votre cabinet d'audit « ${firmLabel} » a été créé sur AuditISA.`,
          ),
          provisioned
            ? `${openWithTemp} ${thenSetUp}`
            : `${T("Use your existing password.", "Utilisez votre mot de passe habituel.")} ${thenSetUp}`,
          T(
            "Each firm's data is fully segregated, and every engagement is independent within the firm.",
            "Les données de chaque cabinet sont entièrement cloisonnées, et chaque mission est indépendante au sein du cabinet.",
          ),
        ],
        button: { label: T("Open AuditISA", "Ouvrir AuditISA"), url: signIn },
        fields: provisioned
          ? credentials(facts.tempPassword ?? "")
          : [{ label: T("Email", "Email"), value: facts.email }],
        notes: provisioned ? [firstSignIn] : [],
        fallbackLabel: fallback,
      });
    }
  }
}
