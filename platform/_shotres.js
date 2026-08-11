/* eslint-disable @typescript-eslint/no-require-imports -- dev-only */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  for (let a = 1; a <= 5; a++) {
    await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 60000 });
    await p.fill('input[name="email"]', 'admin@demo.test'); await p.fill('input[name="password"]', 'password');
    await p.click('[data-testid="login-submit"]');
    try { await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 20000 }); break; } catch {}
  }
  await p.goto('http://localhost:3000/settings', { waitUntil: 'networkidle' });
  const link = await p.isVisible('[data-testid="team-workload-link"]');
  await p.goto('http://localhost:3000/resources', { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid="workload-table"]', { timeout: 30000 });
  const rows = await p.locator('[data-testid="workload-table"] tbody tr').count();
  const firstRow = await p.evaluate(() => { const r = document.querySelector('[data-testid="workload-table"] tbody tr'); return r ? r.innerText.replace(/\s+/g,' ').trim() : 'none'; });
  console.log('settings workload link=' + link + ' rows=' + rows);
  console.log('first row: ' + firstRow);
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
