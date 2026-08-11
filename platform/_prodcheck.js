const { chromium } = require("@playwright/test");
const ok = (c, m) => console.log(`${c ? "PASS" : "FAIL"} ${m}`);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1366, height: 720 } });
  await p.goto("https://www.auditisa.com/login");
  await p.fill("input[name=email]", "admin@auditisa.com");
  await p.fill("input[name=password]", "admin");
  await p.getByTestId("login-submit").click();
  await p.waitForURL("**/dashboard", { timeout: 30000 });
  // D3.2 task on ZOEDEN c64c00a8
  await p.goto("https://www.auditisa.com/engagements/c64c00a8-8081-4062-8924-591c464ed7d8/sections/53c5231d-36fd-48a9-a47c-0ad3d40a9848");
  await p.locator('[data-testid="wp-screen"]').waitFor();
  ok(await p.getByTestId("wp-back-dashboard").isVisible(), "prod: back arrow present");
  const total = Number((await p.getByTestId("wp-step").innerText()).split("/")[1]);
  let clipped = 0;
  for (let s = 1; s < total; s++) {
    await p.getByTestId("wp-next").click();
    const nos = p.locator('div[class*="absolute"]:not([hidden]) [data-testid^="wp-q_"][data-testid$="-no"]');
    const n = await nos.count();
    for (let i = 0; i < n; i++) await nos.nth(i).check();
    await p.waitForTimeout(150);
    const bad = await p.evaluate(() => {
      const page = [...document.querySelectorAll('[data-testid^="wp-form-"] .absolute')].find((e) => !e.hidden);
      if (!page) return -1;
      const limit = page.getBoundingClientRect().bottom + 2;
      return [...page.children].filter((c) => c.getBoundingClientRect().bottom > limit).length;
    });
    if (bad > 0) clipped++;
  }
  ok(clipped === 0, `prod: nothing clipped across ${total} pages at 1366x720 (all boxes open)`);
  await b.close();
})().catch((e) => { console.error("ERROR", e.message.split("\n")[0]); process.exit(1); });
