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
  ok('login -> dashboard (' + p.url() + ')', p.url().includes('/dashboard'));
  const styles = await p.evaluate(() => getComputedStyle(document.body).fontFamily);
  ok('CSS applied (fontFamily set)', !!styles && styles.length > 3);

  // first engagement from the register
  let engId;
  const landed = p.url().match(/engagements\/([0-9a-f-]+)/);
  if (landed) {
    engId = landed[1];
  } else {
    const row = p.locator('[data-testid^="register-row-"]').first();
    await row.waitFor({ timeout: 20000 });
    await row.click();
    await p.waitForURL(/\/engagements\//, { timeout: 20000 });
    engId = new URL(p.url()).pathname.match(/engagements\/([0-9a-f-]+)/)[1];
  }
  ok('engagement open ' + engId.slice(0, 8), true);

  // Wave 3: confirmations page
  await p.goto(`/engagements/${engId}/confirmations`, { waitUntil: 'domcontentloaded' });
  ok('confirmations: manual-subject select', await p.locator('[data-testid="manual-subject"]').count() > 0);
  ok('confirmations: method radios', await p.locator('input[name="method"]').count() >= 2);

  // Wave 5: conclusion report-components panel
  await p.goto(`/engagements/${engId}/conclusion`, { waitUntil: 'domcontentloaded' });
  ok('conclusion: report-components panel', await p.locator('[data-testid="report-components"]').count() === 1);
  const rows = await p.locator('[data-testid^="report-component-"]').count();
  ok(`conclusion: 13 component rows (got ${rows})`, rows === 13);

  // Wave 2: sampling controls on a section page (find one via data-page lead table link or groups)
  await p.goto(`/engagements/${engId}/planning`, { waitUntil: 'domcontentloaded' });
  const secLink = p.locator(`a[href*="/engagements/${engId}/sections/"]`).first();
  if (await secLink.count()) {
    const sHref = await secLink.getAttribute('href');
    await p.goto(sHref, { waitUntil: 'domcontentloaded' });
    ok('section: sampling-confidence select', await p.locator('[data-testid="sampling-confidence"]').count() > 0);
    ok('section: sampling-expected input', await p.locator('[data-testid="sampling-expected"]').count() > 0);
  } else {
    out.push('SKIP section sampling controls (no section link on planning page)');
  }

  // data page (Wave 1 regression)
  await p.goto(`/engagements/${engId}/data`, { waitUntil: 'domcontentloaded' });
  ok('data page renders (journal form)', await p.locator('form#journal, [data-testid="tb-diff"], h1').count() > 0);

  console.log(out.join('\n'));
  console.log(errs.length ? 'ERRORS:\n' + errs.join('\n') : 'NO 5xx / PAGE ERRORS');
  await b.close();
  process.exit(out.some((l) => l.startsWith('FAIL')) || errs.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
