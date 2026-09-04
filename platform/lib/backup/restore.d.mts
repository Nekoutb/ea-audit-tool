import type { Client, PoolClient } from "pg";

type Db = Client | PoolClient;

export declare class RestoreError extends Error {}

export interface Problem {
  check: string;
  [key: string]: unknown;
}

export declare function checkSchema(
  client: Db,
  manifest: { schema: { count: number; last: string | null; digest: string } },
): Promise<{ count: number; last: string | null; digest: string }>;
export declare function tablesIn(dir: string): Promise<string[]>;
export declare function load(
  client: Db,
  dir: string,
  options?: { tables?: string[] | null; mode?: "empty" | "merge" },
): Promise<{ table: string; rows: number }[]>;
export declare function validateConstraints(
  client: Db,
): Promise<{ table: string; constraint: string; message: string }[]>;
export declare function verify(
  client: Db,
  dir: string,
  manifest: unknown,
  options: { tableCounts: { table: string; rows: number; where?: string }[] },
): Promise<{ ok: boolean; problems: Problem[]; manifestKind: string | null }>;
export declare function guardsPresent(client: Db): Promise<Record<string, number>>;
