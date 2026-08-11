/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1366, height: 1000 } });
  const p = await ctx.newPage();
  await p.goto("https://www.auditisa.com/login", { waitUntil: "domcontentloaded" });
  const en = p.getByRole("button", { name: /^(English|Anglais)$/ });
  if (await en.count()) { await en.click(); await p.waitForLoadState("networkidle"); }
  await p.fill("input[name=email]", "admin@auditisa.com");
  await p.fill("input[name=password]", "admin");
  await p.getByTestId("login-submit").click();
  await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 });
  console.log("landing:", p.url());
  await p.waitForLoadState("networkidle");
  await p.screenshot({ path: "_shot-prod-landing.png", fullPage: true });
  await p.goto("https://www.auditisa.com/engagements/c71e5b3d-cf25-42e0-a32a-f4784b4420c0/dashboard", { waitUntil: "networkidle" });
  await p.screenshot({ path: "_shot-prod-engdash.png", fullPage: true });
  const rings = await p.locator('[data-testid^="section-"]').evaluateAll((els) => els.map((e) => e.getAttribute("data-testid")));
  console.log("rings:", rings.join(", "));
  await b.close();
})();
