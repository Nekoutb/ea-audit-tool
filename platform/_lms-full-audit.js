/* eslint-disable @typescript-eslint/no-require-imports -- scratch script */
/* Functional fixes + responsive audit of every page/state and viewport. */
const { chromium } = require("playwright");
const { webcrypto } = require("node:crypto");
const { execFileSync } = require("node:child_process");

const LMS = "C:\\Users\\UltraBook 3.1\\Documents\\AI Projects\\lms";
const BASE = "http://localhost:3000";
const ADMIN = "support@ealearnings.com";
const ADMIN_PASS = "Str0ngPass!2026";
const LEARNER_PASS = "L3arnerPass!2026";

const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 740 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "short-380x560", width: 380, height: 560 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "laptop-1024", width: 1024, height: 768 },
  { name: "desktop-1440", width: 1440, height: 900 },
];

const fails = [];
const ok = (label, cond, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"} ${label}${detail ? " — " + detail : ""}`);
  if (!cond) fails.push(label);
};

async function derive(password, saltB64) {
  const salt = Uint8Array.from(Buffer.from(saltB64, "base64"));
  const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await webcrypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 210000 }, key, 256);
  return Buffer.from(new Uint8Array(bits)).toString("base64");
}

function sqlite(sql) {
  const script = `
import sqlite3,glob,sys
f=[p for p in glob.glob(r"${LMS}\\.wrangler/state/v3/d1/**/*.sqlite",recursive=True) if "miniflare-D1" in p]
c=sqlite3.connect(f[0]);cur=c.cursor();cur.execute(sys.argv[1]);rows=cur.fetchall();c.commit();print(rows)
`;
  return execFileSync("python", ["-c", script, sql], { encoding: "utf8" }).trim();
}

// Reports layout defects: page-level sideways scroll, elements past the right
// edge, and controls too small to tap.
async function audit(page, label) {
  const report = await page.evaluate(() => {
    const vw = window.innerWidth;
    const doc = document.scrollingElement;
    const overflowing = [];
    for (const el of document.querySelectorAll("body *")) {
      const style = getComputedStyle(el);
      if (style.display === "none" || style.visibility === "hidden" || style.position === "fixed") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 2 || r.left < -2) {
        overflowing.push(`${el.tagName.toLowerCase()}.${(el.className || "").toString().split(" ")[0]} right=${Math.round(r.right)}`);
      }
    }
    const tiny = [];
    for (const el of document.querySelectorAll("button, a[href], input, select")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.height < 22) tiny.push(`${el.tagName.toLowerCase()}:${(el.textContent || "").trim().slice(0, 18)} h=${Math.round(r.height)}`);
    }
    return {
      hScroll: doc.scrollWidth - vw,
      overflowing: overflowing.slice(0, 4),
      overflowCount: overflowing.length,
      tiny: tiny.slice(0, 3),
      tinyCount: tiny.length,
    };
  });
  const clean = report.hScroll <= 2 && report.overflowCount === 0;
  ok(`responsive ${label}`, clean, clean ? "" : `hScroll=${report.hScroll} overflow=${report.overflowCount} ${JSON.stringify(report.overflowing)}`);
  if (report.tinyCount) console.log(`     note: ${report.tinyCount} controls under 22px tall e.g. ${JSON.stringify(report.tiny)}`);
  return clean;
}

async function sweep(page, label, viewports = VIEWPORTS) {
  for (const vp of viewports) {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.waitForTimeout(220);
    await audit(page, `${label} @ ${vp.name}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.waitForTimeout(150);
}

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();

  // ---------- PUBLIC ----------
  await page.goto(BASE, { waitUntil: "networkidle" });
  await sweep(page, "public site");

  // ---------- SIGN-IN ----------
  await page.click(".gateway-sign-in");
  await page.waitForSelector(".admin-login-card");
  await sweep(page, "learner sign-in");

  // ---------- ADMIN CONSOLE ----------
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await page.waitForSelector(".admin-login-card");
  await sweep(page, "admin sign-in");
  await page.fill('.admin-login-card input[type="email"]', ADMIN);
  await page.fill('.admin-login-card input[type="password"]', "admin");
  await page.click(".admin-login-card .auth-submit");
  await page.waitForFunction(() => /Choose a new password/.test(document.querySelector(".admin-login-card h1")?.textContent || ""), { timeout: 15000 });
  await sweep(page, "forced password change");
  const pw = await page.$$(".admin-login-card input[type=password]");
  await pw[0].fill("admin"); await pw[1].fill(ADMIN_PASS); await pw[2].fill(ADMIN_PASS);
  await page.click(".admin-login-card .auth-submit");
  await page.waitForSelector(".admin-identity-bar", { timeout: 15000 });
  await sweep(page, "admin console");

  // Onboarding wizard at each stage
  await page.click("text=+ Onboard organization");
  await page.waitForSelector("#tenant-wizard-title");
  await sweep(page, "onboarding welcome");
  await page.click("text=Get started →");
  await page.click(".wizard-goal-card.primary");
  await page.fill("#ob-company-name", "Meridian Shipping");
  await page.fill("#ob-admin-name", "Grace Ndoumbe");
  await page.fill("#ob-admin-email", "grace@meridian.example");
  await sweep(page, "onboarding setup");
  await page.click("text=Continue to review →");
  await page.waitForSelector(".wizard-review");
  await sweep(page, "onboarding review");
  await page.click("button:has-text('Create organization →')");
  await page.waitForSelector(".wizard-invite-status:not(.sending)", { timeout: 30000 });
  await sweep(page, "onboarding success");
  await page.click(".admin-wizard > header > button");

  // ---------- LEARNER APP AS ADMIN ----------
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.click(".gateway-sign-in");
  await page.waitForSelector(".app-shell, .admin-login-card", { timeout: 15000 });
  if (await page.isVisible(".admin-login-card")) {
    await page.fill('.admin-login-card input[type="email"]', ADMIN);
    await page.fill('.admin-login-card input[type="password"]', ADMIN_PASS);
    await page.click(".admin-login-card .auth-submit");
  }
  await page.waitForSelector(".app-shell", { timeout: 20000 });

  // Greeting must name the signed-in person, never a hardcoded one
  const greeting = await page.textContent(".workspace-title h1, .learner-hero h1").catch(() => "");
  const bodyNow = await page.textContent(".app-content");
  ok("greeting is not hardcoded to another person", !/Boma\b/.test(bodyNow), greeting ? `greeting="${greeting.trim()}"` : "");

  // Sidebar navigation actually navigates
  const navButtons = await page.$$(".app-sidebar nav button");
  ok(`sidebar has navigation entries (${navButtons.length})`, navButtons.length >= 4);
  let navWorked = 0;
  for (let i = 0; i < navButtons.length; i++) {
    const before = await page.textContent(".app-content");
    await navButtons[i].click();
    await page.waitForTimeout(320);
    const after = await page.textContent(".app-content");
    const activeMoved = await page.$eval(".app-sidebar nav", (nav, idx) => {
      const buttons = [...nav.querySelectorAll("button")];
      return buttons[idx]?.classList.contains("active") || false;
    }, i).catch(() => false);
    if (before !== after || activeMoved) navWorked++;
  }
  ok(`every sidebar entry responds (${navWorked}/${navButtons.length})`, navWorked === navButtons.length);

  // Learner views responsive
  for (const view of ["Home", "My Learning", "Notes", "Settings"]) {
    const btn = await page.$(`.app-sidebar nav button:has-text("${view}")`);
    if (btn) { await btn.click(); await page.waitForTimeout(280); await sweep(page, `learner ${view.toLowerCase()}`, VIEWPORTS.slice(0, 4)); }
  }

  // ---------- ORG WORKSPACE + LEARNERS MANAGEMENT ----------
  const orgBtn = await page.$('.app-sidebar nav button:has-text("Organization overview")');
  if (orgBtn) await orgBtn.click(); else { await page.click(".profile-control > button"); await page.click("text=Organisation workspace"); }
  await page.waitForSelector(".metric-row, .org-people-list", { timeout: 15000 });
  await sweep(page, "organisation overview");

  await page.click('.app-sidebar nav button:has-text("Learners")');
  await page.waitForSelector(".org-learner-table, .admin-empty-state", { timeout: 15000 });
  ok("Learners page reachable from the sidebar", true);
  await sweep(page, "organisation learners");

  // Add a learner with one course
  await page.click("button:has-text('+ Add learner')");
  await page.waitForSelector("#add-learner-title");
  await sweep(page, "add learner dialog", VIEWPORTS.slice(0, 4));
  await page.fill('.admin-wizard input[placeholder="name@company.com"]', "rita@elite.example");
  await page.fill('.admin-wizard .wizard-field-row input >> nth=0', "Rita Ngu");
  await page.click(".admin-wizard .assignment-course-choices label >> nth=0");
  await page.click("button:has-text('Add and invite →')");
  await page.waitForSelector(".admin-success", { timeout: 30000 });
  await page.waitForSelector(".org-learner-table", { timeout: 15000 });
  const rosterText = await page.textContent(".org-learner-table");
  ok("added learner appears in the roster", /rita@elite\.example/.test(rosterText));
  ok("their assigned course is listed", /Anti-Money Laundering|Anti-corruption|Ethics/.test(rosterText));

  // The learner really only sees that course
  const salt = Buffer.from(webcrypto.getRandomValues(new Uint8Array(16))).toString("base64");
  const hash = await derive(LEARNER_PASS, salt);
  sqlite(`update users set password_hash='${hash}', password_salt='${salt}', must_change_password=0 where email='rita@elite.example'`);
  const learnerCtx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const lp = await learnerCtx.newPage();
  await lp.goto(BASE, { waitUntil: "networkidle" });
  await lp.click(".gateway-sign-in");
  await lp.waitForSelector(".admin-login-card");
  await lp.fill('.admin-login-card input[type="email"]', "rita@elite.example");
  await lp.fill('.admin-login-card input[type="password"]', LEARNER_PASS);
  await lp.click(".admin-login-card .auth-submit");
  await lp.waitForSelector(".app-shell", { timeout: 20000 });
  const learnerBody = await lp.textContent(".app-content");
  const titles = ["Anti-Money Laundering", "Anti-corruption", "Ethics", "Environmental Compliance", "Anti-bribery", "Information Security", "Conflict of Interest"];
  await lp.click('.app-sidebar nav button:has-text("My Learning")').catch(() => {});
  await lp.waitForTimeout(300);
  const learningBody = await lp.textContent(".app-content");
  const seen = titles.filter((x) => learningBody.includes(x));
  ok(`learner sees only their assigned course (${seen.length})`, seen.length === 1, JSON.stringify(seen));
  ok("learner greeted by their own name", /Rita/.test(learnerBody) || /Rita/.test(await lp.textContent(".app-header")));
  ok("learner has no Learners admin entry", !/Learners/.test(await lp.textContent(".app-sidebar")));
  await sweep(lp, "learner workspace (learner role)", VIEWPORTS);

  // Course player responsiveness
  const startBtn = await lp.$(".learner-course-grid button, .learner-hero button");
  if (startBtn) {
    await startBtn.click();
    await lp.waitForTimeout(1200);
    await sweep(lp, "course player", VIEWPORTS.slice(0, 5));
  }

  // ---------- REMOVE ----------
  await page.click(".org-learner-actions button:has-text('Remove')");
  await page.waitForSelector("button:has-text('Confirm removal')");
  await page.click("button:has-text('Confirm removal')");
  await page.waitForSelector(".admin-success", { timeout: 20000 });
  await page.waitForTimeout(600);
  const afterRemoval = await page.textContent(".workspace-panel");
  ok("removed learner disappears from the roster", !/rita@elite\.example/.test(afterRemoval));
  const dbAfter = sqlite("select count(*) from users where email='rita@elite.example'");
  ok("removed learner is deleted server-side", /\(0,\)/.test(dbAfter), dbAfter);

  await browser.close();
  console.log(fails.length ? `\nAUDIT FAILURES: ${fails.length}\n - ${fails.join("\n - ")}` : "\nFULL AUDIT ALL GREEN");
  process.exit(fails.length ? 1 : 0);
})().catch((err) => { console.error("AUDIT CRASH", err); process.exit(2); });
