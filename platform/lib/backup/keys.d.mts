export declare function slugify(value: unknown, fallback?: string): string;
export declare function runId(at?: Date): string;
export declare function dbPrefix(
  runid: string,
  cls: "daily" | "weekly" | "monthly" | "yearly",
): string;
export declare function tenantPrefix(tenantId: string): string;
export declare function tenantFullKey(args: {
  tenantId: string;
  tenantName: unknown;
  runid: string;
}): string;
export declare function engagementPrefix(tenantId: string, engagementId: string): string;
export declare function engagementRollingKey(args: {
  tenantId: string;
  engagementId: string;
  clientName: unknown;
  fiscalYear: number | string;
  runid: string;
}): string;
export declare function engagementArchiveKey(args: {
  tenantId: string;
  engagementId: string;
  clientName: unknown;
  fiscalYear: number | string;
  archivedAt: string | Date;
}): string;
export declare function drillKey(runid: string): string;
export declare function bucketFor(key: string): "dr" | "archive";
export declare function parseKey(key: string): Record<string, string> | null;
