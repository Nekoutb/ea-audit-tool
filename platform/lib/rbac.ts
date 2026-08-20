// Firm-level roles (mirrors the user_role enum in the DB). Engagement-scoped
// permissions are layered on top of these in a later phase.
export const ROLES = [
  "firm_admin",
  "partner",
  "manager",
  "senior",
  "staff",
  "eqr_reviewer",
  "read_only",
  "client_user",
] as const;

export type Role = (typeof ROLES)[number];

// Rank for the linear seniority hierarchy. eqr_reviewer sits at manager level for
// review authority; its independence-from-the-team rule is enforced separately at
// assignment time, not by rank. read_only and client_user are deliberately low.
const RANK: Record<Role, number> = {
  client_user: 0,
  read_only: 1,
  staff: 2,
  senior: 3,
  eqr_reviewer: 4,
  manager: 4,
  partner: 5,
  firm_admin: 6,
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** True when `role` is at least as senior as `min`. */
export function atLeast(role: Role, min: Role): boolean {
  return RANK[role] >= RANK[min];
}

/**
 * Roles permitted to change anything at all. read_only exists so a person can be
 * given the file without being able to touch it; client_user belongs to the
 * portal and reaches firm mutations through no legitimate path.
 */
export const canWrite = (role: Role): boolean => role !== "read_only" && role !== "client_user";

export const canManageFirm = (role: Role): boolean => atLeast(role, "firm_admin");
export const canPartnerSignoff = (role: Role): boolean => atLeast(role, "partner");
export const canReview = (role: Role): boolean => atLeast(role, "senior");
