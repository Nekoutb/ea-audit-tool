/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
const BASE = "https://www.auditisa.com";
const ok = (c, m) => console.log(`${c ? "PASS" : "FAIL"} ${m}`);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1366, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const en = p.getByRole("button", { name: /^(English|Anglais)$/ });
  if (await en.count()) { await en.click(); await p.waitForLoadState("networkidle"); }
  await p.fill("input[name=email]", "admin@auditisa.com");
  await p.fill("input[name=password]", "admin");
  await p.getByTestId("login-submit").click();
  await p.waitForURL("**/dashboard", { timeout: 45000 });
  ok(new URL(p.url()).pathname === "/dashboard", "sign-in lands on the welcome dashboard");
  const w = await p.getByTestId("welcome").innerText();
  ok(/Welcome|Bienvenue/.test(w), `welcome: "${w}"`);
  const rows = await p.locator('[data-testid="my-engagements"] a').count();
  ok(rows > 0, `engagement list disclosed (${rows})`);
  await p.screenshot({ path: "_shot-prod-welcome.png", fullPage: true });

  await p.locator('[data-testid="my-engagements"] a').first().click();
  await p.waitForURL(/\/engagements\/.*\/dashboard/);
  await p.locator('[data-testid="section-card-acceptance"]').waitFor();
  const cards = await p.locator('[data-testid^="section-card-"]').count();
  ok(cards === 4, `four phase cards (${cards})`);
  ok((await p.locator('[data-testid="phase-acceptance"]').count()) === 0, "no duplicate phase bar");
  ok((await p.locator('[data-testid="engagement-feed"]').count()) === 0, "feed removed");
  ok((await p.locator('[data-testid="phase-task-rollout"]').count()) === 0, "tasks hidden until click");
  await p.locator('[data-testid="section-card-acceptance"]').click();
  await p.waitForTimeout(450);
  ok((await p.locator('[data-testid^="stage-task-"]').count()) > 0, "click reveals the tasks");
  await p.screenshot({ path: "_shot-prod-open.png", fullPage: false });
  await b.close();
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
