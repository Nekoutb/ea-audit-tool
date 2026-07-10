import { expect, test, type Page } from "@playwright/test";
import pg from "pg";

// Phase 3 acceptance — my scope (3.4/3.7/3.8/3.9/3.10): TB data → lead
// schedule generated + assigned → analytics variance flag → risk raised into
// D7.1 and promoted. The TB is seeded directly (steps 3.1–3.3, the import
// wizard, belong to the parallel TB workstream and slot in here once landed).

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
  await page.getByTestId("engagement-year").fill(year);
  await page.getByTestId("engagement-period-end").fill(`${year}-12-31`);
  await page.getByTestId("create-engagement").click();
  await page.waitForURL("**/engagements/**");
  return page.url().split("/engagements/")[1].split(/[/?#]/)[0];
}

async function seedTb(
  admin: pg.Pool,
  engagementId: string,
  periodEnd: string,
  rows: Array<[string, string, number, number]>,
): Promise<void> {
  const meta = await admin.query<{ tenant_id: string; client_id: string }>(
    "SELECT tenant_id, client_id FROM engagement WHERE id = $1",
    [engagementId],
  );
  const { tenant_id, client_id } = meta.rows[0];
  const tb = await admin.query<{ id: string }>(
    `INSERT INTO trial_balance (tenant_id, client_id, engagement_id, period_end, current_version_no)
     VALUES ($1, $2, $3, $4, 1) RETURNING id`,
    [tenant_id, client_id, engagementId, periodEnd],
  );
  const version = await admin.query<{ id: string }>(
    `INSERT INTO trial_balance_version (tenant_id, trial_balance_id, version_no, version_kind, validation_status, row_count)
     VALUES ($1, $2, 1, 'initial', 'valid', $3) RETURNING id`,
    [tenant_id, tb.rows[0].id, rows.length],
  );
  let rowNo = 0;
  for (const [account, name, debit, credit] of rows) {
    rowNo += 1;
    await admin.query(
      `INSERT INTO trial_balance_row
         (tenant_id, version_id, row_no, account_code, account_name, debit, credit)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [tenant_id, version.rows[0].id, rowNo, account, name, debit, credit],
    );
  }
}

test("Phase 3: TB → lead schedule → assignment → analytics flag → risk", async ({ page }) => {
  test.setTimeout(240_000);
  const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  try {
    await login(page);

    // Client + two fiscal years (prior for comparatives).
    const clientName = `TB SA ${Date.now()}`;
    await page.goto("/clients");
    await page.getByTestId("client-name").fill(clientName);
    await page.getByTestId("create-client").click();
    await page.waitForURL("**/clients/**");
    const clientUrl = page.url();
    const prior = await createEngagementViaUi(page, clientUrl, "2024");
    const current = await createEngagementViaUi(page, clientUrl, "2025");

    await seedTb(admin, prior, "2024-12-31", [
      ["411000", "Clients", 50_000_000, 0],
      ["701000", "Ventes", 0, 70_000_000],
      ["601000", "Achats", 20_000_000, 0],
    ]);
    await seedTb(admin, current, "2025-12-31", [
      ["411000", "Clients", 80_000_000, 0],
      ["701000", "Ventes", 0, 150_000_000],
      ["601000", "Achats", 30_000_000, 0],
    ]);

    // Materiality (needed for flags + lead-schedule header).
    await page.goto(`/engagements/${current}/planning`);
    await page.getByTestId("materiality-benchmark").selectOption("revenue");
    await page.getByTestId("materiality-amount").fill("150000000");
    await page.getByTestId("materiality-pct").fill("1");
    await page.getByTestId("materiality-justification").fill("Revenue benchmark.");
    await page.getByTestId("create-materiality").click();
    await page.getByTestId("approve-materiality").click();

    // Data tab: E100 grouped balances present → generate the lead schedule.
    await page.goto(`/engagements/${current}/data`);
    await expect(page.getByTestId("leadsheets-table")).toContainText("E100");
    await page.getByTestId("generate-lead-E100").click();
    await page.waitForURL("**/documents/**");
    await expect(page.locator("h1")).toContainText("E100.1");
    const href = await page.getByTestId("download-current").getAttribute("href");
    const download = await page.request.get(href!);
    expect(download.status()).toBe(200);
    expect((await download.body()).subarray(0, 2).toString("latin1")).toBe("PK");

    // Distribution: assign the section → notification lands.
    await page.goto(`/engagements/${current}/data`);
    await page.getByTestId("owner-E100").selectOption({ label: "Alice Alpha" });
    await page.getByTestId("assign-E100").click();
    await page.goto("/notifications");
    await expect(page.getByTestId("notifications-list")).toContainText("E100");

    // Analytics: E100 movement (-50M) far above PM (1.125M) → flagged → raise.
    await page.goto(`/engagements/${current}/analytics`);
    await expect(page.getByTestId("variance-table")).toBeVisible();
    await expect(page.getByTestId("flag-E100")).toBeVisible();
    await page.getByTestId("raise-E100").click();

    // The flag lands in D7.1 and can be promoted to the register.
    await page.goto(`/engagements/${current}/risks`);
    await expect(page.getByTestId("potential-risks")).toContainText("D4.3 variance E100");
    await page.locator("[data-testid^=promote-]").first().click();
    await expect(page.getByTestId("risk-register")).toContainText("D4.3 variance E100");
  } finally {
    await admin.end();
  }
});
