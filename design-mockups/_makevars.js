/* Generates variations B and C from variation A (shared tokens, data, drawer, mid section). */
const fs = require('fs');
const a = fs.readFileSync('dashboard-var-a-rail.html', 'utf8');

/* ---------------- Variation B: expanding deck ---------------- */
let b = a;
b = b.replace('<title>Dashboard A — Section rail</title>', '<title>Dashboard B — Expanding deck</title>');

const bCss = `  /* ====== B: expanding deck ====== */
  .stage { display:flex; gap:12px; margin-bottom:16px; min-height:230px; }
  .sec {
    display:flex; flex-direction:column; align-items:flex-start; gap:10px; padding:16px; cursor:pointer;
    font:inherit; color:var(--ink); text-align:left; border:1px solid var(--glass-border);
    flex:1; min-width:0; overflow:hidden;
    transition:flex 340ms cubic-bezier(.23,1,.32,1), background 200ms ease;
  }
  .sec.on { flex:3.4; background:var(--glass-strong); cursor:default; }
  .sec:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  .sec-head { display:flex; align-items:center; gap:13px; width:100%; }
  .ring { --p:0; --c:var(--accent); width:56px; height:56px; border-radius:50%; flex-shrink:0;
    background:radial-gradient(closest-side,var(--glass-strong) 74%,transparent 75% 100%),conic-gradient(var(--c) calc(var(--p)*1%),var(--track) 0);
    display:grid; place-items:center; font-size:13px; font-weight:750; font-variant-numeric:tabular-nums; }
  .sec h2 { margin:0; font-size:14px; font-weight:700; letter-spacing:-.01em; white-space:nowrap; }
  .sec .sub { font-size:11px; color:var(--muted); white-space:nowrap; }
  .sec-groups { display:none; flex-direction:column; width:100%; margin-top:2px; }
  .sec.on .sec-groups { display:flex; }
  .grp {
    display:flex; align-items:center; gap:12px; width:calc(100% + 16px); margin:0 -8px; padding:7px 8px;
    border:none; background:none; font:inherit; color:var(--ink-soft); text-align:left; border-radius:var(--r-sm); cursor:pointer;
    opacity:0; transform:translateX(-14px);
    animation:roll 300ms cubic-bezier(.23,1,.32,1) forwards; animation-delay:calc(var(--i) * 40ms);
    transition:background 150ms ease;
  }
  @keyframes roll { to { opacity:1; transform:none; } }
  .grp:hover { background:rgba(127,132,140,.12); }
  .grp:focus-visible { outline:2px solid var(--accent); outline-offset:-2px; }
  .grp .gname { flex:1; font-weight:600; font-size:12.5px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .grp .gcount { font-size:11px; color:var(--muted); font-variant-numeric:tabular-nums; }
  .gbar { width:76px; height:4px; border-radius:3px; background:var(--track); overflow:hidden; flex-shrink:0; }
  .gbar i { display:block; height:100%; background:var(--accent); border-radius:3px; }
  .grp svg { color:var(--muted); flex-shrink:0; }
  .hint { font-size:10.5px; color:var(--muted); padding-top:5px; }
  /* tiles / findings / feed */`;
b = b.replace(/ {2}\/\* ====== A: vertical section rail \+ roll-out panel ====== \*\/[\s\S]*?\/\* tiles \/ findings \/ feed \*\//, bCss);
b = b.replace('@media (max-width:960px) { .stage { grid-template-columns:1fr; }', '@media (max-width:960px) { .stage { flex-direction:column; } .sec.on { flex:1; }');
b = b.replace(/ {2}<div class="stage">[\s\S]*?<\/div>\n\n {2}<div class="mid">/, '  <div class="stage" id="deck"></div>\n\n  <div class="mid">');

const bJs = `  const deck = document.getElementById('deck');
  let current = 0;

  function renderDeck() {
    deck.innerHTML = DATA.map((s, i) => \`
      <div class="sec glass \${i === current ? 'on' : ''}" role="button" tabindex="0" aria-expanded="\${i === current}" data-i="\${i}">
        <div class="sec-head">
          <span class="ring" style="--p:\${s.pct};--c:\${s.col}">\${s.pct}%</span>
          <span><h2>\${s.name}</h2><span class="sub">\${s.done}/\${s.total} reviewed · \${s.due}</span></span>
        </div>
        <div class="sec-groups">
          \${s.groups.map((g, gi) => \`
            <button class="grp" style="--i:\${gi}" data-g="\${gi}">
              <span class="gname">\${g.code} · \${g.name}</span>
              <span class="gcount">\${g.done}/\${g.total}</span>
              <span class="gbar"><i style="width:\${g.total ? Math.round((g.done / g.total) * 100) : 0}%"></i></span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M9 6l6 6-6 6"/></svg>
            </button>\`).join('')}
          <div class="hint">Detail tasks open on the group page — click a group.</div>
        </div>
      </div>\`).join('');
    deck.querySelectorAll('.sec').forEach((el) => {
      el.addEventListener('click', (ev) => {
        if (ev.target.closest('.grp')) return;
        if (+el.dataset.i !== current) { current = +el.dataset.i; renderDeck(); }
      });
      el.addEventListener('keydown', (ev) => { if ((ev.key === 'Enter' || ev.key === ' ') && !ev.target.closest('.grp')) { ev.preventDefault(); current = +el.dataset.i; renderDeck(); } });
    });
    deck.querySelectorAll('.grp').forEach((btn) => btn.addEventListener('click', () => openDrawer(DATA[current], DATA[current].groups[+btn.dataset.g])));
  }

`;
b = b.replace(/ {2}const rail = document\.getElementById\('rail'\);\n {2}const rollout = document\.getElementById\('rollout'\);\n {2}let current = 0;\n\n {2}function renderRail\(\) \{[\s\S]*?renderRollout\(\); \}\n\n/, bJs);
b = b.replace('  renderRail(); renderRollout();', '  renderDeck();');
b = b.replace(
  'Variation A — section rail · click a section: groups roll out to the right · click a group: its task page opens (drawer preview)',
  'Variation B — expanding deck · the clicked section grows and its groups roll out inside; the others compress · click a group for its task page (drawer preview)',
);
fs.writeFileSync('dashboard-var-b-deck.html', b);
console.log('B written:', b.length, b.includes('renderDeck') && !b.includes('renderRail') ? 'OK' : 'CHECK');

/* ---------------- Variation C: focus stage ---------------- */
let c = a;
c = c.replace('<title>Dashboard A — Section rail</title>', '<title>Dashboard C — Focus stage</title>');

const cCss = `  /* ====== C: focus stage ====== */
  .stage { display:grid; grid-template-columns:300px 1fr; gap:14px; margin-bottom:16px; align-items:stretch; }
  .hero { padding:20px; display:flex; flex-direction:column; gap:14px; }
  .hero-ring { --p:0; --c:var(--accent); width:130px; height:130px; border-radius:50%; margin:6px auto 0;
    background:radial-gradient(closest-side,var(--glass-strong) 80%,transparent 81% 100%),conic-gradient(var(--c) calc(var(--p)*1%),var(--track) 0);
    display:grid; place-items:center; font-size:26px; font-weight:780; letter-spacing:-.03em; font-variant-numeric:tabular-nums;
    transition:--p 300ms ease; }
  .hero h2 { margin:0; text-align:center; font-size:16.5px; letter-spacing:-.015em; }
  .hero .sub { text-align:center; font-size:12px; color:var(--muted); margin-top:2px; }
  .switch { display:flex; gap:6px; justify-content:center; }
  .sw { flex:1; display:flex; flex-direction:column; align-items:center; gap:4px; padding:9px 6px; border-radius:var(--r-md);
    border:1px solid transparent; background:none; font:inherit; cursor:pointer; color:var(--muted); transition:background 160ms ease; }
  .sw:hover { background:rgba(127,132,140,.12); }
  .sw.on { background:var(--glass-strong); color:var(--ink); border-color:var(--glass-border); box-shadow:var(--shadow-sm); }
  .sw:focus-visible { outline:2px solid var(--accent); }
  .sw .mini-ring { --p:0; --c:var(--accent); width:34px; height:34px; border-radius:50%;
    background:radial-gradient(closest-side,var(--glass-strong) 70%,transparent 71% 100%),conic-gradient(var(--c) calc(var(--p)*1%),var(--track) 0);
    display:grid; place-items:center; font-size:8.5px; font-weight:750; font-variant-numeric:tabular-nums; }
  .sw span.lbl { font-size:10px; font-weight:650; }
  .fan { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; align-content:start; }
  .grp {
    display:flex; flex-direction:column; gap:8px; padding:15px 16px 13px; text-align:left; font:inherit; cursor:pointer;
    color:var(--ink); border:1px solid var(--glass-border);
    opacity:0; transform:translateX(-18px);
    animation:roll 340ms cubic-bezier(.23,1,.32,1) forwards; animation-delay:calc(var(--i) * 55ms);
    transition:transform 180ms cubic-bezier(.23,1,.32,1);
  }
  @keyframes roll { to { opacity:1; transform:none; } }
  .grp:hover { transform:translateY(-2px); }
  .grp:active { transform:scale(.98); }
  .grp:focus-visible { outline:2px solid var(--accent); outline-offset:2px; }
  .grp .gcode { font-size:10px; font-weight:750; letter-spacing:.05em; color:var(--muted); }
  .grp .gname { font-weight:650; font-size:13px; line-height:1.3; min-height:34px; }
  .grp .grow { display:flex; align-items:center; gap:8px; }
  .grp .gcount { font-size:11.5px; color:var(--muted); font-variant-numeric:tabular-nums; }
  .gbar { flex:1; height:5px; border-radius:3px; background:var(--track); overflow:hidden; }
  .gbar i { display:block; height:100%; background:var(--accent); border-radius:3px; }
  .hint { grid-column:1/-1; font-size:11px; color:var(--muted); }
  /* tiles / findings / feed */`;
c = c.replace(/ {2}\/\* ====== A: vertical section rail \+ roll-out panel ====== \*\/[\s\S]*?\/\* tiles \/ findings \/ feed \*\//, cCss);
c = c.replace('@media (max-width:960px) { .stage { grid-template-columns:1fr; }', '@media (max-width:960px) { .stage { grid-template-columns:1fr; } .fan { grid-template-columns:1fr 1fr; }');
c = c.replace(/ {2}<div class="stage">[\s\S]*?<\/div>\n\n {2}<div class="mid">/,
  '  <div class="stage">\n    <aside class="hero glass" id="hero"></aside>\n    <div class="fan" id="fan"></div>\n  </div>\n\n  <div class="mid">');

const cJs = `  const hero = document.getElementById('hero');
  const fan = document.getElementById('fan');
  let current = 0;

  function render() {
    const s = DATA[current];
    hero.innerHTML = \`
      <div class="switch" role="tablist" aria-label="Sections">
        \${DATA.map((x, i) => \`
          <button class="sw \${i === current ? 'on' : ''}" role="tab" aria-selected="\${i === current}" data-i="\${i}">
            <span class="mini-ring" style="--p:\${x.pct};--c:\${x.col}">\${x.pct}%</span>
            <span class="lbl">\${x.name.split(' ')[0]}</span>
          </button>\`).join('')}
      </div>
      <div>
        <div class="hero-ring" style="--p:\${s.pct};--c:\${s.col}">\${s.pct}%</div>
        <h2>\${s.name}</h2>
        <div class="sub">\${s.done} of \${s.total} tasks reviewed · \${s.due}</div>
      </div>\`;
    hero.querySelectorAll('.sw').forEach((btn) => btn.addEventListener('click', () => { current = +btn.dataset.i; render(); }));
    fan.innerHTML = s.groups.map((g, gi) => \`
      <button class="grp glass glass-sm" style="--i:\${gi}" data-g="\${gi}">
        <span class="gcode">\${g.code}</span>
        <span class="gname">\${g.name}</span>
        <span class="grow"><span class="gbar"><i style="width:\${g.total ? Math.round((g.done / g.total) * 100) : 0}%"></i></span>
        <span class="gcount">\${g.done}/\${g.total}</span></span>
      </button>\`).join('') + '<div class="hint">Detail tasks open on the group page — click a group.</div>';
    fan.querySelectorAll('.grp').forEach((btn) => btn.addEventListener('click', () => openDrawer(s, s.groups[+btn.dataset.g])));
  }

`;
c = c.replace(/ {2}const rail = document\.getElementById\('rail'\);\n {2}const rollout = document\.getElementById\('rollout'\);\n {2}let current = 0;\n\n {2}function renderRail\(\) \{[\s\S]*?renderRollout\(\); \}\n\n/, cJs);
c = c.replace('  renderRail(); renderRollout();', '  render();');
c = c.replace(
  'Variation A — section rail · click a section: groups roll out to the right · click a group: its task page opens (drawer preview)',
  'Variation C — focus stage · the selected section takes the spotlight; its groups fan out to the right as tiles · click a group for its task page (drawer preview)',
);
fs.writeFileSync('dashboard-var-c-stage.html', c);
console.log('C written:', c.length, c.includes('hero-ring') && !c.includes('renderRail') ? 'OK' : 'CHECK');
