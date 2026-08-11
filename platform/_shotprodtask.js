/* eslint-disable @typescript-eslint/no-require-imports -- dev-only */
const { chromium } = require('playwright');
const OUT = 'C:\\Users\\UltraBook 3.1\\Documents\\AI Projects\\EA AUDIT TOOL\\design-mockups\\';
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
  for (let a = 1; a <= 4; a++) {
    await p.goto('https://www.auditisa.com/login', { waitUntil: 'networkidle', timeout: 60000 });
    await p.fill('input[name="email"]', 'admin@auditisa.com');
    await p.fill('input[name="password"]', 'admin');
    await p.click('[data-testid="login-submit"]');
    try { await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 20000 }); break; } catch {}
  }
  const eng = p.url().replace(/\/dashboard$/, '');
  // Click through: phase list -> D3.1 task row -> task page (read-only checks)
  await p.goto(eng + '/phases/pre-planning', { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid="phase-task-list"]', { timeout: 30000 });
  await p.click('tr[data-testid="phase-task-D3.1"]');
  await p.waitForURL('**/forms/D3.1', { timeout: 30000 });
  await p.waitForTimeout(500);
  const d = await p.evaluate(() => ({
    tabs: document.querySelectorAll('[data-testid^="tab-"]').length,
    back: document.querySelector('[data-testid="back-to-phase"]')?.innerText.trim(),
    h1: document.querySelector('h1')?.innerText.replace(/\s+/g, ' ').trim(),
    purpose: !!document.querySelector('[data-testid="task-purpose"]'),
    checklist: document.querySelectorAll('[data-testid="task-purpose"] ol li').length,
    signoff: !!document.querySelector('[data-testid="task-signoff"]'),
    handoff: !!document.querySelector('[data-testid="save-handoff"]'),
    notes: !!document.querySelector('[data-testid="task-review-notes"]'),
  }));
  console.log('prod D3.1 via row click: tabs=' + d.tabs + ' back="' + d.back + '"');
  console.log('h1: ' + d.h1);
  console.log('purpose=' + d.purpose + ' checklist=' + d.checklist + ' signoff=' + d.signoff + ' handoff=' + d.handoff + ' notes=' + d.notes);
  await p.screenshot({ path: OUT + 'shot-prod-taskpage.png', fullPage: true });
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
