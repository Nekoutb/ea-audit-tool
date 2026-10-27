// F070 (firm decision 2026-10-27): the email domains an engagement-team
// invitation may be sent to.
//
// The list is held on the firm (tenant.allowed_email_domains, migration
// 20261027000004) and kept by the firm administrator in Settings. The rule:
//  - the domain is the part of the address after the last '@', lower-cased;
//  - it must EQUAL one of the listed domains (case-insensitive). Subdomains do
//    not match their parent: with "eca.com" listed, "audit.eca.com" is refused
//    unless it is listed too. Exact matching is the firm's default; it keeps a
//    look-alike such as "eca.com.attacker.net" or "x.eca.com" from passing;
//  - an EMPTY list means no restriction (the behaviour before the rule), and
//    Settings says so.
// It applies to every way a person is put on an engagement team by email
// (lib/team.ts addTeamMemberByEmail). Client portal contacts are not team
// members and are not subject to it.

import { pool } from "@/lib/db";
import { recordActivity } from "@/lib/activity";
import { requireRole, requireTenant } from "@/lib/tenant";

/** Refusal raised when an address is outside the firm's allowed domains. */
export class EmailDomainError extends Error {
  constructor(public readonly allowed: string[]) {
    super("email-domain-not-allowed");
    this.name = "EmailDomainError";
  }
}

const DOMAIN = /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

/**
 * Parse the administrator's input — one domain per line, or separated by
 * commas, semicolons or spaces; a leading "@" is tolerated — into a sorted,
 * de-duplicated, lower-case list. Throws "invalid-email-domain" naming nothing
 * when an entry is not a domain.
 */
export function parseDomainList(raw: string): string[] {
  const entries = raw
    .split(/[\s,;]+/)
    .map((s) => s.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
  for (const d of entries) if (!DOMAIN.test(d)) throw new Error("invalid-email-domain");
  return [...new Set(entries)].sort();
}

/** The domain of an address, lower-cased; null when there is none. */
export function emailDomain(email: string): string | null {
  const at = email.trim().lastIndexOf("@");
  if (at < 1) return null;
  const domain = email.trim().slice(at + 1).toLowerCase();
  return domain || null;
}

/** True when the address may be invited under the list (empty list: always). */
export function emailDomainAllowed(email: string, allowed: readonly string[]): boolean {
  if (allowed.length === 0) return true;
  const domain = emailDomain(email);
  return domain !== null && allowed.some((d) => d.toLowerCase() === domain);
}

/** The firm's list, for a tenant id the caller already holds. */
export async function allowedDomainsFor(tenantId: string): Promise<string[]> {
  const r = await pool.query<{ allowed_email_domains: string[] | null }>(
    "SELECT allowed_email_domains FROM tenant WHERE id = $1",
    [tenantId],
  );
  return r.rows[0]?.allowed_email_domains ?? [];
}

/** The signed-in user's firm's list. */
export async function getAllowedDomains(): Promise<string[]> {
  const { tenantId } = await requireTenant();
  return allowedDomainsFor(tenantId);
}

/** Throws EmailDomainError when the address is outside the firm's list. */
export async function assertEmailDomainAllowed(tenantId: string, email: string): Promise<void> {
  const allowed = await allowedDomainsFor(tenantId);
  if (!emailDomainAllowed(email, allowed)) throw new EmailDomainError(allowed);
}

/** Replace the firm's list (firm administrator). An empty input clears it. */
export async function setAllowedDomains(raw: string): Promise<string[]> {
  const { tenantId } = await requireRole("firm_admin");
  const list = parseDomainList(raw);
  const before = await allowedDomainsFor(tenantId);
  await pool.query("UPDATE tenant SET allowed_email_domains = $2 WHERE id = $1", [tenantId, list]);
  await recordActivity({
    entityType: "tenant",
    entityId: tenantId,
    action: "email_domains.set",
    summary: list.length ? `Allowed email domains set to ${list.join(", ")}` : "Allowed email domains cleared",
    before: { domains: before },
    after: { domains: list },
  });
  return list;
}
