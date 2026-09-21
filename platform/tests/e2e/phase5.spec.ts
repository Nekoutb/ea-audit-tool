import { expect, test, type Page } from "@playwright/test";

// Phase 5 acceptance (spec §17): each engine runs on demo datasets producing
// indexed working papers; a projected misstatement lands in C1.1 automatically.
//
// The engine runners sat in the pane below the paper wizard, and that pane was
// removed on 2026-09-21. The import half of the phase is untouched and runs
// below; the runs themselves, and the findings they raise, are kept whole in
// the fixme test at the foot of this file.

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

/**
 * A new file with an imported trial balance and an approved materiality
 * (overall 2M / trivial 100k) — the ground both tests stand on. Returns the
 * engagement URL.
 */
async function enginesFile(page: Page, clientName: string): Promise<string> {
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

  return engagementUrl;
}

/** AR open items via the Data tab (12.6M against a TB of 10M). */
async function uploadArOpenItems(page: Page, engagementUrl: string): Promise<void> {
  await page.goto(`${engagementUrl}/analyzers/ar_open_items`);
  await page.getByTestId("dataset-file").setInputFiles({
    name: "ar.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      "Code;Customer;Reference facture;Date facture;Amount\nC1;ACME;INV-1;15/11/2025;5000000\nC2;Beta;INV-2;15/11/2025;2500000\nC3;Gamma;INV-3;15/10/2025;1800000\nC4;Delta;INV-4;15/10/2025;1200000\nC5;Epsilon;INV-5;15/09/2025;900000\nC6;Zeta;INV-6;15/09/2025;700000\nC7;Eta;INV-7;15/08/2025;300000\nC8;Theta;INV-8;15/07/2025;200000",
      "utf8",
    ),
  });
  await page.getByTestId("dataset-analyze").click();
  await page.getByTestId("dataset-confirm").waitFor();
  await page.getByTestId("dataset-upload").click();
}

test("Phase 5: the AR open-items dataset imports and ages against the trial balance", async ({ page }) => {
  test.setTimeout(300_000);
  await login(page);
  const engagementUrl = await enginesFile(page, `Engines SA ${Date.now()}`);

  await uploadArOpenItems(page, engagementUrl);
  // The AR analyzer no longer lists its datasets in a table (the aging header
  // names the file); the upload confirmation and the aging grid are the proof.
  await expect(page.getByTestId("dataset-done")).toContainText("ar.csv");
  await expect(page.getByTestId("aging")).toBeVisible();
});

test("Phase 5: engines run on demo data; projected misstatement lands in C1.1", async ({ page }) => {
  test.fixme(
    true,
    "The engine runners — sampling (run-sampling), subledger reconciliation (run-recon), substantive analytics (run-analytic) and the run list (engine-runs) — were removed from the working-paper section screen on 2026-09-21 at the user's request. Sampling lives on under Tools → Sampling and analytics under Tools → GL Correlation Console, but running them from a task, evaluating a sample so the projected misstatement is raised, and the reconciliation engine itself have no screen today.",
  );
  test.setTimeout(300_000);
  await login(page);
  const engagementUrl = await enginesFile(page, `Engines run SA ${Date.now()}`);

  // The engines sample and reconcile this dataset, so it is imported first.
  await uploadArOpenItems(page, engagementUrl);
  await expect(page.getByTestId("dataset-done")).toContainText("ar.csv");

  // E5.1 workspace: run sampling (MUS, seeded) → run recorded + output
  // document. The engines panel lived on the execution tasks that are not E4
  // accounts; the file item stored as E5.1 is Operating Expenditures, and it is
  // the one this run opened them on.
  await page.goto(engagementUrl);
  await page.getByTestId("open-section-E5.1").click();
  await page.waitForURL("**/sections/**");
  const sectionUrl = page.url();
  await page.getByTestId("sampling-method").selectOption("mus");
  await page.getByTestId("sampling-size").fill("3");
  await page.getByTestId("sampling-seed").fill("isa-530-demo");
  await page.getByTestId("run-sampling").click();
  await expect(page.getByTestId("engine-runs")).toContainText("sampling");

  // Evaluate the sample → projected misstatement auto-raised to C1.1 (5.3).
  await page.locator("[data-testid^=evaluate-input-]").first().fill("800000");
  await page.locator("[data-testid^=evaluate-run-]").first().click();
  await expect(page.getByTestId("engine-runs")).toContainText("projected");

  // Reconciliation (5.4): 2.6M difference → C1.2 finding.
  await page.goto(sectionUrl);
  await page.getByTestId("run-recon").click();
  await expect(page.getByTestId("engine-runs")).toContainText("recon_subledger");

  // Substantive analytics (5.9): unexplained variance → C1.1.
  await page.goto(sectionUrl);
  await page.getByTestId("analytic-expectation").fill("5000000");
  await page.getByTestId("analytic-tolerance").fill("1000000");
  await page.getByTestId("analytic-basis").fill("Margin trend expectation");
  await page.getByTestId("run-analytic").click();
  await expect(page.getByTestId("engine-runs")).toContainText("substantive_analytics");

  // Findings: the projected misstatement is in C1.1 and the recon diff in C1.2.
  await page.goto(`${engagementUrl}/findings`);
  await page.waitForURL("**/findings");
  await expect(page.getByTestId("b5-table")).toContainText("Projected misstatement");
  await expect(page.getByTestId("b4-list")).toContainText("Unreconciled difference");
});
