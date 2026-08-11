/* eslint-disable @typescript-eslint/no-require-imports -- scratch */
const { chromium } = require("playwright");
const BASE = "https://ealearnings.com";
const fails = [];
const ok = (l, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"} ${l}${d ? " — " + d : ""}`); if (!c) fails.push(l); };
(async () => {
  const b = await chromium.launch();
  const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.fill('.admin-login-card input[type="email"]', "support@ealearnings.com");
  await page.fill('.admin-login-card input[type="password"]', "admin");
  await page.click(".admin-login-card .auth-submit");
  await page.waitForTimeout(2500);
  if (await page.evaluate(() => /Choose a new password/.test(document.querySelector(".admin-login-card h1")?.textContent || ""))) {
    const pw = await page.$$(".admin-login-card input[type=password]");
    await pw[0].fill("admin"); await pw[1].fill("Str0ngPass!2026"); await pw[2].fill("Str0ngPass!2026");
    await page.click(".admin-login-card .auth-submit");
  } else if (await page.$(".admin-login-card")) {
    await page.fill('.admin-login-card input[type="email"]', "support@ealearnings.com");
    await page.fill('.admin-login-card input[type="password"]', "Str0ngPass!2026");
    await page.click(".admin-login-card .auth-submit");
  }
  await page.waitForSelector(".admin-identity-bar", { timeout: 20000 });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click(".gateway-sign-in");
  await page.waitForSelector(".app-shell", { timeout: 20000 });

  const labelsOf = () => page.$$eval(".app-sidebar nav button", (bs) => bs.map((x) => x.textContent.replace(/^\d+/, "").trim()));
  const baseline = await labelsOf();
  console.log("   menu:", JSON.stringify(baseline));
  ok("no duplicate label in the menu", new Set(baseline).size === baseline.length,
     new Set(baseline).size === baseline.length ? "" : "dupes present");

  // Walk EVERY entry: the menu must stay identical and exactly one item active.
  for (let i = 0; i < baseline.length; i++) {
    const btns = await page.$$(".app-sidebar nav button");
    await btns[i].click();
    await page.waitForTimeout(400);
    const after = await labelsOf();
    const same = JSON.stringify(after) === JSON.stringify(baseline);
    const activeCount = await page.$$eval(".app-sidebar nav button.active", (b) => b.length);
    const activeLabel = await page.$$eval(".app-sidebar nav button.active", (b) => b.map((x) => x.textContent.replace(/^\d+/, "").trim())[0] || "");
    ok(`"${baseline[i]}" keeps one stable menu`, same && activeCount === 1 && activeLabel === baseline[i],
       same ? `active=${activeCount} (${activeLabel})` : `menu changed to ${JSON.stringify(after)}`);
  }
  await page.screenshot({ path: "../../lms/_shot-nav-fixed.png" });
  await b.close();
  console.log(fails.length ? `FAILURES: ${fails.length}` : "NAVIGATION SINGLE-MENU ALL GREEN");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error("CRASH", e.message); process.exit(2); });
