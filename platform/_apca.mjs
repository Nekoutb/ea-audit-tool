// APCA-W3 contrast check over the Atlas token pairs (audit item 3).
// Implements the SAPC/APCA 0.0.98G-4g constants. Lc thresholds used:
//   >=90 preferred body, >=75 body minimum, >=60 large/semibold text (>=16px bold
//   or >=24px), >=45 large headline / non-text UI.
function sRGBtoY([r, g, b]) {
  const c = [r, g, b].map((v) => Math.pow(v / 255, 2.4));
  return 0.2126729 * c[0] + 0.7151522 * c[1] + 0.072175 * c[2];
}
function hex(h) {
  const s = h.replace("#", "");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}
function apca(textHex, bgHex) {
  let Ytxt = sRGBtoY(hex(textHex));
  let Ybg = sRGBtoY(hex(bgHex));
  const clamp = (Y) => (Y > 0.022 ? Y : Y + Math.pow(0.022 - Y, 1.414));
  Ytxt = clamp(Ytxt); Ybg = clamp(Ybg);
  let S;
  if (Ybg > Ytxt) S = (Math.pow(Ybg, 0.56) - Math.pow(Ytxt, 0.57)) * 1.14; // dark text on light
  else S = (Math.pow(Ybg, 0.65) - Math.pow(Ytxt, 0.62)) * 1.14;            // light text on dark
  const abs = Math.abs(S);
  if (abs < 0.1) return 0;
  const Lc = S > 0 ? (S - 0.027) * 100 : (S + 0.027) * 100;
  return Math.round(Lc * 10) / 10;
}

const LIGHT = { canvas: "#d5d9de", surface: "#ecedef", surface2: "#e5e9ec", ink: "#1b1e23", inkSoft: "#2b323b", muted: "#515863", warn: "#9c660e", warnSoft: "#f7edd8", rose: "#b23c4f", roseSoft: "#f7e7ea", good: "#12795a", goodSoft: "#e4f2ec", emerald700: "#047857", white: "#ffffff" };
const DARK = { canvas: "#121418", surface: "#202328", surface2: "#2a2d32", ink: "#eef1f5", inkSoft: "#c8d1de", muted: "#aab7ca", warn: "#e0b054", warnSoft: "#2a2113", rose: "#f9a3b0", roseSoft: "#2b171b", good: "#5cd8a3", goodSoft: "#12241d", emerald400: "#34d399" };

// [label, text, bg, requiredLc, note]
const PAIRS = [
  ["L ink/surface (body)", LIGHT.ink, LIGHT.surface, 75],
  ["L inkSoft/surface (body)", LIGHT.inkSoft, LIGHT.surface, 75],
  ["L inkSoft/canvas (body)", LIGHT.inkSoft, LIGHT.canvas, 75],
  ["L muted/surface (small labels, semibold)", LIGHT.muted, LIGHT.surface, 60],
  ["L muted/surface2 (small labels)", LIGHT.muted, LIGHT.surface2, 60],
  ["L muted/canvas (small labels)", LIGHT.muted, LIGHT.canvas, 60],
  ["L warn/warnSoft (chip)", LIGHT.warn, LIGHT.warnSoft, 60],
  ["L rose/roseSoft (chip)", LIGHT.rose, LIGHT.roseSoft, 60],
  ["L good/goodSoft (chip)", LIGHT.good, LIGHT.goodSoft, 60],
  ["L emerald700/surface (links, semibold)", LIGHT.emerald700, LIGHT.surface, 60],
  ["L white/emerald700 (primary button)", LIGHT.white, LIGHT.emerald700, 60],
  ["D ink/surface (body)", DARK.ink, DARK.surface, 75],
  ["D inkSoft/surface (body)", DARK.inkSoft, DARK.surface, 75],
  ["D inkSoft/canvas (body)", DARK.inkSoft, DARK.canvas, 75],
  ["D muted/surface (small labels)", DARK.muted, DARK.surface, 60],
  ["D muted/canvas (small labels)", DARK.muted, DARK.canvas, 60],
  ["D warn/warnSoft (chip)", DARK.warn, DARK.warnSoft, 60],
  ["D rose/roseSoft (chip)", DARK.rose, DARK.roseSoft, 60],
  ["D good/goodSoft (chip)", DARK.good, DARK.goodSoft, 60],
  ["D emerald400/surface (links)", DARK.emerald400, DARK.surface, 60],
];

let fails = 0;
for (const [label, t, bg, req] of PAIRS) {
  const lc = Math.abs(apca(t, bg));
  const ok = lc >= req;
  if (!ok) fails++;
  console.log(`${ok ? "PASS" : "FAIL"}  Lc ${String(lc).padStart(5)}  (need ${req})  ${label}`);
}
console.log(fails === 0 ? "ALL PASS" : fails + " FAILURES");
