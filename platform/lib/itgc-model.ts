// Pure, client-safe model for the S2.3/S2.5 IT-applications board.

export const IT_STRATEGIES = ["rely_itgc", "test_direct", "substantive_only"] as const;
export type ItStrategy = (typeof IT_STRATEGIES)[number];

export interface ItAppRow {
  /** stable key: the slug of the name at creation */
  key: string;
  name: string;
  /** layers in scope: application / database / operating system / network */
  layers: string;
  /** which SCOTs mention it (derived, read-only) */
  scots: string[];
  strategy: ItStrategy | "";
  /** ITGC testing decision: which processes are in scope and why */
  itgcNote: string;
}

export interface ItAppsView {
  rows: ItAppRow[];
}

export const newAppKey = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "app";
