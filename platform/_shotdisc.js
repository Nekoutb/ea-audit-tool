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
  const discLink = await p.isVisible('[data-testid="dashboard-discussion-link"]');

  await p.goto(eng + '/discussion', { waitUntil: 'networkidle' });
  await p.fill('[data-testid="comment-input"]', 'Welcome @QA — please review the D3.1 acceptance form.');
  await p.click('[data-testid="comment-submit"]');
  await p.waitForSelector('[data-testid^="thread-"]', { timeout: 30000 });
  const threadId = await p.locator('[data-testid^="thread-"]').first().getAttribute('data-testid');
  const rootId = threadId.replace('thread-', '');
  await p.fill('[data-testid="reply-input-' + rootId + '"]', 'Noted, thanks.');
  await p.click('[data-testid="reply-submit-' + rootId + '"]');
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(500);
  const counts = await p.evaluate(() => ({
    threads: document.querySelectorAll('[data-testid^="thread-"]').length,
    text: document.querySelector('[data-testid="discussion-list"]').innerText.replace(/\s+/g, ' ').slice(0, 200),
  }));
  console.log('discussion link=' + discLink + ' threads=' + counts.threads);
  console.log('list: ' + counts.text);
  await p.screenshot({ path: OUT + 'shot-discussion.png' });
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
