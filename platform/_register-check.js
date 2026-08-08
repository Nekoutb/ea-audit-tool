/* eslint-disable @typescript-eslint/no-require-imports -- dev-only prose audit */
/* Implements the self-check in design-mockups/writing-register-prompt.md
   Usage: node _register-check.js ../design-mockups/<file>.html   */
const { chromium } = require('playwright');
const path = require('path');

const BANNED = [
  /not a matter of/i, /is itself/i, /in its own right/i, /what matters is/i, /the answer is/i,
  /rather than a list/i, /deserves? particular/i, /not simply/i, /rather than reading/i,
  /not a routine/i, /not discovered/i, /foundation on which/i, /person by person/i,
  /exists? to (?!be\b)/i, /carries? weight/i, /disproportionate/i, /vocabulary/i, /strong signal/i,
  /it is worth/i, /of course/i, /simply put/i, /in truth/i, /the point is/i,
  /cannot be overstated/i, /goes to the heart/i, /the reality is/i, /at the end of the day/i,
  /^(crucially|importantly|notably)\b/i, /biggest hole/i, /thesis/i, /deserve/i,
  /it is important to note/i, /should be borne in mind/i, /in order to/i, /\butilise/i,
  /is not just/i, /more than just/i, /the heart of/i, /the key is/i, /think of/i,
];

(async () => {
  const target = process.argv[2] || '../design-mockups/isa-engine-prompt-v1.html';
  const abs = path.resolve(__dirname, target).split(path.sep).join('/');
  const b = await chromium.launch();
  const p = await (await b.newContext()).newPage();
  await p.goto('file:///' + abs, { waitUntil: 'load' });

  const data = await p.evaluate(() => {
    const blocks = [];
    document.querySelectorAll('p,li,td,th,h1,h2,h3').forEach((n) => {
      if (n.querySelector('p,li,td')) return;                       // leaf nodes only
      if (getComputedStyle(n).textTransform === 'uppercase') return; // CSS-capitalised headers
      const t = n.textContent.replace(/\s+/g, ' ').trim();
      if (t) blocks.push({ t, sec: (n.closest('section,div')?.querySelector('h2')?.textContent || '').slice(0, 40) });
    });
    return { blocks, full: document.body.innerText };
  });

  // 1. banned-construction scan
  const hits = [];
  data.blocks.forEach((b2) => {
    BANNED.forEach((r) => { if (r.test(b2.t)) hits.push({ re: String(r).slice(0, 30), txt: b2.t.slice(0, 155) }); });
  });

  // 4. sentence length
  const sents = data.blocks.flatMap((b2) => b2.t.split(/(?<=[.;:])\s+(?=[A-Z(])/))
    .map((s) => s.trim()).filter((s) => s.split(/\s+/).length > 3);
  const w = sents.map((s) => s.split(/\s+/).length).sort((a, c) => a - c);
  const mean = w.reduce((a, c) => a + c, 0) / w.length;

  // 3. abbreviation inventory
  const acr = [...new Set((data.full.match(/\b[A-Z]{2,}(?:\/[A-Z])?\b/g) || []))];

  console.log('=== ' + path.basename(target) + ' ===');
  console.log('1. BANNED CONSTRUCTIONS: ' + hits.length);
  hits.forEach((h) => console.log('   [' + h.re + '] ' + h.txt));
  console.log('4. SENTENCE LENGTH: n=' + w.length + ' mean=' + mean.toFixed(1) + ' median=' + w[Math.floor(w.length / 2)] + ' max=' + w[w.length - 1] + ' over35=' + w.filter((x) => x > 35).length);
  console.log('   targets: mean 15-18, median <=18  =>  ' + (mean >= 15 && mean <= 18 && w[Math.floor(w.length / 2)] <= 18 ? 'PASS' : 'MISS'));
  console.log('3. ACRONYMS PRESENT: ' + acr.join(' '));
  const longest = sents.filter((s) => s.split(/\s+/).length > 35).slice(0, 6);
  if (longest.length) { console.log('   longest sentences:'); longest.forEach((s) => console.log('   > ' + s.slice(0, 170))); }
  await b.close();
  process.exit(hits.length ? 1 : 0);
})().catch((e) => { console.error('FATAL', e.message); process.exit(2); });
