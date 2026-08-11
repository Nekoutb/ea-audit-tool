/* eslint-disable @typescript-eslint/no-require-imports -- scratch */
const { chromium } = require("playwright");
const BASE = "http://localhost:3000";
const fails = [];
const ok = (l, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"} ${l}${d ? " — " + d : ""}`); if (!c) fails.push(l); };

// Words that should never survive a switch to French.
const ENGLISH_LEAKS = ["Learning preferences", "Your organisation", "No completion data yet", "Mandatory learning",
  "Notes and bookmarks", "Practical resources", "Your deadlines", "Add a learner", "Work email", "Full name",
  "Courses to assign", "This is you", "Sign out", "Public website", "No learners yet", "Manage learners",
  "Signed in at least once", "Invitations pending", "Programmes available", "Your learning record",
  "Narrator", "Playback speed", "Text size", "Course narration", "High contrast", "Reduced motion",
  "Low bandwidth", "Email reminders", "Concepts complete", "Knowledge mastery", "Mandatory learning",
  "Start course", "Not started", "In progress", "Progress saved", "Final assessments"];

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

  // Switch to French
  await page.click('.language-switch button:has-text("FR")');
  await page.waitForTimeout(500);

  const sections = ["Accueil", "Mes formations", "Notes", "Paramètres", "Vue d’ensemble", "Apprenants"];
  for (const label of sections) {
    const btn = await page.$(`.app-sidebar nav button:has-text("${label}")`);
    if (!btn) { ok(`section "${label}" present in FR menu`, false); continue; }
    await btn.click();
    await page.waitForTimeout(450);
    const text = await page.textContent(".app-content");
    const side = await page.textContent(".app-sidebar");
    const leaks = ENGLISH_LEAKS.filter((w) => text.includes(w) || side.includes(w));
    ok(`FR "${label}" has no English leak`, leaks.length === 0, leaks.length ? JSON.stringify(leaks.slice(0, 4)) : "");
  }

  // Back to English: the same surfaces must read English again.
  await page.click('.language-switch button:has-text("EN")');
  await page.waitForTimeout(500);
  const enText = await page.textContent(".app-content");
  ok("EN restores English copy", /Learners|People|Your organisation|Learning/.test(enText));
  const enSide = await page.textContent(".app-sidebar");
  ok("EN menu is English", /Home|My Learning|Settings/.test(enSide), enSide.replace(/\s+/g, " ").slice(0, 90));

  await b.close();
  console.log(fails.length ? `I18N FAILURES: ${fails.length}` : "I18N ALL GREEN");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error("CRASH", e.message); process.exit(2); });
