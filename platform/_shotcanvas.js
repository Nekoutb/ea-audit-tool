/* eslint-disable @typescript-eslint/no-require-imports -- dev-only verification */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 940 } })).newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('PAGEERR ' + e.message.slice(0, 120)));

  for (let a = 1; a <= 6; a++) {
    await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 90000 });
    await p.fill('input[name="email"]', 'admin@demo.test');
    await p.fill('input[name="password"]', 'password');
    await p.click('[data-testid="login-submit"]');
    try { await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 25000 }); break; } catch {}
  }
  const eng = p.url().replace(/\/dashboard$/, '');
  console.log('login OK -> ' + p.url().slice(-60));

  // 1. Dashboard: 3 sections, groups roll out, no detail leak
  const dash = await p.evaluate(() => ({
    sections: [...document.querySelectorAll('[data-testid^="section-"]')].map((el) => el.innerText.replace(/\s+/g, ' ').slice(0, 44)),
    groups: [...document.querySelectorAll('[data-testid^="group-"]')].filter((el) => el.dataset.testid !== 'group-rollout').length,
    tiles: document.querySelectorAll('[data-testid="summary-tiles"] > div').length,
    hasBlur: getComputedStyle(document.querySelector('header')).backdropFilter.includes('blur'),
    bodyGradient: getComputedStyle(document.body).backgroundImage.includes('radial-gradient'),
  }));
  console.log('sections: ' + JSON.stringify(dash.sections));
  console.log('groups visible=' + dash.groups + ' tiles=' + dash.tiles + ' glassBlur=' + dash.hasBlur + ' greyGradient=' + dash.bodyGradient);
  await p.screenshot({ path: '_shot-dash.png' });

  // 2. Switch to Execution -> groups change
  await p.click('[data-testid="section-execution"]');
  await p.waitForTimeout(600);
  const exeGroups = await p.evaluate(() =>
    [...document.querySelectorAll('[data-testid^="group-"]')].filter((el) => el.dataset.testid !== 'group-rollout').map((el) => el.innerText.split('\n')[0].slice(0, 40)),
  );
  console.log('execution groups: ' + JSON.stringify(exeGroups));

  // 3. Group page: ST1 -> tasks with display codes
  await p.goto(eng + '/groups/st1', { waitUntil: 'networkidle' });
  const grp = await p.evaluate(() => ({
    h1: document.querySelector('h1')?.innerText.replace(/\s+/g, ' '),
    rows: [...document.querySelectorAll('tbody tr')].map((r) => r.innerText.split('\t')[0].split('\n')[0]),
    back: !!document.querySelector('[data-testid="back-to-dashboard"]'),
  }));
  console.log('group ST1: ' + JSON.stringify(grp));
  await p.screenshot({ path: '_shot-group.png' });

  // 4. Task page via group row: display code + back-to-group
  await p.click('tbody tr[data-testid^="phase-task-"]');
  await p.waitForTimeout(2500);
  const task = await p.evaluate(() => ({
    url: location.pathname.slice(-22),
    badge: document.querySelector('h1 span')?.innerText,
    back: document.querySelector('[data-testid="back-to-phase"]')?.innerText.replace(/\s+/g, ' '),
  }));
  console.log('task page: ' + JSON.stringify(task));

  // 5. E group page (execution accounts)
  await p.goto(eng + '/groups/e3', { waitUntil: 'networkidle' });
  const e3 = await p.evaluate(() => ({
    h1: document.querySelector('h1')?.innerText.replace(/\s+/g, ' '),
    rowCount: document.querySelectorAll('tbody tr').length,
    firstCode: document.querySelector('tbody tr span')?.innerText,
  }));
  console.log('group E3: ' + JSON.stringify(e3));
  await p.screenshot({ path: '_shot-e3.png' });

  console.log('page errors: ' + (errors.length ? errors.join(' | ') : 'none'));
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
