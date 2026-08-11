/* eslint-disable @typescript-eslint/no-require-imports -- scratch */
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 360, height: 740 } });
  await p.goto("http://localhost:3000/admin", { waitUntil: "networkidle" });
  await p.fill('.admin-login-card input[type="email"]', "support@ealearnings.com");
  await p.fill('.admin-login-card input[type="password"]', "Str0ngPass!2026");
  await p.click(".admin-login-card .auth-submit");
  await p.waitForSelector(".admin-identity-bar", { timeout: 20000 });
  await p.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await p.click(".gateway-sign-in");
  await p.waitForSelector(".app-shell", { timeout: 20000 });
  await p.waitForTimeout(400);
  const rows = await p.evaluate(() => {
    const vw = window.innerWidth, out = [];
    for (const el of document.querySelectorAll("body *")) {
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (r.right > vw + 2) out.push({ sel: el.tagName.toLowerCase() + "." + (el.className || "").toString().trim().split(/\s+/).join("."), right: Math.round(r.right), w: Math.round(r.width) });
    }
    return { vw, scrollW: document.scrollingElement.scrollWidth, rows: out.slice(0, 10) };
  });
  console.log(JSON.stringify(rows, null, 1));
  await b.close();
})();
