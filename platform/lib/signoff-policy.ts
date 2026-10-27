// Sign-off governance (F002 / F003): the firm's sign-off policy, its per-task
// role rules, and who holds the engagement partner's signature.
//
// The ladder every rank comparison uses, lowest to highest:
//   staff < senior < manager < senior_manager < director < partner.
// eqr_reviewer is outside it and keeps its own rules (lib/eqr.ts).
//
// No policy row means the default matrix (below). The no-self-review rule is
// NOT part of the policy: allow_sole_practitioner is stored, shown as "not
// permitted", and never read by any sign-off path.

import type { PoolClient } from "pg";
import { recordActivity } from "@/lib/activity";
import { withTenant } from "@/lib/db";
import { DEFAULT_FILE_INDEX } from "@/lib/file-index";
import { atLeast } from "@/lib/rbac";
import { ForbiddenError, requireWrite } from "@/lib/tenant";

export const TEAM_LADDER = ["staff", "senior", "manager", "senior_manager", "director", "partner"] as const;
export type LadderRole = (typeof TEAM_LADDER)[number];

/** Tasks whose approval belongs to the audit partner alone (operator rule). */
export const PARTNER_ONLY_APPROVAL: ReadonlySet<string> = new Set(["P5.2", "P7.2", "S6.1", "S6.2", "S3.1", "C1.1"]);

/**
 * Papers whose phase gate looks for a PARTNER signature (lib/gates.ts). A
 * reviewer sign-off on them must not lock the paper — the partner still has
 * to sign — and the engagement partner pressing the list's R chip is recorded
 * as the partner they are, so the gate sees it (UAT B20).
 */
export const PARTNER_GATED: ReadonlySet<string> = new Set(["P1.1", "P2.2", "P5.2", "S3.1", "P7.2"]);

/**
 * The firm's default sign-off matrix (F002, decision of 2026-10-27): the
 * minimum preparer and reviewer per task family, used wherever the firm has
 * no per-task rule of its own. First match wins, so the named exceptions come
 * before their family.
 *
 *   Acceptance  P1.x-P2.x  manager / partner
 *   Planning    P3.x-P7.x  senior  / manager
 *   Strategy    S1.x-S6.x  senior  / manager
 *   Execution   E1.x-E6.x  staff   / senior, except E3.1 (fraud / journal
 *                          entries), E6.3 (going concern) and E6.10 (FS
 *                          tie-out): senior / manager
 *   Completion  C1.x-C4.x  senior  / manager (C4.2's own sign-off is the EQR's,
 *                          lib/eqr.ts; the team's P/R there attest its
 *                          governance communications)
 *   OHADA legal C5.x       manager / partner
 *   Archive     C6.x       manager / partner
 */
const DEFAULT_MATRIX: readonly { match: (code: string) => boolean; minPreparer: LadderRole; minReviewer: LadderRole }[] = [
  { match: (c) => c === "E3.1" || c === "E6.3" || c === "E6.10", minPreparer: "senior", minReviewer: "manager" },
  { match: (c) => /^P[12]\./.test(c), minPreparer: "manager", minReviewer: "partner" },
  { match: (c) => /^P[3-7]\./.test(c), minPreparer: "senior", minReviewer: "manager" },
  { match: (c) => /^S[1-6]\./.test(c), minPreparer: "senior", minReviewer: "manager" },
  { match: (c) => /^E[1-6]\./.test(c), minPreparer: "staff", minReviewer: "senior" },
  { match: (c) => /^C[1-4]\./.test(c), minPreparer: "senior", minReviewer: "manager" },
  { match: (c) => /^C[56]\./.test(c), minPreparer: "manager", minReviewer: "partner" },
];

/** The partner's own sign-off in the default matrix: P1.1, P2.2, P5.2, P7.2, S3.1, S6.1, S6.2, C1.1, every C5.x, C6.2. */
const DEFAULT_PARTNER_SIGNOFF: readonly string[] = ["P1.1", "P2.2", "P5.2", "P7.2", "S3.1", "S6.1", "S6.2", "C1.1", "C6.2"];

/** The matrix's partner sign-off, united with the two older operator sets (none is dropped). */
function defaultPartnerSignoff(code: string): boolean {
  return (
    DEFAULT_PARTNER_SIGNOFF.includes(code) || /^C5\./.test(code) || PARTNER_GATED.has(code) || PARTNER_ONLY_APPROVAL.has(code)
  );
}

/** The floor for any code outside the matrix (none in the default index today). */
export const DEFAULT_MIN_PREPARER: LadderRole = "staff";
/** The firm-wide reviewer floor when no policy is saved (the lowest reviewer of the matrix). */
export const DEFAULT_MIN_REVIEWER: LadderRole = "senior";

/** The default matrix's preparer / reviewer minimum for one task code. */
export function defaultTaskMinimums(code: string): { minPreparer: LadderRole; minReviewer: LadderRole } {
  const hit = DEFAULT_MATRIX.find((m) => m.match(code));
  return hit
    ? { minPreparer: hit.minPreparer, minReviewer: hit.minReviewer }
    : { minPreparer: DEFAULT_MIN_PREPARER, minReviewer: DEFAULT_MIN_REVIEWER };
}

/**
 * Every task of the default index that needs the partner's own sign-off by
 * default: the matrix's list, united with the two older operator sets so no
 * code that was partner-gated before loses it.
 */
export const DEFAULT_REQUIRE_PARTNER_ON: readonly string[] = [
  ...new Set([...DEFAULT_FILE_INDEX.map((e) => e.code).filter(defaultPartnerSignoff), ...PARTNER_GATED, ...PARTNER_ONLY_APPROVAL]),
].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

function higher(a: LadderRole, b: LadderRole): LadderRole {
  return teamRank(a) >= teamRank(b) ? a : b;
}

export function isLadderRole(value: unknown): value is LadderRole {
  return typeof value === "string" && (TEAM_LADDER as readonly string[]).includes(value);
}

/** Position on the ladder; -1 for anything off it (eqr_reviewer, null). */
export function teamRank(role: string | null | undefined): number {
  return role ? (TEAM_LADDER as readonly string[]).indexOf(role) : -1;
}

/**
 * The refusal raised when a team role is below a task minimum. The required
 * role travels in the code so every banner names it without extra plumbing:
 * role-below-task-minimum-senior, …-senior-manager, …
 */
export function belowMinimumCode(required: LadderRole): string {
  return `role-below-task-minimum-${required.replace(/_/g, "-")}`;
}

export interface SignoffPolicy {
  minReviewerRole: LadderRole;
  requirePartnerOn: string[];
  /** stored only; never relaxes the no-self-review rule */
  allowSolePractitioner: boolean;
  requireDistinctPreparerApprover: boolean;
  /** false when no row is saved and the defaults apply */
  stored: boolean;
  updatedAt: string | null;
}

export interface TaskRule {
  minPreparer: LadderRole | null;
  minReviewer: LadderRole | null;
  partnerRequired: boolean | null;
}

export interface EffectiveTaskRule {
  minPreparer: LadderRole;
  minReviewer: LadderRole;
  partnerRequired: boolean;
}

export function defaultPolicy(): SignoffPolicy {
  return {
    minReviewerRole: DEFAULT_MIN_REVIEWER,
    requirePartnerOn: [...DEFAULT_REQUIRE_PARTNER_ON],
    allowSolePractitioner: false,
    requireDistinctPreparerApprover: true,
    stored: false,
    updatedAt: null,
  };
}

export async function getPolicyTx(tx: PoolClient, tenantId: string): Promise<SignoffPolicy> {
  const r = await tx.query<{
    min_reviewer_role: string;
    require_partner_on: string[];
    allow_sole_practitioner: boolean;
    require_distinct_preparer_approver: boolean;
    updated_at: string | null;
  }>(
    `SELECT min_reviewer_role, require_partner_on, allow_sole_practitioner,
            require_distinct_preparer_approver, updated_at::text
       FROM firm_signoff_policy WHERE tenant_id = $1`,
    [tenantId],
  );
  const row = r.rows[0];
  if (!row) return defaultPolicy();
  return {
    minReviewerRole: isLadderRole(row.min_reviewer_role) ? row.min_reviewer_role : DEFAULT_MIN_REVIEWER,
    requirePartnerOn: row.require_partner_on ?? [...DEFAULT_REQUIRE_PARTNER_ON],
    allowSolePractitioner: row.allow_sole_practitioner,
    requireDistinctPreparerApprover: row.require_distinct_preparer_approver,
    stored: true,
    updatedAt: row.updated_at,
  };
}

/** The firm's per-task overrides, keyed by code (all of them, or just `codes`). */
export async function getTaskRulesTx(
  tx: PoolClient,
  tenantId: string,
  codes?: readonly string[],
): Promise<Map<string, TaskRule>> {
  const r = await tx.query<{
    code: string;
    min_preparer_role: string | null;
    min_reviewer_role: string | null;
    partner_required: boolean | null;
  }>(
    `SELECT code, min_preparer_role, min_reviewer_role, partner_required
       FROM firm_task_signoff_rule
      WHERE tenant_id = $1 AND ($2::text[] IS NULL OR code = ANY($2::text[]))`,
    [tenantId, codes ? [...codes] : null],
  );
  return new Map(
    r.rows.map((row) => [
      row.code,
      {
        minPreparer: isLadderRole(row.min_preparer_role) ? row.min_preparer_role : null,
        minReviewer: isLadderRole(row.min_reviewer_role) ? row.min_reviewer_role : null,
        partnerRequired: row.partner_required,
      },
    ]),
  );
}

/**
 * What applies to one task: its own rule where set, otherwise the default
 * matrix raised by the firm policy — the policy's minimum reviewer is a floor
 * under every task, and its partner list adds to the matrix's (a per-task
 * "No" is how a firm lifts a default partner sign-off). The reviewer minimum
 * is never below the preparer minimum, whatever a stored rule says: the review
 * is at least as senior as the work it reviews.
 */
export function effectiveTaskRule(
  policy: SignoffPolicy,
  rules: ReadonlyMap<string, TaskRule>,
  code: string,
): EffectiveTaskRule {
  const rule = rules.get(code);
  const matrix = defaultTaskMinimums(code);
  const minPreparer = rule?.minPreparer ?? matrix.minPreparer;
  const minReviewer = rule?.minReviewer ?? higher(matrix.minReviewer, policy.minReviewerRole);
  return {
    minPreparer,
    minReviewer: higher(minReviewer, minPreparer),
    partnerRequired: rule?.partnerRequired ?? (defaultPartnerSignoff(code) || policy.requirePartnerOn.includes(code)),
  };
}

/** One task's effective rule, read in the caller's transaction. */
export async function effectiveRuleTx(tx: PoolClient, tenantId: string, code: string): Promise<EffectiveTaskRule> {
  const [policy, rules] = await Promise.all([getPolicyTx(tx, tenantId), getTaskRulesTx(tx, tenantId, [code])]);
  return effectiveTaskRule(policy, rules, code);
}

/* --------------------------- the engagement partner --------------------------- */

export interface EngagementPartner {
  /** accepted team members holding team role 'partner' (exactly one when designated) */
  partnerIds: string[];
  delegateId: string | null;
}

export async function engagementPartnerTx(tx: PoolClient, engagementId: string): Promise<EngagementPartner> {
  const partners = await tx.query<{ user_id: string }>(
    `SELECT user_id FROM team_member
      WHERE engagement_id = $1 AND team_role = 'partner' AND coalesce(status, 'accepted') = 'accepted'`,
    [engagementId],
  );
  const eng = await tx.query<{ partner_delegate_user_id: string | null }>(
    "SELECT partner_delegate_user_id FROM engagement WHERE id = $1",
    [engagementId],
  );
  return {
    partnerIds: partners.rows.map((p) => p.user_id),
    delegateId: eng.rows[0]?.partner_delegate_user_id ?? null,
  };
}

/**
 * Why this user may not give a partner-tier sign-off on the engagement, or
 * null when they may: only the designated engagement partner or their
 * delegate signs for the partner (F003).
 */
export async function partnerTierRefusalTx(
  tx: PoolClient,
  engagementId: string,
  userId: string,
): Promise<string | null> {
  const { partnerIds, delegateId } = await engagementPartnerTx(tx, engagementId);
  if (partnerIds.length === 0) return "designate-engagement-partner-first";
  if (partnerIds.includes(userId) || (delegateId !== null && delegateId === userId)) return null;
  return "not-engagement-partner";
}

/** The same check in its own transaction, for actions outside signDocument. */
export async function partnerTierRefusal(
  tenantId: string,
  engagementId: string,
  userId: string,
): Promise<string | null> {
  return withTenant(tenantId, (tx) => partnerTierRefusalTx(tx, engagementId, userId));
}

/* ------------------------------- saving it ------------------------------- */

/** Firm administrators and partners set the firm's sign-off rules. */
export async function requirePolicyEditor() {
  const ctx = await requireWrite();
  if (!atLeast(ctx.role, "partner")) throw new ForbiddenError("signoff-policy-partner-only");
  return ctx;
}

const KNOWN_CODES = new Set(DEFAULT_FILE_INDEX.map((e) => e.code));

export async function getPolicy(): Promise<{ policy: SignoffPolicy; rules: Map<string, TaskRule> }> {
  const { tenantId } = await requirePolicyEditor();
  return withTenant(tenantId, async (tx) => ({
    policy: await getPolicyTx(tx, tenantId),
    rules: await getTaskRulesTx(tx, tenantId),
  }));
}

export async function savePolicy(input: {
  minReviewerRole: string;
  requirePartnerOn: readonly string[];
  requireDistinctPreparerApprover: boolean;
}): Promise<void> {
  const { tenantId, userId } = await requirePolicyEditor();
  if (!isLadderRole(input.minReviewerRole)) throw new Error("invalid-team-role");
  const codes = [...new Set(input.requirePartnerOn.map((c) => c.trim()).filter(Boolean))].sort();
  const unknown = codes.filter((c) => !KNOWN_CODES.has(c));
  if (unknown.length > 0) throw new Error("unknown-task-code");
  const before = await withTenant(tenantId, async (tx) => {
    const prior = await getPolicyTx(tx, tenantId);
    // allow_sole_practitioner is always written false: self-review is refused
    // in every circumstance (F001), whatever a form posts.
    await tx.query(
      `INSERT INTO firm_signoff_policy
         (tenant_id, min_reviewer_role, require_partner_on, allow_sole_practitioner,
          require_distinct_preparer_approver, updated_by, updated_at)
       VALUES ($1, $2, $3, false, $4, $5, now())
       ON CONFLICT (tenant_id) DO UPDATE
         SET min_reviewer_role = EXCLUDED.min_reviewer_role,
             require_partner_on = EXCLUDED.require_partner_on,
             allow_sole_practitioner = false,
             require_distinct_preparer_approver = EXCLUDED.require_distinct_preparer_approver,
             updated_by = EXCLUDED.updated_by, updated_at = now()`,
      [tenantId, input.minReviewerRole, codes, input.requireDistinctPreparerApprover, userId],
    );
    return prior;
  });
  await recordActivity({
    entityType: "firm_signoff_policy",
    entityId: tenantId,
    action: "signoff_policy_updated",
    summary: "Firm sign-off policy updated",
    before: {
      minReviewerRole: before.minReviewerRole,
      requirePartnerOn: before.requirePartnerOn,
      requireDistinctPreparerApprover: before.requireDistinctPreparerApprover,
    },
    after: {
      minReviewerRole: input.minReviewerRole,
      requirePartnerOn: codes,
      requireDistinctPreparerApprover: input.requireDistinctPreparerApprover,
    },
  });
}

export interface TaskRuleInput extends TaskRule {
  code: string;
}

/**
 * Save per-task rules: a row whose three values are all null is the firm
 * default and is deleted. Returns the number of tasks whose rule changed.
 */
export async function saveTaskRules(input: readonly TaskRuleInput[]): Promise<number> {
  const { tenantId, userId } = await requirePolicyEditor();
  for (const rule of input) {
    if (!KNOWN_CODES.has(rule.code)) throw new Error("unknown-task-code");
    if (rule.minPreparer !== null && !isLadderRole(rule.minPreparer)) throw new Error("invalid-team-role");
    if (rule.minReviewer !== null && !isLadderRole(rule.minReviewer)) throw new Error("invalid-team-role");
  }
  const changes = await withTenant(tenantId, async (tx) => {
    const prior = await getTaskRulesTx(tx, tenantId, input.map((r) => r.code));
    const changed: { code: string; before: TaskRule | null; after: TaskRule | null }[] = [];
    for (const rule of input) {
      const was = prior.get(rule.code) ?? null;
      const empty = rule.minPreparer === null && rule.minReviewer === null && rule.partnerRequired === null;
      const same =
        (was === null && empty) ||
        (was !== null &&
          was.minPreparer === rule.minPreparer &&
          was.minReviewer === rule.minReviewer &&
          was.partnerRequired === rule.partnerRequired);
      if (same) continue;
      if (empty) {
        await tx.query("DELETE FROM firm_task_signoff_rule WHERE tenant_id = $1 AND code = $2", [tenantId, rule.code]);
      } else {
        await tx.query(
          `INSERT INTO firm_task_signoff_rule
             (tenant_id, code, min_preparer_role, min_reviewer_role, partner_required, updated_by, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, now())
           ON CONFLICT (tenant_id, code) DO UPDATE
             SET min_preparer_role = EXCLUDED.min_preparer_role,
                 min_reviewer_role = EXCLUDED.min_reviewer_role,
                 partner_required = EXCLUDED.partner_required,
                 updated_by = EXCLUDED.updated_by, updated_at = now()`,
          [tenantId, rule.code, rule.minPreparer, rule.minReviewer, rule.partnerRequired, userId],
        );
      }
      const { code, ...after } = rule;
      changed.push({ code, before: was, after: empty ? null : after });
    }
    return changed;
  });
  if (changes.length > 0) {
    await recordActivity({
      entityType: "firm_task_signoff_rule",
      entityId: tenantId,
      action: "task_signoff_rules_updated",
      summary: `Sign-off rules updated for ${changes.length} task(s): ${changes.slice(0, 12).map((c) => c.code).join(", ")}${changes.length > 12 ? "…" : ""}`,
      before: Object.fromEntries(changes.map((c) => [c.code, c.before])),
      after: Object.fromEntries(changes.map((c) => [c.code, c.after])),
    });
  }
  return changes.length;
}
