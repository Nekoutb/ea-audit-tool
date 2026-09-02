import { expect, test, type Page } from "@playwright/test";

// Phase 2 acceptance (master spec §17): complete a full planning phase on the
// demo client; a significant risk on revenue appears in the E4.1 header;
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
  await page.getByTestId("create-engagement").click();
  // The nature-of-entity screen concludes the scope; the team screen follows.
  await page.waitForURL("**/nature");
  await page.getByTestId("cq-listed").check();
  await page.getByTestId("classify-entity").click();
  await page.waitForURL("**/team");
  const engagementUrl = page.url().replace(/\/team$/, "");
  await page.goto(engagementUrl);

  // --- Acceptance: P1.1 structured form ---
  await page.goto(`${engagementUrl}/acceptance`);
  await page.waitForURL("**/acceptance");
  await page.getByTestId("open-d31-form").click();
  await page.waitForURL("**/forms/P1.1");
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
  // An exception answer requires the circumstances and safeguards (IESBA
  // §120); the textarea appears the moment "yes" is chosen and is required.
  await page
    .getByTestId("q-financial_interest-note")
    .fill("Holds a small shareholding in the client; divested before fieldwork.");
  await page.getByTestId("signature-input").fill("Alice Alpha");
  await page.getByTestId("submit-confirmation").click();
  await expect(page.getByTestId("confirmation-done")).toBeVisible();

  await page.goto(engagementUrl);
  await page.goto(`${engagementUrl}/acceptance`);
  await page.getByTestId("disposition-input").fill("Interest divested; safeguards applied.");
  await page.getByTestId("dispose-exception").click();

  // Blocked until P1.1 carries a partner sign-off.
  await page.getByTestId("advance-to-planning").click();
  await expect(page.getByTestId("planning-error")).toBeVisible();

  // Partner sign-off on the P1.1 working paper, then advance.
  await partnerSignCode(page, engagementUrl, "P1.1");
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

  // Mark E4.2 material with no coverage → stand-back must block.
  await page.getByTestId("toggle-material-E4.2").click();

  // Close attempt: blocked, failed gates listed (unlinked significant risk,
  // uncovered material section, unsigned gate documents).
  await page.getByTestId("close-planning").click();
  await expect(page.getByTestId("planning-error")).toBeVisible();
  await expect(page.getByTestId("planning-error")).toContainText(/significant risk/i);
  await expect(page.getByTestId("planning-error")).toContainText(/material section/i);

  // --- The seeded significant revenue risk is on the register (ISA 240 presumed) ---
  // E4 accounts are index-per-account working papers now, with no risk header
  // and no program generator; the register is where a risk shows its rating.
  await page.goto(`${engagementUrl}/risks`);
  await expect(page.getByTestId("risk-revenue_fraud")).toContainText(/revenue recognition/i);
  await expect(page.getByTestId("risk-revenue_fraud")).toContainText(/Significant/i);

  // --- E3.1: the generated program links the management-override risk ---
  await page.goto(engagementUrl);
  await page.getByTestId("open-section-E3.1").click();
  await page.waitForURL("**/sections/**");
  await page.getByTestId("generate-program").click();
  await expect(page.getByTestId("program-table")).toBeVisible();

  // --- E4.2 (material): substantive coverage is a procedure on the account paper ---
  // A procedure row is a program step (source 'psp'), which is what the
  // stand-back gate counts as coverage.
  await page.goto(engagementUrl);
  await page.getByTestId("open-section-E4.2").click();
  await page.waitForURL("**/sections/**");
  await page.getByTestId("psp-add-row").click();
  await page.getByTestId("psp-other-text").fill("Substantive coverage for purchases & payables.");
  await page.getByTestId("psp-other-add").click();
  await expect(page.getByTestId("psp-row-OSP-1")).toBeVisible();

  // --- E4.20 (Revenue): a substantive procedure answers the presumed revenue
  // risk — the procedure links as the risk's response, which the
  // significant-risks gate requires (the E4 program generator used to do this).
  await page.goto(engagementUrl);
  await page.getByTestId("open-section-E4.20").click();
  await page.waitForURL("**/sections/**");
  await page.getByTestId("psp-add-row").click();
  await page.getByTestId("psp-other-text").fill("Substantive testing of revenue recognition and cut-off.");
  await page.getByTestId("psp-other-add").click();
  await expect(page.getByTestId("psp-row-OSP-1")).toBeVisible();

  // --- Partner sign-offs on the gate documents ---
  for (const code of ["P2.2", "P5.2", "S3.1"]) {
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
