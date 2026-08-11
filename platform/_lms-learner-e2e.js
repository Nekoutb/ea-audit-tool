/* eslint-disable @typescript-eslint/no-require-imports -- scratch script */
/* Proves the three reported defects are fixed:
   1. a learner sees only the courses assigned to them
   2. the workspace shows the signed-in person, not another account
   3. the learner can sign out                                              */
const { chromium } = require("playwright");
const { webcrypto } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const LMS = path.join("C:", "Users", "UltraBook 3.1", "Documents", "AI Projects", "lms");
const BASE = "http://localhost:3000";
const ADMIN_PASS = "Str0ngPass!2026";
const LEARNER_PASS = "L3arnerPass!2026";

// Mirrors app/auth/core.ts so the test can seed a known learner password.
async function derive(password, saltB64) {
  const salt = Uint8Array.from(Buffer.from(saltB64, "base64"));
  const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await webcrypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 210000 }, key, 256);
  return Buffer.from(new Uint8Array(bits)).toString("base64");
}

function sqlite(sql) {
  const script = `
import sqlite3,glob,sys
f=[p for p in glob.glob(r"${LMS}\\\\.wrangler/state/v3/d1/**/*.sqlite",recursive=True) if "miniflare-D1" in p]
c=sqlite3.connect(f[0]);cur=c.cursor();cur.execute(sys.argv[1]);
rows=cur.fetchall();c.commit();print(rows)
`;
  return execFileSync("python", ["-c", script, sql], { encoding: "utf8" }).trim();
}

(async () => {
  const fails = [];
  const ok = (label, cond) => { console.log(`${cond ? "PASS" : "FAIL"} ${label}`); if (!cond) fails.push(label); };
  const browser = await chromium.launch();
  const admin = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  // --- Public site is served to anonymous visitors, workspace is not ---
  await admin.goto(BASE, { waitUntil: "networkidle" });
  const publicText = await admin.textContent("body");
  ok("anonymous visitor gets the public site", /Build confident people|Sign in/i.test(publicText));
  ok("no workspace or foreign identity leaked anonymously", !/Boma Nekout|Learner workspace/.test(publicText));

  // --- Admin signs in via /admin and completes the forced change ---
  await admin.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await admin.waitForSelector(".admin-login-card");
  await admin.fill('.admin-login-card input[type="email"]', "support@ealearnings.com");
  await admin.fill('.admin-login-card input[type="password"]', "admin");
  await admin.click(".admin-login-card .auth-submit");
  await admin.waitForFunction(() => /Choose a new password/.test(document.querySelector(".admin-login-card h1")?.textContent || ""), { timeout: 15000 });
  const pw = await admin.$$(".admin-login-card input[type=password]");
  await pw[0].fill("admin"); await pw[1].fill(ADMIN_PASS); await pw[2].fill(ADMIN_PASS);
  await admin.click(".admin-login-card .auth-submit");
  await admin.waitForSelector(".admin-identity-bar", { timeout: 15000 });
  ok("admin console reached", true);

  // --- Onboard an organisation ---
  await admin.click("text=+ Onboard organization");
  await admin.waitForSelector("#tenant-wizard-title");
  await admin.click("text=Get started →");
  await admin.click(".wizard-goal-card.primary");
  await admin.fill("#ob-company-name", "Harbour Freight Ltd");
  await admin.fill("#ob-admin-name", "Ada Manager");
  await admin.fill("#ob-admin-email", "ada@harbour.example");
  await admin.click("text=Continue to review →");
  await admin.waitForSelector(".wizard-review");
  await admin.click("button:has-text('Create organization →')");
  await admin.waitForSelector(".wizard-invite-status:not(.sending)", { timeout: 30000 });

  // --- Add an employee with exactly ONE course ---
  await admin.click("button:has-text('Add employees')");
  await admin.waitForSelector("#employee-wizard-title");
  await admin.fill(".admin-wizard.compact .wizard-field-row input >> nth=0", "Sam Learner");
  await admin.fill('.admin-wizard.compact input[placeholder="name@company.com"]', "sam@harbour.example");
  const boxes = await admin.$$(".admin-wizard.compact .assignment-course-choices input:checked");
  for (let i = 1; i < boxes.length; i++) await boxes[i].click();
  const chosen = await admin.$$eval(".admin-wizard.compact .assignment-course-choices input:checked", (els) => els.length);
  ok(`exactly one course selected for the employee (${chosen})`, chosen === 1);
  await admin.click("button:has-text('Add and invite →')");
  await admin.waitForFunction(() => !/sending the invitation/i.test(document.querySelector(".admin-success")?.textContent || ""), { timeout: 30000 });

  // --- The server stored exactly that one course ---
  const stored = sqlite("select email,assigned_courses from users where email='sam@harbour.example'");
  console.log("   stored:", stored);
  const storedCount = (stored.match(/"/g) || []).length / 2;
  ok(`server stored one assigned course for the learner (${storedCount})`, storedCount === 1);

  // --- Give the learner a known password (stands in for the emailed link) ---
  const salt = Buffer.from(webcrypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const hash = await derive(LEARNER_PASS, salt);
  sqlite(`update users set password_hash='${hash}', password_salt='${salt}', must_change_password=0 where email='sam@harbour.example'`);

  // --- The learner signs in on a clean session ---
  const learner = await browser.newContext();
  const page = await learner.newPage();
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click(".gateway-sign-in, .gateway-cta");
  await page.waitForSelector(".admin-login-card", { timeout: 15000 });
  await page.fill('.admin-login-card input[type="email"]', "sam@harbour.example");
  await page.fill('.admin-login-card input[type="password"]', LEARNER_PASS);
  await page.click(".admin-login-card .auth-submit");
  await page.waitForSelector(".app-shell", { timeout: 20000 });

  // 1. Only the assigned course is visible
  await page.click(".app-sidebar nav button >> nth=1").catch(() => {});
  const bodyText = await page.textContent(".app-content");
  const titles = ["Anti-Money Laundering", "Anti-corruption", "Ethics", "Environmental Compliance", "Anti-bribery", "Information Security", "Conflict of Interest"];
  const shown = titles.filter((title) => bodyText.includes(title));
  console.log("   courses visible to learner:", shown);
  ok(`learner sees only their assigned course (${shown.length} of 7)`, shown.length === 1);

  // 2. The learner sees their own identity
  const header = await page.textContent(".app-frame .app-header");
  ok("workspace shows the signed-in learner", /Sam Learner|sam@harbour.example/.test(header));
  ok("no other account is shown", !/Boma Nekout/.test(header));
  ok("organisation is the learner's own", /Harbour Freight/i.test(await page.textContent(".app-sidebar")));

  // 3. Sign out exists and works
  await page.click(".profile-control > button");
  await page.waitForSelector(".profile-menu");
  ok("sign out is offered", await page.isVisible(".profile-signout"));
  ok("no workspace switcher for a learner", !/Organisation workspace/.test(await page.textContent(".profile-menu")));
  await page.click(".profile-signout");
  await page.waitForFunction(() => !document.querySelector(".app-shell"), { timeout: 15000 });
  const after = await page.textContent("body");
  ok("signing out returns to the public site", /Sign in/i.test(after) && !/Sam Learner/.test(after));

  await browser.close();
  console.log(fails.length ? `LEARNER E2E FAILURES: ${fails.length} (${fails.join("; ")})` : "LEARNER E2E ALL GREEN");
  process.exit(fails.length ? 1 : 0);
})().catch((err) => { console.error("LEARNER E2E CRASH", err); process.exit(2); });
