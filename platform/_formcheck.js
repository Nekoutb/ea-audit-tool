/* eslint-disable @typescript-eslint/no-require-imports -- dev-only validation */
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await (await b.newContext({ viewport: { width: 1366, height: 768 } })).newPage();
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message.slice(0, 120)));
  const f = path.resolve(__dirname, '..', 'design-mockups', 'isa-engine-workflow.html').split(path.sep).join('/');
  await p.goto('file:///' + f, { waitUntil: 'load' });
  const out = [];
  const ok = (n, c) => out.push(`${c ? 'PASS' : 'FAIL'} ${n}`);

  ok('7 form chips on Phase 00', await p.locator('.formlink').count() === 7);
  await p.click(String.raw`.formlink[data-code="ACC-1"]`);
  ok('modal opens', await p.evaluate(() => document.getElementById('fmWrap').classList.contains('open')));

  const m = await p.evaluate(() => {
    const el = document.getElementById('fmPage');
    const cs = getComputedStyle(el.querySelector('textarea.fx'));
    return {
      cb: el.querySelectorAll('input.cb').length,
      tx: el.querySelectorAll('textarea.fx').length,
      defs: el.querySelectorAll('.fabbr tr').length,
      pep: /Politically exposed person/.test(el.innerText),
      color: cs.color, style: cs.fontStyle,
      auto: el.querySelectorAll('.fauto').length,
      riskAuto: /From the engagement record: Low, Moderate or High/.test(el.innerText),
      noSignBtn: el.querySelectorAll('.fmSign').length === 0,
      signNote: /sign-off is performed on the acceptance task in the tool/.test(el.innerText),
    };
  });
  ok(`tickable boxes (${m.cb})`, m.cb >= 18);
  ok(`editable result fields (${m.tx})`, m.tx >= 15);
  ok(`definitions table (${m.defs} rows, PEP=${m.pep})`, m.defs >= 5 && m.pep);
  ok(`typed text black, not italic (${m.color} / ${m.style})`, m.color === 'rgb(20, 20, 20)' && m.style === 'normal');
  ok('no sign-off button in the paper', m.noSignBtn);
  ok('sign-off note points to the tool', m.signNote);
  ok('risk rating is system-populated', m.riskAuto);
  ok(`system-populated cells (${m.auto})`, m.auto >= 6);

  const noBox = p.locator('#fmPage input.cb[data-no="1"]').nth(2);
  const g = await noBox.getAttribute('data-g');
  await noBox.check();
  ok('No reveals explanation under the question', await p.evaluate((gg) => document.querySelector(`.noexpl[data-for="${gg}"]`).style.display !== 'none', g));
  await p.locator(`#fmPage input.cb[data-g="${g}"]`).first().check();
  const h = await p.evaluate((gg) => ({
    hid: document.querySelector(`.noexpl[data-for="${gg}"]`).style.display === 'none',
    noOff: !document.querySelector(`input.cb[data-no="1"][data-g="${gg}"]`).checked,
  }), g);
  ok('Yes unchecks No and hides the box', h.hid && h.noOff);

  await p.locator('#fmPage textarea.fx:visible').first().fill('RCCM extract obtained - W/P A-1.1');
  await p.click('.fmClose');
  ok('chip shows in progress', /in progress/.test(await p.locator(String.raw`.formlink[data-code="ACC-1"]`).textContent()));
  await p.click(String.raw`.formlink[data-code="ACC-1"]`);
  ok('reopen restores saved state', (await p.locator('#fmPage textarea.fx:visible').first().inputValue()).includes('RCCM extract'));
  await p.keyboard.press('Escape');

  await p.click(String.raw`.formlink[data-code="ACC-2"]`);
  const acc2 = await p.evaluate(() => document.getElementById('fmPage').innerText);
  ok('ACC-2 staffing-plan section removed', !/Staffing plan/i.test(acc2) && !/Planned hours/i.test(acc2));
  await p.keyboard.press('Escape');

  await p.click(String.raw`.formlink[data-code="ACC-3"]`);
  const acc3 = await p.evaluate(() => document.getElementById('fmPage').innerText);
  ok('ACC-3 declarations come from the tool', /From the engagement team setup/.test(acc3) && /independence campaign/.test(acc3));
  await p.keyboard.press('Escape');

  ok('34 rule cards intact', await p.locator('.rc').count() === 34);
  console.log(out.join('\n'));
  console.log(errs.length ? 'PAGE ERRORS:\n' + errs.join('\n') : 'NO PAGE ERRORS');
  await b.close();
  process.exit(out.some((l) => l.startsWith('FAIL')) || errs.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
