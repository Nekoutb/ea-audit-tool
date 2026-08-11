/* eslint-disable @typescript-eslint/no-require-imports -- scratch */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(String(e).slice(0, 300)));
  await p.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await p.click(".gateway-sign-in").catch(() => {});
  await p.waitForTimeout(1500);
  const overlay = await p.evaluate(() => {
    const el = document.querySelector('[data-testid="vinext-dev-error-backdrop"]');
    return el ? el.innerText.slice(0, 700) : null;
  });
  console.log("PAGE ERRORS:", errs.slice(0, 2));
  console.log("OVERLAY:", overlay);
  await b.close();
})();
