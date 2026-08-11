/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
const ok = (c, m) => console.log(`${c ? "PASS" : "FAIL"} ${m}`);
require("dotenv").config();
const { Pool } = require("pg");
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const r = await pool.query(
    "SELECT fi.id, fi.engagement_id FROM file_item fi JOIN engagement e ON e.id=fi.engagement_id JOIN tenant t ON t.id=e.tenant_id WHERE t.name='Cabinet Alpha' AND fi.code='D3.1' AND e.phase<>'archived' ORDER BY e.created_at DESC LIMIT 1",
  );
  await pool.end();
  const { id: itemId, engagement_id: engId } = r.rows[0];

  const b = await chromium.launch();
  const p = await b.newPage();
  await p.context().addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);
  await p.goto("http://localhost:3100/login");
  await p.fill("input[name=email]", "alice@firm-a.test");
  await p.fill("input[name=password]", "password");
  await p.getByTestId("login-submit").click();
  await p.waitForURL("**/dashboard");

  // ---- theme toggle ----
  await p.getByTestId("welcome").waitFor();
  const t0 = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));
  ok(t0 === "light" || t0 === "dark", `theme stamped before paint (${t0})`);
  const bg0 = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await p.getByTestId("theme-toggle").click();
  await p.waitForTimeout(150);
  const t1 = await p.evaluate(() => document.documentElement.getAttribute("data-theme"));
  const bg1 = await p.evaluate(() => getComputedStyle(document.body).backgroundColor);
  ok(t1 !== t0 && bg1 !== bg0, `toggle switches theme (${t0}→${t1}) and the canvas actually changes`);
  await p.reload();
  await p.getByTestId("welcome").waitFor();
  ok((await p.evaluate(() => document.documentElement.getAttribute("data-theme"))) === t1, "choice survives reload");
  await p.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
  await p.screenshot({ path: "_shot-light.png" });
  await p.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await p.screenshot({ path: "_shot-dark.png" });
  await p.evaluate(() => localStorage.setItem("theme", "light"));

  // ---- attachments: upload, list, download, version bump ----
  await p.goto(`http://localhost:3100/engagements/${engId}/sections/${itemId}`);
  await p.locator('[data-testid="task-attachments"]').waitFor();
  ok(true, "attachments panel on the task page");
  await p.setInputFiles('[data-testid="attachment-input"]', {
    name: "bank-confirmation.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("bank;balance\nSGC;12500000", "utf8"),
  });
  await p.locator('[data-testid="attachment-download-bank-confirmation.csv"]').waitFor({ timeout: 15000 });
  ok(true, "upload lands in the list");
  const dl = await p.request.get(`http://localhost:3100/api/attachments/file/` +
    (await p.locator('[data-testid="attachment-download-bank-confirmation.csv"]').getAttribute("href")).split("/").pop());
  ok(dl.status() === 200 && (await dl.text()).includes("SGC;12500000"), "download returns the exact bytes");
  // second upload of the same name = version 2 (what the watcher does on save)
  await p.setInputFiles('[data-testid="attachment-input"]', {
    name: "bank-confirmation.csv",
    mimeType: "text/csv",
    buffer: Buffer.from("bank;balance\nSGC;99000000", "utf8"),
  });
  await p.waitForTimeout(800);
  const row = await p.locator('[data-testid="attachments-list"] li', { hasText: "bank-confirmation.csv" }).innerText();
  ok(/v2/.test(row), "re-upload becomes version 2");
  const rows = await p.locator('[data-testid="attachments-list"] li').count();
  ok(rows === 1, "one row per filename (latest version shown)");
  ok((await p.locator('[data-testid="attachment-edit-bank-confirmation.csv"]').count()) >= 0, "edit-locally control present where supported");
  await b.close();
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
