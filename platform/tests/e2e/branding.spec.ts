import { execSync } from "node:child_process";
import { expect, test, type Browser, type Page } from "@playwright/test";

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

/**
 * Sign in as `email` in a FRESH browser context and return its page.
 *
 * Switching users by clearing cookies in one context does not work here: the
 * proxy refreshes the session cookie on every response, and the app prefetches
 * the nav's links, so a prefetch still in flight when the cookies were cleared
 * put the previous user's session straight back. The next /login then
 * redirected to that user's dashboard and the e-mail field never appeared —
 * the stall that hid behind every red run of this spec. A context per user
 * has nothing to race.
 */
async function signIn(browser: Browser, email: string): Promise<Page> {
  const context = await browser.newContext();
  await context.addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);
  const page = await context.newPage();
  await page.goto("/login");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", "password");
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/dashboard");
  return page;
}

test("firm branding: settings → themed UI + nav identity, isolated per tenant", async ({ browser }) => {
  test.setTimeout(180_000);
  // The seed resets tenant.branding, so the default state is deterministic.
  const alice = await signIn(browser, "alice@firm-a.test");
  await expect(alice.getByTestId("brand-name")).toContainText("Cabinet Alpha");

  // Save a full branding set.
  await alice.goto("/settings");
  await alice.getByTestId("branding-name").fill("Cabinet FOKO & Associés");
  await alice.getByTestId("branding-accent").fill(ACCENT);
  await alice.getByTestId("branding-letterhead1").fill("Rue de la Réunification, BP 1234");
  await alice.getByTestId("branding-letterhead2").fill("Douala, Cameroun");
  await alice.getByTestId("branding-footer").fill("Inscrit au tableau de l'ONECCA");
  await alice.getByTestId("branding-save").click();
  await alice.waitForURL("**/settings?saved=1", { timeout: 30_000 });
  await expect(alice.getByTestId("branding-saved")).toBeVisible();

  // Nav identity + theme applied: the primary button now renders the accent.
  await expect(alice.getByTestId("brand-name")).toContainText("Cabinet FOKO & Associés");
  const buttonColor = await alice
    .getByTestId("branding-save")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(buttonColor).toBe(ACCENT_RGB);

  // The theme follows to every page (dashboard uses the same variables).
  await alice.goto("/dashboard");
  await expect(alice.getByTestId("brand-name")).toContainText("Cabinet FOKO & Associés");

  // A malformed/too-light accent is refused with a readable error.
  await alice.goto("/settings");
  await alice.getByTestId("branding-accent").fill("#fefefe");
  await alice.getByTestId("branding-save").click();
  await alice.waitForURL("**/settings?error=invalid-color", { timeout: 30_000 });
  await expect(alice.getByTestId("planning-error")).toContainText(/hex colour/i);

  // Firm B is untouched: default name, default green primary.
  const bob = await signIn(browser, "bob@firm-b.test");
  await expect(bob.getByTestId("brand-name")).toContainText("Cabinet Beta");
  await bob.goto("/settings");
  const firmBColor = await bob
    .getByTestId("branding-save")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(firmBColor).not.toBe(ACCENT_RGB);
  await bob.context().close();

  // Cleanup: restore Firm A defaults so the demo tenant stays green.
  await alice.goto("/settings");
  await alice.getByTestId("branding-name").fill("Cabinet Alpha");
  await alice.getByTestId("branding-reset-accent").check();
  await alice.getByTestId("branding-letterhead1").fill("");
  await alice.getByTestId("branding-letterhead2").fill("");
  await alice.getByTestId("branding-footer").fill("");
  await alice.getByTestId("branding-save").click();
  await alice.waitForURL("**/settings?saved=1", { timeout: 30_000 });
  await expect(alice.getByTestId("branding-saved")).toBeVisible();
  const restored = await alice
    .getByTestId("branding-save")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(restored).not.toBe(ACCENT_RGB);
  await alice.context().close();
});
