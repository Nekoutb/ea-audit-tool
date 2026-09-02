import { execSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

// White-label phase 1: firm branding round-trip — themed UI via the emerald
// CSS-variable override, nav identity, and cross-tenant isolation of the
// theme. Letterhead content is covered by the unit suite.

const ACCENT = "#7c3aed";
const ACCENT_RGB = "rgb(124, 58, 237)";

// The seed resets tenant.branding, but the global setup runs it once per
// suite. This test mutates branding half-way through, so an attempt that dies
// after the save leaves "Cabinet FOKO & Associés" behind and the retry fails
// its very first assertion. Re-seed before every attempt instead.
test.beforeEach(() => {
  execSync("node scripts/seed.mjs", { stdio: "inherit" });
});

async function login(page: Page, email: string): Promise<void> {
  await page.context().clearCookies();
  await page.context().addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);
  // Warm the auth API so the client-side signIn never races its dev compile.
  await page.request.get("/api/auth/csrf");
  await page.goto("/login");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", "password");
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/dashboard");
}

test("firm branding: settings → themed UI + nav identity, isolated per tenant", async ({ page }) => {
  test.setTimeout(180_000);
  // The seed resets tenant.branding, so the default state is deterministic.
  await login(page, "alice@firm-a.test");
  await expect(page.getByTestId("brand-name")).toContainText("Cabinet Alpha");

  // Save a full branding set.
  await page.goto("/settings");
  await page.getByTestId("branding-name").fill("Cabinet FOKO & Associés");
  await page.getByTestId("branding-accent").fill(ACCENT);
  await page.getByTestId("branding-letterhead1").fill("Rue de la Réunification, BP 1234");
  await page.getByTestId("branding-letterhead2").fill("Douala, Cameroun");
  await page.getByTestId("branding-footer").fill("Inscrit au tableau de l'ONECCA");
  await page.getByTestId("branding-save").click();
  await page.waitForURL("**/settings?saved=1", { timeout: 30_000 });
  await expect(page.getByTestId("branding-saved")).toBeVisible();

  // Nav identity + theme applied: the primary button now renders the accent.
  await expect(page.getByTestId("brand-name")).toContainText("Cabinet FOKO & Associés");
  const buttonColor = await page
    .getByTestId("branding-save")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(buttonColor).toBe(ACCENT_RGB);

  // The theme follows to every page (dashboard uses the same variables).
  await page.goto("/dashboard");
  await expect(page.getByTestId("brand-name")).toContainText("Cabinet FOKO & Associés");

  // A malformed/too-light accent is refused with a readable error.
  await page.goto("/settings");
  await page.getByTestId("branding-accent").fill("#fefefe");
  await page.getByTestId("branding-save").click();
  await page.waitForURL("**/settings?error=invalid-color", { timeout: 30_000 });
  await expect(page.getByTestId("planning-error")).toContainText(/hex colour/i);

  // Firm B is untouched: default name, default green primary.
  await login(page, "bob@firm-b.test");
  await expect(page.getByTestId("brand-name")).toContainText("Cabinet Beta");
  await page.goto("/settings");
  const firmBColor = await page
    .getByTestId("branding-save")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(firmBColor).not.toBe(ACCENT_RGB);

  // Cleanup: restore Firm A defaults so the demo tenant stays green.
  await login(page, "alice@firm-a.test");
  await page.goto("/settings");
  await page.getByTestId("branding-name").fill("Cabinet Alpha");
  await page.getByTestId("branding-reset-accent").check();
  await page.getByTestId("branding-letterhead1").fill("");
  await page.getByTestId("branding-letterhead2").fill("");
  await page.getByTestId("branding-footer").fill("");
  await page.getByTestId("branding-save").click();
  await page.waitForURL("**/settings?saved=1", { timeout: 30_000 });
  await expect(page.getByTestId("branding-saved")).toBeVisible();
  const restored = await page
    .getByTestId("branding-save")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(restored).not.toBe(ACCENT_RGB);
});
