/* eslint-disable @typescript-eslint/no-require-imports */
// Acceptance-phase verification against the production build on :3100.
const { chromium } = require("@playwright/test");

const BASE = "http://localhost:3100";
const EMAIL = "alice@firm-a.test";
const PASSWORD = "password";

const ok = (c, m) => console.log(`${c ? "PASS" : "FAIL"} ${m}`);

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${BASE}/login`);
  // the page carries three forms: two language switchers and the sign-in form
  const en = page.getByRole("button", { name: /^(English|Anglais)$/ });
  if (await en.count()) {
    await en.click();
    await page.waitForLoadState("networkidle");
  }
  await page.fill('input[name="email"]', EMAIL);
  await page.fill('input[name="password"]', PASSWORD);
  await page.getByRole("button", { name: /^(Sign in|Se connecter)$/ }).click();
  await page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 });

  const id = process.env.ENG_ID;
  console.log("engagement:", id);

  // ---- phase page ----
  await page.goto(`${BASE}/engagements/${id}/phase/acceptance`);
  await page.waitForLoadState("networkidle");

  const main = await page.locator('[data-testid="phase-tasks"] a').evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-testid").replace("phase-task-", "")),
  );
  const opt = await page.locator('[data-testid="phase-optional"] a').evaluateAll((els) =>
    els.map((e) => e.getAttribute("data-testid").replace("phase-optional-", "")),
  );
  console.log("main tasks:", main.join(", "));
  console.log("conditional:", opt.join(", ") || "(none)");

  const expectMain = ["D3.1", "D6.1", "D3.2", "D3.3", "D3.5", "D3.6"];
  ok(JSON.stringify(main) === JSON.stringify(expectMain), `six papers in performance order`);
  ok(opt.includes("D3.4"), "D3.4 reachable in the conditional strip");

  // ---- the backfill button must not nag once every row exists ----
  await page.goto(`${BASE}/engagements/${id}/groups/st1`);
  await page.waitForLoadState("networkidle");
  const btn = page.getByRole("button", { name: /Add the missing tasks|Ajouter/i });
  ok((await btn.count()) === 0, "no leftover 'add the missing tasks' button");

  // ---- every acceptance paper: procedures with sources, and a conclusion ----
  const ALL = ["D3.1", "D6.1", "D3.2", "D3.3", "D3.4", "D3.5", "D3.6"];
  const hrefByCode = new Map();
  await page.goto(`${BASE}/engagements/${id}/phase/acceptance`);
  for (const sel of ['[data-testid^="phase-task-"]', '[data-testid^="phase-optional-"]']) {
    const rows = await page.locator(sel).evaluateAll((els) =>
      els.map((e) => [e.getAttribute("data-testid").replace(/^phase-(task|optional)-/, ""), e.getAttribute("href")]),
    );
    rows.forEach(([c, h]) => hrefByCode.set(c, h));
  }

  for (const code of ALL) {
    const href = hrefByCode.get(code);
    if (!href) {
      ok(false, `${code} has no link on the phase page`);
      continue;
    }
    await page.goto(BASE + href);
    await page.waitForLoadState("networkidle");
    const form = page.locator(`[data-testid="wp-form-${code}"]`);
    if ((await form.count()) !== 1) {
      ok(false, `${code} renders its working paper`);
      continue;
    }
    const procs = await form.locator('[data-testid^="wp-p_"]').count();
    const sources = await form.getByText(/Expected sources:/).count();
    const yn = await form.locator('[data-testid^="wp-q_"][data-testid$="-yes"]').count();
    const concl = await form.locator('[data-testid^="wp-c_"][data-testid$="-yes"]').count();
    ok(
      procs > 0 && sources === procs && concl > 0,
      `${code}: ${procs} procedures, ${sources} source lines, ${yn} yes/no, ${concl} conclusions`,
    );
  }

  // ---- a procedure result persists ----
  await page.goto(BASE + hrefByCode.get("D3.4"));
  const box = page.locator('[data-testid="wp-p_identify"]');
  const stamp = "predecessor: Cabinet Delta, FY2024-2025";
  await box.fill(stamp);
  await page.getByTestId("wp-save-D3.4").click();
  await page.waitForLoadState("networkidle");
  await page.goto(BASE + hrefByCode.get("D3.4"));
  ok((await page.locator('[data-testid="wp-p_identify"]').inputValue()) === stamp, "a procedure result survives a save");

  await browser.close();
})().catch((e) => {
  console.error("ERROR", e.message);
  process.exit(1);
});
