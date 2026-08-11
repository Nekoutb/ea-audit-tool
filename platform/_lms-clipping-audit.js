/* eslint-disable @typescript-eslint/no-require-imports -- scratch script */
/* Finds text the layout silently cuts off.
 *
 * The reported bug — the three action cards losing their last words — was not a
 * one-off: the lesson stage was a fixed-height cell with overflow:hidden, so
 * ANY page taller than the viewport lost its bottom. This walks every element
 * on every surface at several viewports and reports anything whose content is
 * taller than the box that clips it. */
const { chromium } = require("playwright");
const BASE = process.env.LMS_BASE ?? "http://127.0.0.1:8791";
const MASTER = "support@ealearnings.com";
const MASTER_PASS = "ClipAudit!2026";

let pass = 0, fail = 0;
const problems = [];
const check = (name, ok, detail = "") => {
  if (ok) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
};

// Sign in through the form. Playwright's request API talks to wrangler dev's
// loopback service, which crashes the worker — the UI path is the stable one.
async function signIn(page) {
  // The seed password is rotated on the first run, so try the rotated one too.
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

// Reports every element that clips its own content vertically or horizontally.
const DETECTOR = `(() => {
  const found = [];
  for (const el of document.querySelectorAll("body *")) {
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const box = el.getBoundingClientRect();
    if (box.height < 12 || box.width < 12) continue;
    const text = (el.innerText || "").trim();
    if (!text) continue;

    const clipsY = ["hidden", "clip"].includes(style.overflowY);
    const clipsX = ["hidden", "clip"].includes(style.overflowX);
    // Line-clamped and ellipsised elements cut text deliberately.
    const deliberate = style.webkitLineClamp !== "none" || style.textOverflow === "ellipsis";
    if (deliberate) continue;

    const cutY = clipsY && el.scrollHeight - el.clientHeight > 4;
    const cutX = clipsX && el.scrollWidth - el.clientWidth > 4;
    if (!cutY && !cutX) continue;

    // Only report the innermost offender, so one clipped page is not reported
    // once per ancestor.
    found.push({
      selector: el.tagName.toLowerCase() + (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".") : ""),
      axis: cutY ? "vertical" : "horizontal",
      lost: cutY ? el.scrollHeight - el.clientHeight : el.scrollWidth - el.clientWidth,
      sample: text.slice(-70).replace(/\\s+/g, " "),
      depth: (function d(n){ let i=0; while ((n = n.parentElement)) i++; return i; })(el),
    });
  }
  const deepest = new Map();
  for (const f of found) {
    const key = f.selector + f.axis;
    if (!deepest.has(key) || deepest.get(key).depth < f.depth) deepest.set(key, f);
  }
  return [...deepest.values()];
})()`;

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "laptop", width: 1280, height: 720 },
  { name: "short-laptop", width: 1366, height: 640 },
  { name: "tablet", width: 768, height: 1024 },
  { name: "mobile", width: 390, height: 844 },
];

async function scan(page, surface, viewport) {
  const hits = await page.evaluate(DETECTOR);
  for (const hit of hits) {
    problems.push({ surface, viewport: viewport.name, ...hit });
  }
  return hits.length;
}

(async () => {
  console.log(`Clipped-text audit · ${BASE}\n`);
  const browser = await chromium.launch();

  const context = await browser.newContext({ viewport: VIEWPORTS[0] });
  const page = await context.newPage();
  await page.addInitScript(() => window.localStorage.setItem("ea-language", "EN"));
  check("signed in as the platform administrator", await signIn(page));

  for (const viewport of VIEWPORTS) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    await scan(page, "public site", viewport);

    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    await scan(page, "admin console", viewport);

    // The course player. The workspace is entered from the public gateway; a
    // platform administrator sees the full catalogue, so any course will do.
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(700);
    await page.click(".gateway-sign-in").catch(() => {});
    await page.waitForTimeout(900);
    await scan(page, "learner workspace", viewport);
    await page.click('.app-sidebar nav button:has-text("My Learning")').catch(() => {});
    await page.waitForTimeout(700);
    await scan(page, "my learning", viewport);

    const opened = await page.locator(".app-content button").filter({ hasText: /start course/i }).first()
      .click({ timeout: 4000 }).then(() => true).catch(() => false);
    if (opened) {
      await page.waitForSelector(".focus-player-shell", { timeout: 12000 }).catch(() => {});
      await page.waitForTimeout(1200);
      await page.locator(".focus-guide button").last().click({ timeout: 1200 }).catch(() => {});
      for (let screen = 0; screen < 8; screen += 1) {
        await page.waitForTimeout(500);
        await scan(page, `course page ${screen + 1}`, viewport);
        // Answer, then scan again: revealed feedback makes the page tallest.
        await page.locator(".red-flag-picker div button").first().click({ timeout: 500 }).catch(() => {});
        await page.locator(".red-flag-submit").click({ timeout: 500 }).catch(() => {});
        await page.locator(".focus-answers button").first().click({ timeout: 500 }).catch(() => {});
        await page.waitForTimeout(400);
        await scan(page, `course page ${screen + 1} answered`, viewport);
        const next = page.locator("button.focus-primary").first();
        if (!(await next.click({ timeout: 1500 }).then(() => true).catch(() => false))) break;
      }
      await page.locator("button").filter({ hasText: /exit/i }).first().click({ timeout: 1500 }).catch(() => {});
    }
    console.log(`  scanned ${viewport.name} (${viewport.width}x${viewport.height})${opened ? "" : " — course player not reached"}`);
  }
  await context.close();

  await browser.close();

  console.log("\n--- clipped text ---");
  if (!problems.length) {
    check("no element clips its own text on any surface or viewport", true);
  } else {
    const bySurface = new Map();
    for (const p of problems) {
      const key = `${p.surface} @ ${p.viewport}`;
      bySurface.set(key, [...(bySurface.get(key) ?? []), p]);
    }
    for (const [key, list] of bySurface) {
      console.log(`\n  ${key}`);
      for (const p of list) console.log(`    ${p.axis} · ${p.lost}px lost · ${p.selector}\n      …${p.sample}`);
    }
    check("no element clips its own text on any surface or viewport", false, `${problems.length} clipped element(s)`);
  }

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
