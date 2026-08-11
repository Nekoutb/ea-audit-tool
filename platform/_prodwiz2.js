/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
const ok = (c, m) => console.log(`${c ? "PASS" : "FAIL"} ${m}`);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1366, height: 900 } });
  const p = await ctx.newPage();
  await p.goto("https://www.auditisa.com/login", { waitUntil: "domcontentloaded" });
  const en = p.getByRole("button", { name: /^(English|Anglais)$/ });
  if (await en.count()) { await en.click(); await p.waitForLoadState("networkidle"); }
  await p.fill("input[name=email]", "admin@auditisa.com");
  await p.fill("input[name=password]", "admin");
  await p.getByTestId("login-submit").click();
  await p.waitForURL("**/dashboard", { timeout: 45000 });
  await p.goto("https://www.auditisa.com/new-engagement", { waitUntil: "networkidle" });
  for (const tid of ["engagement-client", "engagement-year", "engagement-nature"]) {
    ok((await p.locator(`[data-testid="${tid}"]`).count()) === 1, `${tid} live`);
  }
  for (const tid of ["engagement-period-end", "engagement-duration", "engagement-work-phase", "engagement-framework", "engagement-first-year", "engagement-partner"]) {
    ok((await p.locator(`[data-testid="${tid}"]`).count()) === 0, `${tid} gone`);
  }
  await p.getByTestId("engagement-client").fill("ZOEDEN");
  ok(await p.getByText("Existing client").isVisible(), "typed ZOEDEN matches the existing client");
  await p.getByTestId("engagement-nature").selectOption("other");
  ok((await p.locator('[data-testid="engagement-nature-text"]').count()) === 1, "Other reveals the free-text input");
  await p.screenshot({ path: "_shot-prod-wiz3.png", fullPage: true });
  // no engagement created on production
  await b.close();
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
