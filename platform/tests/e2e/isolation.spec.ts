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
  await page.click("button[type=submit]");
  await page.waitForURL("**/dashboard");
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
