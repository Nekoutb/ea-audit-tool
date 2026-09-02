import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// AUTH_DISABLE_MFA exists for the dev instance. The point of these tests is
// the half that is easy to get wrong: the flag must do NOTHING on production,
// because both instances run the same build from the same branch and an .env
// line copied to the wrong server must not be able to unlock www.auditisa.com.

const PROD = "postgresql://ea_app:x@localhost:5432/ea_audit";
const DEV = "postgresql://ea_app:x@localhost:5432/ea_audit_dev";

let saved: NodeJS.ProcessEnv;

beforeEach(() => {
  saved = { ...process.env };
  vi.resetModules();
});

afterEach(() => {
  process.env = saved;
  vi.restoreAllMocks();
});

async function mfaDisabled(): Promise<boolean> {
  const mod = await import("@/lib/mfa-policy");
  return mod.mfaDisabled();
}

describe("mfaDisabled", () => {
  it("is off by default on the dev database", async () => {
    delete process.env.AUTH_DISABLE_MFA;
    process.env.APP_DATABASE_URL = DEV;
    expect(await mfaDisabled()).toBe(false);
  });

  it("is on when the dev database asks for it", async () => {
    process.env.AUTH_DISABLE_MFA = "1";
    process.env.APP_DATABASE_URL = DEV;
    expect(await mfaDisabled()).toBe(true);
  });

  it("accepts true/yes as well as 1", async () => {
    process.env.APP_DATABASE_URL = DEV;
    for (const raw of ["true", "TRUE", " yes ", "1"]) {
      vi.resetModules();
      process.env.AUTH_DISABLE_MFA = raw;
      expect(await mfaDisabled()).toBe(true);
    }
  });

  it("ignores the flag on the production database, and says so", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    process.env.AUTH_DISABLE_MFA = "1";
    process.env.APP_DATABASE_URL = PROD;
    expect(await mfaDisabled()).toBe(false);
    expect(warn).toHaveBeenCalledOnce();
  });

  it("ignores the flag when the database cannot be identified", async () => {
    process.env.AUTH_DISABLE_MFA = "1";
    delete process.env.APP_DATABASE_URL;
    delete process.env.DATABASE_URL;
    expect(await mfaDisabled()).toBe(false);
  });

  it("ignores the flag when the connection string is unparseable", async () => {
    process.env.AUTH_DISABLE_MFA = "1";
    process.env.APP_DATABASE_URL = "not a url";
    expect(await mfaDisabled()).toBe(false);
  });

  it("reads APP_DATABASE_URL in preference to DATABASE_URL", async () => {
    process.env.AUTH_DISABLE_MFA = "1";
    process.env.APP_DATABASE_URL = PROD;
    process.env.DATABASE_URL = DEV;
    expect(await mfaDisabled()).toBe(false);
  });
});
