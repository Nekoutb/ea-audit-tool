/* eslint-disable @typescript-eslint/no-require-imports -- scratch */
const BASE = "http://localhost:3000";
async function login(email, password) {
  const r = await fetch(`${BASE}/api/auth/login`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password }) });
  const raw = r.headers.get("set-cookie") || "";
  return { ok: r.ok, cookie: (raw.split(";")[0] || "") };
}
(async () => {
  console.log("--- anonymous ---");
  const anon = await fetch(`${BASE}/api/org/overview`);
  console.log("anonymous:", anon.status, (await anon.text()).slice(0, 60));

  const admin = await login("support@ealearnings.com", "Str0ngPass!2026");
  console.log("admin login ok:", admin.ok);
  const asAdmin = await fetch(`${BASE}/api/org/overview`, { headers: { Cookie: admin.cookie } });
  const adminBody = await asAdmin.text();
  console.log("admin:", asAdmin.status, adminBody.slice(0, 120));
  console.log("admin body leaks hash?", /password_hash|passwordHash|passwordSalt/.test(adminBody));

  const learner = await login("sam@harbour.example", "L3arnerPass!2026");
  console.log("learner login ok:", learner.ok);
  const asLearner = await fetch(`${BASE}/api/org/overview`, { headers: { Cookie: learner.cookie } });
  console.log("learner:", asLearner.status, (await asLearner.text()).slice(0, 80));
})();
