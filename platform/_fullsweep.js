/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
const BASE = "https://www.auditisa.com";
const ok = (c, m) => console.log(`${c ? "PASS" : "FAIL"} ${m}`);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1600, height: 950 } });
  const p = await ctx.newPage();

  // 1. sign-in → welcome
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const en = p.getByRole("button", { name: /^(English|Anglais)$/ });
  if (await en.count()) { await en.click(); await p.waitForLoadState("networkidle"); }
  await p.fill("input[name=email]", "admin@auditisa.com");
  await p.fill("input[name=password]", "admin");
  await p.getByTestId("login-submit").click();
  await p.waitForURL("**/dashboard", { timeout: 45000 });
  ok(await p.getByTestId("welcome").isVisible(), "welcome greeting");
  const rows = await p.locator('[data-testid="my-engagements"] a').count();
  ok(rows === 1, `assigned engagements only (${rows}: ZOEDEN)`);
  ok((await p.locator("header nav a").count()) === 0, "no header links on welcome");
  ok(await p.getByTestId("new-engagement").isVisible(), "create-engagement button");

  // 2. wizard: three questions, generated name
  await p.getByTestId("new-engagement").click();
  await p.waitForURL("**/new-engagement**");
  const q = await Promise.all(["engagement-client", "engagement-year", "engagement-nature"].map((t) => p.locator(`[data-testid="${t}"]`).count()));
  const gone = await Promise.all(["engagement-period-end", "engagement-partner", "engagement-duration"].map((t) => p.locator(`[data-testid="${t}"]`).count()));
  ok(q.every((c) => c === 1) && gone.every((c) => c === 0), "wizard: 3 identity questions only");
  await p.getByTestId("engagement-client").fill("ZOEDEN");
  ok(/ZOEDEN_DECEMBER 31 \d{4}_STATUTORY AUDIT/.test(await p.getByTestId("engagement-name").innerText()), "generated engagement name");

  // 3. engagement console
  await p.goto(`${BASE}/dashboard`);
  await p.locator('[data-testid="my-engagements"] a').first().click();
  await p.waitForURL(/\/engagements\/.*\/(dashboard|nature)/);
  await p.locator('[data-testid="section-card-acceptance"]').waitFor({ timeout: 30000 });
  const pct = await p.evaluate(() => Math.round(document.querySelector("main").getBoundingClientRect().width / innerWidth * 100));
  ok(pct === 95, `console spans ${pct}% of the viewport`);
  const labels = await p.locator('[data-testid^="section-card-"] span').evaluateAll((els) => els.filter((e) => e.className.includes("uppercase")).map((e) => e.innerText));
  ok(labels.join("|") === "ENGAGEMENT EVALUATION|PLANNING & STRATEGY|EXECUTION|CONCLUSION", "phase names: " + labels.join(" · "));
  ok((await p.locator("header nav a").count()) === 0 && (await p.locator("header").innerText()).includes("ENGAGEMENTS"), "header: selector kept, links gone");
  const ring = await p.locator('[data-testid="section-card-acceptance"] span').nth(1).boundingBox();
  ok(Math.round(ring.width) === 140, "140px rings, no captions");

  // 4. groups per phase: 5/5/6/5, short names, list style
  for (const [key, prefix, want] of [["acceptance", "a", 5], ["strategy", "s", 5], ["execution", "e", 6], ["conclusion", "c", 5]]) {
    await p.locator(`[data-testid="section-card-${key}"]`).click();
    await p.waitForTimeout(380);
    const n = await p.locator(`[data-testid^="stage-group-${prefix}"]`).count();
    ok(n === want, `${key}: ${n} grouped tasks`);
    await p.locator(`[data-testid="section-card-${key}"]`).click();
    await p.waitForTimeout(200);
  }

  // 5. summary row + A1 paper carries the final-analytics procedure
  for (const txt of ["My tasks", "Review notes", "Findings", "Tools"]) {
    ok(await p.getByText(txt, { exact: true }).first().isVisible(), `summary box: ${txt}`);
  }
  await b.close();
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
