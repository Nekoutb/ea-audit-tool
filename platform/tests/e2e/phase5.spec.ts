import { expect, test, type Page } from "@playwright/test";

// Phase 5 acceptance (spec §17): each engine runs on demo datasets producing
// indexed working papers; a projected misstatement lands in B5 automatically.

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

test("Phase 5: engines run on demo data; projected misstatement lands in B5", async ({ page }) => {
  test.setTimeout(300_000);
  await login(page);

  const clientName = `Engines SA ${Date.now()}`;
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
  const engagementId = engagementUrl.split("/engagements/")[1].split(/[/?#]/)[0];

  // TB via the real import engine.
  const tb = await page.request.post(`/api/engagements/${engagementId}/tb`, {
    multipart: {
      file: {
        name: "tb.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          "Compte;Libellé;Mouvement débit;Mouvement crédit\n411000;Clients;10000000;0\n701000;Ventes;0;10000000",
          "utf8",
        ),
      },
    },
  });
  expect((await tb.json()).status).toBe("valid");

  // Materiality (overall 2M / trivial 100k).
  await page.goto(`${engagementUrl}/planning`);
  await page.getByTestId("materiality-benchmark").selectOption("revenue");
  await page.getByTestId("materiality-amount").fill("200000000");
  await page.getByTestId("materiality-pct").fill("1");
  await page.getByTestId("materiality-justification").fill("Revenue.");
  await page.getByTestId("create-materiality").click();
  await page.getByTestId("approve-materiality").click();

  // AR open items dataset via the Data tab (12.6M vs TB 10M).
  await page.goto(`${engagementUrl}/data`);
  await page.getByTestId("dataset-kind").selectOption("ar_open_items");
  await page.getByTestId("dataset-file").setInputFiles({
    name: "ar.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Customer;Amount\nACME;5000000\nBeta;2500000\nGamma;1800000\nDelta;1200000\nEpsilon;900000\nZeta;700000\nEta;300000\nTheta;200000",
      "utf8",
    ),
  });
  await page.getByTestId("dataset-upload").click();
  await expect(page.getByTestId("datasets-table")).toContainText("ar.csv");

  // E100 workspace: run sampling (MUS, seeded) → run recorded + output document.
  await page.goto(engagementUrl);
  await page.getByTestId("open-section-E100").click();
  await page.waitForURL("**/sections/**");
  const sectionUrl = page.url();
  await page.getByTestId("sampling-method").selectOption("mus");
  await page.getByTestId("sampling-size").fill("3");
  await page.getByTestId("sampling-seed").fill("isa-530-demo");
  await page.getByTestId("run-sampling").click();
  await expect(page.getByTestId("engine-runs")).toContainText("sampling");

  // Evaluate the sample → projected misstatement auto-raised to B5 (5.3).
  await page.locator("[data-testid^=evaluate-input-]").first().fill("800000");
  await page.locator("[data-testid^=evaluate-run-]").first().click();
  await expect(page.getByTestId("engine-runs")).toContainText("projected");

  // Reconciliation (5.4): 2.6M difference → B4 finding.
  await page.goto(sectionUrl);
  await page.getByTestId("run-recon").click();
  await expect(page.getByTestId("engine-runs")).toContainText("recon_subledger");

  // Substantive analytics (5.9): unexplained variance → B5.
  await page.goto(sectionUrl);
  await page.getByTestId("analytic-expectation").fill("5000000");
  await page.getByTestId("analytic-tolerance").fill("1000000");
  await page.getByTestId("analytic-basis").fill("Margin trend expectation");
  await page.getByTestId("run-analytic").click();
  await expect(page.getByTestId("engine-runs")).toContainText("substantive_analytics");

  // Findings: the projected misstatement is in B5 and the recon diff in B4.
  await page.getByTestId("tab-findings").click();
  await page.waitForURL("**/findings");
  await expect(page.getByTestId("b5-table")).toContainText("Projected misstatement");
  await expect(page.getByTestId("b4-list")).toContainText("Unreconciled difference");
});
