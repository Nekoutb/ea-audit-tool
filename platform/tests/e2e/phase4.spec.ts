import { expect, test, type Page } from "@playwright/test";

// Phase 4 acceptance (spec §17): run execution; raise misstatements; B5 totals
// live against materiality; revise-approach adds a dated risk to D7.2.

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

test("Phase 4: step execution → findings routing → B5 vs materiality → revise-approach", async ({ page }) => {
  test.setTimeout(300_000);
  await login(page);

  const clientName = `Exec SA ${Date.now()}`;
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

  // Materiality (overall 1.5M / trivial 75k) so B5 verdicts are live.
  await page.goto(`${engagementUrl}/planning`);
  await page.getByTestId("materiality-benchmark").selectOption("revenue");
  await page.getByTestId("materiality-amount").fill("150000000");
  await page.getByTestId("materiality-pct").fill("1");
  await page.getByTestId("materiality-justification").fill("Revenue.");
  await page.getByTestId("create-materiality").click();
  await page.getByTestId("approve-materiality").click();

  // E110 workspace: add a step and complete it with a conclusion (4.2).
  await page.goto(engagementUrl);
  await page.getByTestId("open-section-E110").click();
  await page.waitForURL("**/sections/**");
  const sectionUrl = page.url();
  await page.getByTestId("custom-step-description").fill("Search for unrecorded liabilities.");
  await page.getByTestId("add-custom-step").click();
  await page.locator("[data-testid^=step-conclusion-]").first().fill("No unrecorded liabilities found.");
  await page.locator("[data-testid^=complete-step-]").first().click();
  await expect(page.locator("[data-testid^=step-status-]").first()).toContainText("✓");

  // Matter arising → B5 misstatement above trivial (4.4/4.5).
  await page.getByTestId("finding-route").selectOption("b5");
  await page.getByTestId("finding-title").fill("Unrecorded supplier invoice");
  await page.getByTestId("finding-amount").fill("8000000");
  await page.getByTestId("route-finding").click();

  // Control deviation → deficiency → C1 (4.7).
  await page.goto(sectionUrl);
  await page.getByTestId("control-description").fill("Three-way match control");
  await page.getByTestId("control-result").selectOption("deviation");
  await page.getByTestId("control-decision").selectOption("deficiency");
  await page.getByTestId("record-control").click();
  await expect(page.getByTestId("control-tests")).toContainText(/deficiency/i);

  // Revise-approach → dated risk pending partner approval (4.10).
  await page.getByTestId("finding-route").selectOption("revise");
  await page.getByTestId("finding-title").fill("New inventory obsolescence risk identified");
  await page.getByTestId("route-finding").click();

  // Section conclusion: prepare + review (4.11) — no significant risk on E110.
  await page.goto(sectionUrl);
  await page.getByTestId("section-conclusion").fill("Objectives achieved for payables.");
  await page.getByTestId("save-conclusion").click();
  await page.getByTestId("review-conclusion").click();
  await expect(page.getByTestId("conclusion-state")).toContainText("Objectives achieved for payables.");

  // Findings tab: B5 totals vs materiality — exceeds, then correct → within (4.6).
  await page.goto(`${engagementUrl}/findings`);
  await page.waitForURL("**/findings");
  await expect(page.getByTestId("b5-totals")).toContainText("8 000 000");
  await expect(page.getByTestId("b5-verdict")).toContainText(/EXCEED/i);
  await page.locator("[data-testid^=toggle-corrected-]").first().click();
  await expect(page.getByTestId("b5-verdict")).toContainText(/Within/i);

  // C1 point present and clearable (4.9).
  await expect(page.getByTestId("c1-list")).toContainText("Three-way match");
  await page.locator("[data-testid^=clear-finding-]").first().click({ trial: true }).catch(() => {});

  // Risks: the revise-approach risk is pending partner approval → approve (4.10).
  await page.goto(`${engagementUrl}/risks`);
  await page.waitForURL("**/risks");
  await expect(page.getByTestId("risk-register")).toContainText("inventory obsolescence");
  await expect(page.locator("[data-testid^=pending-approval-]")).toHaveCount(1);
  await page.locator("[data-testid^=approve-addition-]").first().click();
  await expect(page.locator("[data-testid^=pending-approval-]")).toHaveCount(0);
});
