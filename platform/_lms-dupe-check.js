/* eslint-disable @typescript-eslint/no-require-imports -- scratch */
const { chromium } = require("playwright");
const BASE = "http://localhost:3000";
const fails = [];
const ok = (l, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"} ${l}${d ? " — " + d : ""}`); if (!c) fails.push(l); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, locale: "en-GB" });
  // Pin the interface to English so the selectors below are stable.
  await ctx.addInitScript(() => { try { localStorage.setItem("ea-language", "EN"); } catch {} });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.waitForSelector(".admin-login-card", { timeout: 20000 });
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
    // Seed password already rotated by an earlier run.
    await page.fill('.admin-login-card input[type="email"]', "support@ealearnings.com");
    await page.fill('.admin-login-card input[type="password"]', "Str0ngPass!2026");
    await page.click(".admin-login-card .auth-submit");
  }
  await page.waitForSelector(".admin-identity-bar", { timeout: 20000 });

  await page.click("text=+ Onboard organization");
  await page.waitForSelector("#tenant-wizard-title");
  await page.click(".wizard-welcome button.red-button, button:has-text('Get started')");
  await page.click(".wizard-goal-card.primary");

  // "Elite Advisors" already exists as the seeded platform organisation.
  await page.fill("#ob-company-name", "Elite Advisors");
  await page.fill("#ob-admin-name", "Someone Else");
  await page.fill("#ob-admin-email", "someone@elite.example");
  await page.click("text=Continue to review →");
  await page.waitForTimeout(500);
  const err = await page.textContent(".wizard-error-summary, .field-error").catch(() => "");
  ok("duplicate company name is refused", /already on the platform/.test(err || ""), (err || "").slice(0, 100));
  ok("wizard did not advance to review", !(await page.$(".wizard-review")));

  // A genuinely new name still works.
  await page.fill("#ob-company-name", "Kribi Port Services");
  await page.waitForTimeout(300);
  await page.click("text=Continue to review →");
  await page.waitForSelector(".wizard-review", { timeout: 10000 });
  ok("a new company still proceeds", true);

  await b.close();
  console.log(fails.length ? `FAILURES: ${fails.length}` : "DUPLICATE GUARD ALL GREEN");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error("CRASH", e.message); process.exit(2); });
