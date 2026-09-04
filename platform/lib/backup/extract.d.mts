import type { Client } from "pg";

export interface TableResult {
  table: string;
  rows: number;
  where: string;
  columns: { name: string; type: string; notnull: boolean }[];
  redacted: string[];
  format: "csv" | "binary";
  viaParent?: { column: string; lookup: string } | null;
}

export interface SchemaState {
  count: number;
  last: string | null;
  digest: string;
}

export interface ExtractResult {
  identity: Record<string, unknown> | null;
  tables: TableResult[];
  gaps: { constraint: string; child: string; column: string; parent: string; missing: number }[];
  schema: SchemaState;
  source: Record<string, unknown>;
  census: Record<string, number>;
  archived: Record<string, unknown>[];
  manifest: Record<string, unknown>;
}

interface CommonExtractOptions {
  keyId?: string | null;
  releaseSha?: string | null;
  runid?: string | null;
}

/**
 * A union rather than a bag of optional fields, so the runtime rule is visible
 * in the type: a firm-wide extract MUST state whose password hashes and TOTP
 * secrets it is carrying, because a person can work for two firms and the
 * answer differs between an operator restore and anything a firm downloads.
 * An engagement extract has no such choice to make.
 */
export type ExtractOptions =
  | (CommonExtractOptions & {
      tenantId: string;
      engagementId?: null;
      credentials: "include" | "redact";
    })
  | (CommonExtractOptions & {
      engagementId: string;
      tenantId?: null;
      credentials?: undefined;
    });

export declare function connect(connectionString?: string): Promise<Client>;
export declare function extract(
  client: Client,
  dir: string,
  options: ExtractOptions,
): Promise<ExtractResult>;
export declare function sealDirectory(
  dir: string,
  relativePaths: string[],
): Promise<{ path: string; sha256: string }[]>;
