/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
const ok = (c, m) => console.log(`${c ? "PASS" : "FAIL"} ${m}`);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1366, height: 950 } });
  const p = await ctx.newPage();
  await p.goto("https://www.auditisa.com/login", { waitUntil: "domcontentloaded" });
  const en = p.getByRole("button", { name: /^(English|Anglais)$/ });
  if (await en.count()) { await en.click(); await p.waitForLoadState("networkidle"); }
  await p.fill("input[name=email]", "admin@auditisa.com");
  await p.fill("input[name=password]", "admin");
  await p.getByTestId("login-submit").click();
  await p.waitForURL("**/dashboard", { timeout: 45000 });
  await p.locator('[data-testid="my-engagements"] a').first().click();
  await p.waitForURL(/\/engagements\/.*\/(dashboard|nature)/);
  await p.locator('[data-testid="section-card-acceptance"]').waitFor({ timeout: 30000 });
  ok((await p.locator('[data-testid^="section-card-"]').count()) === 4, "four full-width cards live");
  await p.locator('[data-testid="section-card-acceptance"]').click();
  await p.waitForTimeout(450);
  ok((await p.locator('[data-testid^="stage-group-a"]').count()) === 6, "six grouped tasks on click");
  await p.screenshot({ path: "_shot-prod-final.png", fullPage: false });
  await b.close();
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
