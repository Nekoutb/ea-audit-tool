/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
const BASE = "http://localhost:3100";
const ok = (c, m) => console.log(`${c ? "PASS" : "FAIL"} ${m}`);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1366, height: 1000 } });
  await p.goto(`${BASE}/login`);
  const en = p.getByRole("button", { name: /^(English|Anglais)$/ });
  if (await en.count()) { await en.click(); await p.waitForLoadState("networkidle"); }
  await p.fill("input[name=email]", "alice@firm-a.test");
  await p.fill("input[name=password]", "password");
  await p.getByTestId("login-submit").click();
  await p.waitForURL("**/dashboard", { timeout: 30000 });

  // 1. landing: welcome + engagement list
  ok(p.url().endsWith("/dashboard"), "sign-in lands on the firm dashboard");
  const welcome = await p.getByTestId("welcome").innerText();
  ok(/Welcome back/.test(welcome), `welcome header: "${welcome}"`);
  const engRows = await p.locator('[data-testid="my-engagements"] a').count();
  ok(engRows > 0, `engagement list disclosed (${engRows} rows)`);
  await p.screenshot({ path: "_shot-landing.png", fullPage: true });

  // 2. engagement dashboard: four phases, once
  await p.locator('[data-testid="my-engagements"] a').first().click();
  await p.waitForURL(/\/engagements\/.*\/dashboard/);
  await p.waitForLoadState("networkidle");
  await p.locator('[data-testid="section-card-acceptance"]').waitFor();
  const cards = await p.locator('[data-testid^="section-card-"]').evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-testid").replace("section-card-", "")),
  );
  ok(cards.join(",") === "acceptance,strategy,execution,conclusion", `phase cards once: ${cards.join(", ")}`);
  ok((await p.locator('[data-testid="phase-acceptance"]').count()) === 0, "no duplicate phase bar on the dashboard");
  ok((await p.locator('[data-testid="engagement-feed"]').count()) === 0, "engagement feed removed");
  ok((await p.getByText("Engagement feed").count()) === 0, "no feed heading");
  // tasks hidden until a phase is clicked
  ok((await p.locator('[data-testid="phase-task-rollout"]').count()) === 0, "tasks hidden before a phase is clicked");
  await p.screenshot({ path: "_shot-dash-idle.png", fullPage: false });

  // 3. click a phase: others slide out, tasks disclosed
  await p.locator('[data-testid="section-card-acceptance"]').click();
  await p.waitForTimeout(450);
  const rollout = await p.locator('[data-testid="phase-task-rollout"]').count();
  ok(rollout === 1, "task rollout disclosed on click");
  const taskRows = await p.locator('[data-testid^="stage-task-"]').count();
  ok(taskRows > 0, `acceptance tasks revealed (${taskRows})`);
  const hidden = await p.locator('[data-testid="section-card-execution"]').evaluate((e) => getComputedStyle(e).opacity);
  ok(hidden === "0", "other phase cards slid out");
  await p.screenshot({ path: "_shot-dash-open.png", fullPage: false });

  // 4. back to all phases
  await p.getByTestId("stage-show-all").click();
  await p.waitForTimeout(400);
  const back = await p.locator('[data-testid="section-card-execution"]').evaluate((e) => getComputedStyle(e).opacity);
  ok(back === "1", "all four cards return");

  // 5. a task link resolves
  await p.locator('[data-testid="section-card-acceptance"]').click();
  await p.locator('[data-testid^="stage-task-"]').first().click();
  await p.waitForURL(/\/sections\//);
  ok(true, "clicking a task opens its page");

  await b.close();
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
