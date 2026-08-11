/* eslint-disable @typescript-eslint/no-require-imports -- scratch */
const { chromium } = require("playwright");
const BASE = "http://localhost:3000";
const fails = [];
const ok = (l, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"} ${l}${d ? " — " + d : ""}`); if (!c) fails.push(l); };
const FRENCH = ["Nom de l’entreprise", "Adresse de l’académie", "Continuer vers la vérification", "Langue par défaut", "Pays"];
const ENGLISH = ["Company name", "Academy address", "Continue to review", "Default language", "Country"];

(async () => {
  const b = await chromium.launch();
  // A French browser, which is what produced the mixed screen.
  const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, locale: "fr-FR" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.waitForSelector(".admin-login-card", { timeout: 20000 });

  ok("sign-in offers a language switch", await page.isVisible(".card-language-switch .language-switch"));
  await page.click('.card-language-switch button:has-text("EN")');
  await page.waitForTimeout(300);
  ok("sign-in switches to English", /Sign in/.test(await page.textContent(".admin-login-card h1")));

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
  ok("console offers a language switch", await page.isVisible(".admin-identity-bar .language-switch"));

  // Open the wizard to the step from the screenshot and check for mixing.
  const openWizard = async () => {
    await page.click(".workspace-title button.red-button");
    await page.waitForSelector("#tenant-wizard-title");
    // A saved draft offers to resume; start clean so the goal step appears.
    const fresh = await page.$(".wizard-resume button:not(.red-button)");
    if (fresh) { await fresh.click(); await page.waitForTimeout(300); }
    const start = await page.$(".admin-wizard footer button.red-button");
    if (start) { await start.click(); await page.waitForTimeout(400); }
    const card = await page.$(".wizard-goal-card.primary");
    if (card) { await card.click(); await page.waitForTimeout(400); }
  };
  await openWizard();
  let body = await page.textContent(".admin-wizard");
  let frenchLeaks = FRENCH.filter((w) => body.includes(w));
  ok("English mode has no French left in the wizard", frenchLeaks.length === 0, JSON.stringify(frenchLeaks));
  ok("English labels are present", ENGLISH.filter((w) => body.includes(w)).length >= 4);
  await page.screenshot({ path: "../../lms/_shot-wizard-en.png" });

  // Switch to French and confirm the whole step follows.
  await page.click(".admin-wizard > header > button");
  await page.click('.admin-identity-bar .language-switch button:has-text("FR")');
  await page.waitForTimeout(400);
  await openWizard();
  body = await page.textContent(".admin-wizard");
  const englishLeaks = ENGLISH.filter((w) => body.includes(w));
  ok("French mode has no English left in the wizard", englishLeaks.length === 0, JSON.stringify(englishLeaks));
  ok("French labels are present", FRENCH.filter((w) => body.includes(w)).length >= 4);
  await page.screenshot({ path: "../../lms/_shot-wizard-fr.png" });

  await b.close();
  console.log(fails.length ? `\nFAILURES: ${fails.length}` : "\nLANGUAGE SWITCH ALL GREEN");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error("CRASH", e.message); process.exit(2); });
