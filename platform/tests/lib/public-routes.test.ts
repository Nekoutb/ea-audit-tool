import { describe, expect, it } from "vitest";
import { isPublic } from "@/lib/public-routes";

// Which pages work without a session.
//
// Written after /invite shipped without being on the list: a new colleague has
// no session by definition, so the page where they choose their first password
// was redirecting them to a sign-in they could not complete. The failure is
// invisible in unit tests and looks like a working deploy, so it is stated here.

describe("routes reachable without signing in", () => {
  it("includes the pages a person must reach before they have an account", () => {
    expect(isPublic("/login"), "sign-in").toBe(true);
    expect(isPublic("/invite/abc123"), "choose your first password").toBe(true);
    expect(isPublic("/terms")).toBe(true);
    expect(isPublic("/privacy")).toBe(true);
    expect(isPublic("/")).toBe(true);
  });

  it("includes what the deploy pipeline and the mail hook need", () => {
    expect(isPublic("/api/auth/callback/credentials")).toBe(true);
    expect(isPublic("/api/version")).toBe(true);
    expect(isPublic("/version")).toBe(true);
    expect(isPublic("/api/email/inbound")).toBe(true);
  });

  it("does not include the audit file", () => {
    for (const guarded of [
      "/dashboard",
      "/engagements/abc/dashboard",
      "/users",
      "/admin",
      "/change-password",
      "/security",
      "/api/engagements/abc/export/bundle",
    ]) {
      expect(isPublic(guarded), guarded).toBe(false);
    }
  });

  it("does not open a path merely because it starts with a public one", () => {
    // "/loginsomething" is not "/login"; the check is segment-aware.
    expect(isPublic("/logins")).toBe(false);
    expect(isPublic("/inviteer")).toBe(false);
    expect(isPublic("/versions")).toBe(false);
  });
});
