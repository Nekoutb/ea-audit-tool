/* eslint-disable @typescript-eslint/no-require-imports -- dev-only layout verification */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 950 }, baseURL: 'https://www.auditisa.com' })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 110)));
  p.on('response', (r) => { if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${r.url().slice(-60)}`); });
  const out = [];
  const ok = (n, c) => out.push(`${c ? 'PASS' : 'FAIL'} ${n}`);

  await p.goto('/login', { waitUntil: 'networkidle' });
  await p.fill('input[name="email"]', 'admin@auditisa.com');
  await p.fill('input[name="password"]', 'admin');
  await p.click('[data-testid="login-submit"]');
  await p.waitForTimeout(6000);
  const eng = p.url().replace(/\/dashboard$/, '');
  ok('login → dashboard', /\/engagements\//.test(p.url()));

  // 1. four phases in the nav, everywhere
  ok('phase nav: 4 phases + overview', await p.locator('[data-testid^="phase-"]').count() >= 5);
  ok('phase nav: tools link', await p.locator('[data-testid="nav-tools"]').count() === 1);
  ok('dashboard: 4 phase cards', await p.locator('[data-testid^="section-"]').count() === 4);

  // 2. left edge is identical across pages (the alignment complaint)
  const edges = {};
  for (const path of ['/dashboard', '/phase/acceptance', '/phase/strategy', '/tools', '/team', '/tasks', '/cra', '/risks', '/planning', '/findings']) {
    await p.goto(eng + path, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(250);
    edges[path] = await p.evaluate(() => {
      const m = document.querySelector('main');
      if (!m) return { main: -1, top: -1 };
      const nav = document.querySelector('nav, header');
      return { main: Math.round(m.getBoundingClientRect().left), top: nav ? Math.round(nav.getBoundingClientRect().top) : -1 };
    });
  }
  const lefts = [...new Set(Object.values(edges).map((e) => e.main))];
  const tops = [...new Set(Object.values(edges).map((e) => e.top))];
  ok(`page shell identical across 10 pages (${lefts.join(',')})`, lefts.length === 1);
  ok(`nav top offset identical (${tops.join(',')})`, tops.length === 1);

  // 3. phase page: sequential tasks, links inline
  await p.goto(eng + '/phase/strategy', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(300);
  const n = await p.locator('[data-testid="phase-tasks"] li').count();
  ok(`strategy phase lists tasks in sequence (${n})`, n > 0);
  ok('fed-by / feeds shown inline', (await p.locator('main >> text=/Fed by|Feeds/').count()) >= 2);

  // 4. task page carries its working paper
  const first = p.locator('[data-testid="phase-tasks"] li a').first();
  await first.click();
  await p.waitForURL('**/sections/**');
  await p.waitForTimeout(400);
  ok('task page opens standalone', /\/sections\//.test(p.url()));
  ok('working paper present', await p.locator('[data-testid^="wp-form-"]').count() === 1);
  const fields = await p.locator('[data-testid^="wp-"]:not([data-testid^="wp-form"]):not([data-testid^="wp-save"])').count();
  ok(`paper has fields (${fields})`, fields >= 3);
  ok('task page has no old tab cluster', await p.locator('[data-testid^="tab-"]').count() === 0);

  // 5. tools grouped, with links to the papers they feed
  await p.goto(eng + '/tools', { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(300);
  ok(`tools listed in one place (${await p.locator('[data-testid^="tool-"]:not([data-testid="tool-list"])').count()})`, await p.locator('[data-testid^="tool-"]:not([data-testid="tool-list"])').count() === 8);
  ok('independence inquiry on the tools page', await p.locator('#independence').count() === 1);
  ok('independence stats', await p.locator('[data-testid="indep-stats"]').count() === 1);

  // 6. no horizontal overflow anywhere
  const over = [];
  for (const path of ['/dashboard', '/phase/acceptance', '/phase/strategy', '/phase/execution', '/phase/conclusion', '/tools']) {
    await p.goto(eng + path, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(200);
    const bad = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (bad) over.push(path);
  }
  ok(`no horizontal overflow (${over.length ? over.join(',') : 'all clean'})`, over.length === 0);

  console.log(out.join('\n'));
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'NO 5xx / PAGE ERRORS');
  await b.close();
  process.exit(out.some((l) => l.startsWith('FAIL')) || errs.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
