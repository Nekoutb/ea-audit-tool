/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.context().addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);
  await p.goto("http://localhost:3100/login");
  await p.fill("input[name=email]", "alice@firm-a.test");
  await p.fill("input[name=password]", "password");
  await p.getByTestId("login-submit").click();
  await p.waitForURL("**/dashboard");
  await p.goto("http://localhost:3100/engagements/c9791388-fb25-49e1-8a6e-8672e4c3012c/conclusion");
  await p.waitForLoadState("networkidle");
  await p.getByTestId("partner-conclusion-text").fill("Sufficient appropriate evidence obtained.");
  await p.getByTestId("independence-reconfirm").check();
  const t0 = Date.now();
  await p.getByTestId("save-partner-conclusion").click();
  for (let i = 0; i < 20; i++) {
    const txt = await p.getByTestId("gate-partner_conclusion").innerText();
    if (txt.includes("✓")) { console.log(`gate turned ✓ after ${Date.now() - t0}ms`); break; }
    if (i === 19) console.log("gate NEVER turned ✓ in 10s:", JSON.stringify(txt));
    await p.waitForTimeout(500);
  }
  await b.close();
})();
