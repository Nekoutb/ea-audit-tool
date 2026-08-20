import { afterEach, describe, expect, it } from "vitest";
import { PLATFORM_SUPPORT_LOCAL, mailDomain, platformSender, resolveFrom, sanitiseMailLocal } from "@/lib/email";

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
});

describe("platform vs firm sender", () => {
  it("sends onboarding from support on the verified domain", () => {
    process.env.MAIL_DOMAIN = "auditisa.com";
    expect(resolveFrom(platformSender()).email).toBe("support@auditisa.com");
  });

  it("keeps audit correspondence on the firm's own address", () => {
    // A third party relies on a confirmation, so it must carry the firm's
    // identity — not the platform's.
    process.env.MAIL_DOMAIN = "auditisa.com";
    expect(resolveFrom({ fromLocal: "eca", fromName: "ECA Audit" }).email).toBe("eca@auditisa.com");
  });

  it("falls back to MAIL_FROM when no verified domain is configured", () => {
    // Without MAIL_DOMAIN nothing may claim to be support@auditisa.com.
    delete process.env.MAIL_DOMAIN;
    process.env.MAIL_FROM = "no-reply@auditisa.com";
    expect(resolveFrom(platformSender()).email).toBe("no-reply@auditisa.com");
  });

  it("uses support as the local part", () => {
    expect(PLATFORM_SUPPORT_LOCAL).toBe("support");
    expect(platformSender().fromLocal).toBe("support");
  });

  it("names the sender AuditISA unless overridden", () => {
    delete process.env.MAIL_FROM_NAME;
    expect(platformSender().fromName).toBe("AuditISA");
    process.env.MAIL_FROM_NAME = "AuditISA Support";
    expect(platformSender().fromName).toBe("AuditISA Support");
  });

  it("never lets a tenant choose the domain", () => {
    process.env.MAIL_DOMAIN = "auditisa.com";
    // A local part carrying a domain is not a valid local part.
    expect(sanitiseMailLocal("eca@evil.example")).toBeUndefined();
    expect(mailDomain()).toBe("auditisa.com");
  });
});
