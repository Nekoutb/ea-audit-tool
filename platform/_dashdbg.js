/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  p.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
  await p.goto("http://localhost:3100/login");
  await p.fill("input[name=email]", "alice@firm-a.test");
  await p.fill("input[name=password]", "password");
  await p.getByTestId("login-submit").click();
  await p.waitForURL("**/dashboard", { timeout: 30000 });
  const r = await p.goto("http://localhost:3100/dashboard");
  console.log("status:", r.status());
  console.log("firm-notes count:", await p.getByTestId("firm-notes").count());
  const txt = await p.locator("body").innerText();
  console.log("has 'Alpha confidential':", txt.includes("Alpha confidential"));
  console.log("--- first 300 chars ---");
  console.log(txt.slice(0, 300));
  await b.close();
})();
