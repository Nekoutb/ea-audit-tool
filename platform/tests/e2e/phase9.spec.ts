import { expect, test, type Page } from "@playwright/test";

// Phase 9 acceptance (spec §17): PBC request → portal upload by an external
// client user (who can never see the audit file) → firm accepts + attaches;
// engagement + firm dashboards; regulator export.

const EMAIL = "alice@firm-a.test";
const PASSWORD = "password";

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.context().addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);
  await page.goto("/login");
  await page.fill("input[name=email]", email);
  await page.fill("input[name=password]", password);
  await page.getByTestId("login-submit").click();
}

test("Phase 9: portal PBC round-trip + dashboards + export", async ({ page }) => {
  test.setTimeout(300_000);
  await login(page, EMAIL, PASSWORD);
  // Sign-in lands on the welcome screen: a greeting and only the engagements
  // the user is assigned to — the firm-wide panels were removed by design.
  await page.waitForURL("**/dashboard");
  await expect(page.getByTestId("welcome")).toBeVisible();
  await expect(page.getByTestId("my-engagements")).toBeVisible();

  const stamp = Date.now();
  const clientName = `Portal SA ${stamp}`;
  const contactEmail = `contact-${stamp}@portal.test`;
  await page.goto("/clients");
  await page.getByTestId("client-name").fill(clientName);
  await page.getByTestId("create-client").click();
  await page.waitForURL("**/clients/**");
  const clientUrl = page.url();
  await page.getByTestId("new-engagement").click();
  await page.waitForURL("**/new-engagement**");
  await page.getByTestId("engagement-year").fill("2025");
  await page.getByTestId("engagement-period-end").fill("2025-12-31");
  await page.getByTestId("cq-listed").check();
  await page.getByTestId("create-engagement").click();
  await page.waitForURL("**/engagements/**");
  const engagementUrl = page.url().replace(/\/dashboard$/, "");
  await page.goto(engagementUrl);

  // Engagement dashboard strip (9.3) + export link (9.6).
  await expect(page.getByTestId("engagement-dashboard")).toBeVisible();
  const exportHref = await page.getByTestId("export-file-index").getAttribute("href");
  const exported = await page.request.get(exportHref!);
  expect(exported.status()).toBe(200);
  expect((await exported.body()).subarray(0, 2).toString("latin1")).toBe("PK");

  // Portal contact for the client (9.1).
  await page.goto(clientUrl);
  await page.getByTestId("contact-name").fill("Mme Contact");
  await page.getByTestId("contact-email").fill(contactEmail);
  await page.getByTestId("contact-password").fill("portal-pass-9");
  await page.getByTestId("add-contact").click();
  await expect(page.getByTestId("portal-contacts")).toContainText(contactEmail);

  // PBC request (9.1).
  await page.goto(`${engagementUrl}/pbc`);
  await page.getByTestId("pbc-title").fill("Grand livre 2025");
  await page.getByTestId("pbc-note").fill("Format CSV ou Excel.");
  await page.getByTestId("pbc-add").click();
  await expect(page.getByTestId("pbc-status-Grand livre 2025")).toContainText(/Requested/i);

  // --- Switch to the client user: portal only, audit file locked out ---
  await page.context().clearCookies();
  await login(page, contactEmail, "portal-pass-9");
  await page.waitForURL("**/portal");
  await expect(page.getByTestId("portal-items")).toContainText("Grand livre 2025");

  // The proxy walls off firm routes for portal users.
  await page.goto(engagementUrl);
  await page.waitForURL("**/portal");
  await page.goto("/dashboard");
  await page.waitForURL("**/portal");

  // Upload the requested document (9.1).
  await page.getByTestId("portal-file-Grand livre 2025").setInputFiles({
    name: "grand-livre.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("Compte;Montant\n411000;1000000", "utf8"),
  });
  await page.getByTestId("portal-upload-Grand livre 2025").click();
  await expect(page.getByTestId("portal-status-Grand livre 2025")).toContainText(/Uploaded/i);

  // --- Back to the firm: accept + attach to E100 as a working paper (9.2) ---
  await page.context().clearCookies();
  await login(page, EMAIL, PASSWORD);
  await page.waitForURL("**/dashboard");
  await page.goto(`${engagementUrl}/pbc`);
  await expect(page.getByTestId("pbc-status-Grand livre 2025")).toContainText(/Uploaded/i);
  await expect(page.getByTestId("pbc-table")).toContainText("grand-livre.csv");
  await page.getByTestId("pbc-attach-Grand livre 2025").selectOption({ index: 1 }); // E100
  await page.getByTestId("pbc-accept-Grand livre 2025").click();
  await page.waitForURL("**/documents/**");
  await expect(page.locator("h1")).toContainText(/PBC — Grand livre 2025/);

  // PBC now accepted; the engagement dashboard reflects it.
  await page.goto(`${engagementUrl}/pbc`);
  await expect(page.getByTestId("pbc-status-Grand livre 2025")).toContainText(/Accepted/i);
  await page.goto(engagementUrl);
  await expect(page.getByTestId("engagement-dashboard")).toBeVisible();
});
