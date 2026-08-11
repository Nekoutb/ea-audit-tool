/* eslint-disable @typescript-eslint/no-require-imports -- scratch script */
/* A wrong answer must teach and let the learner continue, not trap them.
   Reproduces the reported case: choose wrongly, then check that Next works and
   that the right answer is shown. */
const { chromium } = require("playwright");

const BASE = process.env.LMS_BASE ?? "http://127.0.0.1:8791";
const MASTER = "support@ealearnings.com";
const MASTER_PASS = "ClipAudit!2026";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
};

async function signIn(page) {
  for (const candidate of ["admin", MASTER_PASS]) {
    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector(".admin-login-card", { timeout: 15000 });
    await page.fill('.admin-login-card input[type="email"]', MASTER);
    await page.fill('.admin-login-card input[type="password"]', candidate);
    await page.click(".admin-login-card .auth-submit");
    const forced = await page.waitForFunction(
      () => /Choose a new password|Choisissez un nouveau/.test(document.querySelector(".admin-login-card h1")?.textContent || ""),
      { timeout: 5000 },
    ).then(() => true).catch(() => false);
    if (forced) {
      const fields = await page.$$(".admin-login-card input[type=password]");
      await fields[0].fill(candidate);
      await fields[1].fill(MASTER_PASS);
      await fields[2].fill(MASTER_PASS);
      await page.click(".admin-login-card .auth-submit");
    }
    if (await page.waitForSelector(".admin-identity-bar", { timeout: 8000 }).then(() => true).catch(() => false)) return true;
  }
  return false;
}

(async () => {
  console.log(`Lesson progression · ${BASE}\n`);
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.addInitScript(() => window.localStorage.setItem("ea-language", "EN"));

  check("signed in", await signIn(page));

  await page.goto(BASE, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(700);
  await page.click(".gateway-sign-in").catch(() => {});
  await page.waitForTimeout(800);
  await page.click('.app-sidebar nav button:has-text("My Learning")').catch(() => {});
  await page.waitForTimeout(600);
  await page.locator(".app-content button").filter({ hasText: /start course/i }).first().click();
  await page.waitForSelector(".focus-player-shell", { timeout: 12000 });
  await page.waitForTimeout(1100);
  await page.locator(".focus-guide button").last().click({ timeout: 1200 }).catch(() => {});

  // Walk to the select-all activity (page 7 of 8).
  for (let i = 0; i < 6; i += 1) {
    await page.locator("button.focus-primary").first().click();
    await page.waitForTimeout(350);
  }

  // --- the select-all activity -------------------------------------------
  const picker = page.locator(".red-flag-picker");
  check("reached the warning-signs activity", await picker.count() > 0);

  const nextBefore = await page.locator("button.focus-primary").first().isDisabled();
  check("Next is held until the learner checks their choices", nextBefore);

  // Deliberately choose only a safe signal — a wrong answer.
  const options = page.locator(".red-flag-picker div button");
  const total = await options.count();
  await options.nth(1).click();
  await page.locator(".red-flag-submit").click();
  await page.waitForTimeout(400);

  const marks = await page.locator(".red-flag-picker .flag-mark").count();
  check("every option is labelled after checking", marks === total, `${marks} of ${total} labelled`);
  const revealed = await page.locator(".red-flag-picker button.missed").count();
  check("the warning signs the learner missed are shown", revealed > 0, `${revealed} revealed`);
  check("a continue note is shown after a wrong attempt", await page.locator(".flag-continue").count() > 0);

  const nextAfterWrong = await page.locator("button.focus-primary").first().isDisabled();
  check("Next is enabled after a WRONG select-all answer", !nextAfterWrong);

  await page.locator("button.focus-primary").first().click();
  await page.waitForTimeout(500);

  // --- the single-answer check -------------------------------------------
  const answers = page.locator(".focus-answers button");
  check("reached the quick check", await answers.count() > 0);
  const heldBefore = await page.locator("button.focus-primary").first().isDisabled();
  check("Next is held until an answer is chosen", heldBefore);

  // Pick a deliberately wrong option: the one not marked correct.
  const correctIndex = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll(".focus-answers button")];
    return buttons.findIndex((b) => b.className.includes("correct"));
  });
  const wrongIndex = correctIndex === 0 ? 1 : 0;
  await answers.nth(wrongIndex).click();
  await page.waitForTimeout(400);

  const feedback = (await page.locator(".focus-feedback").innerText().catch(() => "")).trim();
  check("the correct answer is stated after a wrong choice", /correct answer is/i.test(feedback), feedback.slice(0, 90));
  check("the correct option is highlighted", await page.locator(".focus-answers button.correct").count() > 0);

  const nextAfterWrongCheck = await page.locator("button.focus-primary").first().isDisabled();
  check("Next is enabled after a WRONG quick-check answer", !nextAfterWrongCheck);

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
