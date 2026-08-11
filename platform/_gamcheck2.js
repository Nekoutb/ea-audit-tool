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
  await p.locator("text=Planning & Risk Identification").first().waitFor({ timeout: 15000 });
  const body = await p.locator("body").innerText();
  ok(body.includes("Planning & Risk Identification"), "phase 1: Planning & Risk Identification");
  ok(body.includes("Strategy & Risk Assessment"), "phase 2: Strategy & Risk Assessment");
  ok(body.includes("Execution"), "phase 3: Execution");
  ok(body.includes("Conclusion & Reporting"), "phase 4: Conclusion & Reporting");
  ok(!body.includes("Engagement Evaluation"), "old phase name gone");
  // D8.2 questionnaire: navigate into step 1 and read visible content
  const d82 = (await pool.query("SELECT id FROM file_item WHERE engagement_id=$1 AND code='D8.2'", [eng])).rows[0];
  await p.goto(`http://localhost:3100/engagements/${eng}/sections/${d82.id}`);
  await p.locator('[data-testid="wp-screen"]').waitFor();
  const total = Number((await p.getByTestId("wp-step").innerText()).split("/")[1]);
  ok(total >= 2, `wizard paginated (${total} pages)`);
  await p.getByTestId("wp-next").click();
  await p.waitForTimeout(300);
  const step1 = await p.locator("body").innerText();
  ok(/Part A|Procedures and expected sources/i.test(step1), "questionnaire Part A visible on page 2");
  await pool.end();
  await b.close();
})().catch((e) => { console.error("ERROR", e.message.split("\n")[0]); process.exit(1); });
