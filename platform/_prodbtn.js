/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
const BASE = "https://www.auditisa.com";
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ ignoreHTTPSErrors: true });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  const en = p.getByRole("button", { name: /^(English|Anglais)$/ });
  if (await en.count()) { await en.click(); await p.waitForLoadState("networkidle"); }
  await p.fill("input[name=email]", process.env.PROD_EMAIL);
  await p.fill("input[name=password]", process.env.PROD_PASSWORD);
  await p.getByTestId("login-submit").click();
  await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 45000 });
  await p.goto(`${BASE}/engagements/${process.env.PROD_ENG_ID}/groups/st1`, { waitUntil: "networkidle" });
  const btn = p.getByRole("button", { name: /Add the missing tasks|Ajouter/i });
  console.log("button:", (await btn.count()) ? (await btn.first().innerText()).trim() : "(none)");
  await b.close();
})();
