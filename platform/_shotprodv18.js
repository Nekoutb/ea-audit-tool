/* eslint-disable @typescript-eslint/no-require-imports -- prod verification */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 940 } })).newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('PAGEERR ' + e.message.slice(0, 100)));

  await p.goto('https://www.auditisa.com/login', { waitUntil: 'networkidle', timeout: 60000 });
  await p.fill('input[name="email"]', 'admin@auditisa.com');
  await p.fill('input[name="password"]', 'admin');
  await p.click('[data-testid="login-submit"]');
  await p.waitForTimeout(6000);
  console.log('after login: ' + p.url());

  // land on an engagement dashboard (login lands on most-recent, else pick via /engagements)
  if (!p.url().includes('/dashboard')) {
    await p.goto('https://www.auditisa.com/engagements', { waitUntil: 'networkidle' });
    const first = await p.locator('a[href*="/dashboard"]').first();
    await first.click();
    await p.waitForTimeout(4000);
  }
  await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 30000 });
  const eng = p.url().replace(/\/dashboard$/, '');

  const dash = await p.evaluate(() => ({
    sections: [...document.querySelectorAll('[data-testid^="section-"]')].map((el) => el.innerText.split('\n')[1]),
    groups: [...document.querySelectorAll('[data-testid^="group-"]')].filter((el) => el.dataset.testid !== 'group-rollout').length,
    tiles: document.querySelectorAll('[data-testid="summary-tiles"] > div').length,
    blur: getComputedStyle(document.querySelector('header')).backdropFilter.includes('blur'),
    gradient: getComputedStyle(document.body).backgroundImage.includes('radial-gradient'),
  }));
  console.log('PROD dashboard: ' + JSON.stringify(dash));
  await p.screenshot({ path: '_shot-prod-dash.png' });

  await p.click('[data-testid="section-execution"]');
  await p.waitForTimeout(700);
  const exe = await p.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="group-"]')].filter((el) => el.dataset.testid !== 'group-rollout').map((el) => el.innerText.split('\n')[0]),
  );
  console.log('PROD execution groups: ' + JSON.stringify(exe));

  await p.goto(eng + '/groups/e1', { waitUntil: 'networkidle' });
  const grp = await p.evaluate(() => ({
    h1: document.querySelector('h1')?.innerText.replace(/\s+/g, ' '),
    rows: document.querySelectorAll('tbody tr').length,
    firstCode: document.querySelector('tbody tr span')?.innerText,
  }));
  console.log('PROD group E1: ' + JSON.stringify(grp));

  await p.goto(eng + '/groups/st1', { waitUntil: 'networkidle' });
  await p.click('tbody tr td:first-child');
  await p.waitForURL(/forms|documents/, { timeout: 25000 });
  console.log('PROD task nav: ' + p.url().split('/').slice(-2).join('/'));
  await p.waitForTimeout(2500);
  const badge = await p.evaluate(() => document.querySelector('h1 span')?.innerText);
  console.log('PROD task badge: ' + badge);
  await p.screenshot({ path: '_shot-prod-task.png' });

  console.log('page errors: ' + (errors.length ? errors.join(' | ') : 'none'));
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
