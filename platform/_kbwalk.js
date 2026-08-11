/* eslint-disable @typescript-eslint/no-require-imports -- dev-only a11y walk */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  for (let a = 1; a <= 5; a++) {
    await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 90000 });
    await p.fill('input[name="email"]', 'admin@demo.test');
    await p.fill('input[name="password"]', 'password');
    await p.click('[data-testid="login-submit"]');
    try { await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 20000 }); break; } catch {}
  }
  const eng = p.url().replace(/\/dashboard$/, '');

  async function walk(label, url, tabs) {
    await p.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await p.waitForTimeout(500);
    await p.evaluate(() => document.body.focus());
    let noIndicator = 0, reached = 0;
    const missing = [];
    for (let i = 0; i < tabs; i++) {
      await p.keyboard.press('Tab');
      const info = await p.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return null;
        const st = getComputedStyle(el);
        // focus-visible only applies on keyboard focus, which this is
        const hasOutline = st.outlineStyle !== 'none' && parseFloat(st.outlineWidth) > 0;
        const hasRing = st.boxShadow !== 'none';
        return {
          tag: el.tagName,
          text: (el.getAttribute('aria-label') || el.innerText || el.getAttribute('name') || '').trim().slice(0, 24),
          visible: hasOutline || hasRing,
        };
      });
      if (!info) continue;
      reached++;
      if (!info.visible) { noIndicator++; if (missing.length < 5) missing.push(info.tag + ' "' + info.text + '"'); }
    }
    console.log(label.padEnd(14) + '| focus stops=' + reached + '/' + tabs + ' | no-indicator=' + noIndicator + (missing.length ? ' | e.g. ' + missing.join(', ') : ''));
  }

  await walk('dashboard', eng + '/dashboard', 25);
  await walk('phase list', eng + '/phases/pre-planning', 25);
  await walk('form D3.1', eng + '/forms/D3.1', 25);

  // Enter opens a task row from the phase list (row keyboard support)
  await p.goto(eng + '/phases/pre-planning', { waitUntil: 'networkidle' });
  await p.waitForSelector('tr[data-testid="phase-task-D3.1"]');
  await p.evaluate(() => {
    const r = document.querySelector('tr[data-testid="phase-task-D3.1"]');
    r.focus();
  });
  await p.keyboard.press('Enter');
  await p.waitForTimeout(1500);
  console.log('Enter on task row -> ' + (p.url().includes('/forms/D3.1') || p.url().includes('/documents/') ? 'OPENS TASK ✓' : 'NO NAV ✗ (' + p.url().slice(-30) + ')'));

  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
