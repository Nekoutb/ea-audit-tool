/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.context().addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);
  await p.goto("http://localhost:3100/login");
  await p.fill("input[name=email]", "alice@firm-a.test");
  await p.fill("input[name=password]", "password");
  await p.getByTestId("login-submit").click();
  await p.waitForURL("**/dashboard");
  await p.goto("http://localhost:3100/engagements/c9791388-fb25-49e1-8a6e-8672e4c3012c/conclusion");
  await p.waitForLoadState("networkidle");
  console.log("gate on fresh load:", JSON.stringify(await p.getByTestId("gate-partner_conclusion").innerText()));
  await b.close();
})();
