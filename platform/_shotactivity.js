/* eslint-disable @typescript-eslint/no-require-imports -- dev-only screenshot script */
const { chromium } = require('playwright');
const OUT = 'C:\\Users\\UltraBook 3.1\\Documents\\AI Projects\\EA AUDIT TOOL\\design-mockups\\';
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1909, height: 943 } })).newPage();
  for (let a = 1; a <= 5; a++) {
    await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 60000 });
    await p.fill('input[name="email"]', 'admin@demo.test');
    await p.fill('input[name="password"]', 'password');
    await p.click('[data-testid="login-submit"]');
    try { await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 20000 }); break; } catch {}
  }
  const eng = p.url().replace(/\/dashboard$/, '');

  // Trigger a sign-off (records an activity), then check the activity page.
  await p.goto(eng + '/phases/conclusion', { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid="phase-task-list"]', { timeout: 30000 });
  const pbtn = p.locator('[data-testid^="sign-preparer-"]').first();
  if (await pbtn.count()) {
    await pbtn.click();
    await p.waitForLoadState('networkidle', { timeout: 30000 });
    await p.waitForSelector('[data-testid="phase-task-list"]', { timeout: 30000 });
  }

  // Dashboard link present?
  await p.goto(eng + '/dashboard', { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 30000 });
  const hasLink = await p.isVisible('[data-testid="dashboard-activity-link"]');

  // Activity page
  await p.goto(eng + '/activity', { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid="activity-log"]', { timeout: 30000 });
  await p.waitForTimeout(400);
  const entries = await p.evaluate(() => {
    const items = [...document.querySelectorAll('[data-testid="activity-log"] li')];
    return items.slice(0, 5).map((li) => li.innerText.replace(/\s+/g, ' ').trim());
  });
  console.log('dashboard activity link visible: ' + hasLink);
  console.log('activity entries: ' + entries.length);
  entries.forEach((e) => console.log('  • ' + e));
  await p.screenshot({ path: OUT + 'shot-activity.png' });
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
