/* eslint-disable @typescript-eslint/no-require-imports -- dev-only screenshot script */
const { chromium } = require('playwright');
const OUT = 'C:\\Users\\UltraBook 3.1\\Documents\\AI Projects\\EA AUDIT TOOL\\design-mockups\\';
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  for (let a = 1; a <= 5; a++) {
    await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 60000 });
    await p.fill('input[name="email"]', 'admin@demo.test');
    await p.fill('input[name="password"]', 'password');
    await p.click('[data-testid="login-submit"]');
    try { await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 20000 }); break; } catch {}
  }
  const eng = p.url().replace(/\/dashboard$/, '');
  const timeLink = await p.isVisible('[data-testid="dashboard-time-link"]');

  await p.goto(eng + '/time', { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid="budget-actual"]', { timeout: 30000 });
  await p.fill('[data-testid="time-hours"]', '3.5');
  await p.fill('[data-testid="time-note"]', 'Planning meeting');
  await p.click('[data-testid="time-submit"]');
  await p.waitForSelector('[data-testid="time-entries"]', { timeout: 30000 });
  await p.waitForTimeout(400);
  const info = await p.evaluate(() => {
    const rows = document.querySelectorAll('[data-testid="time-entries"] tbody tr').length;
    const actualCells = [...document.querySelectorAll('[data-testid="budget-actual"] tbody tr')].map(r => r.innerText.replace(/\s+/g, ' ').trim());
    return { rows, actualCells };
  });
  console.log('dashboard time link: ' + timeLink);
  console.log('my time entries: ' + info.rows);
  console.log('budget-vs-actual rows:'); info.actualCells.forEach(c => console.log('  ' + c));
  await p.screenshot({ path: OUT + 'shot-time.png' });
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
