/* eslint-disable @typescript-eslint/no-require-imports -- prod verification */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1869, height: 930 } })).newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message.slice(0, 100)));

  await p.goto('https://www.auditisa.com/login', { waitUntil: 'networkidle', timeout: 60000 });
  await p.fill('input[name="email"]', 'admin@auditisa.com');
  await p.fill('input[name="password"]', 'admin');
  await p.click('[data-testid="login-submit"]');
  await p.waitForTimeout(6000);
  await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 30000 });

  const width = await p.evaluate(() => document.querySelector('main').getBoundingClientRect().width);
  const nav = await p.evaluate(() =>
    [...document.querySelectorAll('header a')].map((a) => a.getAttribute('href')).filter((h) => h && !h.includes('/engagements/')),
  );
  const entity = await p.evaluate(() => document.querySelector('[data-testid="entity-link"]')?.innerText);
  console.log('hub: width=' + width + ' | nav=' + JSON.stringify(nav) + ' | entityLink="' + entity + '"');

  await p.goto('https://www.auditisa.com/engagements', { waitUntil: 'networkidle' });
  const reg = await p.evaluate(() => ({
    heads: [...document.querySelectorAll('thead th')].map((t) => t.innerText.trim()).filter(Boolean),
    rows: document.querySelectorAll('tbody tr').length,
    first: document.querySelector('tbody tr')?.innerText.replace(/\s+/g, ' ').slice(0, 110),
  }));
  console.log('register: ' + JSON.stringify(reg.heads) + ' rows=' + reg.rows);
  console.log('first row: ' + reg.first);

  await p.goto('https://www.auditisa.com/dashboard', { waitUntil: 'networkidle' });
  const dash = await p.evaluate(() => ({
    h1: document.querySelector('h1')?.innerText,
    devDiag: !!document.querySelector('[data-testid="dev-diagnostics"]'),
    uuidLeak: /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(
      document.querySelector('main').innerText.replace(/\/(engagements|clients)\/[^\s]+/g, ''),
    ),
    stageLinks: document.querySelectorAll('[data-testid="firm-by-phase"] a').length,
  }));
  console.log('portfolio: ' + JSON.stringify(dash));
  await p.screenshot({ path: '_shot-prod-v21.png' });

  console.log('page errors: ' + (errors.length ? errors.join(' | ') : 'none'));
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
