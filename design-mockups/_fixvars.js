/* Splice the stale rail/rollout JS out of B and C, insert each variation's renderer. */
const fs = require('fs');

function splice(file, replacement, finalCall) {
  let s = fs.readFileSync(file, 'utf8');
  const start = s.indexOf("  const rail = document.getElementById('rail');");
  const end = s.indexOf('  const drawerHost =');
  if (start === -1 || end === -1) { console.log(file + ': anchors missing', start, end); return; }
  s = s.slice(0, start) + replacement + s.slice(end);
  // ensure the boot call is the variation's own
  s = s.replace(/\n {2}render(?:Rail\(\); renderRollout|Deck|)\(\);(\s*)<\/script>/, '\n  ' + finalCall + '$1</script>');
  fs.writeFileSync(file, s);
  console.log(file + ': spliced, boot=' + finalCall);
}

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

splice('dashboard-var-b-deck.html', bJs, 'renderDeck();');
splice('dashboard-var-c-stage.html', cJs, 'render();');

// sanity: no stale identifiers left
for (const f of ['dashboard-var-b-deck.html', 'dashboard-var-c-stage.html']) {
  const s = fs.readFileSync(f, 'utf8');
  console.log(f, '| stale rail refs:', (s.match(/renderRail|getElementById\('rollout'\)/g) || []).length,
    '| boot:', s.match(/\n {2}(render\w*\(\));(\s*)<\/script>/)?.[1]);
}
