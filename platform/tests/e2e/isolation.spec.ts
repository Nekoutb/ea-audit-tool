import { expect, test, type Page } from "@playwright/test";

// Mirrors the fixed ids/creds in scripts/seed.mjs.
const FIRM_A = {
  email: "alice@firm-a.test",
  note: "Alpha confidential",
  id: "a0000000-0000-0000-0000-00000000000a",
};
const FIRM_B = {
  email: "bob@firm-b.test",
  note: "Beta confidential",
  id: "b0000000-0000-0000-0000-00000000000b",
};
const PASSWORD = "password";

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", PASSWORD);
  // Target the login button specifically — the language switcher also renders
  // submit buttons on this page.
  await page.getByTestId("login-submit").click();
  // Login lands on the most-recently-worked engagement's dashboard (or the firm
  // dashboard when the tenant has none) — both end in /dashboard.
  await page.waitForURL("**/dashboard");
  // These tests assert on the FIRM dashboard, so navigate there explicitly.
  await page.goto("/dashboard");
}

test("Firm A sees only its own data on the dashboard", async ({ page }) => {
  await login(page, FIRM_A.email);
  const notes = page.getByTestId("firm-notes");
  await expect(notes).toContainText(FIRM_A.note);
  await expect(notes).not.toContainText(FIRM_B.note);
});

test("Firm B sees only its own data on the dashboard", async ({ page }) => {
  await login(page, FIRM_B.email);
  const notes = page.getByTestId("firm-notes");
  await expect(notes).toContainText(FIRM_B.note);
  await expect(notes).not.toContainText(FIRM_A.note);
});

test("a crafted API request cannot cross tenants", async ({ page }) => {
  await login(page, FIRM_A.email);
  // Signed in as Firm A, try to read Firm B by passing its id explicitly.
  const body = await page.evaluate(async (otherTenantId) => {
    const response = await fetch(`/api/probe?tenantId=${otherTenantId}`);
    return response.json();
  }, FIRM_B.id);

  expect(body.notes).toContain(FIRM_A.note);
  expect(body.notes).not.toContain(FIRM_B.note);
});

test("the tenant API rejects unauthenticated requests", async ({ request }) => {
  const response = await request.get("/api/probe");
  expect(response.status()).toBe(401);
});

// /api/version is deliberately public: the deploy pipeline reads it from
// outside to prove the site serves the commit it just deployed. Under
// `next start` in CI there is a BUILD_ID but no RELEASE file (the deploy
// script writes that), so the sha is null here and set on a real instance.
test("the version endpoint answers without a session", async ({ request }) => {
  const response = await request.get("/api/version");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { sha: string | null; buildId: string | null };
  expect(body).toHaveProperty("sha");
  expect(body).toHaveProperty("commit");
  expect(typeof body.buildId === "string" || body.buildId === null).toBe(true);
});

// The readable twin of the endpoint, where a browser is sent from /api/version.
test("the version page answers without a session", async ({ page }) => {
  const response = await page.goto("/version");
  expect(response?.status()).toBe(200);
  await expect(page.getByTestId("version-sha")).toBeVisible();
  await expect(page.getByTestId("version-json")).toHaveAttribute("href", "/api/version");
});
