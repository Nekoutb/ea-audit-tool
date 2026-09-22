import { expect, test, type Page } from "@playwright/test";

// Notifications live in the bell's panel and nowhere else: hovering the bell
// drops a scrolling list, opening one marks it read, and a notification is
// seen only by the user it was created for.

const FIRM_A_EMAIL = "alice@firm-a.test";
const FIRM_B_EMAIL = "bob@firm-b.test";
const PASSWORD = "password";

async function login(page: Page, email: string): Promise<void> {
  await page.context().addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);
  await page.goto("/login");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", PASSWORD);
  await page.click("button[type=submit]");
  await page.waitForURL(/\/dashboard/);
}

async function openBell(page: Page): Promise<void> {
  await page.getByTestId("nav-notifications").hover();
  await expect(page.getByTestId("notif-panel")).toBeVisible();
}

test("a notification reaches only the user it was created for, in the bell panel", async ({ browser }) => {
  const aliceContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  await login(alice, FIRM_A_EMAIL);
  await alice.getByTestId("send-test-notification").click();
  await expect(alice.getByTestId("unread-badge")).toHaveText("1");

  await openBell(alice);
  await expect(alice.getByTestId("notifications-list")).toContainText("Test notification");

  // Bob (a different firm and user) sees nothing.
  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  await login(bob, FIRM_B_EMAIL);
  await openBell(bob);
  await expect(bob.getByTestId("notifications-empty")).toBeVisible();

  await aliceContext.close();
  await bobContext.close();
});

test("the bell never navigates to a page of its own", async ({ page }) => {
  await login(page, FIRM_A_EMAIL);
  await page.getByTestId("nav-notifications").click();
  await expect(page).toHaveURL(/\/dashboard/);
  const gone = await page.goto("/notifications");
  expect(gone?.status()).toBe(404);
});

test("opening a notification marks it read and clears the badge", async ({ page }) => {
  await login(page, FIRM_A_EMAIL);
  await page.getByTestId("send-test-notification").click();
  await expect(page.getByTestId("unread-badge")).toBeVisible();

  // Open every unread notification (other tests may have left some behind).
  for (let guard = 0; guard < 60; guard += 1) {
    if ((await page.getByTestId("unread-badge").count()) === 0) break;
    await openBell(page);
    await page.locator('[data-testid^="notif-row-"]').filter({ hasText: "unread" }).first().click();
    await page.waitForLoadState("networkidle");
  }
  await page.goto("/dashboard");
  await expect(page.getByTestId("unread-badge")).toHaveCount(0);
});
