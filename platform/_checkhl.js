/* eslint-disable @typescript-eslint/no-require-imports -- dev-only mockup check */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const file = path.resolve(__dirname, '..', 'design-mockups', 'dashboard-var-a-rail.html');
  await p.goto('file:///' + file.split(path.sep).join('/'), { waitUntil: 'load' });
  await p.waitForTimeout(500);

  const state = () => p.evaluate(() => {
    const on = document.querySelector('.sec.on');
    return {
      name: on.querySelector('h2').innerText,
      iconChips: document.querySelectorAll('.sec .icon').length, // must be 0 (original structure)
      cardChildren: on.children.length,                          // ring + text span = 2
      halo: getComputedStyle(on).boxShadow.includes('3px'),
      ringGlow: getComputedStyle(on.querySelector('.ring')).filter !== 'none',
      dot: getComputedStyle(on, '::after').backgroundColor,
    };
  });

  console.log('initial:', JSON.stringify(await state()));
  await p.locator('.sec').nth(1).click();
  await p.waitForTimeout(500);
  console.log('after click Execution:', JSON.stringify(await state()));
  await p.locator('.grp').first().click();
  await p.waitForTimeout(400);
  console.log('drawer still works:', await p.evaluate(() => document.body.classList.contains('open')));
  console.log('errors:', errors.length ? errors[0] : 'none');
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
