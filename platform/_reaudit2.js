/* eslint-disable @typescript-eslint/no-require-imports -- dev-only audit crawler */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage();
  async function login() {
    for (let a = 1; a <= 5; a++) {
      await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 60000 });
      await p.fill('input[name="email"]', 'admin@demo.test');
      await p.fill('input[name="password"]', 'password');
      await p.click('[data-testid="login-submit"]');
      try { await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 20000 }); return; } catch {}
    }
    throw new Error('login failed');
  }
  await login();
  const eng = p.url().replace(/\/dashboard$/, '');

  async function inspect(label, url) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await p.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
        await p.waitForTimeout(700);
        if (p.url().includes('/login') || p.url().includes('/api/auth')) { await login(); continue; }
        break;
      } catch { if (attempt === 2) { console.log(label.padEnd(18) + '| NAV FAILED'); return; } await login(); }
    }
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
      return { title: document.title, unlabeled, tiny, hOverflow };
    });
    console.log(
      label.padEnd(18) +
      '| title=' + (d.title !== 'EA Audit' ? '"' + d.title + '"' : 'GENERIC') +
      ' | unlabeled=' + d.unlabeled + ' | tiny=' + d.tiny + ' | hOverflow=' + d.hOverflow,
    );
  }

  // warm-title recheck on three pages that showed GENERIC
  await inspect('dashboard (warm)', eng + '/dashboard');
  await inspect('phase (warm)', eng + '/phases/pre-planning');
  await inspect('form D3.1 (warm)', eng + '/forms/D3.1');
  // the pages the broken session skipped
  await inspect('clients', 'http://localhost:3000/clients');
  await inspect('engagements', 'http://localhost:3000/engagements');
  await inspect('new-engagement', 'http://localhost:3000/new-engagement');
  await inspect('users', 'http://localhost:3000/users');
  await inspect('templates', 'http://localhost:3000/templates');
  await inspect('resources', 'http://localhost:3000/resources');
  await inspect('settings', 'http://localhost:3000/settings');
  await inspect('notifications', 'http://localhost:3000/notifications');

  // mobile spot-check on newest screens
  const m = await b.newContext({ viewport: { width: 375, height: 812 } });
  const mp = await m.newPage();
  await mp.goto('http://localhost:3000/login', { waitUntil: 'networkidle' });
  await mp.fill('input[name="email"]', 'admin@demo.test');
  await mp.fill('input[name="password"]', 'password');
  await mp.click('[data-testid="login-submit"]');
  try { await mp.waitForSelector('[data-testid="phase-gauges"]', { timeout: 20000 }); } catch {}
  for (const [label, url] of [['considerations', eng + '/considerations'], ['users', 'http://localhost:3000/users'], ['templates', 'http://localhost:3000/templates'], ['legal', eng + '/legal']]) {
    await mp.goto(url, { waitUntil: 'networkidle' });
    await mp.waitForTimeout(300);
    const o = await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    console.log('mobile375 ' + label + ': hOverflow=' + o + 'px');
  }
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
