import { expect, test, type Page } from "@playwright/test";

// Phase 6 acceptance (spec §17): full AR + bank confirmation cycle on demo
// data including one non-reply flowing to alternative procedures.

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

test("Phase 6: AR + bank confirmation cycle with exception → B5 and a non-reply → alternative", async ({ page }) => {
  test.setTimeout(300_000);
  await login(page);

  const clientName = `Conf SA ${Date.now()}`;
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

  // Materiality so client-error differences can land in B5 cleanly.
  await page.goto(`${engagementUrl}/planning`);
  await page.getByTestId("materiality-benchmark").selectOption("revenue");
  await page.getByTestId("materiality-amount").fill("200000000");
  await page.getByTestId("materiality-pct").fill("1");
  await page.getByTestId("materiality-justification").fill("Revenue.");
  await page.getByTestId("create-materiality").click();
  await page.getByTestId("approve-materiality").click();

  // AR open items dataset.
  await page.goto(`${engagementUrl}/analyzers/ar_open_items`);
  await page.getByTestId("dataset-file").setInputFiles({
    name: "ar.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Code;Customer;Reference facture;Date facture;Amount\nC1;ACME;INV-1;15/11/2025;5000000\nC2;Beta;INV-2;15/10/2025;2500000\nC3;Gamma;INV-3;15/09/2025;400000",
      "utf8",
    ),
  });
  await page.getByTestId("dataset-analyze").click();
  await page.getByTestId("dataset-confirm").waitFor();
  await page.getByTestId("dataset-upload").click();
  await expect(page.getByTestId("analyzer-datasets")).toContainText("ar.csv");

  // Confirmations tab: select AR positives above 1M (ACME + Beta).
  await page.goto(`${engagementUrl}/confirmations`);
  await page.waitForURL("**/confirmations");
  await page.getByTestId("conf-type").selectOption("ar_positive");
  await page.getByTestId("conf-threshold").fill("1000000");
  await page.getByTestId("conf-select").click();
  await expect(page.getByTestId("confirmations-table")).toContainText("ACME");
  await expect(page.getByTestId("confirmations-table")).toContainText("Beta");

  // Bank confirmation added manually (all banking relationships).
  await page.getByTestId("manual-type").selectOption("bank");
  await page.getByTestId("manual-party").fill("Banque Atlantique");
  await page.getByTestId("manual-add").click();

  // ACME: letter → approve → send → reply with a DIFFERENT amount → exception
  // → disposition client error → B5.
  await page.getByTestId("letter-ACME").click();
  await page.waitForURL("**/documents/**");
  await expect(page.getByTestId("download-current")).toBeVisible();
  await page.goBack();
  await page.getByTestId("approve-ACME").click();
  await page.getByTestId("send-ACME").click();
  await page.getByTestId("reply-amount-ACME").fill("4200000");
  await page.getByTestId("reply-ACME").click();
  await expect(page.getByTestId("conf-status-ACME")).toContainText(/Exception/i);
  await page.getByTestId("dispose-select-ACME").selectOption("client_error");
  await page.getByTestId("dispose-ACME").click();

  // Beta: reconciles exactly.
  await page.getByTestId("approve-Beta").click();
  await page.getByTestId("send-Beta").click();
  await page.getByTestId("reply-amount-Beta").fill("2500000");
  await page.getByTestId("reply-Beta").click();
  await expect(page.getByTestId("conf-status-Beta")).toContainText(/Reconciled/i);

  // Bank: sent but NO reply → alternative procedures (acceptance criterion).
  await page.getByTestId("approve-Banque Atlantique").click();
  await page.getByTestId("send-Banque Atlantique").click();
  await page.getByTestId("alt-input-Banque Atlantique").fill("Agreed to bank statement + subsequent transactions");
  await page.getByTestId("alt-Banque Atlantique").click();
  await expect(page.getByTestId("conf-status-Banque Atlantique")).toContainText(/Alternative/i);

  // Summary working paper produced.
  await page.getByTestId("generate-summary").click();
  await page.waitForURL("**/documents/**");
  await expect(page.locator("h1")).toContainText(/Confirmations summary/i);

  // The ACME client-error difference reached B5.
  await page.goto(`${engagementUrl}/findings`);
  await expect(page.getByTestId("b5-table")).toContainText("ACME");
});
