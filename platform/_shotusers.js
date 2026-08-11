/* eslint-disable @typescript-eslint/no-require-imports -- dev-only screenshot script */
const { chromium } = require('playwright');
const OUT = 'C:\\Users\\UltraBook 3.1\\Documents\\AI Projects\\EA AUDIT TOOL\\design-mockups\\';
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1600, height: 900 } });
  const p = await ctx.newPage();
  for (let a = 1; a <= 5; a++) {
    await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 60000 });
    await p.fill('input[name="email"]', 'admin@demo.test');
    await p.fill('input[name="password"]', 'password');
    await p.click('[data-testid="login-submit"]');
    try { await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 20000 }); break; } catch {}
  }
  // Settings -> manage users
  await p.goto('http://localhost:3000/settings', { waitUntil: 'networkidle' });
  const hasLink = await p.isVisible('[data-testid="manage-users-link"]');
  await p.goto('http://localhost:3000/users', { waitUntil: 'networkidle' });
  await p.waitForSelector('[data-testid="users-table"]', { timeout: 30000 });
  const before = await p.locator('[data-testid="users-table"] tbody tr').count();

  const email = 'qa+' + Date.now() + '@demo.test';
  await p.fill('[data-testid="invite-name"]', 'QA Tester');
  await p.fill('[data-testid="invite-email"]', email);
  await p.selectOption('[data-testid="invite-role"]', 'senior');
  await p.fill('[data-testid="invite-password"]', 'testpass123');
  await p.click('[data-testid="invite-submit"]');
  await p.waitForSelector('[data-testid="users-saved"]', { timeout: 30000 });
  await p.waitForSelector('[data-testid="users-table"]', { timeout: 30000 });
  const after = await p.locator('[data-testid="users-table"] tbody tr').count();
  const rowVisible = await p.isVisible(`[data-testid="user-row-${email}"]`);
  console.log('settings manageLink=' + hasLink + ' rowsBefore=' + before + ' rowsAfter=' + after + ' invitedRowVisible=' + rowVisible);
  await p.screenshot({ path: OUT + 'shot-users.png' });

  // The invited user can sign in
  await ctx.clearCookies();
  await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await p.fill('input[name="email"]', email);
  await p.fill('input[name="password"]', 'testpass123');
  await p.click('[data-testid="login-submit"]');
  let signedIn = false;
  try { await p.waitForURL('**/dashboard', { timeout: 20000 }); signedIn = true; } catch {}
  console.log('invited user can sign in: ' + signedIn);
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
