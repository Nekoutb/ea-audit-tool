/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
const ok = (c, m) => console.log(`${c ? "PASS" : "FAIL"} ${m}`);
require("dotenv").config();
const { Pool } = require("pg");
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const d31 = (await pool.query(
    "SELECT fi.id, fi.engagement_id FROM file_item fi JOIN engagement e ON e.id=fi.engagement_id JOIN tenant t ON t.id=e.tenant_id WHERE t.name='Cabinet Alpha' AND fi.code='D3.1' AND e.phase<>'archived' ORDER BY e.created_at DESC LIMIT 1",
  )).rows[0];
  await pool.end();
  const b = await chromium.launch();

  for (const vp of [{ width: 1600, height: 900 }, { width: 1366, height: 720 }]) {
    const ctx = await b.newContext({ viewport: vp });
    const p = await ctx.newPage();
    await p.context().addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);
    await p.goto("http://localhost:3100/login");
    await p.fill("input[name=email]", "alice@firm-a.test");
    await p.fill("input[name=password]", "password");
    await p.getByTestId("login-submit").click();
    await p.waitForURL("**/dashboard");
    await p.goto(`http://localhost:3100/engagements/${d31.engagement_id}/sections/${d31.id}`);
    await p.locator('[data-testid="wp-screen"]').waitFor();
    const total = Number((await p.getByTestId("wp-step").innerText()).split("/")[1]);

    // walk every page; on each: answer every visible question "No" (worst
    // case — all yellow boxes open) and assert nothing is clipped
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
    ok(clipped === 0, `${vp.width}x${vp.height}: no clipped item on any of ${total} pages (all boxes open)`);
    const doc = await p.evaluate(() => document.documentElement.scrollHeight - innerHeight);
    ok(doc <= 0, `${vp.width}x${vp.height}: page itself still never scrolls`);
    if (vp.height === 720) await p.screenshot({ path: "_shot-clip.png" });
    await ctx.close();
  }
  await b.close();
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
