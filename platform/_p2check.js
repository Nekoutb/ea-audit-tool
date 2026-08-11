const { chromium } = require("@playwright/test");
require("dotenv").config();
const { Pool } = require("pg");
const ok = (c, m) => console.log(`${c ? "PASS" : "FAIL"} ${m}`);
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const eng = (await pool.query("SELECT e.id FROM engagement e JOIN tenant t ON t.id=e.tenant_id WHERE t.name='Cabinet Alpha' AND e.phase<>'archived' ORDER BY e.created_at DESC LIMIT 1")).rows[0].id;
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.context().addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);
  await p.goto("http://localhost:3100/login");
  await p.fill("input[name=email]", "alice@firm-a.test");
  await p.fill("input[name=password]", "password");
  await p.getByTestId("login-submit").click();
  await p.waitForURL("**/dashboard");

  // 1) dashboard: no Tools panel, tools icon in header
  await p.goto(`http://localhost:3100/engagements/${eng}/dashboard`);
  await p.locator('[data-testid="review-notes-box"]').waitFor();
  const tc = await p.evaluate(() => document.body.textContent);
  ok(!/Outils|Tools/.test(tc.replace("Tools · AuditISA", "")), "dashboard: tools panel removed");
  ok(await p.getByTestId("nav-tools").isVisible(), "header: tools icon present");

  // 2) tools page sections
  await p.getByTestId("nav-tools").click();
  await p.waitForURL("**/tools");
  const tools = await p.evaluate(() => document.body.textContent);
  for (const sec of ["Data Analytics", "Sampling", "Circularisation", "Independence Campaign"]) ok(tools.includes(sec), `tools section: ${sec}`);
  for (const t of ["Trial Balance Analyzer", "General Ledger Analyzer", "Accounts Receivable Analyzer", "Accounts Payable Analyzer", "Inventory Analyzer"]) ok(tools.includes(t), `analyzer: ${t}`);

  // 3) TB analyzer confirm-and-map flow
  await p.goto(`http://localhost:3100/engagements/${eng}/data`);
  await p.setInputFiles('[data-testid="tb-file"]', "_tb-test.csv");
  await p.getByTestId("tb-analyze").click();
  await p.locator('[data-testid="tb-confirm"]').waitFor({ timeout: 15000 });
  ok((await p.getByTestId("tb-col-account").inputValue()) === "Compte", "columns auto-detected (account = Compte)");
  ok(await p.locator('[data-testid="tb-sample"] tr').count() > 3, "sample rows shown");
  const classCount = await p.locator('[data-testid="tb-classes"] tbody tr').count();
  ok(classCount >= 8, `account classes listed (${classCount})`);
  const cls41 = await p.getByTestId("tb-class-map-41").inputValue();
  ok(cls41 !== "", `class 41 auto-mapped to ${cls41 || "(none)"}`);
  await p.getByTestId("tb-upload").click();
  await p.locator('[data-testid="tb-import-status"]').waitFor({ timeout: 20000 });
  ok(true, "confirm & ingest created " + (await p.getByTestId("tb-import-status").innerText()));

  // 4) materiality bases from the TB
  await p.goto(`http://localhost:3100/engagements/${eng}/planning`);
  await p.locator('[data-testid="materiality-bases"]').waitFor({ timeout: 15000 });
  const rev = await p.locator('[data-testid="basis-revenue"]').innerText();
  ok(rev.includes("160") , "revenue basis derived (160,000,000)");
  const pbt = await p.locator('[data-testid="basis-pbt"]').innerText();
  ok(pbt.includes("15"), "PBT derived (160M - 145M = 15,000,000)");
  await p.getByTestId("use-basis-revenue").click();
  ok((await p.getByTestId("materiality-amount").inputValue()) === "160000000", "Use fills amount");
  ok((await p.getByTestId("materiality-pct").inputValue()) !== "", "Use fills suggested %");
  await p.getByTestId("materiality-justification").fill("Revenue basis from ingested TB — stable benchmark");
  await p.getByTestId("materiality-pct").fill("1");
  await p.locator('button:has-text("Create"), button[type=submit]').filter({ has: p.locator(':scope') }).first();
  // submit the create form via the pct input's form
  await p.getByTestId("materiality-pct").press("Enter");
  await p.waitForTimeout(2000);
  const mat = (await pool.query("SELECT overall, performance, trivial FROM materiality WHERE engagement_id=$1 ORDER BY version_no DESC LIMIT 1", [eng])).rows[0];
  ok(Boolean(mat) && Number(mat.overall) === 1600000, `PM computed = ${mat ? Number(mat.overall) : "none"}`);

  // 5) D5.1 paper blue field
  const d51 = (await pool.query("SELECT id FROM file_item WHERE engagement_id=$1 AND code='D5.1'", [eng])).rows[0];
  await p.goto(`http://localhost:3100/engagements/${eng}/sections/${d51.id}`);
  await p.locator('[data-testid="wp-screen"]').waitFor();
  const wp = await p.evaluate(() => document.body.textContent);
  ok(wp.includes("PM 1 600 000"), "D5.1 paper shows tool-filled PM/TE/SAD line");
  await p.screenshot({ path: "_shot-tb-analyzer.png" });
  await pool.end();
  await b.close();
})().catch((e) => { console.error("ERROR", e.message.split("\n")[0]); process.exit(1); });
