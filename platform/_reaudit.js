/* eslint-disable @typescript-eslint/no-require-imports -- dev-only audit crawler */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  for (let a = 1; a <= 5; a++) {
    await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 60000 });
    await p.fill('input[name="email"]', 'admin@demo.test');
    await p.fill('input[name="password"]', 'password');
    await p.click('[data-testid="login-submit"]');
    try { await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 20000 }); break; } catch {}
  }
  const eng = p.url().replace(/\/dashboard$/, '');

  const rows = [];
  async function inspect(label, url) {
    try {
      await p.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await p.waitForTimeout(300);
    } catch { rows.push(label.padEnd(18) + '| NAV FAILED'); return; }
    const d = await p.evaluate(() => {
      const qa = (s) => [...document.querySelectorAll(s)];
      const unlabeled = qa('input:not([type=hidden]):not([type=checkbox]):not([type=file]), textarea, select').filter((el) => {
        const wrapped = el.closest('label');
        const labelled = el.id && document.querySelector('label[for="' + el.id + '"]');
        return !wrapped && !labelled && !el.getAttribute('aria-label');
      }).length;
      const tiny = qa('button, a').filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.height < 24 || r.width < 24);
      }).length;
      const hOverflow = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      const noFocusable = qa('button, a, input, select, textarea').some((el) => {
        const st = getComputedStyle(el);
        return st.outlineStyle === 'none' && !el.className.includes('focus');
      });
      // empty-state quality: panels whose text is just a "none yet" sentence with no action link/button
      return { title: document.title, unlabeled, tiny, hOverflow, noFocusable };
    });
    rows.push(
      label.padEnd(18) +
      '| title=' + (d.title !== 'EA Audit' ? 'OK' : 'GENERIC') +
      ' | unlabeled=' + d.unlabeled +
      ' | tiny=' + d.tiny +
      ' | hOverflow=' + d.hOverflow,
    );
  }

  await inspect('dashboard', eng + '/dashboard');
  await inspect('phase pre-planning', eng + '/phases/pre-planning');
  await inspect('phase execution', eng + '/phases/execution');
  await inspect('form D3.1', eng + '/forms/D3.1');
  await inspect('form D5.6', eng + '/forms/D5.6');
  await inspect('considerations', eng + '/considerations');
  await inspect('planning', eng + '/planning');
  await inspect('risks', eng + '/risks');
  await inspect('data', eng + '/data');
  await inspect('analytics', eng + '/analytics');
  await inspect('findings', eng + '/findings');
  await inspect('confirmations', eng + '/confirmations');
  await inspect('pbc', eng + '/pbc');
  await inspect('legal', eng + '/legal');
  await inspect('conclusion', eng + '/conclusion');
  await inspect('time', eng + '/time');
  await inspect('activity', eng + '/activity');
  await inspect('discussion', eng + '/discussion');
  await inspect('clients', 'http://localhost:3000/clients');
  await inspect('engagements', 'http://localhost:3000/engagements');
  await inspect('new-engagement', 'http://localhost:3000/new-engagement');
  await inspect('users', 'http://localhost:3000/users');
  await inspect('templates', 'http://localhost:3000/templates');
  await inspect('resources', 'http://localhost:3000/resources');
  await inspect('settings', 'http://localhost:3000/settings');
  await inspect('notifications', 'http://localhost:3000/notifications');
  rows.forEach((r) => console.log(r));

  // S2: does any submit button disable/spin while pending? (static check: form buttons lack aria-busy/disabled wiring)
  // S3: empty-state quality on a fresh area
  await p.goto(eng + '/discussion', { waitUntil: 'networkidle' });
  const empty = await p.evaluate(() => {
    const el = [...document.querySelectorAll('p')].find((x) => /no discussion|aucune discussion/i.test(x.innerText));
    return el ? el.innerText.trim() : null;
  });
  console.log('empty-state sample (discussion): ' + (empty ?? 'n/a'));

  // mobile spot-check on the two new screens
  const m = await b.newContext({ viewport: { width: 375, height: 812 } });
  const mp = await m.newPage();
  await mp.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await mp.fill('input[name="email"]', 'admin@demo.test');
  await mp.fill('input[name="password"]', 'password');
  await mp.click('[data-testid="login-submit"]');
  try { await mp.waitForSelector('[data-testid="phase-gauges"]', { timeout: 20000 }); } catch {}
  for (const [label, url] of [['considerations', eng + '/considerations'], ['users', 'http://localhost:3000/users'], ['templates', 'http://localhost:3000/templates']]) {
    await mp.goto(url, { waitUntil: 'networkidle' });
    await mp.waitForTimeout(300);
    const o = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log('mobile375 ' + label + ': hOverflow=' + o + 'px');
  }
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
