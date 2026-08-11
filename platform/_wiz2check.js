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
  await p.goto("http://localhost:3100/new-engagement");

  // only the three questions
  for (const tid of ["engagement-client", "engagement-year", "engagement-nature"]) {
    ok((await p.locator(`[data-testid="${tid}"]`).count()) === 1, `${tid} present`);
  }
  for (const tid of ["engagement-period-end", "engagement-duration", "engagement-work-phase", "engagement-framework", "engagement-first-year", "engagement-partner"]) {
    ok((await p.locator(`[data-testid="${tid}"]`).count()) === 0, `${tid} removed`);
  }

  // typed client name (new client), free-text nature via Other
  const stamp = `Nouveau SARL ${Date.now()}`;
  await p.getByTestId("engagement-client").fill(stamp);
  ok(await p.getByText("New client — the entity will be created").isVisible(), "new-client hint");
  await p.getByTestId("engagement-year").fill("2026");
  await p.getByTestId("engagement-nature").selectOption("other");
  await p.getByTestId("engagement-nature-text").fill("Due diligence");
  const name = await p.getByTestId("engagement-name").innerText();
  console.log("generated:", name);
  ok(name === `${stamp.toUpperCase()}_DECEMBER 31 2026_DUE DILIGENCE`, "free-text nature in the generated name");
  await p.screenshot({ path: "_shot-wizard3.png", fullPage: true });

  await p.getByTestId("create-engagement").click();
  await p.waitForURL("**/nature", { timeout: 30000 });
  ok(true, "creation (typed new client) lands on nature screen");
  await p.getByTestId("classify-entity").click();
  await p.waitForURL("**/team", { timeout: 30000 });
  ok(true, "classification lands on the team screen");
  const eid = p.url().split("/engagements/")[1].split("/")[0];

  // existing-client match: same name resolves to the same client (duplicate check)
  await p.goto("http://localhost:3100/new-engagement");
  await p.getByTestId("engagement-client").fill(stamp);
  ok(await p.getByText("Existing client").isVisible(), "typed name now matches the existing client");
  await p.getByTestId("engagement-year").fill("2026");
  await p.getByTestId("create-engagement").click();
  await p.waitForURL(/error=duplicate-engagement/, { timeout: 30000 });
  ok(true, "same client + year is refused as a duplicate (name matching works)");

  await p.goto(`http://localhost:3100/engagements/${eid}/team`);
  ok((await p.locator("h1, h2").first().innerText()).length > 0, "team screen renders");
  await b.close();
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
