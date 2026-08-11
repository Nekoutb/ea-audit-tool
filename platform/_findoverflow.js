/* eslint-disable @typescript-eslint/no-require-imports -- dev-only */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 375, height: 812 } })).newPage();
  for (let a = 1; a <= 5; a++) {
    await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 60000 });
    await p.fill('input[name="email"]', 'admin@demo.test');
    await p.fill('input[name="password"]', 'password');
    await p.click('[data-testid="login-submit"]');
    try { await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 20000 }); break; } catch {}
  }
  const eng = p.url().replace(/\/dashboard$/, '');
  await p.goto(eng + '/time', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const offenders = await p.evaluate(() => {
    const docW = document.documentElement.clientWidth;
    const bad = [];
    document.querySelectorAll('*').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.right > docW + 1 || r.left < -1) {
        bad.push(
          el.tagName + '.' + String(el.className).split(' ').slice(0, 4).join('.') +
          ' -> left=' + Math.round(r.left) + ' right=' + Math.round(r.right) + ' w=' + Math.round(r.width),
        );
      }
    });
    return bad.slice(0, 12);
  });
  console.log(offenders.join('\n'));
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
