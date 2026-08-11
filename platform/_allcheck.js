/* eslint-disable @typescript-eslint/no-require-imports */
// Coverage check: every task-group member has a bespoke paper with procedures,
// sources, an evaluation and a conclusion; plus a browser spot-check of one
// paper per phase on the production build at :3100.
const { chromium } = require("@playwright/test");

const ok = (c, m) => console.log(`${c ? "PASS" : "FAIL"} ${m}`);

async function coverage() {
  // compiled TS isn't require-able; parse the sources instead
  const fs = require("fs");
  const read = (p) => fs.readFileSync(p, "utf8");
  const groups = read("lib/task-groups.ts");
  const members = [];
  for (const m of groups.matchAll(/members: \[([^\]]*)\]/g)) {
    members.push(...m[1].split(",").map((x) => x.trim().replace(/"/g, "")).filter(Boolean));
  }
  const papers = ["acceptance", "strategy", "execution", "conclusion"]
    .map((n) => read(`lib/papers/${n}.ts`))
    .join("\n");
  // keys of the exported maps: "D3.1": / D1, / E100, etc.
  const defined = new Set();
  for (const m of papers.matchAll(/^\s{2}(?:"([A-Z][0-9.]+)"|([A-Z][0-9.]*[0-9]))[,:]/gm)) {
    defined.add(m[1] ?? m[2]);
  }
  const missing = members.filter((c) => !defined.has(c));
  ok(missing.length === 0, `all ${members.length} group members have a bespoke paper${missing.length ? " — missing: " + missing.join(", ") : ""}`);

  // every paper carries procedures with sources and a conclusion
  for (const name of ["strategy", "execution", "conclusion"]) {
    const src = read(`lib/papers/${name}.ts`);
    const nProc = (src.match(/srcEn:/g) || []).length;
    const nConcl = (src.match(/conclEn/g) || []).length;
    console.log(`${name}: ${nProc} procedures, ${nConcl} conclusion blocks`);
  }
}

async function browse() {
  const BASE = "http://localhost:3100";
  const ID = process.env.ENG_ID;
  const b = await chromium.launch();
  const p = await b.newPage();
  await p.goto(`${BASE}/login`);
  const en = p.getByRole("button", { name: /^(English|Anglais)$/ });
  if (await en.count()) {
    await en.click();
    await p.waitForLoadState("networkidle");
  }
  await p.fill("input[name=email]", "alice@firm-a.test");
  await p.fill("input[name=password]", "password");
  await p.getByTestId("login-submit").click();
  await p.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 });

  // one paper per phase
  const CHECKS = [
    ["strategy", "D5.4"],
    ["execution", "E110"],
    ["execution", "E350"],
    ["conclusion", "B5"],
    ["conclusion", "F2"],
  ];
  for (const [phase, code] of CHECKS) {
    await p.goto(`${BASE}/engagements/${ID}/phase/${phase}`);
    await p.waitForLoadState("networkidle");
    const link = p.locator(`[data-testid="phase-task-${code}"]`);
    if ((await link.count()) === 0) {
      ok(false, `${code} not on the ${phase} phase page`);
      continue;
    }
    await p.goto("http://localhost:3100" + (await link.getAttribute("href")));
    await p.waitForLoadState("networkidle");
    const form = p.locator(`[data-testid="wp-form-${code}"]`);
    const procs = await form.locator('[data-testid^="wp-p_"]').count();
    const sources = await form.getByText(/Expected sources:/).count();
    const concl = await form.locator('[data-testid^="wp-c_"][data-testid$="-yes"]').count();
    ok(procs > 0 && sources === procs && concl > 0, `${code}: ${procs} procedures, ${sources} sources, ${concl} conclusions`);
  }

  // persistence on a strategy paper
  await p.goto(`${BASE}/engagements/${ID}/phase/strategy`);
  await p.goto("http://localhost:3100" + (await p.locator('[data-testid="phase-task-D5.4"]').getAttribute("href")));
  const stamp = "inquiries held 8 Aug; no fraud alleged; see WP D5.4-1";
  await p.locator('[data-testid="wp-p_mgmt"]').fill(stamp);
  await p.getByTestId("wp-save-D5.4").click();
  await p.waitForLoadState("networkidle");
  await p.reload();
  ok((await p.locator('[data-testid="wp-p_mgmt"]').inputValue()) === stamp, "a strategy procedure result survives a save");

  await b.close();
}

(async () => {
  await coverage();
  await browse();
})().catch((e) => {
  console.error("ERROR", e.message);
  process.exit(1);
});
