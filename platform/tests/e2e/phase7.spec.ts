import { expect, test, type Page } from "@playwright/test";

// Phase 7 acceptance (spec §17): completion gates block issuance → satisfy
// every gate through the UI → issue the OHADA statutory report → archive
// (immutable) → rollforward to N+1 carrying the B10 points.

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

const HEADERS = "Compte;Libellé;Mouvement débit;Mouvement crédit";
const tbCsv = (rows: string[]): string => [HEADERS, ...rows].join("\n");

test("Phase 7: gates block → complete file → issue report → archive → rollforward", async ({ page }) => {
  test.setTimeout(300_000);
  await login(page);

  const clientName = `Concl SA ${Date.now()}`;
  await page.goto("/clients");
  await page.getByTestId("client-name").fill(clientName);
  await page.getByTestId("create-client").click();
  await page.waitForURL("**/clients/**");
  await page.getByTestId("engagement-year").fill("2025");
  await page.getByTestId("engagement-period-end").fill("2025-12-31");
  await page.getByTestId("create-engagement").click();
  await page.waitForURL("**/engagements/**");
  const engagementUrl = page.url();
  const engagementId = engagementUrl.split("/engagements/")[1].split(/[/?#]/)[0];

  // Balanced TB (débits = crédits = 150M) so the FS tie-out passes.
  await page.goto(`${engagementUrl}/data`);
  await page.getByTestId("tb-file").setInputFiles({
    name: "tb-2025.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      tbCsv([
        "411000;Clients;80000000;0",
        "701000;Ventes;0;150000000",
        "601000;Achats;30000000;0",
        "661000;Salaires;40000000;0",
      ]),
      "utf8",
    ),
  });
  await page.getByTestId("tb-upload").click();
  await expect(page.getByTestId("tb-import-status")).toContainText("valid");

  // --- Acceptance: D3.1 form + independence campaign (clean) + advance ---
  await page.goto(`${engagementUrl}/forms/D3.1`);
  await page.getByTestId("field-engagement_type").selectOption("new");
  for (const key of ["integrity_ok", "competence_ok", "conflicts_ok", "aml_ok", "independence_ok"]) {
    await page.getByTestId(`field-${key}`).selectOption("yes");
  }
  await page.getByTestId("field-risk_rating").selectOption("moderate");
  await page.getByTestId("field-conclusion").selectOption("accept");
  await page.getByTestId("save-form").click();

  await page.goto(`${engagementUrl}/acceptance`);
  await page.getByTestId("campaign-recipients").selectOption({ label: "Alice Alpha" });
  await page.getByTestId("launch-campaign").click();
  await page.getByTestId("my-confirmation-link").click();
  await page.waitForURL("**/independence/**");
  await page.getByTestId("signature-input").fill("Alice Alpha"); // all answers default to "no"
  await page.getByTestId("submit-confirmation").click();
  await expect(page.getByTestId("confirmation-done")).toBeVisible();

  await partnerSignCode(page, engagementUrl, "D3.1");
  await page.goto(`${engagementUrl}/acceptance`);
  await page.getByTestId("advance-to-planning").click();
  await page.waitForURL("**/acceptance");
  await expect(page.getByTestId("planning-error")).toHaveCount(0);

  // --- Planning: approved materiality + programs linking the presumed risks ---
  await page.goto(`${engagementUrl}/planning`);
  await page.getByTestId("materiality-benchmark").selectOption("revenue");
  await page.getByTestId("materiality-amount").fill("150000000");
  await page.getByTestId("materiality-pct").fill("1");
  await page.getByTestId("materiality-justification").fill("Revenue benchmark.");
  await page.getByTestId("create-materiality").click();
  await page.getByTestId("approve-materiality").click();

  for (const section of ["E100", "E350"]) {
    await page.goto(engagementUrl);
    await page.getByTestId(`open-section-${section}`).click();
    await page.waitForURL("**/sections/**");
    await page.getByTestId("generate-program").click();
    await expect(page.getByTestId("program-table")).toBeVisible();
  }
  for (const code of ["D6.1", "D7.1", "D7.2"]) {
    await partnerSignCode(page, engagementUrl, code);
  }
  await page.goto(`${engagementUrl}/planning`);
  await page.getByTestId("close-planning").click();
  await page.waitForURL("**/planning");
  await expect(page.getByTestId("planning-error")).toHaveCount(0);

  // --- Fieldwork: complete every program step, conclude + review each section ---
  for (const section of ["E100", "E350"]) {
    await page.goto(engagementUrl);
    await page.getByTestId(`open-section-${section}`).click();
    await page.waitForURL("**/sections/**");
    const seqs = await page
      .locator("[data-testid^=step-conclusion-]")
      .evaluateAll((els) => els.map((el) => el.getAttribute("data-testid")!.replace("step-conclusion-", "")));
    for (const seq of seqs) {
      await page.getByTestId(`step-conclusion-${seq}`).fill("Performed; no exceptions noted.");
      await page.getByTestId(`complete-step-${seq}`).click();
      await expect(page.getByTestId(`step-status-${seq}`)).toContainText("✓", { timeout: 15_000 });
    }
    await page.getByTestId("section-conclusion").fill("Objectives achieved.");
    await page.getByTestId("save-conclusion").click();
    await page.getByTestId("review-conclusion").click();
    await expect(page.getByTestId("conclusion-state")).toContainText("Objectives achieved.");
  }

  // Conclusion tab: gates visible, several failing; issuance is BLOCKED.
  await page.getByTestId("tab-conclusion").click();
  await page.waitForURL("**/conclusion");
  await expect(page.getByTestId("gates-panel")).toBeVisible();
  await expect(page.getByTestId("gate-risks_concluded")).toContainText("✗");
  await expect(page.getByTestId("gate-partner_conclusion")).toContainText("✗");
  await page.getByTestId("report-date").fill("2026-03-31");
  await page.getByTestId("issue-report").click();
  await expect(page.getByTestId("planning-error")).toContainText(/gates are not satisfied/i);

  // Conclude the two presumed ISA 240 risks through the register.
  await page.goto(`${engagementUrl}/risks`);
  await page.getByTestId("risk-status-revenue_fraud").selectOption("concluded");
  await page.getByTestId("risk-update-revenue_fraud").click();
  await page.getByTestId("risk-status-mgmt_override").selectOption("concluded");
  await page.getByTestId("risk-update-mgmt_override").click();

  // Final analytical review + FS tie-out snapshots.
  await page.goto(`${engagementUrl}/conclusion`);
  await page.getByTestId("run-final-analytics").click();
  await expect(page.getByTestId("gate-final_analytical_review")).toContainText("✓");
  await page.getByTestId("run-tieout").click();
  await expect(page.getByTestId("gate-fs_tieout_passed")).toContainText("✓");

  // Disclosure checklist, subsequent events, B10 points, partner conclusion.
  await page.getByTestId("disclosure-complete").check();
  await page.getByTestId("save-disclosure").click();
  await page.getByTestId("subsequent-date").fill("2026-03-31");
  await page.getByTestId("save-subsequent").click();
  await page.getByTestId("points-forward").fill("Review the new IT system next year.");
  await page.getByTestId("save-points").click();
  await page.getByTestId("partner-conclusion-text").fill("Sufficient appropriate evidence obtained; opinion unmodified.");
  await page.getByTestId("independence-reconfirm").check();
  await page.getByTestId("save-partner-conclusion").click();

  // OHADA double representation letters (B8) + final management letter.
  await page.getByTestId("gen-affirmation").click();
  await page.waitForURL("**/documents/**");
  await expect(page.locator("h1")).toContainText(/Affirmation/i);
  await page.goto(`${engagementUrl}/conclusion`);
  await page.getByTestId("gen-complementary").click();
  await page.waitForURL("**/documents/**");
  await page.goto(`${engagementUrl}/conclusion`);
  await expect(page.getByTestId("gate-rep_letters_generated")).toContainText("✓");

  // Every gate green → issue the report (unmodified) → statutory report filed.
  await expect(page.getByTestId("gates-panel")).not.toContainText("✗");
  await page.getByTestId("report-date").fill("2026-03-31");
  await page.getByTestId("issue-report").click();
  await page.waitForURL("**/documents/**");
  await expect(page.locator("h1")).toContainText(/Rapport CAC/i);

  // Assembly clock: 60 days after the report date.
  await page.goto(`${engagementUrl}/conclusion`);
  await expect(page.getByTestId("report-issued")).toContainText("unmodified");
  await expect(page.getByTestId("assembly-deadline")).toContainText("2026-05-30");

  // Archive → immutable; the rollforward form appears.
  await page.getByTestId("archive-file").click();
  await expect(page.getByTestId("archived-banner")).toBeVisible();

  // Rollforward N+1 → a fresh 2026 engagement.
  await page.getByTestId("rollforward-year").fill("2026");
  await page.getByTestId("rollforward").click();
  await page.waitForURL(
    (url) => /\/engagements\/[0-9a-f-]+$/.test(url.pathname) && !url.pathname.includes(engagementId),
  );
  const newId = page.url().split("/engagements/")[1].split(/[/?#]/)[0];
  expect(newId).not.toBe(engagementId);
  await expect(page.locator("h1")).toContainText("2026");
});
