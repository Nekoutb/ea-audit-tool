/* eslint-disable @typescript-eslint/no-require-imports -- scratch script */
/* Guided onboarding walkthrough against the lms dev server on :3000. */
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const fails = [];
  const ok = (label, cond) => { console.log(`${cond ? "PASS" : "FAIL"} ${label}`); if (!cond) fails.push(label); };

  await page.goto("http://localhost:3000/admin", { waitUntil: "networkidle" });
  ok("admin page loads", (await page.textContent("h1")) === "Platform administration");

  // --- Stage 1: welcome ---
  await page.click("text=+ Onboard organization");
  await page.waitForSelector("#tenant-wizard-title");
  ok("welcome headline", /Let’s get your next client learning/.test(await page.textContent("#tenant-wizard-title")));
  ok("time expectation shown", await page.isVisible("text=about 2 minutes"));
  ok("focus moved to heading", await page.evaluate(() => document.activeElement?.id === "tenant-wizard-title"));

  // --- Stage 2: goal ---
  await page.click("text=Get started →");
  ok("goal step counted", /Step 1 of 3/.test(await page.textContent(".wizard-step-label")));
  ok("four goal cards", (await page.$$(".wizard-goal-card")).length === 4);
  ok("primary card flagged", await page.isVisible(".wizard-goal-card.primary >> text=MOST COMMON"));
  await page.click(".wizard-goal-card.primary");

  // --- Stage 3: setup + validation-on-continue ---
  ok("setup step counted", /Step 2 of 3/.test(await page.textContent(".wizard-step-label")));
  await page.click("text=Continue to review →");
  ok("error summary appears only after continue", await page.isVisible("#ob-error-summary"));
  ok("summary focused", await page.evaluate(() => document.activeElement?.id === "ob-error-summary"));
  const issueCount = await page.$$eval("#ob-error-summary li", (els) => els.length);
  ok(`summary lists issues (${issueCount})`, issueCount >= 3);

  await page.fill("#ob-company-name", "Société Générale Cameroun");
  ok("slug derives", (await page.inputValue("#ob-academy-address")) === "societe-generale-cameroun");
  await page.fill("#ob-academy-address", "email");
  ok("reserved name rejected", await page.isVisible("text=reserved for platform infrastructure"));
  await page.fill("#ob-academy-address", "societe-generale-cameroun");
  await page.fill("#ob-admin-name", "Aline Mbarga");
  await page.fill("#ob-admin-email", "aline.mbarga@socgen.example");

  // --- Draft persistence: close, reopen, resume ---
  await page.click("button[aria-label='Close onboarding — your progress is saved']");
  ok("close notes saved progress", /progress is saved/i.test(await page.textContent(".admin-success")));
  await page.click("text=+ Onboard organization");
  ok("resume banner offered", await page.isVisible(".wizard-resume >> text=Société Générale Cameroun"));
  await page.click(".wizard-resume-actions >> text=Continue");
  ok("resume restores setup stage", /Step 2 of 3/.test(await page.textContent(".wizard-step-label")));
  ok("resume restores values", (await page.inputValue("#ob-admin-email")) === "aline.mbarga@socgen.example");

  // --- Stage 4: review + idempotent create ---
  await page.click("text=Continue to review →");
  ok("review step counted", /Step 3 of 3/.test(await page.textContent(".wizard-step-label")));
  ok("review shows academy + admin", await page.isVisible("text=societe-generale-cameroun.ealearnings.com") && await page.isVisible("text=aline.mbarga@socgen.example"));
  await page.screenshot({ path: "../../lms/_shot-guided-review.png" });
  const createBtn = page.locator("button:has-text('Create organization →')");
  await Promise.all([createBtn.click(), createBtn.click().catch(() => {})]);

  // --- Stage 5: success ---
  await page.waitForSelector(".wizard-success");
  ok("success names the client", /Société Générale Cameroun is ready/.test(await page.textContent("#tenant-wizard-title")));
  await page.waitForSelector(".wizard-invite-status.needs-configuration");
  ok("invite status is truthful without mail token", /email dispatch is not configured/.test(await page.textContent(".wizard-invite-status")));
  await page.screenshot({ path: "../../lms/_shot-guided-success.png" });
  await page.click("text=Open organization →");
  await page.waitForSelector(".admin-drawer");
  ok("open action lands in drawer", await page.isVisible(".admin-drawer >> text=aline.mbarga@socgen.example"));

  // Idempotence: double-click created exactly one tenant
  const rows = await page.$$eval(".tenant-register > div", (els) => els.map((el) => el.textContent || ""));
  ok("no duplicate tenant", rows.filter((t) => t.includes("societe-generale-cameroun")).length === 1);

  // Analytics ledger recorded the journey
  const events = await page.evaluate(() => JSON.parse(localStorage.getItem("ea-onboarding-events:v1") ?? "[]").map((e) => e.name));
  for (const expected of ["wizard_started", "goal_selected", "validation_error", "wizard_resumed", "organisation_created", "success_action_used"]) {
    ok(`event recorded: ${expected}`, events.includes(expected));
  }

  // Draft cleared after success
  const draft = await page.evaluate(() => localStorage.getItem("ea-onboarding-draft:v1"));
  ok("draft cleared after create", draft === null);

  await browser.close();
  console.log(fails.length ? `E2E FAILURES: ${fails.length}` : "E2E ALL GREEN");
  process.exit(fails.length ? 1 : 0);
})().catch((err) => { console.error("E2E CRASH", err); process.exit(2); });
