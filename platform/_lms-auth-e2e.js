/* eslint-disable @typescript-eslint/no-require-imports -- scratch script */
/* Auth milestone walkthrough against the lms dev server on :3000. */
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const fails = [];
  const ok = (label, cond) => { console.log(`${cond ? "PASS" : "FAIL"} ${label}`); if (!cond) fails.push(label); };
  const base = "http://localhost:3000";

  // --- Admin console is gated ---
  await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
  await page.waitForSelector(".admin-login-card, .admin-identity-bar", { timeout: 20000 });
  ok("admin console shows login when signed out", await page.isVisible(".admin-login-card"));
  ok("login screen title", /Sign in/.test(await page.textContent(".admin-login-card h1")));

  // --- Wrong password rejected ---
  await page.fill('.admin-login-card input[type="email"]', "support@ealearnings.com");
  await page.fill('.admin-login-card input[type="password"]', "wrongpass");
  await page.click(".admin-login-card .auth-submit");
  await page.waitForSelector(".admin-login-card .field-error", { timeout: 10000 });
  ok("wrong password shows error", /Incorrect email or password/.test(await page.textContent(".admin-login-card .field-error")));

  // --- Master admin login → forced password change ---
  await page.fill('.admin-login-card input[type="password"]', "admin");
  await page.click(".admin-login-card .auth-submit");
  await page.waitForSelector(".admin-login-card", { timeout: 10000 });
  await page.waitForFunction(() => /Choose a new password/.test(document.querySelector(".admin-login-card h1")?.textContent || ""), { timeout: 10000 });
  ok("seed password forces a change", true);
  await page.screenshot({ path: "../../lms/_shot-auth-forcechange.png" });

  // --- Complete the forced change ---
  const NEW_PASS = "Str0ngPass!2026";
  const changeInputs = await page.$$(".admin-login-card input[type=password]");
  await changeInputs[0].fill("admin");
  await changeInputs[1].fill(NEW_PASS);
  await changeInputs[2].fill(NEW_PASS);
  await page.click(".admin-login-card .auth-submit");
  await page.waitForSelector(".admin-identity-bar", { timeout: 15000 });
  ok("admin workspace unlocked after change", await page.isVisible(".admin-identity-bar"));
  ok("workspace renders once authed", await page.isVisible("text=Tenant register"));
  ok("identity bar names the admin", /support@ealearnings\.com|Platform Administrator/.test(await page.textContent(".admin-identity-bar")));

  // --- Settings: change password again ---
  await page.click(".admin-identity-bar >> text=Settings");
  await page.waitForSelector("#settings-title");
  ok("settings has preferences + password tabs", (await page.$$(".tenant-admin-tabs button")).length >= 2);
  await page.click('#settings-title ~ nav >> text=Password').catch(() => page.click('.tenant-admin-tabs >> text=Password'));
  const setInputs = await page.$$(".admin-wizard input[type=password]");
  await setInputs[0].fill(NEW_PASS);
  await setInputs[1].fill("An0therPass!99");
  await setInputs[2].fill("An0therPass!99");
  await page.click(".admin-wizard footer .red-button");
  await page.waitForSelector(".settings-saved", { timeout: 10000 });
  ok("settings password change succeeds", /updated/i.test(await page.textContent(".settings-saved")));
  await page.screenshot({ path: "../../lms/_shot-auth-settings.png" });
  await page.click(".admin-wizard footer .outline-button");

  // --- Sign out returns to the gate ---
  await page.click(".admin-identity-bar >> text=Sign out");
  await page.waitForSelector(".admin-login-card", { timeout: 10000 });
  ok("sign out returns to login", await page.isVisible(".admin-login-card"));

  // --- Reset request flow (any role) shows confirmation ---
  await page.click(".admin-login-card .auth-help");
  await page.fill('.admin-login-card input[type="email"]', "support@ealearnings.com");
  await page.click(".admin-login-card .auth-submit");
  await page.waitForFunction(() => /reset link is on its way/.test(document.querySelector(".admin-login-intro")?.textContent || ""), { timeout: 10000 });
  ok("reset request confirms without disclosing account", true);

  // --- Old seed password no longer works ---
  await page.goto(`${base}/admin`, { waitUntil: "networkidle" });
  await page.waitForSelector(".admin-login-card");
  await page.fill('.admin-login-card input[type="email"]', "support@ealearnings.com");
  await page.fill('.admin-login-card input[type="password"]', "admin");
  await page.click(".admin-login-card .auth-submit");
  await page.waitForSelector(".admin-login-card .field-error", { timeout: 10000 });
  ok("old seed password rejected after change", await page.isVisible(".admin-login-card .field-error"));

  // --- Final password works ---
  await page.fill('.admin-login-card input[type="password"]', "An0therPass!99");
  await page.click(".admin-login-card .auth-submit");
  await page.waitForSelector(".admin-identity-bar", { timeout: 15000 });
  ok("final password signs in", await page.isVisible(".admin-identity-bar"));

  await browser.close();
  console.log(fails.length ? `AUTH E2E FAILURES: ${fails.length} (${fails.join("; ")})` : "AUTH E2E ALL GREEN");
  process.exit(fails.length ? 1 : 0);
})().catch((err) => { console.error("AUTH E2E CRASH", err); process.exit(2); });
