/* eslint-disable @typescript-eslint/no-require-imports -- dev-only wave-2 verification */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 940 } })).newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message.slice(0, 100)));

  for (let a = 1; a <= 6; a++) {
    await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 90000 });
    await p.fill('input[name="email"]', 'admin@demo.test');
    await p.fill('input[name="password"]', 'password');
    await p.click('[data-testid="login-submit"]');
    try { await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 25000 }); break; } catch {}
  }

  // 1. Portfolio: priority actions + my engagements
  await p.goto('http://localhost:3000/dashboard', { waitUntil: 'networkidle' });
  const dash = await p.evaluate(() => ({
    priorityRows: [...document.querySelectorAll('[data-testid="priority-actions"] a')].map((a) => ({
      text: a.innerText.replace(/\s+/g, ' ').slice(0, 70),
      href: a.getAttribute('href'),
    })),
    myEng: [...document.querySelectorAll('[data-testid="my-engagements"] a')].map((a) => a.innerText.split('\n')[0]),
  }));
  console.log('priority rows: ' + JSON.stringify(dash.priorityRows, null, 1));
  console.log('my engagements: ' + JSON.stringify(dash.myEng));
  await p.screenshot({ path: '_shot-wave2.png' });

  // 2. Register filters: search + year + mine round-trip
  await p.goto('http://localhost:3000/engagements', { waitUntil: 'networkidle' });
  const base = await p.evaluate(() => document.querySelectorAll('tbody tr').length);
  await p.fill('[data-testid="register-search"]', 'zzz-no-match');
  await p.click('[data-testid="apply-filters"]');
  await p.waitForTimeout(1500);
  const none = await p.evaluate(() => document.querySelectorAll('tbody tr').length);
  await p.goto('http://localhost:3000/engagements?year=2025', { waitUntil: 'networkidle' });
  const byYear = await p.evaluate(() => document.querySelectorAll('tbody tr').length);
  await p.goto('http://localhost:3000/engagements?mine=1', { waitUntil: 'networkidle' });
  const mineRows = await p.evaluate(() => document.querySelectorAll('tbody tr').length);
  console.log(`register: base=${base} noMatch=${none} year2025=${byYear} mine=${mineRows}`);

  console.log('page errors: ' + (errors.length ? errors.join(' | ') : 'none'));
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
