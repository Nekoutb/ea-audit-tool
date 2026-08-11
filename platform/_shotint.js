/* eslint-disable @typescript-eslint/no-require-imports -- dev-only */
const { chromium } = require('playwright');
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
  const engId = p.url().split('/engagements/')[1].split('/')[0];
  const res = await p.request.get('http://localhost:3000/api/engagements/' + engId + '/status');
  const json = await res.json();
  console.log('status API: http=' + res.status() + ' phases=' + (json.phases || []).length + ' tasks=' + (json.tasks || []).length);
  const signed = (json.tasks || []).find((t) => t.preparer);
  console.log('sample signed task: ' + (signed ? signed.code + ' preparer=' + signed.preparer + ' at=' + signed.preparerSignedAt : 'none'));
  await p.goto('http://localhost:3000/settings', { waitUntil: 'networkidle' });
  console.log('integrations panel visible: ' + (await p.isVisible('[data-testid="integrations-panel"]')));
  // Unauthenticated must NOT get data
  const anon = await b.newContext();
  const anonPage = await anon.newPage();
  const anonRes = await anonPage.request.get('http://localhost:3000/api/engagements/' + engId + '/status');
  console.log('unauthenticated status API: http=' + anonRes.status());
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
