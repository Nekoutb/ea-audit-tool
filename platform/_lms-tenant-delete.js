/* eslint-disable @typescript-eslint/no-require-imports -- scratch script */
/* Proves that deleting an organisation ends access for its people. */
const { webcrypto } = require("node:crypto");
const { execFileSync } = require("node:child_process");

const LMS = "C:\\Users\\UltraBook 3.1\\Documents\\AI Projects\\lms";
const BASE = "http://localhost:3000";
const ADMIN = "support@ealearnings.com";
const ADMIN_PASS = "Str0ngPass!2026";
const STAFF = "victim@doomed.example";
const STAFF_PASS = "St4ffPass!2026";

const fails = [];
const ok = (l, c, d = "") => { console.log(`${c ? "PASS" : "FAIL"} ${l}${d ? " — " + d : ""}`); if (!c) fails.push(l); };

function sqlite(sql) {
  const script = `
import sqlite3,glob,sys
f=[p for p in glob.glob(r"${LMS}\\.wrangler/state/v3/d1/**/*.sqlite",recursive=True) if "miniflare-D1" in p]
c=sqlite3.connect(f[0]);cur=c.cursor();cur.execute(sys.argv[1]);rows=cur.fetchall();c.commit();print(rows)
`;
  return execFileSync("python", ["-c", script, sql], { encoding: "utf8" }).trim();
}

async function derive(password, saltB64) {
  const salt = Uint8Array.from(Buffer.from(saltB64, "base64"));
  const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await webcrypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 210000 }, key, 256);
  return Buffer.from(new Uint8Array(bits)).toString("base64");
}

async function post(path, body, cookie) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  const r = await fetch(BASE + path, { method: "POST", headers, body: JSON.stringify(body) });
  const raw = r.headers.get("set-cookie") || "";
  return { status: r.status, ok: r.ok, body: await r.json().catch(() => ({})), cookie: (raw.split(";")[0] || "") };
}

(async () => {
  // Platform admin signs in and clears the forced change.
  let admin = await post("/api/auth/login", { email: ADMIN, password: "admin" });
  if (admin.body?.user?.mustChangePassword) {
    await post("/api/auth/change-password", { currentPassword: "admin", newPassword: ADMIN_PASS }, admin.cookie);
    admin = await post("/api/auth/login", { email: ADMIN, password: ADMIN_PASS });
  } else {
    admin = await post("/api/auth/login", { email: ADMIN, password: ADMIN_PASS });
  }
  ok("platform admin signed in", admin.ok);

  // Create an organisation with one member, via the real invitation route.
  const invite = await post("/api/invitation", {
    type: "employee-invite", id: "doomed-co", tenantName: "Doomed Co",
    academyName: "Doomed Co Academy", subdomain: "doomed-co",
    recipientName: "Victim Staff", recipientEmail: STAFF, language: "EN",
    assignedCourses: ["aml-cft"],
  }, admin.cookie);
  ok("member provisioned for the organisation", invite.status === 200 || invite.status === 202, `status ${invite.status}`);

  // Give them a password and sign them in, so there is a live session.
  const salt = Buffer.from(webcrypto.getRandomValues(new Uint8Array(16))).toString("base64");
  sqlite(`update users set password_hash='${await derive(STAFF_PASS, salt)}', password_salt='${salt}', must_change_password=0 where email='${STAFF}'`);
  const staff = await post("/api/auth/login", { email: STAFF, password: STAFF_PASS });
  ok("member can sign in before deletion", staff.ok);
  const session = await fetch(BASE + "/api/auth/session", { headers: { Cookie: staff.cookie } }).then((r) => r.json());
  ok("member has a live session", session.user?.email === STAFF);

  // A learner must not be able to delete an organisation.
  const byLearner = await post("/api/org/tenants", { action: "delete", id: "doomed-co" }, staff.cookie);
  ok("a learner cannot delete an organisation", byLearner.status === 403, `status ${byLearner.status}`);

  // The platform admin cannot delete their own tenant.
  const ownTenant = await post("/api/org/tenants", { action: "delete", id: "elite" }, admin.cookie);
  ok("admin cannot delete their own organisation", ownTenant.status === 400, `status ${ownTenant.status}`);

  // Now delete it properly.
  const del = await post("/api/org/tenants", { action: "delete", id: "doomed-co" }, admin.cookie);
  ok("organisation deleted by the platform admin", del.ok, JSON.stringify(del.body));

  // THE BUG: the member must no longer be able to sign in.
  const retry = await post("/api/auth/login", { email: STAFF, password: STAFF_PASS });
  ok("deleted member can NO LONGER sign in", retry.status === 401, `status ${retry.status}`);

  // Their existing session must be dead too.
  const after = await fetch(BASE + "/api/auth/session", { headers: { Cookie: staff.cookie } }).then((r) => r.json());
  ok("their live session is revoked", after.user === null);

  // And nothing is left behind in the database.
  console.log("   users left:", sqlite(`select count(*) from users where tenant_id='doomed-co'`));
  console.log("   reset tokens left:", sqlite(`select count(*) from password_resets where user_id not in (select id from users)`));
  ok("no accounts remain for that organisation", /\(0,\)/.test(sqlite(`select count(*) from users where tenant_id='doomed-co'`)));
  ok("no orphaned reset links remain", /\(0,\)/.test(sqlite(`select count(*) from password_resets where user_id not in (select id from users)`)));

  // The platform admin still works.
  const adminAfter = await post("/api/auth/login", { email: ADMIN, password: ADMIN_PASS });
  ok("platform admin is unaffected", adminAfter.ok);

  console.log(fails.length ? `\nGUARDRAIL FAILURES: ${fails.length}\n - ${fails.join("\n - ")}` : "\nTENANT DELETION GUARDRAILS ALL GREEN");
  process.exit(fails.length ? 1 : 0);
})().catch((e) => { console.error("CRASH", e); process.exit(2); });
