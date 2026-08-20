import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  ANALYTIC_BY_KEY, catalogue, runAnalytic,
  type AnalyticParams,
} from "@/lib/gl-analytics";
import {
  accountsFor, drillDown, entryAnalysis, twoAccountCorrelation,
  ACCOUNT_RE, type CounterpartLimit, type CounterpartRank, type DrillFilter, type EntryMode,
} from "@/lib/gl-correlation";
import { buildProjection, validatePopulation } from "@/lib/gl-line";
import { assertMutable, ArchivedError } from "@/lib/mutability";

/**
 * The GL analytics engine's single endpoint.
 *
 *   build     -> project the imported ledger into gl_line, then validate it
 *   validate  -> re-run the population checks against the existing projection
 *   catalogue -> all thirty analytics with their status for this dataset
 *   accounts  -> the account picker list
 *   analytic  -> run one analytic
 *   entry     -> entry analysis around selected accounts
 *   correlate -> two-account correlation
 *   drill     -> the lines behind a cell
 *
 * Only "build" writes, so only "build" carries the archive guard; the read-only
 * analytics stay available on an archived file, which is the point of an
 * archive.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const bad = (code: string, status = 400) => NextResponse.json({ error: code }, { status });

function readDatasetId(body: Record<string, unknown>): string {
  const datasetId = String(body.datasetId ?? "");
  if (!UUID_RE.test(datasetId)) throw new Error("invalid-dataset");
  return datasetId;
}

function readLocale(body: Record<string, unknown>): "en" | "fr" {
  return body.locale === "fr" ? "fr" : "en";
}

/** Only the numeric knobs each analytic declares; everything else is dropped. */
function readParams(body: Record<string, unknown>): AnalyticParams {
  const raw = (body.params ?? {}) as Record<string, unknown>;
  const numberOf = (value: unknown): number | undefined => {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    locale: readLocale(body),
    percentile: numberOf(raw.percentile),
    sdFactor: numberOf(raw.sdFactor),
    roundMin: numberOf(raw.roundMin),
    roundStep: numberOf(raw.roundStep),
    minOccurrences: numberOf(raw.minOccurrences),
    rareMax: numberOf(raw.rareMax),
    topN: numberOf(raw.topN),
    yearEndDays: numberOf(raw.yearEndDays),
    prefixes: Array.isArray(raw.prefixes) ? raw.prefixes.map((p) => String(p)) : undefined,
  };
}

function readAccounts(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) throw new Error("invalid-accounts");
  const cleaned = [...new Set(value.map((a) => String(a).trim()))];
  if (cleaned.length === 0 || cleaned.length > max) throw new Error("invalid-accounts");
  if (cleaned.some((a) => !ACCOUNT_RE.test(a))) throw new Error("invalid-accounts");
  return cleaned;
}

function readDrillFilter(value: unknown): DrillFilter {
  const raw = (value ?? {}) as Record<string, unknown>;
  const filter: DrillFilter = {
    limit: Number(raw.limit ?? 100),
    offset: Number(raw.offset ?? 0),
  };
  if (raw.accounts !== undefined) filter.accounts = readAccounts(raw.accounts, 50);
  if (raw.entryAccounts !== undefined) filter.entryAccounts = readAccounts(raw.entryAccounts, 25);
  if (raw.entryMode !== undefined) filter.entryMode = raw.entryMode === "all" ? "all" : "any";
  if (raw.month !== undefined) filter.month = String(raw.month);
  if (raw.jeNumber !== undefined) filter.jeNumber = String(raw.jeNumber);
  if (raw.preparer !== undefined) filter.preparer = String(raw.preparer);
  if (raw.reviewer !== undefined) filter.reviewer = String(raw.reviewer);
  if (raw.approver !== undefined) filter.approver = String(raw.approver);
  if (raw.minAbs !== undefined) filter.minAbs = Number(raw.minAbs);
  if (raw.weekendOnly !== undefined) filter.weekendOnly = raw.weekendOnly === true;
  if (raw.missingReference !== undefined) filter.missingReference = raw.missingReference === true;
  return filter;
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return bad("unauthenticated", 401);
  const { id } = await context.params;
  if (!UUID_RE.test(id)) return bad("invalid-engagement");

  try {
    const body = (await request.json()) as { op?: string } & Record<string, unknown>;
    const op = String(body.op ?? "");

    if (op === "build") {
      // the only mutating op: it writes the projection
      try {
        await assertMutable(id);
      } catch (e) {
        if (e instanceof ArchivedError) return NextResponse.json({ error: "archived" }, { status: 423 });
        throw e;
      }
      const datasetId = readDatasetId(body);
      const build = await buildProjection(id, datasetId);
      const validation = await validatePopulation(id, datasetId);
      return NextResponse.json({ build, validation });
    }

    if (op === "validate") {
      const datasetId = readDatasetId(body);
      return NextResponse.json({ validation: await validatePopulation(id, datasetId) });
    }

    if (op === "catalogue") {
      const datasetId = readDatasetId(body);
      return NextResponse.json({ catalogue: await catalogue(id, datasetId, readLocale(body)) });
    }

    if (op === "accounts") {
      const datasetId = readDatasetId(body);
      const search = body.search === undefined ? undefined : String(body.search);
      return NextResponse.json({ accounts: await accountsFor(id, datasetId, search) });
    }

    if (op === "analytic") {
      const datasetId = readDatasetId(body);
      const key = String(body.key ?? "");
      if (!ANALYTIC_BY_KEY.has(key)) return bad("unknown-analytic");
      return NextResponse.json({ result: await runAnalytic(id, datasetId, key, readParams(body)) });
    }

    if (op === "entry") {
      const datasetId = readDatasetId(body);
      const accounts = readAccounts(body.accounts, 25);
      const mode: EntryMode = body.mode === "all" ? "all" : "any";
      const ranks: CounterpartRank[] = ["abs", "net", "postings", "entries", "account"];
      const rank = ranks.includes(body.rank as CounterpartRank) ? (body.rank as CounterpartRank) : "abs";
      const rawLimit = body.limit === "all" ? "all" : Number(body.limit);
      const limit: CounterpartLimit =
        rawLimit === "all" ? "all" : ([10, 20, 50] as number[]).includes(rawLimit as number) ? (rawLimit as 10 | 20 | 50) : 20;
      return NextResponse.json({ result: await entryAnalysis(id, datasetId, accounts, mode, rank, limit) });
    }

    if (op === "correlate") {
      const datasetId = readDatasetId(body);
      const a = String(body.a ?? "").trim();
      const b = String(body.b ?? "").trim();
      if (!ACCOUNT_RE.test(a) || !ACCOUNT_RE.test(b)) return bad("invalid-accounts");
      if (a === b) return bad("same-account");
      return NextResponse.json({ result: await twoAccountCorrelation(id, datasetId, a, b) });
    }

    if (op === "drill") {
      const datasetId = readDatasetId(body);
      return NextResponse.json({ result: await drillDown(id, datasetId, readDrillFilter(body.filter)) });
    }

    return bad("invalid-op");
  } catch (error) {
    const code = error instanceof Error && /^[a-z0-9-]+$/.test(error.message) ? error.message : "analytics-failed";
    return bad(code);
  }
}
