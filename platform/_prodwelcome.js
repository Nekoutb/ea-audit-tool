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
  await p.waitForLoadState("networkidle");
  ok(await p.getByTestId("welcome").isVisible(), `welcome: "${await p.getByTestId("welcome").innerText()}"`);
  const rows = await p.locator('[data-testid="my-engagements"] a').allInnerTexts();
  ok(rows.length === 1 && /ZOEDEN/.test(rows[0]), `exactly one engagement, ZOEDEN (${rows.length})`);
  for (const tid of ["priority-actions", "firm-by-phase", "firm-mandates", "firm-deadlines", "portfolio-risks", "portfolio-b5", "dev-diagnostics"]) {
    ok((await p.locator(`[data-testid="${tid}"]`).count()) === 0, `${tid} absent`);
  }
  const body = await p.locator("main").innerText();
  ok(!/actions prioritaires|priority|par étape|by stage|mandate|deadline heat/i.test(body), "no stray panel text");
  await p.screenshot({ path: "_shot-prod-welcome2.png", fullPage: true });
  await b.close();
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
