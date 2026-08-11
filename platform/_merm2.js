/* eslint-disable @typescript-eslint/no-require-imports -- dev-only validation */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 100)));
  const f = path.resolve(__dirname, '..', 'design-mockups', 'isa-engine-workflow.html').split(path.sep).join('/');
  await p.goto('file:///' + f, { waitUntil: 'load' });
  await p.waitForTimeout(400);
  // interactivity
  const s1 = await p.evaluate(() => ({
    tiles: document.querySelectorAll('.ph').length,
    steps: document.querySelectorAll('#phSteps li').length,
    rules: document.querySelectorAll('.rc').length,
    mods: document.querySelectorAll('details.mod').length,
  }));
  await p.click('.ph[data-i="2"]');
  const s2 = await p.evaluate(() => document.querySelector('#phSteps li')?.innerText.slice(0, 40));
  await p.click('.rc[data-i="10"]');
  const s3 = await p.evaluate(() => document.getElementById('rDetail').innerText.slice(0, 60));
  console.log(JSON.stringify({ ...s1, phase20FirstStep: s2, r11: s3, errs: errs.length ? errs : 'none' }));
  // mermaid validation
  const blocks = await p.evaluate(() => [...document.querySelectorAll('pre.mermaid')].map((e) => e.textContent));
  await p.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js' });
  await p.waitForFunction(() => typeof window.mermaid !== 'undefined', { timeout: 30000 });
  await p.evaluate(() => window.mermaid.initialize({ startOnLoad: false }));
  let fails = 0;
  for (let i = 0; i < blocks.length; i++) {
    const r = await p.evaluate(async (c) => { try { await window.mermaid.parse(c); return { ok: true }; } catch (e) { return { ok: false, m: String(e.message || e).split('\n')[0].slice(0, 130) }; } }, blocks[i]);
    console.log('mermaid #' + (i + 1) + (r.ok ? ' OK' : ' FAIL ' + r.m));
    if (!r.ok) fails++;
  }
  console.log(fails ? fails + ' DIAGRAM FAILED' : 'ALL DIAGRAMS VALID');
  await b.close();
  process.exit(fails ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
