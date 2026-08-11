/* eslint-disable @typescript-eslint/no-require-imports -- dev-only audit crawler */
const { chromium } = require('playwright');

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
  for (let a = 1; a <= 5; a++) {
    await p.goto('http://localhost:3000/login', { waitUntil: 'networkidle', timeout: 60000 });
    await p.fill('input[name="email"]', 'admin@demo.test');
    await p.fill('input[name="password"]', 'password');
    await p.click('[data-testid="login-submit"]');
    try { await p.waitForSelector('[data-testid="phase-gauges"]', { timeout: 20000 }); break; } catch {}
  }
  const eng = p.url().replace(/\/dashboard$/, '');

  async function inspect(label, url) {
    try {
      await p.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
      await p.waitForTimeout(350);
    } catch { console.log(label + ': NAV FAILED'); return null; }
    const d = await p.evaluate(() => {
      const q = (s) => document.querySelector(s);
      const qa = (s) => [...document.querySelectorAll(s)];
      const h1 = q('h1') ? q('h1').innerText.replace(/\s+/g, ' ').trim() : '(none)';
      const tabs = qa('[data-testid^="tab-"]').map((t) => t.innerText.trim());
      const hasBack = !!q('[data-testid="back-to-dashboard"]') || !!qa('a').find((a2) => /back|retour|←/i.test(a2.innerText));
      const inputsNoLabel = qa('input:not([type=hidden]):not([type=checkbox]):not([type=file]), textarea, select').filter((el) => {
        const id = el.id;
        const wrapped = el.closest('label');
        const labelled = id && document.querySelector('label[for="' + id + '"]');
        const aria = el.getAttribute('aria-label');
        return !wrapped && !labelled && !aria;
      }).length;
      const smallTargets = qa('button, a').filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && (r.height < 24 || r.width < 24);
      }).length;
      const fieldCount = qa('main textarea, main input:not([type=hidden])').length;
      const mainText = q('main') ? q('main').innerText.replace(/\s+/g, ' ').slice(0, 90) : '';
      const title = document.title;
      return { h1, tabCount: tabs.length, hasBack, inputsNoLabel, smallTargets, fieldCount, mainText, title };
    });
    console.log(
      label.padEnd(22) +
      '| h1="' + d.h1.slice(0, 44) + '"' +
      ' | tabs=' + d.tabCount +
      ' | back=' + (d.hasBack ? 'Y' : 'N') +
      ' | unlabeled=' + d.inputsNoLabel +
      ' | tinyTargets=' + d.smallTargets +
      ' | fields=' + d.fieldCount +
      ' | title="' + d.title.slice(0, 30) + '"',
    );
    return d;
  }

  console.log('=== JOURNEY: dashboard -> phase -> task types ===');
  await inspect('dashboard', eng + '/dashboard');
  await inspect('phase pre-planning', eng + '/phases/pre-planning');
  // the pages task rows lead to:
  await inspect('form D4.5', eng + '/forms/D4.5');
  await inspect('form D4.6', eng + '/forms/D4.6');
  await inspect('form D4.7', eng + '/forms/D4.7');
  await inspect('form D3.1', eng + '/forms/D3.1');
  await inspect('planning ws (D5.1)', eng + '/planning');
  await inspect('risks ws (D7.2)', eng + '/risks');
  await inspect('legal ws (F1)', eng + '/legal');
  await inspect('discussion', eng + '/discussion');
  await inspect('activity', eng + '/activity');
  await inspect('time', eng + '/time');
  console.log('=== title/H1 uniqueness across form pages measured above ===');
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
