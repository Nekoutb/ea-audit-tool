/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
const ok = (c, m) => console.log(`${c ? "PASS" : "FAIL"} ${m}`);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.context().addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);
  await p.goto("http://localhost:3100/login");
  await p.fill("input[name=email]", "alice@firm-a.test");
  await p.fill("input[name=password]", "password");
  await p.getByTestId("login-submit").click();
  await p.waitForURL("**/dashboard");

  // welcome: minimal nav + create button
  ok((await p.locator('header nav a').count()) === 0, "Dashboard/Engagements links removed from the top");
  ok(await p.getByTestId("new-engagement").isVisible(), "Create engagement button present");

  // wizard: identity questions, generated name
  await p.getByTestId("new-engagement").click();
  await p.waitForURL("**/new-engagement**");
  for (const tid of ["engagement-client", "engagement-year", "engagement-period-end", "engagement-duration", "engagement-nature", "engagement-work-phase", "engagement-framework", "engagement-first-year"]) {
    ok((await p.locator(`[data-testid="${tid}"]`).count()) === 1, `${tid} present`);
  }
  ok((await p.locator('[data-testid="complexity-questions"]').count()) === 0, "no complexity questions on the wizard");
  const stamp = Date.now();
  await p.getByTestId("engagement-client").selectOption({ index: 0 });
  await p.getByTestId("engagement-year").fill("2026");
  await p.getByTestId("engagement-period-end").selectOption("12-31");
  const name = await p.getByTestId("engagement-name").innerText();
  console.log("generated name:", name);
  ok(/_DECEMBER 31 2026_STATUTORY AUDIT$/.test(name), "name follows CLIENT_PERIOD END_NATURE");
  await p.screenshot({ path: "_shot-wizard.png", fullPage: true });

  await p.getByTestId("create-engagement").click();
  await p.waitForURL("**/nature", { timeout: 30000 });
  ok(true, "creation lands on the nature-of-entity screen");
  const q = await p.locator('[data-testid^="cq-"]').count();
  ok(q === 17, `17 questions (${q})`);
  // simple entity: answer nothing
  const preview = await p.getByTestId("complexity-result").innerText();
  ok(/Simple entity/.test(preview), `live preview: "${preview}"`);
  await p.screenshot({ path: "_shot-nature.png", fullPage: true });
  await p.getByTestId("classify-entity").click();
  await p.waitForURL("**/dashboard", { timeout: 30000 });
  ok(true, "classification lands on the engagement dashboard");
  await p.locator('[data-testid="section-card-acceptance"]').waitFor();
  const url = p.url();

  // simple entity → core set only
  const eid = url.split("/engagements/")[1].split("/")[0];
  await p.goto(`http://localhost:3100/engagements/${eid}`);
  await p.waitForLoadState("networkidle");
  const items = await p.locator('[data-testid^="file-item-"]').count();
  console.log("file items for simple entity:", items);
  ok(items > 0 && items < 40, "reduced scope propagated");
  await b.close();
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
