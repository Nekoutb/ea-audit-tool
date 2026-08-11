/* eslint-disable @typescript-eslint/no-require-imports -- dev-only screenshot script */
const { chromium } = require('playwright');
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
  const eng = p.url().replace(/\/dashboard$/, '');
  const linkVisible = await p.isVisible('[data-testid="dashboard-activity-link"]');
  await p.goto(eng + '/activity', { waitUntil: 'networkidle' });
  const ok = await p.isVisible('[data-testid="activity-log"]');
  const bodyText = (await p.evaluate(() => document.body.innerText)).slice(0, 120).replace(/\s+/g, ' ');
  console.log('prod: dashboardLink=' + linkVisible + ' activityPageRenders=' + ok);
  console.log('prod activity page top: ' + bodyText);
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
