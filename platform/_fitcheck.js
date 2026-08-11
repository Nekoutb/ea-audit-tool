/* eslint-disable @typescript-eslint/no-require-imports -- dev-only layout validation */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const results = [];
  for (const [file, vw] of [
    ['isa-engine-workflow.html', 1366], ['isa-engine-workflow.html', 1280], ['isa-engine-workflow.html', 1024],
    ['isa-engine-prompt-v1.html', 1366], ['isa-engine-prompt-v1.html', 1024],
  ]) {
    const p = await (await b.newContext({ viewport: { width: vw, height: 768 } })).newPage();
    const f = path.resolve(__dirname, '..', 'design-mockups', file).split(path.sep).join('/');
    await p.goto('file:///' + f, { waitUntil: 'load' });
    if (file.includes('workflow')) {
      await p.addScriptTag({ url: 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.min.js' });
      await p.waitForFunction(() => typeof window.mermaid !== 'undefined', { timeout: 30000 });
      await p.evaluate(async () => { window.mermaid.initialize({ startOnLoad: false }); await window.mermaid.run({ querySelector: 'pre.mermaid' }); });
      await p.waitForTimeout(300);
    }
    const m = await p.evaluate(() => ({
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      svgs: [...document.querySelectorAll('svg')].map((s) => Math.round(s.getBoundingClientRect().width)),
      wideEls: [...document.querySelectorAll('*')].filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1 && !['HTML', 'BODY'].includes(e.tagName)).slice(0, 3).map((e) => e.tagName + '.' + (e.className.baseVal ?? e.className).toString().slice(0, 25)),
    }));
    const ok = m.scrollW <= m.innerW;
    results.push(`${ok ? 'PASS' : 'FAIL'} ${file} @${vw}px scrollW=${m.scrollW} innerW=${m.innerW} svgW=[${m.svgs.join(',')}]${m.wideEls.length ? ' OVERFLOWING: ' + m.wideEls.join(' ') : ''}`);
    await p.context().close();
  }
  console.log(results.join('\n'));
  await b.close();
  process.exit(results.some((r) => r.startsWith('FAIL')) ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
