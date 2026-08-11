/* eslint-disable @typescript-eslint/no-require-imports */
const { chromium } = require("@playwright/test");
const ok = (c, m) => console.log(`${c ? "PASS" : "FAIL"} ${m}`);
require("dotenv").config();
const { Pool } = require("pg");
(async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const r = await pool.query(
    "SELECT fi.id, fi.engagement_id FROM file_item fi JOIN engagement e ON e.id=fi.engagement_id JOIN tenant t ON t.id=e.tenant_id WHERE t.name='Cabinet Alpha' AND fi.code='D3.2' AND e.phase<>'archived' ORDER BY e.created_at DESC LIMIT 1",
  );
  const { id: itemId, engagement_id: engId } = r.rows[0];
  const stamp = Date.now();
  const newEmail = `new.staffer${stamp}@firm-a.test`;

  const b = await chromium.launch();
  const p = await b.newPage();
  await p.context().addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);
  await p.goto("http://localhost:3100/login");
  await p.fill("input[name=email]", "alice@firm-a.test");
  await p.fill("input[name=password]", "password");
  await p.getByTestId("login-submit").click();
  await p.waitForURL("**/dashboard");

  // 1. team: add by email — unknown address provisions + invites; alice joins too
  await p.goto(`http://localhost:3100/engagements/${engId}/team`);
  await p.getByTestId("team-email").waitFor();
  await p.getByTestId("team-email").fill(newEmail);
  await p.getByTestId("team-role").selectOption("senior");
  await p.getByTestId("team-add").click();
  await p.waitForLoadState("networkidle");
  const uNew = await pool.query("SELECT id FROM app_user WHERE email=$1", [newEmail]);
  const row = await p.locator(`[data-testid="team-row-${uNew.rows[0].id}"]`).innerText();
  ok(/Invited — awaiting response/.test(row), "unknown email provisioned + shown as invited");
  ok(/Senior/i.test(row), "role recorded");
  await p.getByTestId("team-email").fill("alice@firm-a.test");
  await p.getByTestId("team-role").selectOption("partner");
  await p.getByTestId("team-add").click();
  await p.waitForLoadState("networkidle");

  // 2. the invited member accepts from the banner
  const u = await pool.query("SELECT id FROM app_user WHERE email=$1", [newEmail]);
  await pool.query(
    "UPDATE app_user SET password_hash=(SELECT password_hash FROM app_user WHERE email='alice@firm-a.test') WHERE id=$1",
    [u.rows[0].id],
  );
  const p2 = await (await b.newContext()).newPage();
  await p2.context().addCookies([{ name: "locale", value: "en", url: "http://localhost:3100" }]);
  await p2.goto("http://localhost:3100/login");
  await p2.fill("input[name=email]", newEmail);
  await p2.fill("input[name=password]", "password");
  await p2.getByTestId("login-submit").click();
  await p2.waitForURL("**/dashboard");
  await p2.goto(`http://localhost:3100/engagements/${engId}/dashboard`);
  await p2.getByTestId("engagement-invite-banner").waitFor({ timeout: 20000 });
  ok(true, "invited member sees the accept/decline banner");
  await p2.getByTestId("accept-engagement").click();
  await p2.waitForLoadState("networkidle");
  await p2.goto(`http://localhost:3100/engagements/${engId}/dashboard`);
  await p2.waitForLoadState("networkidle");
  ok((await p2.locator('[data-testid="engagement-invite-banner"]').count()) === 0, "acceptance clears the banner");
  await p.goto(`http://localhost:3100/engagements/${engId}/team`);
  const row2 = await p.locator(`[data-testid="team-row-${uNew.rows[0].id}"]`).innerText();
  ok(/Accepted · \d/.test(row2), "team page shows Accepted with the timestamp");

  // 3. D3.2 campaign: issue to the team; the member completes; the response locks
  await p.goto(`http://localhost:3100/engagements/${engId}/sections/${itemId}`);
  await p.locator('[data-testid="independence-campaign"]').waitFor();
  ok(true, "campaign panel on the Independence task");
  await p.getByTestId("launch-campaign-team").click();
  await p.waitForLoadState("networkidle");
  const invited = await p.locator('[data-testid^="campaign-row-"]').count();
  ok(invited >= 2, `invitations listed (${invited})`);
  const conf = await pool.query(
    "SELECT ic.token FROM independence_confirmation ic JOIN independence_campaign c ON c.id=ic.campaign_id WHERE c.engagement_id=$1 AND ic.user_id=$2",
    [engId, u.rows[0].id],
  );
  await p2.goto(`http://localhost:3100/independence/${conf.rows[0].token}`);
  await p2.getByTestId("signature-input").fill("New Staffer");
  await p2.getByTestId("submit-confirmation").click();
  await p2.getByTestId("confirmation-done").waitFor();
  await p.goto(`http://localhost:3100/engagements/${engId}/sections/${itemId}`);
  const doneRow = await p.locator(`[data-testid="campaign-row-${u.rows[0].id}"]`).innerText();
  ok(/Completed · \d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(doneRow), "completion shown with date and time");
  const locked = await pool.query("SELECT status, signed_at FROM independence_confirmation WHERE token=$1", [
    conf.rows[0].token,
  ]);
  ok(locked.rows[0].status === "completed" && locked.rows[0].signed_at !== null, "response locked with timestamp");
  await p2.goto(`http://localhost:3100/independence/${conf.rows[0].token}`);
  ok((await p2.locator('[data-testid="submit-confirmation"]').count()) === 0, "locked response cannot be resubmitted");

  // 4. 24h auto-reminder: backdate the still-pending invite (alice's) and reload
  await pool.query(
    `UPDATE independence_confirmation ic SET created_at = now() - interval '25 hours'
       FROM independence_campaign c WHERE c.id=ic.campaign_id AND c.engagement_id=$1 AND ic.status IN ('sent','opened')`,
    [engId],
  );
  await p.goto(`http://localhost:3100/engagements/${engId}/sections/${itemId}`);
  await p.locator('[data-testid="independence-campaign"]').waitFor();
  const reminded = await pool.query(
    `SELECT max(ic.reminder_count) AS m FROM independence_confirmation ic JOIN independence_campaign c ON c.id=ic.campaign_id
      WHERE c.engagement_id=$1 AND ic.status IN ('sent','opened')`,
    [engId],
  );
  ok(Number(reminded.rows[0].m) >= 1, "24h auto-reminder fired on load");
  await p.goto(`http://localhost:3100/engagements/${engId}/sections/${itemId}`);
  await p.locator('[data-testid="independence-campaign"]').waitFor();
  const again = await pool.query(
    `SELECT max(ic.reminder_count) AS m FROM independence_confirmation ic JOIN independence_campaign c ON c.id=ic.campaign_id
      WHERE c.engagement_id=$1 AND ic.status IN ('sent','opened')`,
    [engId],
  );
  ok(Number(again.rows[0].m) === Number(reminded.rows[0].m), "no double reminder within 24h");

  await pool.end();
  await b.close();
})().catch((e) => {
  console.error("ERROR", e.message);
  process.exit(1);
});
