/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
const ok = (c, m) => console.log(`${c ? "PASS" : "FAIL"} ${m}`);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.context().addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);
  await p.goto("http://localhost:3100/login");
  await p.fill("input[name=email]", "alice@firm-a.test");
  await p.fill("input[name=password]", "password");
  await p.getByTestId("login-submit").click();
  await p.waitForURL("**/dashboard");
  ok(await p.getByTestId("welcome").isVisible(), "welcome shown");
  const rows = await p.locator('[data-testid="my-engagements"] a').count();
  console.log("assigned engagements listed:", rows);
  for (const tid of ["priority-actions", "firm-by-phase", "firm-mandates", "firm-deadlines", "portfolio-risks", "portfolio-b5"]) {
    ok((await p.locator(`[data-testid="${tid}"]`).count()) === 0, `${tid} removed`);
  }
  await p.screenshot({ path: "_shot-welcome-only.png", fullPage: true });
  await b.close();
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
