import type { Client, PoolClient } from "pg";

type Db = Client | PoolClient;

export declare const MANIFEST_FORMAT: string;
export declare function hashFile(path: string): Promise<string>;
export declare function hashBuffer(buffer: Buffer): string;
export declare function sha256sums(entries: { path: string; sha256: string }[]): string;
export declare function schemaState(
  client: Db,
): Promise<{ count: number; last: string | null; digest: string }>;
export declare function sourceState(
  client: Db,
  options?: { releaseSha?: string | null },
): Promise<Record<string, unknown>>;
export declare function readReleaseSha(root: string): Promise<string | null>;
export declare function restoreCensus(
  client: Db,
  scope: { tenantId?: string | null; engagementId?: string | null },
): Promise<Record<string, number>>;
export declare function archivedEngagements(
  client: Db,
  scope: { tenantId?: string | null; engagementId?: string | null },
): Promise<Record<string, unknown>[]>;
export declare function buildManifest(args: Record<string, unknown>): Record<string, unknown>;
