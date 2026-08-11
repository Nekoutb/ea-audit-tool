/* eslint-disable @typescript-eslint/no-require-imports */
// Reproduce the partner-conclusion save on the failed run's engagement.
const { chromium } = require("@playwright/test");
require("dotenv").config();
const { Pool } = require("pg");
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const r = await pool.query(
    "SELECT e.id FROM engagement e JOIN tenant t ON t.id=e.tenant_id WHERE t.name='Cabinet Alpha' AND e.phase<>'archived' ORDER BY e.created_at DESC LIMIT 1",
  );
  const id = r.rows[0].id;
  await pool.end();
  console.log("engagement:", id);

  const b = await chromium.launch();
  const p = await b.newPage();
  p.on("response", (res) => {
    if (res.status() >= 400) console.log("HTTP", res.status(), res.url().slice(0, 120));
  });
  await p.context().addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);
  await p.goto("http://localhost:3100/login");
  await p.fill("input[name=email]", "alice@firm-a.test");
  await p.fill("input[name=password]", "password");
  await p.getByTestId("login-submit").click();
  await p.waitForURL("**/dashboard");

  await p.goto(`http://localhost:3100/engagements/${id}/conclusion`);
  await p.waitForLoadState("networkidle");
  const before = await p.getByTestId("gate-partner_conclusion").innerText();
  console.log("gate before:", JSON.stringify(before));
  await p.getByTestId("partner-conclusion-text").fill("Sufficient appropriate evidence obtained.");
  await p.getByTestId("independence-reconfirm").check();
  await p.getByTestId("save-partner-conclusion").click();
  await p.waitForLoadState("networkidle");
  console.log("url after save:", p.url());
  const after = await p.getByTestId("gate-partner_conclusion").innerText();
  console.log("gate after:", JSON.stringify(after));
  const err = await p.locator('[data-testid*="error"]').allInnerTexts();
  console.log("errors on page:", err.length ? err.join(" | ") : "(none)");
  await b.close();
})().catch((e) => { console.error("ERROR", e.message); process.exit(1); });
