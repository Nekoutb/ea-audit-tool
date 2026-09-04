// Hand-written types for scope.mjs.
//
// The modules are plain ESM rather than TypeScript on purpose: `tsx` is a
// devDependency, and a backup that stops working under `npm ci --omit=dev` is
// not a backup. These declarations give the TypeScript callers (the tests, and
// a future firm-facing download route) real types anyway.

import type { Client, PoolClient } from "pg";

type Db = Client | PoolClient;

/** A predicate rendered against a given table alias. */
export type Predicate = (alias: string) => string;

export interface PlanEntry {
  table: string;
  where: Predicate;
  redact: string[];
  viaParent?: { column: string; lookup: string };
}

export interface ChildSpec {
  table: string;
  column: string;
  lookup: string;
}

export interface Classification {
  tables: string[];
  tenantScoped: string[];
  engagementScoped: string[];
  children: ChildSpec[];
  byMembership: string[];
  reference: string[];
  notBackedUp: string[];
  unclassified: string[];
}

export declare const BY_MEMBERSHIP: Record<
  string,
  { predicate: (tenant: string) => Predicate; redactColumns?: string[]; credentialsOnly?: boolean }
>;
export declare const TENANT_ROW: Record<string, { predicate: (tenant: string) => Predicate }>;
export declare const REFERENCE: string[];
export declare const NOT_BACKED_UP: Record<string, string>;

export declare function uuidLiteral(id: string): string;
export declare function childSpecs(client: Db): Promise<ChildSpec[]>;
export declare function classify(client: Db): Promise<Classification>;
export declare function assertClassified(client: Db): Promise<void>;
export declare function tenantPlan(
  client: Db,
  tenantId: string,
  options: { credentials: "include" | "redact" },
): Promise<PlanEntry[]>;
export declare function engagementPlan(client: Db, engagementId: string): Promise<PlanEntry[]>;
export declare function byteaColumns(client: Db): Promise<{ table: string; column: string }[]>;
