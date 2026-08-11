/* eslint-disable @typescript-eslint/no-require-imports -- prod health check */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 940 } })).newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('PAGEERR ' + e.message.slice(0, 90)));
  const bad = [];
  p.on('response', (r) => { if (r.status() >= 500) bad.push(r.status() + ' ' + r.url().slice(-50)); });
  const R = [];
  const ok = (name, cond) => R.push((cond ? 'PASS ' : 'FAIL ') + name);

  // 1. Login (the real flow, not just the form)
  await p.goto('https://www.auditisa.com/login', { waitUntil: 'networkidle', timeout: 60000 });
  await p.fill('input[name="email"]', 'admin@auditisa.com');
  await p.fill('input[name="password"]', 'admin');
  await p.click('[data-testid="login-submit"]');
  await p.waitForTimeout(6000);
  ok('login lands on engagement hub', p.url().includes('/dashboard'));
  const eng = p.url().replace(/\/dashboard$/, '');

  // 2. Hub band
  await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 30000 });
  const hub = await p.evaluate(() => ({
    rings: [...document.querySelectorAll('[data-testid^="section-"]')].map((el) => el.innerText.split('\n')[0]),
    groups: [...document.querySelectorAll('[data-testid^="group-"]')].filter((el) => el.dataset.testid !== 'group-rollout').length,
    tiles: document.querySelectorAll('[data-testid="summary-tiles"] > div').length,
    findings: !!document.querySelector('[data-testid="findings-band"]'),
    feed: !!document.querySelector('[data-testid="engagement-feed"]'),
  }));
  ok('3 section rings (' + hub.rings.join('/') + ')', hub.rings.length === 3);
  ok('task-status groups render (' + hub.groups + ')', hub.groups >= 5);
  ok('summary tiles (4)', hub.tiles === 4);
  ok('findings band', hub.findings);
  ok('engagement feed panel', hub.feed);

  // 3. Group page + task page round-trip
  await p.goto(eng + '/groups/st1', { waitUntil: 'networkidle' });
  const st1 = await p.evaluate(() => document.querySelectorAll('tbody tr').length);
  ok('group ST1 lists tasks (' + st1 + ')', st1 >= 1);
  await p.goto(eng + '/forms/D3.1', { waitUntil: 'networkidle' });
  const form = await p.evaluate(() => ({
    badge: document.querySelector('h1 span')?.innerText,
    signoff: !!document.querySelector('[data-testid="task-signoff"]'),
    purpose: !!document.querySelector('[data-testid="task-purpose"]'),
  }));
  ok('task page ST1.1 (badge=' + form.badge + ', sign-off, purpose)', form.badge === 'ST1.1' && form.signoff && form.purpose);

  // 4. Register + portfolio + team
  await p.goto('https://www.auditisa.com/engagements', { waitUntil: 'networkidle' });
  const reg = await p.evaluate(() => ({
    rows: document.querySelectorAll('tbody tr').length,
    filters: !!document.querySelector('[data-testid="register-filters"]'),
  }));
  ok('register rows (' + reg.rows + ') + filters', reg.rows >= 1 && reg.filters);
  await p.goto('https://www.auditisa.com/dashboard', { waitUntil: 'networkidle' });
  const port = await p.evaluate(() => ({
    h1: document.querySelector('h1')?.innerText,
    priority: !!document.querySelector('[data-testid="priority-actions"]'),
    noDiag: !document.querySelector('[data-testid="dev-diagnostics"]'),
  }));
  ok('portfolio (' + port.h1 + ') + priority queue + no diagnostics', port.h1 === 'My Audit Portfolio' && port.priority && port.noDiag);
  await p.goto(eng + '/team', { waitUntil: 'networkidle' });
  ok('team page', await p.evaluate(() => document.querySelector('h1')?.innerText === 'Manage Team'));

  // 5. Which version is serving? v26 routes exist only after the pending build.
  const t1 = await p.goto(eng + '/tasks', { waitUntil: 'domcontentloaded' });
  const c1 = await p.goto(eng + '/cra', { waitUntil: 'domcontentloaded' });
  R.push('INFO /tasks -> ' + t1.status() + ' · /cra -> ' + c1.status() + ' (404 = still v25, v26 build pending)');

  console.log(R.join('\n'));
  console.log('5xx responses: ' + (bad.length ? bad.join(' | ') : 'none'));
  console.log('page errors: ' + (errors.length ? errors.join(' | ') : 'none'));
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
