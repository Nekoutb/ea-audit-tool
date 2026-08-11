/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
const ok = (c, m) => console.log(`${c ? "PASS" : "FAIL"} ${m}`);
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1366, height: 950 } });
  await p.context().addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);
  await p.goto("http://localhost:3100/login");
  await p.fill("input[name=email]", "alice@firm-a.test");
  await p.fill("input[name=password]", "password");
  await p.getByTestId("login-submit").click();
  await p.waitForURL("**/dashboard");
  await p.locator('[data-testid="my-engagements"] a').first().click();
  await p.waitForURL(/\/engagements\/.*\/dashboard/);
  await p.locator('[data-testid="section-card-acceptance"]').waitFor();

  // band geometry: cards fill the row, no captions, big rings
  const geo = await p.locator('[data-testid="phase-gauges"]').evaluate((row) => {
    const cards = [...row.querySelectorAll('[data-testid^="section-card-"]')].map((c) => c.getBoundingClientRect());
    const r = row.getBoundingClientRect();
    return { after: Math.round(r.right - cards[3].right), sameRow: cards.every((c) => Math.round(c.y) === Math.round(cards[0].y)), n: cards.length };
  });
  ok(geo.n === 4 && geo.after === 0 && geo.sameRow, `four cards fill the row (trailing ${geo.after}px)`);
  const ringW = Math.round((await p.locator('[data-testid="section-card-acceptance"] span').nth(1).boundingBox()).width);
  ok(ringW === 140, `ring ${ringW}px`);
  ok(!/reviewed|due /.test(await p.locator('[data-testid="section-card-acceptance"]').innerText()), "no caption on the cards");

  // click acceptance: list slides open to its right; six lines, name+% only
  await p.locator('[data-testid="section-card-acceptance"]').click();
  await p.waitForTimeout(450);
  const groups = await p.locator('[data-testid^="stage-group-a"]').count();
  ok(groups === 6, `six grouped tasks (${groups})`);
  const panelTxt = await p.locator('[data-testid="stage-open-panel"]').innerText();
  ok(!/Grouped tasks|close|×|—/.test(panelTxt), "no header, no close, no dashes");
  const covered = await p.evaluate(() => {
    const card = document.querySelector('[data-testid="section-card-strategy"]').getBoundingClientRect();
    const panel = document.querySelector('[data-testid="stage-open-panel"]').getBoundingClientRect();
    return panel.right > card.left + 2 && panel.left < card.right - 2;
  });
  ok(!covered, "panel covers no card");
  await p.screenshot({ path: "_shot-prod-console.png", fullPage: false });

  // a group line resolves to its group page
  await p.locator('[data-testid="stage-group-a1"]').click();
  await p.waitForURL(/\/groups\/a1/);
  ok(true, "group line opens the group page");

  // summary boxes
  await p.goBack();
  await p.locator('[data-testid="section-card-acceptance"]').waitFor();
  for (const txt of ["My tasks", "Review notes", "Findings", "Tools"]) {
    ok(await p.getByText(txt, { exact: true }).first().isVisible(), `summary box: ${txt}`);
  }
  await b.close();
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
