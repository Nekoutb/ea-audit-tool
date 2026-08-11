/* eslint-disable @typescript-eslint/no-require-imports -- scratch script */
/* User-directed live email test against ealearnings.com/admin:
   onboard test org (admin boma.nekout@cm-ea.com), add employee
   nekoutboma10@yahoo.com with one course, create one assignment. */
const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36",
  });
  const log = (label, value) => console.log(`${label}: ${value}`);
  page.on("response", (r) => {
    if (r.url().includes("/api/invitation")) {
      r.text().then((t) => console.log("INVITE_RESP", r.status(), JSON.stringify(t.slice(0, 160)))).catch(() => {});
    }
  });

  await page.goto("https://ealearnings.com/admin", { waitUntil: "domcontentloaded", timeout: 45000 });
  try {
    await page.waitForSelector("h1:has-text('Platform administration')", { timeout: 45000 });
  } catch (err) {
    console.log("PAGE TITLE:", await page.title());
    await page.screenshot({ path: "../../lms/_shot-live-blocked.png" });
    throw err;
  }
  log("admin page", await page.textContent("h1"));

  // --- Onboard the test organisation ---
  await page.click("text=+ Onboard organization");
  await page.waitForSelector("#tenant-wizard-title");
  await page.click("text=Get started →");
  await page.click(".wizard-goal-card.primary");
  await page.fill("#ob-company-name", "Tamarind Trading Test Co");
  await page.fill("#ob-admin-name", "Boma Nekout");
  await page.fill("#ob-admin-email", "boma.nekout@cm-ea.com");
  await page.click("text=Continue to review →");
  await page.waitForSelector(".wizard-review");
  await page.click("button:has-text('Create organization →')");
  await page.waitForSelector(".wizard-invite-status:not(.sending)", { timeout: 30000 });
  const adminInvite = await page.textContent(".wizard-invite-status");
  log("ADMIN INVITE STATUS", adminInvite.trim());
  await page.screenshot({ path: "../../lms/_shot-live-admininvite.png" });

  // --- Add the employee with exactly one course ---
  await page.click("button:has-text('Add employees')");
  await page.waitForSelector("#employee-wizard-title");
  await page.fill(".admin-wizard.compact .wizard-field-row input >> nth=0", "Nekout Boma");
  await page.fill('.admin-wizard.compact input[placeholder="name@company.com"]', "nekoutboma10@yahoo.com");
  const boxes = await page.$$(".admin-wizard.compact .assignment-course-choices input:checked");
  for (let i = 1; i < boxes.length; i++) await boxes[i].click();
  const remaining = await page.$$eval(".admin-wizard.compact .assignment-course-choices input:checked", (els) => els.length);
  log("employee courses selected", remaining);
  await page.click("button:has-text('Add and invite →')");
  await page.waitForFunction(() => {
    const el = document.querySelector(".admin-success");
    return el && !/sending the invitation/i.test(el.textContent || "");
  }, { timeout: 30000 });
  const employeeInvite = await page.textContent(".admin-success");
  log("EMPLOYEE INVITE STATUS", employeeInvite.trim());
  await page.screenshot({ path: "../../lms/_shot-live-employeeinvite.png" });

  // --- Create a one-course assignment ---
  await page.click(".tenant-admin-tabs >> text=Assignments");
  await page.click("text=+ Create assignment");
  await page.fill('.admin-wizard input[placeholder="2026 annual compliance learning"]', "Kick-off: first compliance course");
  await page.click(".assignment-course-choices label >> nth=0");
  await page.click("button:has-text('Create assignment →')");
  await page.waitForSelector(".assignment-register article");
  const assignment = await page.textContent(".assignment-register article header");
  log("ASSIGNMENT", assignment.replace(/\s+/g, " ").trim());
  await page.screenshot({ path: "../../lms/_shot-live-assignment.png" });

  await browser.close();
  console.log("LIVE MAIL TEST COMPLETE");
})().catch((err) => { console.error("LIVE TEST CRASH", err); process.exit(2); });
