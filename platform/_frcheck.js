/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
const BASE = "http://localhost:3100";
const ID = process.env.ENG_ID;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto(`${BASE}/login`);
  await p.getByRole("button", { name: /^(French|Français)$/ }).click();
  await p.waitForLoadState("networkidle");
  await p.fill("input[name=email]", "alice@firm-a.test");
  await p.fill("input[name=password]", "password");
  await p.getByTestId("login-submit").click();
  await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 });

  await p.goto(`${BASE}/engagements/${ID}/phase/acceptance`);
  await p.waitForLoadState("networkidle");
  const head = await p.locator("h1").first().innerText();
  console.log("phase heading:", head);
  console.log("conditional strip:", await p.getByText("S’applique selon le cas").count());

  const href = await p.locator('[data-testid="phase-task-D3.2"]').getAttribute("href");
  await p.goto(BASE + href);
  await p.waitForLoadState("networkidle");
  const form = p.locator('[data-testid="wp-form-D3.2"]');
  console.log("procedures:", await form.locator('[data-testid^="wp-p_"]').count());
  console.log("sources label:", await form.getByText(/Sources attendues :/).count());
  const t = await form.innerText();
  console.log("part A title present:", t.includes("Procédures et sources attendues"));
  // any English leaking into the French render of the procedures?
  const leaks = ["Expected sources", "Record the result", "Perform each procedure"].filter((s) => t.includes(s));
  console.log("english leaks:", leaks.length ? leaks.join(" | ") : "none");
  await b.close();
})();
