import { expect, test, type Page } from "@playwright/test";

// Phase 3 acceptance (spec §17): import demo TB → one lead schedule per mapped
// E-section generated and assigned → variance flags raised → one flag promoted
// to a risk. Both years are imported through the real import engine (prior via
// the API, current via the Data-tab wizard), plus an adjusting journal posts an
// ADJUSTED version (3.3).

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

async function createEngagementViaUi(page: Page, clientUrl: string, year: string): Promise<string> {
  await page.goto(clientUrl);
  await page.getByTestId("new-engagement").click();
  await page.waitForURL("**/new-engagement**");
  await page.getByTestId("engagement-year").fill(year);
  await page.getByTestId("create-engagement").click();
  // The nature-of-entity screen concludes the scope; the team screen follows.
  await page.waitForURL("**/nature");
  await page.getByTestId("cq-listed").check();
  await page.getByTestId("classify-entity").click();
  await page.waitForURL("**/team");
  return page.url().split("/engagements/")[1].split(/[/?#]/)[0];
}

const HEADERS = "Compte;Libellé;Mouvement débit;Mouvement crédit";
const tbCsv = (rows: string[]): string => [HEADERS, ...rows].join("\n");

test("Phase 3 full: import TB → lead schedule → journal → analytics → risk", async ({ page }) => {
  test.setTimeout(300_000);
  await login(page);

  const clientName = `Import SA ${Date.now()}`;
  await page.goto("/clients");
  await page.getByTestId("client-name").fill(clientName);
  await page.getByTestId("create-client").click();
  await page.waitForURL("**/clients/**");
  const clientUrl = page.url();
  const prior = await createEngagementViaUi(page, clientUrl, "2024");
  const current = await createEngagementViaUi(page, clientUrl, "2025");

  // Prior-year TB through the real import engine (API multipart).
  const priorImport = await page.request.post(`/api/engagements/${prior}/tb`, {
    multipart: {
      file: {
        name: "tb-2024.csv",
        mimeType: "text/csv",
        buffer: Buffer.from(
          tbCsv(["411000;Clients;50000000;0", "701000;Ventes;0;70000000", "601000;Achats;20000000;0"]),
          "utf8",
        ),
      },
    },
  });
  expect(priorImport.status()).toBe(200);
  expect((await priorImport.json()).status).toBe("valid");

  // Current-year TB through the Data-tab wizard (3.1).
  await page.goto(`/engagements/${current}/data`);
  await page.getByTestId("tb-file").setInputFiles({
    name: "tb-2025.csv",
    mimeType: "text/csv",
    buffer: Buffer.from(
      tbCsv(["411000;Clients;80000000;0", "701000;Ventes;0;150000000", "601000;Achats;30000000;0", "661000;Salaires;40000000;0"]),
      "utf8",
    ),
  });
  await page.getByTestId("tb-upload").click();
  await expect(page.getByTestId("tb-import-status")).toContainText("valid");
  await expect(page.getByTestId("tb-status-1")).toContainText(/Valid/i);
  await expect(page.getByTestId("tb-checks")).toBeVisible();

  // 3.3: post an adjusting journal → ADJUSTED version becomes current.
  await page.getByTestId("journal-description").fill("Cut-off accrual");
  await page.getByTestId("journal-lines").fill("601000;Achats;1000000;0\n408000;FNP;0;1000000");
  await page.getByTestId("create-journal").click();
  await page.getByTestId("post-journal-1").click();
  await expect(page.getByTestId("tb-versions")).toContainText("v2");
  await expect(page.getByTestId("tb-versions")).toContainText(/Adjusted/i);

  // Materiality for flags + lead-schedule header.
  await page.goto(`/engagements/${current}/planning`);
  await page.getByTestId("materiality-benchmark").selectOption("revenue");
  await page.getByTestId("materiality-amount").fill("150000000");
  await page.getByTestId("materiality-pct").fill("1");
  await page.getByTestId("materiality-justification").fill("Revenue benchmark.");
  await page.getByTestId("create-materiality").click();
  await page.getByTestId("approve-materiality").click();

  // Lead schedule for E100: generate → real xlsx → assign → notification.
  await page.goto(`/engagements/${current}/data`);
  await expect(page.getByTestId("leadsheets-table")).toContainText("E100");
  await page.getByTestId("generate-lead-E100").click();
  await page.waitForURL("**/documents/**");
  await expect(page.locator("h1")).toContainText("E100.1");
  const href = await page.getByTestId("download-current").getAttribute("href");
  const download = await page.request.get(href!);
  expect((await download.body()).subarray(0, 2).toString("latin1")).toBe("PK");

  await page.goto(`/engagements/${current}/data`);
  await page.getByTestId("owner-E100").selectOption({ label: "Alice Alpha" });
  await page.getByTestId("assign-E100").click();
  await expect(page.getByTestId("owner-badge-E100")).toContainText("Alice Alpha");
  await page.goto("/notifications");
  await expect(page.getByTestId("notifications-list")).toContainText("E100");

  // Analytics: flagged variance raised into D7.1 and promoted (acceptance).
  await page.goto(`/engagements/${current}/analytics`);
  await expect(page.getByTestId("flag-E100")).toBeVisible();
  await page.getByTestId("raise-E100").click();
  await page.goto(`/engagements/${current}/risks`);
  await expect(page.getByTestId("potential-risks")).toContainText("D4.3 variance E100");
  await page.locator("[data-testid^=promote-]").first().click();
  await expect(page.getByTestId("risk-register")).toContainText("D4.3 variance E100");
});
