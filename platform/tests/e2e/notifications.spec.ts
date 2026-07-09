import { expect, test, type Page } from "@playwright/test";

const FIRM_A_EMAIL = "alice@firm-a.test";
const FIRM_B_EMAIL = "bob@firm-b.test";
const PASSWORD = "password";

async function login(page: Page, email: string): Promise<void> {
  await page.goto("/login");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", PASSWORD);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/dashboard");
}

test("a notification reaches only the user it was created for", async ({ browser }) => {
  // Alice sends herself a test notification.
  const aliceContext = await browser.newContext();
  const alice = await aliceContext.newPage();
  await login(alice, FIRM_A_EMAIL);
  await alice.getByTestId("send-test-notification").click();
  await expect(alice.getByTestId("unread-badge")).toHaveText("1");

  await alice.goto("/notifications");
  await expect(alice.getByTestId("notifications-list")).toContainText("Test notification");

  // Bob (a different firm and user) must see an empty inbox.
  const bobContext = await browser.newContext();
  const bob = await bobContext.newPage();
  await login(bob, FIRM_B_EMAIL);
  await bob.goto("/notifications");
  await expect(bob.getByTestId("notifications-empty")).toBeVisible();

  await aliceContext.close();
  await bobContext.close();
});

test("marking notifications read clears the unread badge", async ({ page }) => {
  await login(page, FIRM_A_EMAIL);
  await page.getByTestId("send-test-notification").click();
  await page.goto("/notifications");

  // Clear every unread notification (other tests may have left some behind).
  let remaining = await page.getByTestId("mark-read").count();
  while (remaining > 0) {
    await page.getByTestId("mark-read").first().click();
    await expect(page.getByTestId("mark-read")).toHaveCount(remaining - 1);
    remaining -= 1;
  }

  await page.goto("/dashboard");
  await expect(page.getByTestId("unread-badge")).toHaveCount(0);
});
