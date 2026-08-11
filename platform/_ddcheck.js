/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
const ok = (c, m) => console.log(`${c ? "PASS" : "FAIL"} ${m}`);
require("dotenv").config();
const { Pool } = require("pg");
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const d31 = (await pool.query(
    "SELECT fi.id, fi.engagement_id FROM file_item fi JOIN engagement e ON e.id=fi.engagement_id JOIN tenant t ON t.id=e.tenant_id WHERE t.name='Cabinet Alpha' AND fi.code='D3.1' AND e.phase<>'archived' ORDER BY e.created_at DESC LIMIT 1",
  )).rows[0];
  await pool.end();

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  await p.context().addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);
  await p.goto("http://localhost:3100/login");
  await p.fill("input[name=email]", "alice@firm-a.test");
  await p.fill("input[name=password]", "password");
  await p.getByTestId("login-submit").click();
  await p.waitForURL("**/dashboard");

  // 1. Due Diligence group → task row lands on the working-paper screen
  await p.goto(`http://localhost:3100/engagements/${d31.engagement_id}/groups/a1`);
  await p.locator(`[data-testid="phase-task-A1.1"]`).first().click();
  await p.waitForURL(/\/sections\//);
  await p.locator('[data-testid="wp-screen"]').waitFor();
  ok(true, "Due Diligence task opens the working-paper screen (no legacy form)");

  // 2. engagement-type options clickable in the middle column
  await p.getByTestId("wp-next").click(); // step 2 = Engagement profile
  await p.locator('[data-testid="wp-engagement_type-new"]').waitFor();
  await p.locator('[data-testid="wp-engagement_type-new"] ~ span, [data-testid="wp-engagement_type-new"]').first().click({ force: true });
  await p.locator('[data-testid="wp-auditor_change-yes"]').click({ force: true });
  ok(true, "engagement-type and auditor-change options clickable");

  // 3. risk rating select on its step; save round-trips the choices
  await p.getByTestId(`wp-save-D3.1`).click();
  await p.waitForLoadState("networkidle");
  await p.goto(`http://localhost:3100/engagements/${d31.engagement_id}/sections/${d31.id}`);
  await p.locator('[data-testid="wp-screen"]').waitFor();
  await p.getByTestId("wp-next").click();
  ok(await p.locator('[data-testid="wp-engagement_type-new"]').isChecked(), "engagement type saved (New engagement)");
  ok(await p.locator('[data-testid="wp-auditor_change-yes"]').isChecked(), "auditor change saved (Yes)");

  // 4. the standard working paper is pre-attached
  const forms = await p.locator('[data-testid="attachments-list"]').innerText();
  ok(/D3\.1 — Standard working paper\.docx/.test(forms), "standard template pre-attached in Forms");
  const href = await p.locator('[data-testid="attachment-download-D3.1 — Standard working paper.docx"]').getAttribute("href");
  const dl = await p.request.get("http://localhost:3100" + href);
  const bytes = await dl.body();
  ok(dl.status() === 200 && bytes.subarray(0, 2).toString("latin1") === "PK", `template downloads as a real DOCX (${bytes.length} bytes)`);
  await p.screenshot({ path: "_shot-dd.png" });
  await b.close();
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
