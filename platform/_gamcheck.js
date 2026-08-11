const { chromium } = require("@playwright/test");
require("dotenv").config();
const { Pool } = require("pg");
const ok = (c, m) => console.log(`${c ? "PASS" : "FAIL"} ${m}`);
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const eng = (await pool.query(
    "SELECT e.id FROM engagement e JOIN tenant t ON t.id=e.tenant_id WHERE t.name='Cabinet Alpha' AND e.phase<>'archived' ORDER BY e.created_at DESC LIMIT 1",
  )).rows[0].id;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.context().addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);
  await p.goto("http://localhost:3100/login");
  await p.fill("input[name=email]", "alice@firm-a.test");
  await p.fill("input[name=password]", "password");
  await p.getByTestId("login-submit").click();
  await p.waitForURL("**/dashboard");
  await p.goto(`http://localhost:3100/engagements/${eng}/dashboard`);
  await p.waitForTimeout(1500);
  const body = await p.locator("body").innerText();
  ok(body.includes("Planning & Risk Identification"), "phase 1 renamed: Planning & Risk Identification");
  ok(body.includes("Strategy & Risk Assessment"), "phase 2 renamed: Strategy & Risk Assessment");
  ok(body.includes("Conclusion & Reporting"), "phase 4 renamed: Conclusion & Reporting");
  ok(!body.includes("Engagement Evaluation"), "old phase name gone");

  // open phase 2 flyout: expect the new groups
  await p.locator("text=Strategy & Risk Assessment").first().click();
  await p.waitForTimeout(800);
  const fly = await p.locator("body").innerText();
  for (const g of ["SCOTs, Flows & Walkthroughs", "Controls Strategy", "Combined Risk Assessment", "Use of Others' Work", "Audit Strategies Memorandum"])
    ok(fly.includes(g), `flyout group: ${g}`);

  // group page s1: backfill the 4 new SCOT tasks
  await p.goto(`http://localhost:3100/engagements/${eng}/groups/s1`);
  await p.waitForTimeout(1200);
  const addBtn = p.locator("button", { hasText: /missing tasks/i }).first();
  if (await addBtn.count()) {
    await addBtn.click();
    await p.waitForTimeout(2500);
  }
  await p.goto(`http://localhost:3100/engagements/${eng}/groups/s1`);
  await p.waitForTimeout(1000);
  const s1 = await p.locator("body").innerText();
  ok(s1.includes("SCOTs & Related Applications") || s1.includes("Identify Significant Classes"), "D8.1 exists after backfill");
  ok(s1.includes("Walkthroughs"), "D8.3 exists after backfill");

  // open D8.2 working paper
  const d82 = (await pool.query("SELECT id FROM file_item WHERE engagement_id=$1 AND code='D8.2'", [eng])).rows[0];
  ok(Boolean(d82), "D8.2 file_item created");
  if (d82) {
    await p.goto(`http://localhost:3100/engagements/${eng}/sections/${d82.id}`);
    await p.locator('[data-testid="wp-screen"]').waitFor();
    const wp = await p.locator("body").innerText();
    ok(wp.includes("Understand Flows of Transactions"), "D8.2 paper opens with GAM title");
    ok(wp.includes("PART A") || wp.includes("Part A") || wp.includes("Procedures"), "questionnaire present");
  }
  // renamed title visible on a task page (D7.2)
  const d72 = (await pool.query("SELECT id FROM file_item WHERE engagement_id=$1 AND code='D7.2'", [eng])).rows[0];
  await p.goto(`http://localhost:3100/engagements/${eng}/sections/${d72.id}`);
  await p.waitForTimeout(1200);
  ok((await p.locator("body").innerText()).includes("Make Combined Risk Assessments"), "D7.2 renamed on task page");
  await pool.end();
  await b.close();
})().catch((e) => { console.error("ERROR", e.message.split("\n")[0]); process.exit(1); });
