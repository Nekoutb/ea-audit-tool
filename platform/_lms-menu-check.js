/* eslint-disable @typescript-eslint/no-require-imports -- scratch */
const { chromium } = require("playwright");
const BASE = "http://localhost:3000";
const fails = [];
const ok = (l, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"} ${l}${d ? " — " + d : ""}`); if (!c) fails.push(l); };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  // Sign in as the platform admin, completing the first-login change if this
  // database is still on the seed password.
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.fill('.admin-login-card input[type="email"]', "support@ealearnings.com");
  await page.fill('.admin-login-card input[type="password"]', "admin");
  await page.click(".admin-login-card .auth-submit");
  await page.waitForTimeout(2500);
  const needsChange = await page.evaluate(() => /Choose a new password/.test(document.querySelector(".admin-login-card h1")?.textContent || ""));
  if (needsChange) {
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

  ok("no header tab strip", (await page.$$(".learner-view-switch")).length === 0);
  ok("no profile dropdown in header", (await page.$$(".profile-control")).length === 0);
  ok("no second menu anywhere", (await page.$$(".profile-menu")).length === 0);
  ok("sidebar shows the account", await page.isVisible(".sidebar-who"));
  ok("sign out is in the left pane", await page.isVisible(".sidebar-exit.is-signout"));
  ok("public website link is in the left pane", (await page.textContent(".sidebar-account")).match(/Public website|Site public/) !== null);

  const navLabels = await page.$$eval(".app-sidebar nav button", (b) => b.map((x) => x.textContent.replace(/^\d+/, "").trim()));
  console.log("   sidebar menu:", JSON.stringify(navLabels));
  ok(`sidebar carries every destination (${navLabels.length})`, navLabels.length >= 5);
  const headerText = await page.textContent(".app-header");
  const dupes = navLabels.filter((l) => headerText.includes(l));
  ok("no menu item duplicated in the header", dupes.length === 0, dupes.length ? JSON.stringify(dupes) : "");

  // language consistency: sidebar labels vs body copy
  const lang = await page.$eval(".language-switch button.active", (b) => b.textContent.trim());
  const heading = await page.textContent(".learner-command-bar h1");
  console.log("   active language:", lang, "| heading:", heading.trim());

  // every entry still navigates
  const btns = await page.$$(".app-sidebar nav button");
  let worked = 0;
  for (let i = 0; i < btns.length; i++) {
    const before = await page.textContent(".app-content");
    await btns[i].click(); await page.waitForTimeout(300);
    if (await page.textContent(".app-content") !== before || await btns[i].evaluate((e) => e.classList.contains("active"))) worked++;
  }
  ok(`all ${btns.length} entries navigate`, worked === btns.length, `${worked}/${btns.length}`);

  for (const [w, h] of [[360, 740], [768, 1024], [1440, 900]]) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(250);
    const over = await page.evaluate(() => document.scrollingElement.scrollWidth - window.innerWidth);
    ok(`no overflow @ ${w}px`, over <= 2, `hScroll=${over}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.screenshot({ path: "../../lms/_shot-unified-menu.png" });
  await browser.close();
  console.log(fails.length ? `FAILURES: ${fails.length}` : "MENU UNIFICATION ALL GREEN");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error("CRASH", e.message); process.exit(2); });
