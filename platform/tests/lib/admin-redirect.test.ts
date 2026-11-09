import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { platformAdminUrl } from "@/lib/admin-redirect";
import { isPublic } from "@/lib/public-routes";

describe("platformAdminUrl", () => {
  it("stays on this tool's console until it is set", () => {
    expect(platformAdminUrl(undefined)).toBeNull();
    expect(platformAdminUrl("")).toBeNull();
  });

  it("goes to the admin Odoo when set", () => {
    expect(platformAdminUrl("https://console.auditisa.com")).toBe("https://console.auditisa.com/");
    expect(platformAdminUrl(" https://console.auditisa.com/odoo ")).toBe("https://console.auditisa.com/odoo");
  });

  it.each([
    "http://console.auditisa.com",
    "https://console.auditisa.com.evil.example",
    "https://evil.example/console.auditisa.com",
    "https://user:pw@console.auditisa.com",
    "https://console.auditisa.com:8443",
    "javascript:alert(1)",
    "not a url",
    "/admin/console",
  ])("refuses %s", (raw) => {
    expect(platformAdminUrl(raw)).toBeNull();
  });
});

describe("the console stays reachable and guarded", () => {
  const console_ = readFileSync("app/admin/console/page.tsx", "utf8");
  const entry = readFileSync("app/admin/page.tsx", "utf8");

  it("the console keeps its super admin check, and its forms return to it", () => {
    expect(console_).toContain('if (!session.user.isSuper) redirect("/dashboard")');
    expect(console_).toMatch(/redirect\(`?"?\/admin\/console\?/);
    expect(console_).not.toMatch(/redirect\(`?"?\/admin\?/);
  });

  it("/admin checks the session before saying where anything is", () => {
    expect(entry.indexOf('redirect("/login")')).toBeLessThan(entry.indexOf("platformAdminUrl()"));
    expect(entry.indexOf('redirect("/dashboard")')).toBeLessThan(entry.indexOf("platformAdminUrl()"));
  });

  it("the links in the app go to the console, which works with or without the redirect", () => {
    for (const file of ["components/AppNav.tsx", "app/dashboard/page.tsx"]) {
      const source = readFileSync(file, "utf8");
      expect(source).toContain('href="/admin/console"');
      expect(source).not.toContain('href="/admin"');
    }
  });

  it("neither is public", () => {
    expect(isPublic("/admin")).toBe(false);
    expect(isPublic("/admin/console")).toBe(false);
  });
});
