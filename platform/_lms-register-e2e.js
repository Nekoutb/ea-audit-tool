// Organisation register end-to-end: the register lives in the database, only a
// platform administrator may change it, uniqueness is enforced server-side, and
// deleting a client revokes its accounts in the same operation.
const BASE = process.env.LMS_BASE ?? "http://127.0.0.1:8787";
const MASTER = "support@ealearnings.com";

let pass = 0, fail = 0;
const check = (name, ok, detail = "") => {
  if (ok) { pass += 1; console.log(`  PASS  ${name}`); }
  else { fail += 1; console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
};

async function req(path, { method = "GET", body, cookie } = {}, attempt = 0) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  let response;
  try {
    response = await fetch(`${BASE}${path}`, {
      method, headers,
      body: body ? JSON.stringify(body) : undefined,
      // The dev server drops pooled sockets when it recycles; without this a
      // request onto a dead socket hangs instead of failing.
      signal: AbortSignal.timeout(15_000),
      keepalive: false,
    });
  } catch (error) {
    if (attempt < 3) return req(path, { method, body, cookie }, attempt + 1);
    throw error;
  }
  const text = await response.text();
  // `wrangler dev` recycles its isolate between requests and only auto-retries
  // GET/HEAD; a POST caught mid-recycle comes back as this 503. It is a local
  // dev-server artifact, so retry it once rather than reporting a failure.
  if (response.status === 503 && /worker restarted mid-request/i.test(text) && attempt < 3) {
    return req(path, { method, body, cookie }, attempt + 1);
  }
  let json = null;
  try { json = JSON.parse(text); } catch { /* non-JSON body */ }
  return { status: response.status, json, text, setCookie: response.headers.get("set-cookie") ?? "" };
}

function cookieOf(setCookie) {
  const match = /ea_session=([^;]+)/.exec(setCookie);
  return match ? `ea_session=${match[1]}` : "";
}

// The seed password is rotated by earlier runs, so try both. A freshly seeded
// administrator must change its password before it may act, which is the
// behaviour under test elsewhere — rotate it here so the register can be
// exercised.
const TEST_PASSWORD = "RegisterTest!2026";

async function signInMaster() {
  for (const password of [process.env.LMS_MASTER_PASSWORD, TEST_PASSWORD, "admin"].filter(Boolean)) {
    const res = await req("/api/auth/login", { method: "POST", body: { email: MASTER, password } });
    if (res.status !== 200) continue;
    let cookie = cookieOf(res.setCookie);
    if (res.json?.user?.mustChangePassword) {
      const rotated = await req("/api/auth/change-password", {
        method: "POST", cookie,
        body: { currentPassword: password, newPassword: TEST_PASSWORD },
      });
      if (rotated.status !== 200) return null;
      if (rotated.setCookie) cookie = cookieOf(rotated.setCookie) || cookie;
    }
    return { cookie };
  }
  return null;
}

async function main() {
  console.log(`Organisation register · ${BASE}\n`);

  const master = await signInMaster();
  if (!master?.cookie) {
    console.log("  FAIL  could not sign in as the platform administrator");
    process.exit(1);
  }
  check("platform administrator signs in", true);

  // --- authorization ---------------------------------------------------------
  const anon = await req("/api/org/tenants");
  check("register refuses an anonymous read", anon.status === 401, `got ${anon.status}`);

  const anonWrite = await req("/api/org/tenants", { method: "POST", body: { name: "Sneaky", subdomain: "sneaky" } });
  check("register refuses an anonymous write", anonWrite.status === 401, `got ${anonWrite.status}`);

  const anonDelete = await req("/api/org/tenants", { method: "POST", body: { action: "delete", id: "elite" } });
  check("register refuses an anonymous delete", anonDelete.status === 401, `got ${anonDelete.status}`);

  // --- read ------------------------------------------------------------------
  const list = await req("/api/org/tenants", { cookie: master.cookie });
  check("register reads back", list.status === 200 && Array.isArray(list.json?.tenants), `got ${list.status}`);
  const platformRow = (list.json?.tenants ?? []).find((row) => row.id === "elite");
  check("the platform's own organisation is present", Boolean(platformRow));
  check("no credential material in the response", !/password|salt|token_hash|tokenHash/i.test(list.text));

  // --- create ----------------------------------------------------------------
  const stamp = String(process.pid).slice(-4);
  const slug = `regtest${stamp}`;
  const created = await req("/api/org/tenants", {
    method: "POST", cookie: master.cookie,
    body: { action: "create", name: `Register Test ${stamp}`, subdomain: slug, country: "Cameroon", defaultLanguage: "FR", programmes: ["anti-bribery"], defaultDueDays: 21 },
  });
  check("creates an organisation", created.status === 200 && created.json?.tenant?.id === slug, `${created.status} ${created.text.slice(0, 120)}`);
  check("stores the values it was given", created.json?.tenant?.defaultLanguage === "FR" && created.json?.tenant?.defaultDueDays === 21);

  // --- server-side uniqueness ------------------------------------------------
  const dupName = await req("/api/org/tenants", {
    method: "POST", cookie: master.cookie,
    body: { action: "create", name: `  register test ${stamp}  `, subdomain: `${slug}x` },
  });
  check("refuses a duplicate company name regardless of case and spacing", dupName.status === 409, `got ${dupName.status}`);

  const dupSub = await req("/api/org/tenants", {
    method: "POST", cookie: master.cookie,
    body: { action: "create", name: `Other ${stamp}`, subdomain: slug },
  });
  check("refuses a duplicate academy address", dupSub.status === 409, `got ${dupSub.status}`);

  const reserved = await req("/api/org/tenants", {
    method: "POST", cookie: master.cookie,
    body: { action: "create", name: `Reserved ${stamp}`, subdomain: "admin" },
  });
  check("refuses a reserved address", reserved.status === 409, `got ${reserved.status}`);

  const badSub = await req("/api/org/tenants", {
    method: "POST", cookie: master.cookie,
    body: { action: "create", name: `Bad ${stamp}`, subdomain: "Not Valid!" },
  });
  check("refuses a malformed address", badSub.status === 400, `got ${badSub.status}`);

  // --- the register governs account provisioning -----------------------------
  const orphan = await req("/api/invitation", {
    method: "POST", cookie: master.cookie,
    body: { type: "employee-invite", tenantId: "no-such-org", tenantName: "Ghost", academyName: "Ghost Academy", subdomain: "ghost", recipientName: "Ghost User", recipientEmail: `ghost${stamp}@example.com`, language: "EN" },
  });
  check("refuses to provision an account into an unregistered organisation", orphan.status === 404, `got ${orphan.status}`);

  // --- persistence across a fresh read ---------------------------------------
  const reread = await req("/api/org/tenants", { cookie: master.cookie });
  const persisted = (reread.json?.tenants ?? []).find((row) => row.id === slug);
  check("the new organisation survives a fresh read", Boolean(persisted));
  check("the roster is reported per organisation", Array.isArray(persisted?.employees));

  // --- an account inside it, then deletion -----------------------------------
  const member = `member${stamp}@example.com`;
  const invited = await req("/api/invitation", {
    method: "POST", cookie: master.cookie,
    body: { type: "employee-invite", tenantId: slug, tenantName: `Register Test ${stamp}`, academyName: "Register Test Academy", subdomain: slug, recipientName: "Test Member", recipientEmail: member, language: "EN", assignedCourses: ["anti-bribery"] },
  });
  check("provisions an account inside a registered organisation", invited.status === 200 || invited.status === 202, `got ${invited.status}`);

  const withMember = await req("/api/org/tenants", { cookie: master.cookie });
  const row = (withMember.json?.tenants ?? []).find((item) => item.id === slug);
  check("the account appears on that organisation's roster", (row?.employees ?? []).some((person) => person.email === member));

  const ownTenant = await req("/api/org/tenants", { method: "POST", cookie: master.cookie, body: { action: "delete", id: "elite" } });
  check("refuses to delete the administrator's own organisation", ownTenant.status === 400, `got ${ownTenant.status}`);

  const deleted = await req("/api/org/tenants", { method: "POST", cookie: master.cookie, body: { action: "delete", id: slug } });
  check("deletes the organisation", deleted.status === 200 && deleted.json?.status === "deleted", `${deleted.status} ${deleted.text.slice(0, 120)}`);
  check("reports the accounts it revoked", deleted.json?.accountsRemoved >= 1, `got ${deleted.json?.accountsRemoved}`);

  const after = await req("/api/org/tenants", { cookie: master.cookie });
  check("the organisation is gone from the register", !(after.json?.tenants ?? []).some((item) => item.id === slug));
  check("its accounts are gone with it", !(after.json?.tenants ?? []).some((item) => (item.employees ?? []).some((p) => p.email === member)));

  // The deleted member must not be able to start a session or a reset.
  const ghostLogin = await req("/api/auth/login", { method: "POST", body: { email: member, password: "anything" } });
  check("a deleted organisation's account cannot sign in", ghostLogin.status === 401, `got ${ghostLogin.status}`);

  const reinvite = await req("/api/invitation", {
    method: "POST", cookie: master.cookie,
    body: { type: "employee-invite", tenantId: slug, tenantName: "Register Test", academyName: "Register Test Academy", subdomain: slug, recipientName: "Test Member", recipientEmail: member, language: "EN" },
  });
  check("the deleted organisation can no longer receive invitations", reinvite.status === 404, `got ${reinvite.status}`);

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

main().catch((error) => { console.error(error); process.exit(1); });
