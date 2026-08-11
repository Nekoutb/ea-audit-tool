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
  const eng = p.url().replace(/\/dashboard$/, '');

  await p.goto(eng + '/legal', { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  const unl = await p.evaluate(() => {
    return [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=file]), textarea, select')]
      .filter((el) => !el.closest('label') && !(el.id && document.querySelector('label[for="' + el.id + '"]')) && !el.getAttribute('aria-label'))
      .map((el) => el.tagName + ' name=' + (el.name || '?') + ' ph="' + (el.placeholder || '') + '"');
  });
  console.log('LEGAL unlabeled:'); unl.forEach((u) => console.log('  ' + u));

  await p.goto(eng + '/planning', { waitUntil: 'networkidle' });
  await p.waitForTimeout(300);
  const tiny = await p.evaluate(() => {
    const seen = {};
    [...document.querySelectorAll('button, a')].forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width > 0 && r.height > 0 && (r.height < 24 || r.width < 24)) {
        const key = el.tagName + ' h=' + Math.round(r.height) + ' "' + el.innerText.trim().slice(0, 22) + '" cls=' + String(el.className).split(' ').slice(0, 3).join('.');
        seen[key] = (seen[key] || 0) + 1;
      }
    });
    return Object.entries(seen).map(([k, n]) => n + 'x ' + k);
  });
  console.log('PLANNING tiny targets:'); tiny.forEach((t) => console.log('  ' + t));
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
