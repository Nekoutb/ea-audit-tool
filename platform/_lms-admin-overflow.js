/* eslint-disable @typescript-eslint/no-require-imports -- scratch */
const { chromium } = require("playwright");
const BASE = "http://localhost:3000";

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.fill('.admin-login-card input[type="email"]', "support@ealearnings.com");
  await page.fill('.admin-login-card input[type="password"]', "Str0ngPass!2026");
  await page.click(".admin-login-card .auth-submit");
  await page.waitForSelector(".admin-identity-bar", { timeout: 20000 });

  const probe = async (label) => {
    const out = await page.evaluate(() => {
      const vw = window.innerWidth;
      const rows = [];
      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.right > vw + 2) {
          rows.push({
            sel: el.tagName.toLowerCase() + (el.className ? "." + el.className.toString().trim().split(/\s+/).join(".") : ""),
            right: Math.round(r.right), width: Math.round(r.width),
            minWidth: cs.minWidth, gridCols: cs.gridTemplateColumns.slice(0, 60), overflowX: cs.overflowX,
            parent: el.parentElement ? el.parentElement.tagName.toLowerCase() + "." + (el.parentElement.className || "").toString().trim().split(/\s+/)[0] : "",
          });
        }
      }
      return { vw, scrollW: document.scrollingElement.scrollWidth, rows: rows.slice(0, 14), total: rows.length };
    });
    console.log(`\n=== ${label} (vw=${out.vw} scrollW=${out.scrollW} overflowing=${out.total}) ===`);
    for (const r of out.rows) console.log(`  ${r.sel}\n     right=${r.right} w=${r.width} minW=${r.minWidth} cols="${r.gridCols}" parent=${r.parent}`);
  };

  await probe("admin console");
  await page.click("text=+ Onboard organization");
  await page.waitForSelector("#tenant-wizard-title");
  await probe("onboarding welcome");
  await page.click("text=Get started →");
  await page.waitForTimeout(300);
  await probe("onboarding goal");
  await page.click(".wizard-goal-card.primary");
  await page.waitForTimeout(300);
  await probe("onboarding setup");

  await browser.close();
})().catch((e) => { console.error("CRASH", e.message); process.exit(2); });
