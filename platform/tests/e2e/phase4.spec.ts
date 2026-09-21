import { expect, test, type Page } from "@playwright/test";

// Phase 4 acceptance (spec §17): run execution; raise misstatements; C1.1 totals
// live against materiality; revise-approach adds a dated risk to S3.1.
//
// The matters-arising router and the control-test recorder both sat in the pane
// below the paper wizard, and that pane was removed on 2026-09-21. What is left
// of Phase 4 on a screen is the account paper: a substantive procedure
// performed, concluded and reviewed. The routing half of the phase is kept,
// whole, in the fixme test at the foot of this file.

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
 * Fill an account procedure's finding & conclusion and wait for the blur-save
 * to land: the "procedure done" tick is refused while the step has no
 * conclusion (a completion records conclusion + preparer + timestamp).
 */
async function concludePsp(page: Page, ref: string, text: string): Promise<void> {
  await page.getByTestId(`psp-finding-${ref}`).fill(text);
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/psp") && r.request().method() === "POST" && r.ok(),
    ),
    page.getByTestId(`psp-finding-${ref}`).blur(),
  ]);
}

/**
 * A new file with an approved materiality (overall 1.5M / trivial 75k) so the
 * C1.1 verdicts are live — the setup both tests share. Returns the engagement
 * URL.
 */
async function executionFile(page: Page, clientName: string): Promise<string> {
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

  await page.goto(`${engagementUrl}/planning`);
  await page.getByTestId("materiality-benchmark").selectOption("revenue");
  await page.getByTestId("materiality-amount").fill("150000000");
  await page.getByTestId("materiality-pct").fill("1");
  await page.getByTestId("materiality-justification").fill("Revenue.");
  await page.getByTestId("create-materiality").click();
  await page.getByTestId("approve-materiality").click();

  return engagementUrl;
}

test("Phase 4: a substantive procedure is performed, concluded and reviewed", async ({ page }) => {
  test.setTimeout(300_000);
  await login(page);
  const engagementUrl = await executionFile(page, `Exec SA ${Date.now()}`);

  // E4.2 account workpaper: add a substantive procedure and complete it (4.2).
  await page.goto(engagementUrl);
  await page.getByTestId("open-section-E4.2").click();
  await page.waitForURL("**/sections/**");
  const sectionUrl = page.url();
  await page.getByTestId("psp-add-row").click();
  await page.getByTestId("psp-other-text").fill("Search for unrecorded liabilities.");
  await page.getByTestId("psp-other-add").click();
  await page.getByTestId("psp-row-OSP-1").click();
  // A procedure carries its conclusion before it can be marked done — the
  // finding & conclusion box IS the step conclusion the completion records.
  await concludePsp(page, "OSP-1", "Performed over the payables population; no exceptions noted.");
  await page.locator("[data-testid^=psp-done-]").check();
  await expect(page.getByTestId("psp-row-OSP-1")).toContainText("✓");

  // Section conclusion: prepare + review (4.11). The E4 account paper keeps a
  // conclusion footer of its own, which is why this half of 4.11 still has a
  // screen; the same box on every other task went with the pane below the
  // wizard on 2026-09-21.
  await page.goto(sectionUrl);
  await page.getByTestId("section-conclusion").fill("Objectives achieved for payables.");
  await page.getByTestId("save-conclusion").click();
  await page.getByTestId("review-conclusion").click();
  await expect(page.getByTestId("conclusion-state")).toContainText("Objectives achieved for payables.");
});

test("Phase 4: findings routing → C1.1 vs materiality → control tests → revise-approach", async ({ page }) => {
  test.fixme(
    true,
    "The matter-arising router (finding-route / route-finding) and control-test recording (record-control) were removed from the working-paper section screen on 2026-09-21 at the user's request. Audit differences are raised through Tools → Summary of Audit Differences and a paper states its own key findings on page 1 of the wizard, but routing a matter to C1.1 or C5.1, recording a control test, and the revise-approach path that puts a dated risk on the register have no screen at all today.",
  );
  test.setTimeout(300_000);
  await login(page);
  const engagementUrl = await executionFile(page, `Exec routing SA ${Date.now()}`);

  // The panels rendered on every execution task that was not an E4 account, so
  // the file item stored as E5.1 is where this run found them. That code is
  // Operating Expenditures — the framework shows it inside E4 now — and not the
  // general audit procedures, which are stored under E3.1.
  await page.goto(engagementUrl);
  await page.getByTestId("open-section-E5.1").click();
  await page.waitForURL("**/sections/**");
  const e5Url = page.url();

  // Matter arising → C1.1 misstatement above trivial (4.4/4.5).
  await page.getByTestId("finding-route").selectOption("b5");
  await page.getByTestId("finding-title").fill("Unrecorded supplier invoice");
  await page.getByTestId("finding-amount").fill("8000000");
  await page.getByTestId("route-finding").click();

  // Control deviation → deficiency → C5.1 (4.7).
  await page.goto(e5Url);
  await page.getByTestId("control-description").fill("Three-way match control");
  await page.getByTestId("control-result").selectOption("deviation");
  await page.getByTestId("control-decision").selectOption("deficiency");
  await page.getByTestId("record-control").click();
  await expect(page.getByTestId("control-tests")).toContainText(/deficiency/i);

  // Revise-approach → dated risk pending partner approval (4.10).
  await page.getByTestId("finding-route").selectOption("revise");
  await page.getByTestId("finding-title").fill("New inventory obsolescence risk identified");
  await page.getByTestId("route-finding").click();

  // Findings tab: C1.1 totals vs materiality — exceeds, then correct → within (4.6).
  await page.goto(`${engagementUrl}/findings`);
  await page.waitForURL("**/findings");
  await expect(page.getByTestId("b5-totals")).toContainText("8 000 000");
  await expect(page.getByTestId("b5-verdict")).toContainText(/EXCEED/i);
  await page.locator("[data-testid^=toggle-corrected-]").first().click();
  await expect(page.getByTestId("b5-verdict")).toContainText(/Within/i);

  // C5.1 point present and clearable (4.9).
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
