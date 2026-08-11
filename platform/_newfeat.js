/* eslint-disable @typescript-eslint/no-require-imports -- dev-only */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  for (let a = 1; a <= 5; a++) {
    await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 60000 });
    await p.fill('input[name="email"]', 'admin@demo.test');
    await p.fill('input[name="password"]', 'password');
    await p.click('[data-testid="login-submit"]');
    try { await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 20000 }); break; } catch {}
  }
  const eng = p.url().replace(/\/dashboard$/, '');

  // 1. Per-task due date: set on D4.1, expect header + phase row to show it
  await p.goto(eng + '/forms/D4.1', { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid="due-date-input"]');
  await p.fill('[data-testid="due-date-input"]', '2026-08-15');
  await p.click('[data-testid="due-date-save"]');
  await p.waitForTimeout(2500);
  await p.goto(eng + '/forms/D4.1', { waitUntil: 'networkidle' });
  const dd = await p.evaluate(() => ({
    input: document.querySelector('[data-testid="due-date-input"]')?.value,
    meta: document.querySelector('main p')?.innerText.includes('2026-08-15') || document.body.innerText.includes('2026-08-15'),
  }));
  console.log('due-date: saved=' + dd.input + ' shownInHeader=' + dd.meta);
  await p.goto(eng + '/phases/pre-planning', { waitUntil: 'networkidle' });
  await p.waitForSelector('tr[data-testid="phase-task-D4.1"]');
  const row = await p.evaluate(() => document.querySelector('tr[data-testid="phase-task-D4.1"]').innerText.replace(/\s+/g, ' '));
  console.log('phase row D4.1: ' + (row.includes('15') && row.includes('2026') ? 'SHOWS CUSTOM DATE ✓' : 'MISSING DATE ✗ (' + row.slice(0, 90) + ')'));

  // 2. Wizard partner select present with users
  await p.goto('http://localhost:3000/new-engagement', { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid="engagement-partner"]');
  const partners = await p.evaluate(() => document.querySelectorAll('[data-testid="engagement-partner"] option').length);
  console.log('wizard partner select: ' + partners + ' options (incl. "assign later")');

  // 3. Pending state: comment submit disables while action runs
  await p.goto(eng + '/discussion', { waitUntil: 'networkidle' });
  await p.fill('[data-testid="comment-input"]', 'Pending-state check comment.');
  await p.click('[data-testid="comment-submit"]');
  const disabled = await p.evaluate(() => document.querySelector('[data-testid="comment-submit"]')?.disabled ?? 'gone');
  await p.waitForTimeout(2500);
  console.log('comment submit disabled during action: ' + disabled);

  // 4. Empty-state copy (activity of a fresh engagement is non-empty; check notifications empty text presence in i18n via time page of new engagement? just check discussion empty gone (we posted). Check notifications page text.)
  await p.goto('http://localhost:3000/notifications', { waitUntil: 'networkidle' });
  const notif = await p.evaluate(() => document.body.innerText.includes('you will be notified') || document.body.innerText.includes('Nothing yet') || document.querySelectorAll('[data-testid="notification-row"], li').length > 0);
  console.log('notifications guided/populated: ' + notif);
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
