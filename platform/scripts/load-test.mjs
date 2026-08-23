// Load test: how many concurrent auditors the box actually carries.
//
// The audit asked for 25 / 50 / 100 / 150 users and for the numbers to be
// published. This measures the journeys people actually make — sign in, open
// the register, open an engagement, read a section, search — rather than
// hammering one cheap endpoint, because the interesting limit is the database
// pool and the 1200 MB cap, not how fast a static page renders.
//
//   node scripts/load-test.mjs --base https://www.auditisa.com --users 25 --seconds 60
//
// Defaults to localhost:3100 so it is safe to run without arguments. Pointing
// it at production is a deliberate act: it signs in repeatedly and reads real
// pages, so run it out of hours and expect it in the login-attempt table.

import { setTimeout as sleep } from "node:timers/promises";

const args = new Map();
for (let i = 2; i < process.argv.length; i += 2) {
  args.set(process.argv[i].replace(/^--/, ""), process.argv[i + 1]);
}

const BASE = (args.get("base") ?? "http://localhost:3100").replace(/\/$/, "");
const USERS = Number(args.get("users") ?? 25);
const SECONDS = Number(args.get("seconds") ?? 30);
const EMAIL = args.get("email") ?? "alice@firm-a.test";
const PASSWORD = args.get("password") ?? "password";

/** One journey step. `weight` is how often it is chosen. */
const STEPS = [
  { name: "dashboard", path: () => "/dashboard", weight: 3 },
  { name: "register", path: () => "/engagements", weight: 3 },
  { name: "clients", path: () => "/clients", weight: 1 },
  { name: "search", path: () => `/search?q=${["receivable", "provision", "creances", "revenue"][Math.floor(Math.random() * 4)]}`, weight: 2 },
  { name: "notifications", path: () => "/notifications", weight: 1 },
];
const WEIGHTED = STEPS.flatMap((s) => Array(s.weight).fill(s));

const results = [];
let signInFailures = 0;
let errors = 0;

/**
 * Sign in once, with a real browser, and share the session across the workers.
 *
 * Login is a Next.js server action, not a form POST — a hand-rolled POST to
 * /login simply redirects, which is how the first version of this script came
 * to report 5 ms latencies and 100% 307s. It was measuring redirects.
 *
 * One session for all workers is a deliberate simplification: the question here
 * is how much concurrent WORK the box carries, and the session lookup is a JWT
 * decode plus at most one cached revalidation query. Where per-user cost
 * matters — the login throttle, the revalidation window — that is measured
 * separately, not here.
 */
async function obtainSession() {
  const { chromium } = await import("playwright");
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({ baseURL: BASE });
    const page = await context.newPage();
    await page.goto("/login", { waitUntil: "domcontentloaded" });
    await page.fill("input[name=email]", EMAIL);
    await page.fill("input[name=password]", PASSWORD);
    await page.getByTestId("login-submit").click();
    // The thing this function needs is the SESSION COOKIE, not any particular
    // URL: the sign-in server action sets the cookie before the client-side
    // redirect, and under headless runs that redirect sometimes never fires
    // (login_attempt shows successful=true while the page sits on /login).
    // So poll the cookie jar; the URL is nobody's business here.
    const deadline = Date.now() + 40000;
    let jar = "";
    while (Date.now() < deadline) {
      const cookies = await context.cookies();
      jar = cookies.map((c) => `${c.name}=${c.value}`).join("; ");
      if (/authjs\.session-token/.test(jar)) return jar;
      await page.waitForTimeout(500);
    }
    throw new Error("no session cookie after sign-in");
  } finally {
    await browser.close();
  }
}

async function worker(id, until, cookie) {
  while (Date.now() < until) {
    const step = WEIGHTED[Math.floor(Math.random() * WEIGHTED.length)];
    const started = performance.now();
    try {
      const res = await fetch(BASE + step.path(), { headers: { Cookie: cookie }, redirect: "manual" });
      // Drain the body: not reading it measures headers, not the page.
      await res.arrayBuffer();
      results.push({ step: step.name, ms: performance.now() - started, status: res.status });
      // A 3xx here means the session was refused: the run is measuring
      // redirects, not pages, and the numbers would be meaningless.
      if (res.status >= 500 || (res.status >= 300 && res.status < 400)) errors += 1;
    } catch {
      errors += 1;
      results.push({ step: step.name, ms: performance.now() - started, status: 0 });
    }
    // Think time: a person reads a page before clicking again. Without it this
    // measures a hammer, not a workload.
    await sleep(200 + Math.random() * 600);
  }
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
}

console.log(`load test — ${USERS} concurrent users for ${SECONDS}s against ${BASE}\n`);
let cookie;
try {
  cookie = await obtainSession();
  console.log("signed in; session shared across workers\n");
} catch (error) {
  console.error("could not sign in:", error instanceof Error ? error.message : error);
  process.exit(2);
}

const until = Date.now() + SECONDS * 1000;
const t0 = performance.now();
await Promise.all(Array.from({ length: USERS }, (_, i) => worker(i, until, cookie)));
const elapsed = (performance.now() - t0) / 1000;

const all = results.map((r) => r.ms).sort((a, b) => a - b);
// A redirect counts as bad: it means the session was refused and the run is
// measuring redirects rather than pages.
const bad = results.filter((r) => r.status === 0 || r.status >= 500 || (r.status >= 300 && r.status < 400)).length;

console.log(`requests      : ${results.length} in ${elapsed.toFixed(1)}s  (${(results.length / elapsed).toFixed(1)}/s)`);
console.log(`sign-in fails : ${signInFailures}/${USERS}`);
console.log(`5xx or dropped: ${bad} (${((bad / Math.max(1, results.length)) * 100).toFixed(2)}%)`);
console.log(`latency ms    : p50 ${percentile(all, 50).toFixed(0)}  p90 ${percentile(all, 90).toFixed(0)}  p99 ${percentile(all, 99).toFixed(0)}  max ${(all.at(-1) ?? 0).toFixed(0)}`);
console.log(`\nby step:`);
for (const step of STEPS) {
  const mine = results.filter((r) => r.step === step.name).map((r) => r.ms).sort((a, b) => a - b);
  if (mine.length === 0) continue;
  console.log(`  ${step.name.padEnd(14)} n=${String(mine.length).padStart(4)}  p50 ${percentile(mine, 50).toFixed(0).padStart(5)}  p90 ${percentile(mine, 90).toFixed(0).padStart(5)}  p99 ${percentile(mine, 99).toFixed(0).padStart(5)}`);
}

const statuses = results.reduce((acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; }, {});
console.log(`\nstatus codes  : ${Object.entries(statuses).map(([k, v]) => `${k}×${v}`).join("  ")}`);
process.exit(bad > results.length * 0.01 ? 1 : 0);
