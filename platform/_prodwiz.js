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

  ok((await p.locator("header nav a").count()) === 0, "top links removed");
  ok(await p.getByTestId("new-engagement").isVisible(), "create button present");
  await p.screenshot({ path: "_shot-prod-w1.png", fullPage: false });

  await p.getByTestId("new-engagement").click();
  await p.waitForURL("**/new-engagement**", { timeout: 30000 });
  const fields = await Promise.all(
    ["engagement-period-end", "engagement-duration", "engagement-nature", "engagement-work-phase", "engagement-framework", "engagement-first-year"]
      .map((tid) => p.locator(`[data-testid="${tid}"]`).count()),
  );
  ok(fields.every((c) => c === 1), "identity questions live");
  await p.getByTestId("engagement-year").fill("2026");
  const name = await p.getByTestId("engagement-name").innerText();
  console.log("generated:", name);
  ok(/_DECEMBER 31 2026_STATUTORY AUDIT$/.test(name), "generated name format");
  await p.screenshot({ path: "_shot-prod-w2.png", fullPage: true });
  // stop here — no engagement is actually created on production
  await b.close();
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
