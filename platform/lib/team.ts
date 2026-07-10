// D6.1 job administration (spec §4.4): team assignment (with the EQR
// independence rule), hours-by-grade budget, and the PBC request list.

import { withTenant } from "@/lib/db";
import { requireTenant } from "@/lib/tenant";

export type TeamRole = "partner" | "manager" | "senior" | "staff" | "eqr_reviewer";
export const TEAM_ROLES: readonly TeamRole[] = ["partner", "manager", "senior", "staff", "eqr_reviewer"];

export interface TeamMember {
  id: string;
  userId: string;
  userName: string;
  teamRole: TeamRole;
}

export async function listTeam(engagementId: string): Promise<TeamMember[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ id: string; user_id: string; user_name: string; team_role: TeamRole }>(
      `SELECT tm.id, tm.user_id, coalesce(u.name, u.email) AS user_name, tm.team_role
         FROM team_member tm JOIN app_user u ON u.id = tm.user_id
        WHERE tm.engagement_id = $1 ORDER BY tm.created_at`,
      [engagementId],
    );
    return result.rows.map((r) => ({ id: r.id, userId: r.user_id, userName: r.user_name, teamRole: r.team_role }));
  });
}

/** Firm users assignable to the engagement (same tenant via membership). */
export async function listFirmUsers(): Promise<{ id: string; name: string }[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ id: string; name: string }>(
      `SELECT u.id, coalesce(u.name, u.email) AS name
         FROM app_user u JOIN membership m ON m.user_id = u.id
        WHERE m.tenant_id = $1 ORDER BY name`,
      [tenantId],
    );
    return result.rows;
  });
}

/**
 * Assign a user to the team. EQR rule (spec §2): the EQR must be independent of
 * the engagement team — the system blocks assigning an EQR who already holds a
 * team role, and blocks giving a team role to the current EQR.
 */
export async function assignTeamMember(
  engagementId: string,
  userId: string,
  teamRole: TeamRole,
): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    const existing = await tx.query<{ team_role: TeamRole }>(
      "SELECT team_role FROM team_member WHERE engagement_id = $1 AND user_id = $2",
      [engagementId, userId],
    );
    const current = existing.rows[0]?.team_role;
    if (teamRole === "eqr_reviewer" && current && current !== "eqr_reviewer") {
      throw new Error("eqr-on-team");
    }
    if (teamRole !== "eqr_reviewer" && current === "eqr_reviewer") {
      throw new Error("eqr-on-team");
    }
    await tx.query(
      `INSERT INTO team_member (tenant_id, engagement_id, user_id, team_role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (engagement_id, user_id) DO UPDATE SET team_role = EXCLUDED.team_role`,
      [tenantId, engagementId, userId, teamRole],
    );
  });
}

export async function removeTeamMember(engagementId: string, userId: string): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query("DELETE FROM team_member WHERE engagement_id = $1 AND user_id = $2", [
      engagementId,
      userId,
    ]);
  });
}

export interface BudgetLine {
  grade: string;
  hours: number;
}

export async function listBudget(engagementId: string): Promise<BudgetLine[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<{ grade: string; hours: string }>(
      "SELECT grade, hours::text FROM budget_line WHERE engagement_id = $1 ORDER BY grade",
      [engagementId],
    );
    return result.rows.map((r) => ({ grade: r.grade, hours: Number(r.hours) }));
  });
}

export async function setBudgetLine(engagementId: string, grade: string, hours: number): Promise<void> {
  const { tenantId } = await requireTenant();
  if (!grade.trim() || !(hours >= 0)) throw new Error("invalid-budget");
  await withTenant(tenantId, async (tx) => {
    await tx.query(
      `INSERT INTO budget_line (tenant_id, engagement_id, grade, hours)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (engagement_id, grade) DO UPDATE SET hours = EXCLUDED.hours`,
      [tenantId, engagementId, grade.trim(), hours],
    );
  });
}

export interface PbcItem {
  id: string;
  title: string;
  status: "requested" | "uploaded" | "accepted";
}

export async function listPbc(engagementId: string): Promise<PbcItem[]> {
  const { tenantId } = await requireTenant();
  return withTenant(tenantId, async (tx) => {
    const result = await tx.query<PbcItem>(
      "SELECT id, title, status FROM pbc_item WHERE engagement_id = $1 ORDER BY created_at",
      [engagementId],
    );
    return result.rows;
  });
}

export async function addPbcItem(engagementId: string, title: string): Promise<void> {
  const { tenantId } = await requireTenant();
  if (!title.trim()) throw new Error("title-required");
  await withTenant(tenantId, async (tx) => {
    await tx.query("INSERT INTO pbc_item (tenant_id, engagement_id, title) VALUES ($1, $2, $3)", [
      tenantId,
      engagementId,
      title.trim(),
    ]);
  });
}

export async function setPbcStatus(id: string, status: PbcItem["status"]): Promise<void> {
  const { tenantId } = await requireTenant();
  await withTenant(tenantId, async (tx) => {
    await tx.query("UPDATE pbc_item SET status = $2 WHERE id = $1", [id, status]);
  });
}
