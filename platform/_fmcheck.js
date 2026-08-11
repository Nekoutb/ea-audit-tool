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
  await p.goto(`http://localhost:3100/engagements/${d31.engagement_id}/sections/${d31.id}`);
  await p.locator('[data-testid="wp-screen"]').waitFor();

  // 1. standard paper gone; page count reduced
  const forms = await p.locator('[data-testid="task-attachments"]').innerText();
  ok(!/Standard working paper/.test(forms), "standard working paper removed");
  const stepTxt = await p.getByTestId("wp-step").innerText();
  const total = Number(stepTxt.split("/")[1]);
  ok(total <= 5, `pages reduced to ${stepTxt} (was 7)`);

  // 2. conditional yellow box: absent until "No", then appears and grows
  await p.getByTestId("wp-next").click(); await p.getByTestId("wp-next").click();
  await p.locator('[data-testid^="wp-q_"][data-testid$="-no"]').first().waitFor();
  const firstNo = p.locator('[data-testid^="wp-q_"][data-testid$="-no"]').first();
  const qname = (await firstNo.getAttribute("data-testid")).replace(/^wp-/, "").replace(/-no$/, "");
  ok((await p.locator(`[data-testid="wp-${qname}_x"]`).count()) === 0, "no yellow box while unanswered");
  await firstNo.check();
  await p.locator(`[data-testid="wp-${qname}_x"]`).waitFor();
  ok(true, "yellow box appears on No");
  const box = p.locator(`[data-testid="wp-${qname}_x"]`);
  const h0 = (await box.boundingBox()).height;
  await box.fill("A long explanation that wraps across several lines of the column to prove the box grows as the text extends beyond the first line width of the amber input area.");
  const h1 = (await box.boundingBox()).height;
  ok(h1 > h0, `yellow box grows with text (${Math.round(h0)}px → ${Math.round(h1)}px)`);
  const yesRadio = p.locator(`[data-testid="wp-${qname}-yes"]`);
  await yesRadio.check();
  ok((await p.locator(`[data-testid="wp-${qname}_x"]`).count()) === 0, "yellow box hides again on Yes");

  // 3. bigger text
  const fs1 = await p.locator('[data-testid^="wp-q_"][data-testid$="-no"]').first().evaluate((e) => getComputedStyle(e.closest("div").querySelector("p")).fontSize);
  ok(parseFloat(fs1) >= 13, `question text ${fs1}`);

  // 4. file icons + icon buttons + rename
  await p.setInputFiles('[data-testid="attachment-input"]', { name: "evidence.xlsx", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from("PK fake xlsx") });
  await p.locator('[data-testid="attachment-download-evidence.xlsx"]').waitFor();
  ok((await p.locator('[data-testid="file-icon-X"]').count()) >= 1, "Excel icon shown");
  const dlBtn = await p.locator('[data-testid="attachment-download-evidence.xlsx"]').innerText();
  ok(dlBtn.trim() === "", "download is an icon, not text");
  ok((await p.locator('[data-testid="attachment-edit-evidence.xlsx"]').innerText()).trim() === "", "edit-locally is an icon, not text");
  await p.locator('[data-testid="attachment-rename-evidence.xlsx"]').click();
  await p.locator('[data-testid="attachment-rename-input-evidence.xlsx"]').fill("bank-evidence-2026");
  await p.keyboard.press("Enter");
  await p.locator('[data-testid="attachment-download-bank-evidence-2026.xlsx"]').waitFor({ timeout: 10000 });
  ok(true, "inline rename works (extension preserved)");
  await p.screenshot({ path: "_shot-fm.png" });
  await b.close();
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
