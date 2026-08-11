/* eslint-disable @typescript-eslint/no-require-imports -- dev-only screenshot script */
const { chromium } = require('playwright');
const OUT = 'C:\\Users\\UltraBook 3.1\\Documents\\AI Projects\\EA AUDIT TOOL\\design-mockups\\';
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
  for (let a = 1; a <= 4; a++) {
    await p.goto('https://www.auditisa.com/login', { waitUntil: 'networkidle', timeout: 60000 });
    await p.fill('input[name="email"]', 'admin@auditisa.com');
    await p.fill('input[name="password"]', 'admin');
    await p.click('[data-testid="login-submit"]');
    try { await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 20000 }); break; } catch {}
  }
  await p.goto('https://www.auditisa.com/settings', { waitUntil: 'networkidle' });
  const link = await p.isVisible('[data-testid="manage-users-link"]');
  await p.goto('https://www.auditisa.com/users', { waitUntil: 'networkidle' });
  const table = await p.isVisible('[data-testid="users-table"]');
  const rows = await p.locator('[data-testid="users-table"] tbody tr').count();
  console.log('prod users: settingsLink=' + link + ' tableRenders=' + table + ' rows=' + rows);
  await p.screenshot({ path: OUT + 'shot-prod-users.png' });
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
