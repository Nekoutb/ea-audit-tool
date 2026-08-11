/* eslint-disable @typescript-eslint/no-require-imports -- scratch */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 140)));
  p.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 140)); });
  await p.goto("https://ealearnings.com/admin", { waitUntil: "networkidle", timeout: 45000 });
  await p.waitForTimeout(2000);
  console.log("login card:", await p.isVisible(".admin-login-card"));
  console.log("heading:", (await p.textContent(".admin-login-card h1").catch(() => "n/a")).trim());
  console.log("errors:", errs.length ? errs.slice(0, 3) : "none");
  await b.close();
})();
