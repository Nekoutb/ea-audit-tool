// Engagement discussion: one-level threaded comments with @mentions. Mentions
// ("@Nekout", "@nekout.boma", "@nekout@firm.test") are matched against the
// firm's internal users by name part or email local part; each match gets an
// in-app notification, as does the parent author on a reply.

import { recordActivity } from "@/lib/activity";
import { withTenant } from "@/lib/db";
import { createNotification } from "@/lib/notifications";
import { requireTenant } from "@/lib/tenant";

export class CommentError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "CommentError";
  }
}

export interface CommentRow {
  id: string;
  parentId: string | null;
  authorName: string | null;
  body: string;
  at: string;
  mine: boolean;
}

const MENTION_RE = /@([\p{L}\p{N}._@-]+)/gu;

export async function addComment(input: {
  engagementId: string;
  body: string;
  parentId?: string | null;
}): Promise<void> {
  const { tenantId, userId } = await requireTenant();
  const body = input.body.trim();
  if (!body) throw new CommentError("body-required");
  if (body.length > 4000) throw new CommentError("too-long");

  const mentioned = new Set<string>();
  let parentAuthor: string | null = null;

  await withTenant(tenantId, async (tx) => {
    if (input.parentId) {
      const parent = await tx.query<{ user_id: string | null; engagement_id: string }>(
        "SELECT user_id, engagement_id FROM comment WHERE id = $1",
        [input.parentId],
      );
      if (!parent.rows[0] || parent.rows[0].engagement_id !== input.engagementId) {
        throw new CommentError("not-found");
      }
      parentAuthor = parent.rows[0].user_id;
    }
    await tx.query(
      `INSERT INTO comment (tenant_id, engagement_id, parent_id, user_id, body)
       VALUES ($1, $2, $3, $4, $5)`,
      [tenantId, input.engagementId, input.parentId ?? null, userId, body],
    );

    // Resolve @mentions against internal firm users.
    const tokens = [...body.matchAll(MENTION_RE)].map((m) => m[1].toLowerCase());
    if (tokens.length > 0) {
      const users = await tx.query<{ id: string; email: string; name: string | null }>(
        `SELECT u.id, u.email, u.name
           FROM membership m JOIN app_user u ON u.id = m.user_id
          WHERE m.tenant_id = $1 AND m.role <> 'client_user'`,
        [tenantId],
      );
      for (const u of users.rows) {
        const nameParts = (u.name ?? "").toLowerCase().split(/\s+/).filter(Boolean);
        const emailLocal = u.email.toLowerCase().split("@")[0];
        const emailFull = u.email.toLowerCase();
        const hit = tokens.some(
          (tk) => tk === emailFull || tk === emailLocal || nameParts.includes(tk),
        );
        if (hit && u.id !== userId) mentioned.add(u.id);
      }
    }
  });

  // Notifications outside the tenant transaction (createNotification opens its own).
  const preview = body.length > 120 ? body.slice(0, 117) + "…" : body;
  for (const uid of mentioned) {
    await createNotification({
      tenantId,
      userId: uid,
      kind: "mention",
      title: "You were mentioned in a discussion",
      body: preview,
    });
  }
  if (parentAuthor && parentAuthor !== userId && !mentioned.has(parentAuthor)) {
    await createNotification({
      tenantId,
      userId: parentAuthor,
      kind: "reply",
      title: "New reply to your comment",
      body: preview,
    });
  }
  await recordActivity({
    engagementId: input.engagementId,
    entityType: "comment",
    action: input.parentId ? "replied" : "commented",
    summary: preview,
  });
}

export async function listComments(engagementId: string): Promise<CommentRow[]> {
  const { tenantId, userId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const r = await tx.query<{
      id: string;
      parent_id: string | null;
      author_name: string | null;
      body: string;
      at: string;
      user_id: string | null;
    }>(
      `SELECT c.id, c.parent_id, c.user_id,
              (SELECT coalesce(name, email) FROM app_user WHERE id = c.user_id) AS author_name,
              c.body, to_char(c.created_at, 'DD Mon YYYY HH24:MI') AS at
         FROM comment c
        WHERE c.engagement_id = $1
        ORDER BY c.created_at`,
      [engagementId],
    );
    return r.rows.map((row) => ({
      id: row.id,
      parentId: row.parent_id,
      authorName: row.author_name,
      body: row.body,
      at: row.at,
      mine: row.user_id === userId,
    }));
  });
}
