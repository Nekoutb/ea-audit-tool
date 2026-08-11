/* eslint-disable @typescript-eslint/no-require-imports -- dev-only */
const { chromium } = require('playwright');
const OUT = 'C:\\Users\\UltraBook 3.1\\Documents\\AI Projects\\EA AUDIT TOOL\\design-mockups\\';
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
  for (let a = 1; a <= 5; a++) {
    await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 60000 });
    await p.fill('input[name="email"]', 'admin@demo.test');
    await p.fill('input[name="password"]', 'password');
    await p.click('[data-testid="login-submit"]');
    try { await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 20000 }); break; } catch {}
  }
  const eng = p.url().replace(/\/dashboard$/, '');

  // New task page layout on D4.7
  await p.goto(eng + '/forms/D4.7', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  const d = await p.evaluate(() => ({
    tabs: document.querySelectorAll('[data-testid^="tab-"]').length,
    back: !!document.querySelector('[data-testid="back-to-phase"]'),
    backText: document.querySelector('[data-testid="back-to-phase"]')?.innerText.trim(),
    h1: document.querySelector('h1')?.innerText.replace(/\s+/g, ' ').trim(),
    purpose: !!document.querySelector('[data-testid="task-purpose"]'),
    checklistItems: document.querySelectorAll('[data-testid="task-purpose"] ol li').length,
    signoff: !!document.querySelector('[data-testid="task-signoff"]'),
    saveForm: !!document.querySelector('[data-testid="save-form"]'),
    saveHandoff: !!document.querySelector('[data-testid="save-handoff"]'),
    reviewNotes: !!document.querySelector('[data-testid="task-review-notes"]'),
  }));
  console.log('D4.7: tabs=' + d.tabs + ' back=' + d.back + ' ("' + d.backText + '")');
  console.log('h1: ' + d.h1);
  console.log('purpose=' + d.purpose + ' checklist=' + d.checklistItems + ' signoffBar=' + d.signoff + ' save=' + d.saveForm + ' handoff=' + d.saveHandoff + ' reviewNotes=' + d.reviewNotes);
  await p.screenshot({ path: OUT + 'shot-taskpage.png', fullPage: true });

  // Save & hand off on D4.6: fill field, click, expect phase list + row in review
  await p.goto(eng + '/forms/D4.2', { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid="save-handoff"]', { timeout: 20000 });
  const ta = p.locator('#task-form textarea').first();
  if (await ta.count()) await ta.fill('IT environment documented for hand-off test.');
  await p.click('[data-testid="save-handoff"]');
  await p.waitForURL('**/phases/**', { timeout: 30000 });
  await p.waitForSelector('[data-testid="phase-task-list"]', { timeout: 30000 });
  await p.waitForTimeout(400);
  const row = await p.evaluate(() => {
    const r = document.querySelector('tr[data-testid="phase-task-D4.2"]');
    return r ? r.innerText.replace(/\s+/g, ' ').trim() : 'ROW NOT FOUND';
  });
  console.log('after Save&handoff -> ' + new URL(p.url()).pathname.split('/').slice(-2).join('/'));
  console.log('D4.2 row: ' + row);
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
