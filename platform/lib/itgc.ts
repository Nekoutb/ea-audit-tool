// S2.3 — the relevant IT applications and the IT strategy decided for each:
// rely on the IT processes (test ITGCs), test the automated controls directly
// every period, or stay fully substantive. Applications are suggested from the
// S1.1 SCOT register's applications column; the recorded rows live in
// form_response under code `itapps` (one JSON row per application) so S2.4
// scopes its testing and S2.5 evaluates against the same record.

import { withTenant } from "@/lib/db";
import { requireTenant, requireWrite } from "@/lib/tenant";
import { listScots } from "@/lib/scots";
import { IT_STRATEGIES, newAppKey as slug, type ItAppRow, type ItAppsView, type ItStrategy } from "@/lib/itgc-model";

export type { ItAppRow, ItAppsView, ItStrategy } from "@/lib/itgc-model";

const CODE = "itapps";

export async function itAppsView(engagementId: string): Promise<ItAppsView> {
  const { tenantId } = await requireTenant();
  const scots = await listScots(engagementId).catch(() => []);

  // applications named on the SCOT register, with the SCOTs that name them
  const fromScots = new Map<string, string[]>();
  for (const s of scots) {
    // Separators split only outside parentheses: "Sage X3 (GL, AR); Odoo" is
    // two applications, not three.
    for (const raw of (s.applications ?? "").split(/[,;·](?![^()]*\))/)) {
      const name = raw.trim();
      if (!name) continue;
      const cur = fromScots.get(name) ?? [];
      if (!cur.includes(s.name)) cur.push(s.name);
      fromScots.set(name, cur);
    }
  }

  const saved = await withTenant(tenantId, async (tx) => {
    const r = await tx.query<{ field_key: string; value: unknown }>(
      "SELECT field_key, value FROM form_response WHERE engagement_id = $1 AND code = $2",
      [engagementId, CODE],
    );
    return r.rows;
  });

  const rows = new Map<string, ItAppRow>();
  const removed = new Set<string>();
  for (const row of saved) {
    if (!row.field_key.startsWith("app_")) continue;
    try {
      const v = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
      const key = row.field_key.slice(4);
      if (v && typeof v === "object" && !(v as { removed?: boolean }).removed) {
        const r = v as Partial<ItAppRow>;
        rows.set(key, {
          key,
          // an empty name means "not recorded": the register name fills it below
          name: String(r.name ?? ""),
          layers: String(r.layers ?? ""),
          scots: [],
          strategy: (IT_STRATEGIES as readonly string[]).includes(String(r.strategy)) ? (r.strategy as ItStrategy) : "",
          itgcNote: String(r.itgcNote ?? ""),
        });
      } else if (v && (v as { removed?: boolean }).removed) {
        removed.add(key);
      }
    } catch {
      // ignore malformed rows
    }
  }

  // seed register applications not yet recorded; attach SCOT names to all
  for (const [name, scotNames] of fromScots) {
    const key = slug(name);
    if (removed.has(key)) continue; // explicitly removed
    const existing = rows.get(key);
    if (existing) {
      // a decision saved without the name shows the register name, not the slug
      if (existing.name === "") existing.name = name;
      existing.scots = scotNames;
    } else {
      rows.set(key, { key, name, layers: "", scots: scotNames, strategy: "", itgcNote: "" });
    }
  }

  // a row with neither a recorded nor a register name only has its key to show
  for (const r of rows.values()) if (r.name === "") r.name = r.key;

  return { rows: [...rows.values()].sort((a, b) => a.name.localeCompare(b.name)) };
}

/** Persist one application row (or mark it removed). */
export async function saveItApp(
  engagementId: string,
  key: string,
  patch: { name?: string; layers?: string; strategy?: string; itgcNote?: string; removed?: boolean },
): Promise<void> {
  if (!/^[a-z0-9-]{1,40}$/.test(key)) throw new Error("invalid-key");
  if (patch.strategy && !(IT_STRATEGIES as readonly string[]).includes(patch.strategy)) throw new Error("invalid-strategy");
  const { tenantId, userId } = await requireWrite();
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.query<{ value: unknown }>(
      "SELECT value FROM form_response WHERE engagement_id = $1 AND code = $2 AND field_key = $3",
      [engagementId, CODE, `app_${key}`],
    );
    let base: Record<string, unknown> = {};
    if (existing.rows[0]) {
      try {
        const v = existing.rows[0].value;
        base = typeof v === "string" ? JSON.parse(v) : ((v as Record<string, unknown>) ?? {});
      } catch {
        base = {};
      }
    }
    const merged = { ...base, ...patch };
    await tx.query(
      `INSERT INTO form_response (tenant_id, engagement_id, code, field_key, value, updated_by, carried_forward)
       VALUES ($1, $2, $3, $4, $5, $6, false)
       ON CONFLICT (engagement_id, code, field_key)
       DO UPDATE SET value = EXCLUDED.value, updated_by = EXCLUDED.updated_by,
                     carried_forward = false, updated_at = now()`,
      [tenantId, engagementId, CODE, `app_${key}`, JSON.stringify(merged), userId],
    );
  });
  // The record is the front page of S2.3 and the basis of S2.5: a change to
  // it voids the signatures given over the previous state (same rule as a
  // working-paper answer, lib/working-papers.ts).
  const { invalidateStaleSignoffs, reportInvalidatedSignoffs } = await import("@/lib/working-papers");
  for (const code of ["S2.3", "S2.5"]) {
    const rows = await withTenant(tenantId, (tx) => invalidateStaleSignoffs(tx, engagementId, code));
    await reportInvalidatedSignoffs(tenantId, engagementId, code, rows, userId);
  }
}

