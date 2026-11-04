import { afterEach, describe, expect, it } from "vitest";
import { AccountMailError, accountMail, loginUrl, safeNext } from "@/lib/account-mail";

// The emails that hand someone the tool. What matters: a real link to the
// sign-in page with the email filled in, the temporary password where an
// account was provisioned (and nowhere in the link), a button in the HTML,
// and the same content in the plain-text part for clients that show it.

const APP = process.env.APP_URL;
afterEach(() => {
  if (APP === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = APP;
});

describe("loginUrl", () => {
  it("points at the sign-in page with the email encoded", () => {
    process.env.APP_URL = "https://dev.auditisa.com/";
    expect(loginUrl("Anne.Dupont@Firm.com")).toBe(
      "https://dev.auditisa.com/login?email=anne.dupont%40firm.com",
    );
  });
});

describe("accountMail", () => {
  it("no account mail carries a password or a temporary-password field (F071)", () => {
    const facts = { email: "anne@firm.com", name: "Anne", firmName: "Elite Advisors", inviteUrl: "https://www.auditisa.com/invite/tok" };
    for (const locale of ["en", "fr"] as const) {
      for (const m of [
        accountMail("invitation", facts, locale),
        accountMail("password-reset", facts, locale),
        accountMail("admin-access", facts, locale),
        accountMail("firm-onboarded", facts, locale),
        accountMail("added-to-engagement", { email: facts.email, engagementName: "X" }, locale),
      ]) {
        expect(m.body).not.toMatch(/temporary password|mot de passe temporaire|mot de passe provisoire/i);
        expect(m.html).not.toMatch(/temporary password|mot de passe temporaire|mot de passe provisoire/i);
      }
      expect(accountMail("firm-onboarded", facts, locale).body).toContain("/invite/tok");
      expect(accountMail("admin-access", facts, locale).body).toContain("/invite/tok");
    }
  });

  it("existing user added to an engagement: the sign-in page, carrying the engagement", () => {
    const m = accountMail(
      "added-to-engagement",
      {
        email: "bob@firm.com",
        name: "Bob",
        firmName: "Elite Advisors",
        inviterName: "Anne",
        engagementName: "ELIMELEC 2026",
        engagementId: "abc-123",
        roleLabel: "manager",
      },
      "en",
    );
    expect(m.subject).toBe("Elite Advisors — you have been added to ELIMELEC 2026");
    expect(m.body).toContain(
      'Anne has added you to the engagement "ELIMELEC 2026" as manager at Elite Advisors.',
    );
    // The link must land on the sign-in page. Pointing straight at the
    // engagement only ever worked for someone who already had a live session.
    expect(m.body).toContain(
      "https://www.auditisa.com/login?email=bob%40firm.com&next=%2Finvitations%2Fabc-123",
    );
    expect(m.body).not.toMatch(/https:\/\/[^\s]*\/engagements\/abc-123\/dashboard(?![^\s]*next)/);
    expect(m.body).toContain("Firm: Elite Advisors");
    expect(m.body).not.toContain("Temporary password");
  });

  it("password reset carries a set-password link and no password (UAT B39)", () => {
    const m = accountMail(
      "password-reset",
      { email: "bob@firm.com", name: "Bob", inviterName: "Anne", inviteUrl: "https://www.auditisa.com/invite/tok-1" },
      "en",
    );
    expect(m.body).toContain("Anne, firm administrator, has reset your AuditISA password.");
    expect(m.body).toContain("https://www.auditisa.com/invite/tok-1");
    expect(m.body).not.toContain("Temporary password");
    // "Choose a new password: <link>" is the button's plain-text fallback, not
    // a credential; only a "password: <something that is not the link>" fails.
    expect(m.body).not.toMatch(/password: (?!https:\/\/www\.auditisa\.com\/invite\/tok-1)/i);
    expect(m.body).toContain("Choose a new password: https://www.auditisa.com/invite/tok-1");
  });

  it("escapes what it puts in HTML", () => {
    const m = accountMail(
      "invitation",
      { email: "x@y.com", name: "<script>alert(1)</script>", inviteUrl: "https://x/invite/t" },
      "en",
    );
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("&lt;script&gt;");
  });

  it("refuses to send a reset email with no link", () => {
    // The @ts-expect-error line is half the test: the overload must reject this
    // at compile time, and the runtime guard is the backstop.
    expect(() =>
      // @ts-expect-error password-reset requires a set-password link
      accountMail("password-reset", { email: "anne@firm.com" }, "en"),
    ).toThrow(AccountMailError);
  });

  it("falls back to the sign-in page when an engagement has no id", () => {
    const m = accountMail(
      "added-to-engagement",
      { email: "bob@firm.com", engagementName: "ELIMELEC 2026" },
      "en",
    );
    expect(m.body).toContain("/login?email=bob%40firm.com");
    expect(m.body).not.toContain("/engagements/");
  });
});

// The two emails a firm sees before it has anyone who could change a language
// setting: the welcome, and platform-admin access. Both were English-only.
describe("account mail speaks the reader's language throughout", () => {
  it("welcomes a firm in French", () => {
    const m = accountMail(
      "firm-onboarded",
      { email: "admin@cabinet.cm", name: "Anne", firmName: "Cabinet Alpha", inviteUrl: "https://x/invite/t" },
      "fr",
    );
    expect(m.subject).toBe("Bienvenue sur AuditISA — Cabinet Alpha est enregistré");
    expect(m.body).toContain("Bonjour Anne,");
    expect(m.body).toContain("Votre cabinet d'audit « Cabinet Alpha » a été créé sur AuditISA.");
    expect(m.body).toContain("Choisir mon mot de passe: https://x/invite/t");
    expect(m.body).toContain("Créez ensuite vos clients");
    expect(m.html).toContain(">Choisir mon mot de passe<");
    expect(m.body).not.toMatch(/Welcome to AuditISA|Open AuditISA|your firm/);
  });

  it("welcomes a firm in English", () => {
    const m = accountMail(
      "firm-onboarded",
      { email: "admin@firm.com", firmName: "Elite Advisors" },
      "en",
    );
    expect(m.subject).toBe("Welcome to AuditISA — Elite Advisors is onboarded");
    expect(m.body).toContain('Your audit firm "Elite Advisors" has been set up on AuditISA.');
    expect(m.body).toContain("Then create your clients");
  });

  it("names the firm even when there is no firm name", () => {
    expect(accountMail("firm-onboarded", { email: "a@b.com" }, "en").subject).toBe(
      "Welcome to AuditISA — your firm is onboarded",
    );
    expect(accountMail("firm-onboarded", { email: "a@b.com" }, "fr").subject).toBe(
      "Bienvenue sur AuditISA — votre cabinet est enregistré",
    );
  });

  it("grants platform-admin access in French, with and without a new account", () => {
    const fresh = accountMail(
      "admin-access",
      { email: "ops@cm-ea.com", name: "Ops", inviteUrl: "https://x/invite/t" },
      "fr",
    );
    expect(fresh.subject).toBe("AuditISA — accès administrateur de la plateforme");
    expect(fresh.body).toContain(
      "L'accès administrateur de la plateforme AuditISA vous a été accordé.",
    );
    expect(fresh.body).toContain("Choisir mon mot de passe: https://x/invite/t");

    const existing = accountMail("admin-access", { email: "ops@cm-ea.com", name: "Ops" }, "fr");
    expect(existing.body).toContain("Utilisez votre mot de passe habituel");
    expect(existing.body).not.toContain("Mot de passe temporaire");
    expect(existing.body).not.toMatch(
      /Use your existing password|administrator access on AuditISA/,
    );
  });

  it("grants platform-admin access in English", () => {
    const m = accountMail("admin-access", { email: "ops@cm-ea.com" }, "en");
    expect(m.subject).toBe("AuditISA — platform administrator access");
    expect(m.body).toContain("the admin console is now available from your account");
  });

  it("leaves no runaway blank lines in the plain-text part", () => {
    // render() joins optional sections; an empty one used to leave a gap.
    for (const m of [
      accountMail(
        "added-to-engagement",
        { email: "b@f.com", engagementName: "X", engagementId: "e1" },
        "en",
      ),
      accountMail("admin-access", { email: "b@f.com" }, "fr"),
      accountMail("invitation", { email: "b@f.com", inviteUrl: "https://x/invite/t" }, "fr"),
    ]) {
      expect(m.body).not.toContain("\n\n\n");
      expect(m.body.trimStart()).toBe(m.body);
    }
  });
});

// Where a link is allowed to send someone after they sign in.
describe("safeNext", () => {
  it("keeps a path on this site", () => {
    expect(safeNext("/engagements/abc/dashboard")).toBe("/engagements/abc/dashboard");
    expect(safeNext("/")).toBe("/");
  });

  it("refuses anything that leaves the site", () => {
    // An account email is exactly the place someone would try this: the
    // sign-in page looks legitimate and the redirect happens after the password
    // has been typed.
    for (const hostile of [
      "//evil.example.com",
      "https://evil.example.com",
      "http://evil.example.com/x",
      "javascript:alert(1)",
      "evil.example.com",
      "",
      null,
      undefined,
      // a browser reads the backslash as a slash: "/\host" is "//host" (UAT B07)
      "/\\example.org/",
      "/%5Cexample.org/",
      "/\texample.org",
      "/\\/example.org",
    ]) {
      expect(safeNext(hostile), String(hostile)).toBe("/");
    }
  });

  it("keeps the query and hash of a path on this site", () => {
    expect(safeNext("/engagements/abc/dashboard?tab=team#notes")).toBe(
      "/engagements/abc/dashboard?tab=team#notes",
    );
  });
});

describe("loginUrl with a destination", () => {
  it("appends only a relative path", () => {
    process.env.APP_URL = "https://www.auditisa.com";
    expect(loginUrl("a@b.com", "/engagements/e1/dashboard")).toBe(
      "https://www.auditisa.com/login?email=a%40b.com&next=%2Fengagements%2Fe1%2Fdashboard",
    );
    expect(loginUrl("a@b.com", "https://evil.example.com")).toBe(
      "https://www.auditisa.com/login?email=a%40b.com",
    );
    expect(loginUrl("a@b.com", "//evil.example.com")).toBe(
      "https://www.auditisa.com/login?email=a%40b.com",
    );
    expect(loginUrl("a@b.com")).toBe("https://www.auditisa.com/login?email=a%40b.com");
  });
});
