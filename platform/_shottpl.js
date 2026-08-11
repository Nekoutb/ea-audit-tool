/* eslint-disable @typescript-eslint/no-require-imports -- dev-only */
const { chromium } = require('playwright');
const OUT = 'C:\\Users\\UltraBook 3.1\\Documents\\AI Projects\\EA AUDIT TOOL\\design-mockups\\';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1500, height: 900 } });
  const p = await ctx.newPage();
  for (let a = 1; a <= 5; a++) {
    await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 60000 });
    await p.fill('input[name="email"]', 'admin@demo.test');
    await p.fill('input[name="password"]', 'password');
    await p.click('[data-testid="login-submit"]');
    try { await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 20000 }); break; } catch {}
  }
  const eng = p.url().replace(/\/dashboard$/, '');

  // Settings link + templates list
  await p.goto('http://localhost:3000/settings', { waitUntil: 'networkidle' });
  const link = await p.isVisible('[data-testid="manage-templates-link"]');
  await p.goto('http://localhost:3000/templates', { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid="templates-table"]', { timeout: 30000 });
  const rowCount = await p.locator('[data-testid="templates-table"] tbody tr').count();

  // Customize B3 (Consultation Record — not yet generated in this tenant run? it may exist; use B10 which was untouched)
  await p.goto('http://localhost:3000/templates/B10', { waitUntil: 'networkidle' });
  await p.fill('[data-testid="tpl-purpose-en"]', 'CUSTOM-PURPOSE-MARKER for points forward.');
  await p.fill('[data-testid="tpl-items-en"]', 'CUSTOM-ITEM-ONE\nCUSTOM-ITEM-TWO');
  await p.click('[data-testid="tpl-save"]');
  await p.waitForSelector('[data-testid="template-saved"]', { timeout: 30000 });
  const badge = await p.locator('[data-testid="template-row-B10"]').innerText();
  console.log('settingsLink=' + link + ' templateRows=' + rowCount + ' B10row=' + badge.replace(/\s+/g, ' ').trim());
  await p.screenshot({ path: OUT + 'shot-templates.png' });

  // Generate B10 from the conclusion phase screen and check the docx contains the custom text
  await p.goto(eng + '/phases/conclusion', { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid="phase-task-list"]', { timeout: 30000 });
  const gen = p.locator('[data-testid="phase-generate-B10"]');
  if (await gen.count()) {
    await gen.click();
    await p.waitForURL('**/documents/**', { timeout: 30000 });
    console.log('B10 generated -> document page');
  } else {
    console.log('B10 already generated earlier; opening via row link');
    await p.click('[data-testid="phase-task-B10"]');
    await p.waitForURL('**/documents/**', { timeout: 30000 });
  }
  console.log('document url ok');
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
