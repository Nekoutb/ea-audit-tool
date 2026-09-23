import pg from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Onboarding without ever sending a password.
//
// The property that matters: the email carries a token, not a credential, and
// the token is stored only as a digest — so reading the table gives an attacker
// nothing they could present, and the administrator who created the account is
// never in a position to know the password.

import { closePool } from "@/lib/db";
import { InviteError, acceptInvite, createInvite, inviteTarget } from "@/lib/invites";

const USER = "f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f601";
const OTHER = "f6f6f6f6-f6f6-4f6f-8f6f-f6f6f6f6f602";
const admin = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function removeFixture(): Promise<void> {
  await admin.query(
    "DELETE FROM app_user WHERE id = ANY($1::uuid[]) OR email LIKE '%@invite.local'",
    [[USER, OTHER]],
  );
}

beforeAll(async () => {
  await removeFixture();
  await admin.query(
    `INSERT INTO app_user (id, email, name, password_hash, must_change_password)
     VALUES ($1, 'newcomer@invite.local', 'Newcomer', 'placeholder-hash', true),
            ($2, 'other@invite.local', 'Other', 'placeholder-hash', true)`,
    [USER, OTHER],
  );
}, 60_000);

afterAll(async () => {
  await removeFixture();
  await admin.end();
  await closePool();
});

describe("invitations", () => {
  it("stores only a digest — the table never holds a usable token", async () => {
    const token = await createInvite({ userId: USER, nextPath: "/engagements/e1/dashboard" });
    const row = await admin.query<{ token_hash: string; next_path: string }>(
      "SELECT token_hash, next_path FROM user_invite WHERE user_id = $1 AND used_at IS NULL",
      [USER],
    );
    expect(row.rows[0].token_hash).not.toBe(token);
    expect(row.rows[0].token_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.rows[0].next_path).toBe("/engagements/e1/dashboard");
    expect(token.length).toBeGreaterThan(30);
  });

  it("refuses a destination that leaves the site", async () => {
    await createInvite({ userId: USER, nextPath: "https://evil.example.com" });
    const row = await admin.query<{ next_path: string | null }>(
      "SELECT next_path FROM user_invite WHERE user_id = $1 AND used_at IS NULL",
      [USER],
    );
    expect(row.rows[0].next_path).toBeNull();
  });

  it("resolves a live token to its owner, and an unknown one to nothing", async () => {
    const token = await createInvite({ userId: USER });
    expect(await inviteTarget(token)).toMatchObject({
      userId: USER,
      email: "newcomer@invite.local",
    });
    expect(await inviteTarget("not-a-real-token-but-long-enough-to-try")).toBeNull();
    expect(await inviteTarget("")).toBeNull();
  });

  it("issuing a new invitation kills the previous link", async () => {
    const first = await createInvite({ userId: USER });
    const second = await createInvite({ userId: USER });
    expect(await inviteTarget(first)).toBeNull();
    expect(await inviteTarget(second)).not.toBeNull();
  });

  it("sets the password the recipient chose, and spends the token", async () => {
    const token = await createInvite({ userId: USER });
    await acceptInvite(token, "Chosen-By-Me-2026", "Chosen-By-Me-2026");

    const bcrypt = (await import("bcryptjs")).default;
    const row = await admin.query<{ password_hash: string; must_change_password: boolean }>(
      "SELECT password_hash, must_change_password FROM app_user WHERE id = $1",
      [USER],
    );
    expect(await bcrypt.compare("Chosen-By-Me-2026", row.rows[0].password_hash)).toBe(true);
    // No second trip through the change-password screen: they already chose it.
    expect(row.rows[0].must_change_password).toBe(false);
    // And the link is spent.
    expect(await inviteTarget(token)).toBeNull();
    await expect(
      acceptInvite(token, "Another-Good-One-2026", "Another-Good-One-2026"),
    ).rejects.toThrow(InviteError);
  }, 30_000);

  it("refuses a mismatch and a weak password without spending the token", async () => {
    const token = await createInvite({ userId: OTHER });
    await expect(acceptInvite(token, "One-Good-One-2026", "A-Different-One-2026")).rejects.toThrow(
      /mismatch/,
    );
    await expect(acceptInvite(token, "short", "short")).rejects.toThrow(InviteError);
    // Still usable — a rejected attempt must not burn the invitation.
    expect(await inviteTarget(token)).not.toBeNull();
  }, 30_000);

  it("refuses an expired invitation", async () => {
    const token = await createInvite({ userId: OTHER });
    await admin.query(
      "UPDATE user_invite SET expires_at = now() - interval '1 day' WHERE user_id = $1 AND used_at IS NULL",
      [OTHER],
    );
    expect(await inviteTarget(token)).toBeNull();
    await expect(acceptInvite(token, "Chosen-By-Me-2026", "Chosen-By-Me-2026")).rejects.toThrow(
      /invalid-or-expired/,
    );
  });

  it("closes any session opened before the password was set", async () => {
    const before = await admin.query<{ session_version: number }>(
      "SELECT coalesce(session_version, 1) AS session_version FROM app_user WHERE id = $1",
      [OTHER],
    );
    await admin.query(
      "UPDATE user_invite SET expires_at = now() + interval '1 day' WHERE user_id = $1 AND used_at IS NULL",
      [OTHER],
    );
    const token = await createInvite({ userId: OTHER });
    await acceptInvite(token, "Fresh-Start-Here-2026", "Fresh-Start-Here-2026");
    const after = await admin.query<{ session_version: number }>(
      "SELECT coalesce(session_version, 1) AS session_version FROM app_user WHERE id = $1",
      [OTHER],
    );
    expect(Number(after.rows[0].session_version)).toBeGreaterThan(
      Number(before.rows[0].session_version),
    );
  }, 30_000);
});

describe("the invitation email", () => {
  it("carries the link and no password at all", async () => {
    const { accountMail } = await import("@/lib/account-mail");
    const m = accountMail(
      "invitation",
      {
        email: "newcomer@invite.local",
        name: "Newcomer",
        firmName: "ELITE ADVISORS",
        inviterName: "Boma Nekout",
        engagementName: "ELIMELEC 2026",
        roleLabel: "staff",
        inviteUrl: "https://www.auditisa.com/invite/abc123token",
      },
      "en",
    );
    expect(m.subject).toBe("ELITE ADVISORS — your AuditISA account is ready");
    expect(m.body).toContain("https://www.auditisa.com/invite/abc123token");
    expect(m.body).toContain("choose your own password");
    // The whole point: nothing resembling a credential in the message.
    expect(m.body).not.toMatch(/Temporary password|Mot de passe temporaire/);
    expect(m.body).toContain("Nobody else knows your password");
  });

  it("speaks French", async () => {
    const { accountMail } = await import("@/lib/account-mail");
    const m = accountMail(
      "invitation",
      {
        email: "a@b.cm",
        name: "Marie",
        firmName: "Cabinet Alpha",
        inviteUrl: "https://x/invite/t",
      },
      "fr",
    );
    expect(m.subject).toBe("Cabinet Alpha — votre compte AuditISA est prêt");
    expect(m.body).toContain("choisir votre propre mot de passe");
    expect(m.html).toContain(">Choisir mon mot de passe<");
  });
});
