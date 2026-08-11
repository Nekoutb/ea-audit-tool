/* eslint-disable @typescript-eslint/no-require-imports -- dev-only */
const { chromium } = require('playwright');
const OUT = 'C:\\Users\\UltraBook 3.1\\Documents\\AI Projects\\EA AUDIT TOOL\\design-mockups\\';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 375, height: 812 }, deviceScaleFactor: 2 });
  const p = await ctx.newPage();
  for (let a = 1; a <= 5; a++) {
    await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 60000 });
    await p.fill('input[name="email"]', 'admin@demo.test');
    await p.fill('input[name="password"]', 'password');
    await p.click('[data-testid="login-submit"]');
    try { await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 20000 }); break; } catch {}
  }
  const eng = p.url().replace(/\/dashboard$/, '');
  const audit = async (name) => {
    await p.waitForTimeout(600);
    const m = await p.evaluate(() => ({
      hScroll: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      vClipped: document.documentElement.scrollHeight > document.documentElement.clientHeight
        && getComputedStyle(document.body).overflow === 'hidden',
      bodyH: document.body.scrollHeight,
    }));
    console.log(name + ': hOverflow=' + m.hScroll + 'px bodyOverflowHiddenClipping=' + m.vClipped);
    await p.screenshot({ path: OUT + 'shot-mob-' + name + '.png' });
  };
  await audit('dashboard');
  await p.goto(eng + '/phases/pre-planning', { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid="phase-task-list"]', { timeout: 30000 });
  await audit('phase');
  await p.goto('http://localhost:3000/new-engagement', { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid="complexity-result"]', { timeout: 30000 });
  await audit('wizard');
  await p.goto(eng + '/time', { waitUntil: 'networkidle' });
  await audit('time');
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
