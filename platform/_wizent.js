/* eslint-disable @typescript-eslint/no-require-imports -- dev-only verification */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 940 } })).newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message.slice(0, 100)));

  for (let a = 1; a <= 6; a++) {
    await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 90000 });
    await p.fill('input[name="email"]', 'admin@demo.test');
    await p.fill('input[name="password"]', 'password');
    await p.click('[data-testid="login-submit"]');
    try { await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 25000 }); break; } catch {}
  }

  await p.goto('http://localhost:3000/new-engagement', { waitUntil: 'networkidle' });
  // pick "+ New entity…" and confirm the inline fields appear
  await p.selectOption('[data-testid="engagement-client"]', '__new');
  await p.waitForSelector('[data-testid="new-entity-name"]', { timeout: 5000 });
  const entity = 'Wizard Entity ' + Math.floor(Math.random() * 100000);
  await p.fill('[data-testid="new-entity-name"]', entity);
  await p.selectOption('[data-testid="new-entity-legal-form"]', 'SARL');
  // naming convention preview should now include the typed entity name
  const nameField = await p.inputValue('[data-testid="engagement-name"]');
  console.log('convention preview: "' + nameField + '" | containsEntity=' + nameField.includes(entity));
  await p.fill('[data-testid="engagement-year"]', '2027');
  await p.fill('[data-testid="engagement-period-end"]', '2027-12-31');
  await p.click('[data-testid="create-engagement"]');
  await p.waitForURL('**/dashboard', { timeout: 40000 });
  await p.waitForSelector('[data-testid="entity-link"]', { timeout: 20000 });
  const h1 = await p.evaluate(() => document.querySelector('h1')?.innerText);
  console.log('created -> ' + p.url().slice(-45));
  console.log('hub H1: "' + h1 + '"');

  // entity record exists with the engagement in its history
  const entityHref = await p.evaluate(() => document.querySelector('[data-testid="entity-link"]')?.getAttribute('href'));
  await p.goto('http://localhost:3000' + entityHref, { waitUntil: 'networkidle' });
  const rec = await p.evaluate(() => ({
    h1: document.querySelector('h1')?.innerText,
    engagements: document.querySelectorAll('[data-testid="client-engagements"] li').length,
  }));
  console.log('entity record: ' + JSON.stringify(rec));
  console.log('page errors: ' + (errors.length ? errors.join(' | ') : 'none'));
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
