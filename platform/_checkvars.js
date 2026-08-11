/* eslint-disable @typescript-eslint/no-require-imports -- dev-only mockup check */
const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const dir = path.resolve(__dirname, '..', 'design-mockups');
  const files = [
    ['A rail', 'dashboard-var-a-rail.html', '.sec', '.grp'],
    ['B deck', 'dashboard-var-b-deck.html', '.sec', '.grp'],
    ['C stage', 'dashboard-var-c-stage.html', '.sw', '.grp'],
  ];
  for (const [label, file, secSel, grpSel] of files) {
    errors.length = 0;
    await p.goto('file:///' + path.join(dir, file).replace(/\\/g, '/'), { waitUntil: 'load' });
    await p.waitForTimeout(600);
    const secs = await p.locator(secSel).count();
    const grpsAtRest = await p.locator(grpSel + ':visible').count();
    // switch to Execution (2nd section) and count visible groups
    await p.locator(secSel).nth(1).click();
    await p.waitForTimeout(600);
    const grpsAfter = await p.locator(grpSel + ':visible').count();
    // click first group -> drawer must open with task rows
    await p.locator(grpSel + ':visible').first().click();
    await p.waitForTimeout(500);
    const drawerOpen = await p.evaluate(() => document.body.classList.contains('open'));
    const rows = await p.locator('.trow').count();
    const title = await p.locator('#d-title').innerText();
    // detail tasks must NOT be on the dashboard before the drawer
    await p.keyboard.press('Escape');
    await p.waitForTimeout(300);
    const detailLeak = await p.evaluate(() => document.querySelector('.wrap').innerText.includes('Walkthroughs'));
    console.log(
      `${label}: sections=${secs} groups@rest=${grpsAtRest} groups@click=${grpsAfter} ` +
      `drawer=${drawerOpen} rows=${rows} (${title.slice(0, 26)}) detailLeak=${detailLeak} errors=${errors.length}` +
      (errors.length ? ' :: ' + errors[0].slice(0, 100) : ''),
    );
  }
  await b.close();
})().catch((e) => { console.error('FATAL', e.message); process.exit(1); });
