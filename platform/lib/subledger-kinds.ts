// Client-safe constants (imported by browser components — keep free of any
// server-only dependency like pg).

export const SUB_LEDGER_KINDS = [
  "ar_open_items",
  "ap_open_items",
  "fixed_asset_register",
  "inventory_listing",
  "payroll_register",
  "bank_statement",
] as const;
export type SubLedgerKind = (typeof SUB_LEDGER_KINDS)[number];

export function isSubLedgerKind(value: unknown): value is SubLedgerKind {
  return typeof value === "string" && (SUB_LEDGER_KINDS as readonly string[]).includes(value);
}
