/* eslint-disable @typescript-eslint/no-require-imports -- dev-only */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  for (let a = 1; a <= 5; a++) {
    await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 60000 });
    await p.fill('input[name="email"]', 'admin@demo.test');
    await p.fill('input[name="password"]', 'password');
    await p.click('[data-testid="login-submit"]');
    try { await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 20000 }); break; } catch {}
  }
  await p.waitForTimeout(600);
  const m = await p.evaluate(() => ({
    vOverflow: document.documentElement.scrollHeight - window.innerHeight,
    hOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  console.log('desktop dashboard 1440x900: vOverflow=' + m.vOverflow + 'px hOverflow=' + m.hOverflow + 'px');
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
