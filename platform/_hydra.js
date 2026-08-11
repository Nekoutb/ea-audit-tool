/* eslint-disable @typescript-eslint/no-require-imports -- scratch */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 160)));
  await p.goto("http://localhost:3000/admin", { waitUntil: "networkidle" });
  await p.waitForTimeout(1500);
  const overlay = await p.evaluate(() => {
    const el = document.querySelector('[data-testid="vinext-dev-error-message"]');
    return el ? el.textContent.slice(0, 200) : null;
  });
  console.log("hydration/overlay:", overlay || "none");
  console.log("page errors:", errs.length ? errs.slice(0, 2) : "none");
  console.log("login card visible:", await p.isVisible(".admin-login-card"));
  console.log("h1:", await p.textContent(".admin-login-card h1").catch(() => "n/a"));
  await b.close();
})();
