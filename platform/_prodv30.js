/* eslint-disable @typescript-eslint/no-require-imports -- dev-only prod health check */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ baseURL: 'https://www.auditisa.com' });
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push('pageerror: ' + e.message.slice(0, 120)));
  p.on('response', (r) => { if (r.status() >= 500) errs.push(`HTTP ${r.status()} ${r.url().slice(0, 100)}`); });
  const out = [];
  const ok = (name, cond) => out.push(`${cond ? 'PASS' : 'FAIL'} ${name}`);

  await p.goto('/login', { waitUntil: 'networkidle', timeout: 60000 });
  await p.fill('input[name="email"]', 'admin@auditisa.com');
  await p.fill('input[name="password"]', 'admin');
  await p.click('[data-testid="login-submit"]');
  await p.waitForTimeout(6000);
  let landed = p.url().match(/engagements\/([0-9a-f-]+)/);
  if (!landed) {
    const row = p.locator('[data-testid^="register-row-"]').first();
    await row.waitFor({ timeout: 20000 });
    await row.click();
    await p.waitForURL(/\/engagements\//, { timeout: 20000 });
    landed = p.url().match(/engagements\/([0-9a-f-]+)/);
  }
  ok('login (' + p.url() + ')', !!landed);
  const engId = landed[1];

  // team page: 7 roles in ladder order + open-task counts
  await p.goto(`/engagements/${engId}/team`, { waitUntil: 'domcontentloaded' });
  const roles = await p.locator('[data-testid="team-role"] option').allTextContents();
  ok(`team roles (${roles.join('/')})`, roles.length === 7 && /senior manager/i.test(roles.join(' ')) && /director/i.test(roles.join(' ')));
  const openCells = await p.locator('[data-testid^="open-tasks-"]').count();
  ok(`open-task counts render (${openCells})`, openCells >= 1);

  // a task page: assignee select present
  await p.goto(`/engagements/${engId}/tasks`, { waitUntil: 'domcontentloaded' });
  ok('my-tasks: assigned-to-me filter', await p.locator('[data-testid="filter-assigned"]').count() === 1);
  const firstTask = p.locator('a[href*="/sections/"]').first();
  if (await firstTask.count()) {
    await p.goto(await firstTask.getAttribute('href'), { waitUntil: 'domcontentloaded' });
    ok('task page: assignee select', await p.locator('[data-testid="task-assignee"]').count() === 1);
  } else {
    out.push('SKIP task page (no section links on tasks page)');
  }

  console.log(out.join('\n'));
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'NO 5xx / PAGE ERRORS');
  await b.close();
  process.exit(out.some((l) => l.startsWith('FAIL')) || errs.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
