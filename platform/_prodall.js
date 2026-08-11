/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
const BASE = "https://www.auditisa.com";
const ID = process.env.PROD_ENG_ID;
const ok = (c, m) => console.log(`${c ? "PASS" : "FAIL"} ${m}`);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const en = p.getByRole("button", { name: /^(English|Anglais)$/ });
  if (await en.count()) { await en.click(); await p.waitForLoadState("networkidle"); }
  await p.fill("input[name=email]", process.env.PROD_EMAIL);
  await p.fill("input[name=password]", process.env.PROD_PASSWORD);
  await p.getByTestId("login-submit").click();
  await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 });
  for (const [phase, code] of [["strategy", "D5.4"], ["execution", "E110"], ["conclusion", "F2"]]) {
    await p.goto(`${BASE}/engagements/${ID}/phase/${phase}`, { waitUntil: "networkidle" });
    const link = p.locator(`[data-testid="phase-task-${code}"]`);
    if ((await link.count()) === 0) { ok(false, `${code} not on ${phase}`); continue; }
    await p.goto(BASE + (await link.getAttribute("href")), { waitUntil: "networkidle" });
    const form = p.locator(`[data-testid="wp-form-${code}"]`);
    const procs = await form.locator('[data-testid^="wp-p_"]').count();
    const src = await form.getByText(/Expected sources:/).count();
    ok(procs > 0 && src === procs, `${code} live: ${procs} procedures, ${src} source lines`);
  }
  await b.close();
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
