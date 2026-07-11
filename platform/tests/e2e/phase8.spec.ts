import { expect, test, type Page } from "@playwright/test";

// Phase 8 acceptance (spec §17): on a demo SA — statutory deadlines calendar,
// an unauthorized convention flagged and carried into the rapport spécial,
// an SA alerte walkthrough, the art. 715 report, the titres attestation,
// equity < ½ capital raising the EGM workflow, and a fait délictueux letter.

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

const HEADERS = "Compte;Libellé;Mouvement débit;Mouvement crédit";

test("Phase 8: deadlines → conventions/rapport spécial → alerte → equity → faits", async ({ page }) => {
  test.setTimeout(300_000);
  await login(page);

  const clientName = `Legal SA ${Date.now()}`;
  await page.goto("/clients");
  await page.getByTestId("client-name").fill(clientName); // legal form defaults to SA
  await page.getByTestId("create-client").click();
  await page.waitForURL("**/clients/**");
  await page.getByTestId("new-engagement").click();
  await page.waitForURL("**/new-engagement**");
  await page.getByTestId("engagement-year").fill("2025");
  await page.getByTestId("engagement-period-end").fill("2025-12-31");
  await page.getByTestId("cq-listed").check();
  await page.getByTestId("create-engagement").click();
  await page.waitForURL("**/engagements/**");
  const engagementUrl = page.url();

  // Loss-making balanced TB for the F7 equity monitor (equity 2M vs capital 10M).
  await page.goto(`${engagementUrl}/data`);
  await page.getByTestId("tb-file").setInputFiles({
    name: "tb-2025.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      [
        HEADERS,
        "101000;Capital;0;10000000",
        "521000;Banque;2000000;0",
        "661000;Salaires;12000000;0",
        "701000;Ventes;0;4000000",
      ].join("\n"),
      "utf8",
    ),
  });
  await page.getByTestId("tb-upload").click();
  await expect(page.getByTestId("tb-import-status")).toContainText("valid");

  // --- F1: statutory deadlines calendar ---
  await page.getByTestId("tab-legal").click();
  await page.waitForURL("**/legal");
  await page.getByTestId("generate-deadlines").click();
  await expect(page.getByTestId("deadlines-table")).toContainText("FS arrêtés");
  await expect(page.getByTestId("deadlines-table")).toContainText("2026-04-30"); // Dec 31 + 4 months
  await page.getByTestId("deadline-done-continuing_conventions_notice").click();
  await expect(page.getByTestId("deadlines-table")).toContainText("✓");

  // --- F2: convention without board authorization → art. 447 flag ---
  await page.getByTestId("conv-parties").fill(`${clientName} / Immo SCI`);
  await page.getByTestId("conv-interested").fill("M. Dupont");
  await page.getByTestId("conv-nature").fill("Bail commercial du siège");
  await page.getByTestId("conv-terms").fill("Loyer annuel 24 000 000 FCFA");
  await page.getByTestId("add-convention").click();
  await expect(page.getByTestId("conventions-list")).toContainText("Bail commercial");
  await expect(page.locator("[data-testid^=conv-unauthorized-]")).toBeVisible();

  // Rapport spécial generated from the register.
  await page.getByTestId("rapport-special").click();
  await page.waitForURL("**/documents/**");
  await expect(page.locator("h1")).toContainText(/Rapport spécial/i);

  // --- F3: article 715 report ---
  await page.goto(`${engagementUrl}/legal`);
  await page.getByTestId("article-715").click();
  await page.waitForURL("**/documents/**");
  await expect(page.locator("h1")).toContainText(/715/);

  // --- F4: SA alerte walkthrough ---
  await page.goto(`${engagementUrl}/legal`);
  await page.getByTestId("alerte-note").fill("Pertes récurrentes et trésorerie insuffisante.");
  await page.getByTestId("start-alerte").click();
  await expect(page.getByTestId("alerte-stage")).toContainText(/Request for explanations sent/i);
  await page.getByTestId("alerte-advance-note").fill("Réponse non satisfaisante.");
  await page.getByTestId("advance-alerte").click();
  await expect(page.getByTestId("alerte-stage")).toContainText(/Reply recorded/i);
  await page.getByTestId("advance-alerte").click();
  await expect(page.getByTestId("alerte-stage")).toContainText(/Board invited/i);

  // --- F6: titres nominatifs attestation ---
  await page.getByTestId("titres-attestation").click();
  await page.waitForURL("**/documents/**");
  await expect(page.locator("h1")).toContainText(/titres nominatifs/i);

  // --- F7: equity < half of capital raises the EGM workflow ---
  await page.goto(`${engagementUrl}/legal`);
  await page.getByTestId("share-capital").fill("10000000");
  await page.getByTestId("save-capital").click();
  await page.getByTestId("equity-check").click();
  await expect(page.getByTestId("equity-breach")).toBeVisible();
  await expect(page.getByTestId("deadlines-table")).toContainText(/EGM on equity/i);

  // --- F5: fait délictueux (partner-only) → révélation letter ---
  await page.getByTestId("fait-description").fill("Détournement présumé de recettes en espèces.");
  await page.getByTestId("reveal-fait").click();
  await page.waitForURL("**/documents/**");
  await expect(page.locator("h1")).toContainText(/Révélation/i);
  await page.goto(`${engagementUrl}/legal`);
  await expect(page.getByTestId("faits-list")).toContainText("Détournement");
});
