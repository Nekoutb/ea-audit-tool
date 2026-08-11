/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
const ok = (c, m) => console.log(`${c ? "PASS" : "FAIL"} ${m}`);
require("dotenv").config();
const { Pool } = require("pg");
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const q = async (code) => (await pool.query(
    "SELECT fi.id, fi.engagement_id FROM file_item fi JOIN engagement e ON e.id=fi.engagement_id JOIN tenant t ON t.id=e.tenant_id WHERE t.name='Cabinet Alpha' AND fi.code=$1 AND e.phase<>'archived' ORDER BY e.created_at DESC LIMIT 1", [code])).rows[0];
  const d31 = await q("D3.1");
  const e100 = await q("E100");
  const d51 = await q("D5.1");

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.context().addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);
  await p.goto("http://localhost:3100/login");
  await p.fill("input[name=email]", "alice@firm-a.test");
  await p.fill("input[name=password]", "password");
  await p.getByTestId("login-submit").click();
  await p.waitForURL("**/dashboard");

  // 1. counts on the flyout lines
  await p.goto(`http://localhost:3100/engagements/${d31.engagement_id}/dashboard`);
  await p.locator('[data-testid="section-card-acceptance"]').waitFor();
  await p.locator('[data-testid="section-card-acceptance"]').click();
  await p.waitForTimeout(400);
  const line = await p.locator('[data-testid="stage-group-a1"]').innerText();
  ok(/\d+\/\d+/.test(line) && !/%/.test(line), `flyout shows counts, no % ("${line.replace(/\n/g, " ")}")`);

  // 2. fixed screen on D3.1: geometry — page never scrolls
  await p.goto(`http://localhost:3100/engagements/${d31.engagement_id}/sections/${d31.id}`);
  await p.locator('[data-testid="wp-screen"]').waitFor();
  const geo = await p.evaluate(() => ({
    docScrollY: document.documentElement.scrollHeight - window.innerHeight,
    docScrollX: document.documentElement.scrollWidth - window.innerWidth,
  }));
  ok(geo.docScrollY <= 0 && geo.docScrollX <= 0, `no page scroll (dy=${geo.docScrollY}, dx=${geo.docScrollX})`);
  const cols = await p.locator('[data-testid="wp-screen"] > div:last-child > section').count();
  ok(cols === 3, "three columns");
  ok(await p.locator('[data-testid="wp-guidance"]').innerText().then((t) => /ISQM 1|ISA 220/.test(t)), "guidance carries the ISA references");

  // 3. pagination: step through, values persist across steps, save round-trips
  const totalTxt = await p.getByTestId("wp-step").innerText();
  ok(/^1\/\d+$/.test(totalTxt), `wizard starts at step 1 (${totalTxt})`);
  await p.getByTestId("wp-key-findings").fill("Key finding: prior-year dispute resolved.");
  await p.getByTestId("wp-next").click();
  const stamp = `docs verified ${Date.now()}`;
  await p.locator('[data-testid="wp-p_docs"]').fill(stamp);
  await p.getByTestId("wp-back").click();
  ok((await p.getByTestId("wp-key-findings").inputValue()).includes("prior-year dispute"), "values persist across steps");
  await p.getByTestId("wp-save-D3.1").click();
  await p.waitForLoadState("networkidle");
  await p.goto(`http://localhost:3100/engagements/${d31.engagement_id}/sections/${d31.id}`);
  await p.locator('[data-testid="wp-screen"]').waitFor();
  ok((await p.getByTestId("wp-key-findings").inputValue()).includes("prior-year dispute"), "key findings saved");
  await p.getByTestId("wp-next").click();
  ok((await p.locator('[data-testid="wp-p_docs"]').inputValue()) === stamp, "hidden-step values submitted and saved");

  // 4. P chip: grey → sign → green
  const before = await p.getByTestId("chip-preparer").getAttribute("data-signed");
  await p.getByTestId("chip-preparer").click();
  await p.waitForLoadState("networkidle");
  await p.goto(`http://localhost:3100/engagements/${d31.engagement_id}/sections/${d31.id}`);
  await p.locator('[data-testid="wp-screen"]').waitFor();
  const after = await p.getByTestId("chip-preparer").getAttribute("data-signed");
  ok(before === "false" && after === "true", "P chip grey → green after sign-off");

  // 5. Forms on top, Linked below; linked task navigates
  const order = await p.evaluate(() => {
    const col = document.querySelectorAll('[data-testid="wp-screen"] > div:last-child > section')[2];
    const forms = col.querySelector('[data-testid="task-attachments"]');
    const linked = col.querySelector('[data-testid="wp-linked"]');
    return forms && linked && forms.getBoundingClientRect().top < linked.getBoundingClientRect().top;
  });
  ok(order === true, "Forms on top, Linked tasks below");
  ok((await p.locator('[data-testid^="linked-"]').count()) > 0, "linked tasks listed");

  // 6. TL badge: D5.1 (materiality tool) shows it; D3.1 does not
  ok((await p.locator('[data-testid="tl-badge"]').count()) === 0, "no TL badge on D3.1 (no tools)");
  await p.goto(`http://localhost:3100/engagements/${d51.engagement_id}/sections/${d51.id}`);
  await p.locator('[data-testid="wp-screen"]').waitFor();
  ok((await p.locator('[data-testid="tl-badge"]').count()) === 1, "TL badge on D5.1 (materiality tool)");

  // 7. execution task: legacy page untouched, with TL badge
  await p.goto(`http://localhost:3100/engagements/${e100.engagement_id}/sections/${e100.id}`);
  await p.waitForLoadState("networkidle");
  ok((await p.locator('[data-testid="wp-screen"]').count()) === 0, "E100 keeps the legacy layout");
  ok((await p.locator('[data-testid="tl-badge"]').count()) === 1, "TL badge on E100");
  ok((await p.getByText("Audit program", { exact: false }).count()) >= 1, "execution tools untouched");

  await pool.end();
  await b.close();
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
