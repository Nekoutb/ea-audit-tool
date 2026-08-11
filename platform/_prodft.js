/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
const ok = (c, m) => console.log(`${c ? "PASS" : "FAIL"} ${m}`);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  await p.goto("https://www.auditisa.com/login", { waitUntil: "domcontentloaded" });
  const en = p.getByRole("button", { name: /^(English|Anglais)$/ });
  if (await en.count()) { await en.click(); await p.waitForLoadState("networkidle"); }
  await p.fill("input[name=email]", "admin@auditisa.com");
  await p.fill("input[name=password]", "admin");
  await p.getByTestId("login-submit").click();
  await p.waitForURL("**/dashboard", { timeout: 45000 });
  await p.getByTestId("welcome").waitFor({ timeout: 30000 });

  // theme live
  const t0 = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));
  const bg0 = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await p.getByTestId("theme-toggle").click();
  await p.waitForTimeout(150);
  const bg1 = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(bg0 !== bg1, `theme toggle live (${t0} → ${await p.evaluate(() => document.documentElement.getAttribute("data-theme"))})`);
  await p.screenshot({ path: "_shot-prod-theme.png" });

  // attachments live on ZOEDEN D3.1 (direct)
  await p.goto("https://www.auditisa.com/engagements/c71e5b3d-cf25-42e0-a32a-f4784b4420c0/sections/b0d6ae6c-e715-4a03-8e57-fb5c26fcf3cc");
  await p.locator('[data-testid="task-attachments"]').waitFor({ timeout: 30000 });
  ok(true, "task files panel live on the task page");
  await p.setInputFiles('[data-testid="attachment-input"]', {
    name: "prod-check.txt", mimeType: "text/plain", buffer: Buffer.from("attachment round-trip", "utf8"),
  });
  await p.locator('[data-testid="attachment-download-prod-check.txt"]').waitFor({ timeout: 15000 });
  const href = await p.locator('[data-testid="attachment-download-prod-check.txt"]').getAttribute("href");
  const dl = await p.request.get("https://www.auditisa.com" + href);
  ok(dl.status() === 200 && (await dl.text()) === "attachment round-trip", "upload → download round-trip live");
  await p.screenshot({ path: "_shot-prod-files.png", fullPage: false });
  await b.close();
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
