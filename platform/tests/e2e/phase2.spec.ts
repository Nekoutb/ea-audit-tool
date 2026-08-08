import { expect, test, type Page } from "@playwright/test";

// Phase 2 acceptance (master spec §17): complete a full planning phase on the
// demo client; a significant risk on revenue appears in the E100 header;
// planning cannot close with an unlinked significant risk or an uncovered
// material FSLI.

const EMAIL = "alice@firm-a.test";
const PASSWORD = "password";

async function login(page: Page): Promise<void> {
  await page.context().addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);
  await page.goto("/login");
  await page.fill("input[name=email]", EMAIL);
  await page.fill("input[name=password]", PASSWORD);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/dashboard");
}

async function partnerSignCode(page: Page, engagementUrl: string, code: string): Promise<void> {
  await page.goto(engagementUrl);
  await page.getByTestId(`generate-doc-${code}`).click();
  await page.waitForURL("**/documents/**");
  await page.getByTestId("sign-preparer").click();
  await expect(page.getByTestId("signed-preparer")).toBeVisible();
  await page.getByTestId("sign-partner").click();
  await expect(page.getByTestId("signed-partner")).toBeVisible();
}

test("full Phase 2 acceptance → planning → gates → close", async ({ page }) => {
  test.setTimeout(300_000);
  await login(page);

  // Client + engagement.
  const clientName = `Planning SA ${Date.now()}`;
  await page.goto("/clients");
  await page.getByTestId("client-name").fill(clientName);
  await page.getByTestId("create-client").click();
  await page.waitForURL("**/clients/**");
  await page.getByTestId("new-engagement").click();
  await page.waitForURL("**/new-engagement**");
  await page.getByTestId("engagement-year").fill("2025");
  await page.getByTestId("engagement-period-end").fill("2025-12-31");
  await page.getByTestId("cq-listed").check();
  await page.getByTestId("create-engagement").click();
  await page.waitForURL("**/engagements/**");
  const engagementUrl = page.url().replace(/\/dashboard$/, "");
  await page.goto(engagementUrl);

  // --- Acceptance: D3.1 structured form ---
  await page.goto(`${engagementUrl}/acceptance`);
  await page.waitForURL("**/acceptance");
  await page.getByTestId("open-d31-form").click();
  await page.waitForURL("**/forms/D3.1");
  await page.getByTestId("field-engagement_type").selectOption("new");
  for (const key of ["integrity_ok", "competence_ok", "conflicts_ok", "aml_ok", "independence_ok"]) {
    await page.getByTestId(`field-${key}`).selectOption("yes");
  }
  await page.getByTestId("field-risk_rating").selectOption("moderate");
  await page.getByTestId("field-conclusion").selectOption("accept");
  await page.getByTestId("save-form").click();

  // --- Independence: launch → my link → an exception → partner disposition ---
  await page.goto(engagementUrl);
  await page.goto(`${engagementUrl}/acceptance`);
  await page.getByTestId("campaign-recipients").selectOption({ label: "Alice Alpha" });
  await page.getByTestId("launch-campaign").click();
  await page.getByTestId("my-confirmation-link").click();
  await page.waitForURL("**/independence/**");
  await page.getByTestId("q-financial_interest-yes").check(); // exception path
  await page.getByTestId("signature-input").fill("Alice Alpha");
  await page.getByTestId("submit-confirmation").click();
  await expect(page.getByTestId("confirmation-done")).toBeVisible();

  await page.goto(engagementUrl);
  await page.goto(`${engagementUrl}/acceptance`);
  await page.getByTestId("disposition-input").fill("Interest divested; safeguards applied.");
  await page.getByTestId("dispose-exception").click();

  // Blocked until D3.1 carries a partner sign-off.
  await page.getByTestId("advance-to-planning").click();
  await expect(page.getByTestId("planning-error")).toBeVisible();

  // Partner sign-off on the D3.1 working paper, then advance.
  await partnerSignCode(page, engagementUrl, "D3.1");
  await page.goto(engagementUrl);
  await page.goto(`${engagementUrl}/acceptance`);
  await page.getByTestId("advance-to-planning").click();
  await page.waitForURL("**/acceptance");
  await expect(page.getByTestId("planning-error")).toHaveCount(0);

  // --- Planning: materiality version + partner approval ---
  await page.goto(`${engagementUrl}/planning`);
  await page.waitForURL("**/planning");
  await page.getByTestId("materiality-benchmark").selectOption("revenue");
  await page.getByTestId("materiality-amount").fill("2000000000");
  await page.getByTestId("materiality-pct").fill("1");
  await page.getByTestId("materiality-justification").fill("Revenue is the stable key benchmark.");
  await page.getByTestId("create-materiality").click();
  await page.getByTestId("approve-materiality").click();
  await expect(page.getByTestId("materiality-status-1")).toContainText(/Approved/i);

  // Mark E110 material with no coverage → stand-back must block.
  await page.getByTestId("toggle-material-E110").click();

  // Close attempt: blocked, failed gates listed (unlinked significant risk,
  // uncovered material section, unsigned gate documents).
  await page.getByTestId("close-planning").click();
  await expect(page.getByTestId("planning-error")).toBeVisible();
  await expect(page.getByTestId("planning-error")).toContainText(/significant risk/i);
  await expect(page.getByTestId("planning-error")).toContainText(/material section/i);

  // --- E100: the seeded significant revenue risk appears in the section header ---
  await page.goto(engagementUrl);
  await page.getByTestId("open-section-E100").click();
  await page.waitForURL("**/sections/**");
  await expect(page.getByTestId("section-risks")).toContainText(/revenue recognition/i);
  await expect(page.getByTestId("section-risks")).toContainText(/Significant/i);

  // Generate the tailored program: library steps + risk extensions auto-linked.
  await page.getByTestId("generate-program").click();
  await expect(page.getByTestId("program-table")).toContainText(/EXTENDED/i);

  // --- E350: program links the management-override risk ---
  await page.goto(engagementUrl);
  await page.getByTestId("open-section-E350").click();
  await page.waitForURL("**/sections/**");
  await page.getByTestId("generate-program").click();
  await expect(page.getByTestId("program-table")).toBeVisible();

  // --- E110 (material): add substantive coverage ---
  await page.goto(engagementUrl);
  await page.getByTestId("open-section-E110").click();
  await page.waitForURL("**/sections/**");
  await page.getByTestId("custom-step-description").fill("Substantive coverage for purchases & payables.");
  await page.getByTestId("add-custom-step").click();

  // --- Partner sign-offs on the gate documents ---
  for (const code of ["D6.1", "D7.1", "D7.2"]) {
    await partnerSignCode(page, engagementUrl, code);
  }

  // --- Close planning: gates all green → execution ---
  await page.goto(engagementUrl);
  await page.goto(`${engagementUrl}/planning`);
  await page.getByTestId("close-planning").click();
  await page.waitForURL("**/planning");
  await expect(page.getByTestId("planning-error")).toHaveCount(0);
  await expect(page.getByTestId("close-planning")).toHaveCount(0);

  await page.goto(engagementUrl);
  await expect(page.locator("main")).toContainText(/Execution/i);
});
