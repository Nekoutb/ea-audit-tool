/* eslint-disable @typescript-eslint/no-require-imports -- dev-only */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 900 } })).newPage();
  for (let a = 1; a <= 4; a++) {
    await p.goto('https://www.auditisa.com/login', { waitUntil: 'networkidle', timeout: 60000 });
    await p.fill('input[name="email"]', 'admin@auditisa.com'); await p.fill('input[name="password"]', 'admin');
    await p.click('[data-testid="login-submit"]');
    try { await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 20000 }); break; } catch {}
  }
  const eng = p.url().replace(/\/dashboard$/, '');
  await p.goto('https://www.auditisa.com/resources', { waitUntil: 'networkidle' });
  const res = await p.isVisible('[data-testid="workload-table"]');
  await p.goto(eng + '/time', { waitUntil: 'networkidle' });
  const time = await p.isVisible('[data-testid="budget-actual"]');
  const links = await (async () => { await p.goto(eng + '/dashboard', { waitUntil: 'networkidle' });
    return { activity: await p.isVisible('[data-testid="dashboard-activity-link"]'), time: await p.isVisible('[data-testid="dashboard-time-link"]') }; })();
  console.log('prod: resourcesRenders=' + res + ' timeRenders=' + time + ' dashLinks(activity/time)=' + links.activity + '/' + links.time);
  await b.close();
})().catch(e => { console.error('FATAL', e.message); process.exit(1); });
