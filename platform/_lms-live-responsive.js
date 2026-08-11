/* eslint-disable @typescript-eslint/no-require-imports -- scratch */
/* Confirms the deployed site has no horizontal overflow on real devices. */
const { chromium } = require("playwright");
const BASE = "https://ealearnings.com";
const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 740 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "short-380x560", width: 380, height: 560 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "laptop-1024", width: 1024, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
];
const fails = [];

async function check(page, label) {
  const r = await page.evaluate(() => {
    const vw = window.innerWidth;
    let over = 0, worst = "";
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || cs.position === "fixed") continue;
      const b = el.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) continue;
      if (b.right > vw + 2) { over++; if (!worst) worst = el.tagName.toLowerCase() + "." + (el.className || "").toString().split(" ")[0]; }
    }
    return { hScroll: document.scrollingElement.scrollWidth - vw, over, worst };
  });
  const clean = r.hScroll <= 2 && r.over === 0;
  console.log(`${clean ? "PASS" : "FAIL"} ${label}${clean ? "" : ` hScroll=${r.hScroll} over=${r.over} ${r.worst}`}`);
  if (!clean) fails.push(label);
}

(async () => {
  const browser = await chromium.launch();
  for (const vp of VIEWPORTS) {
    const page = await browser.newPage({ viewport: { width: vp.width, height: vp.height } });
    await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForTimeout(900);
    await check(page, `live public @ ${vp.name}`);

    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded", timeout: 45000 });
    await page.waitForSelector(".admin-login-card", { timeout: 20000 });
    await page.waitForTimeout(400);
    await check(page, `live admin sign-in @ ${vp.name}`);
    await page.close();
  }
  await browser.close();
  console.log(fails.length ? `LIVE RESPONSIVE FAILURES: ${fails.length}` : "LIVE RESPONSIVE ALL GREEN");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error("CRASH", e.message); process.exit(2); });
