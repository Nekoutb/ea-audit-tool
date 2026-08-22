"use client";

// The GL Correlation Console.
//
// One ledger, one account selection, three ways of interrogating it: what else
// moves when these accounts move (entry analysis), how two accounts move
// against one another (two-account correlation), and the thirty-analytic
// catalogue. Every figure on screen comes from a SQL aggregate in
// lib/gl-analytics.ts / lib/gl-correlation.ts over the typed gl_line
// projection — the console never receives a ledger, only its aggregates, and
// the drill-down is always a capped, paginated page of evidence.
//
// Amount convention, carried from the engine and never reversed here:
//   signed = debit - credit  -> debits positive, credits negative,
// and negatives print in parentheses through num() in components/ui/excel.tsx.

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GlAccountPicker } from "@/components/GlAccountPicker";
import { SCell, SRow, Sheet, SheetNote, SheetTable, num, type SheetCol } from "@/components/ui/excel";
import type { AnalyticCategory, AnalyticResult, CatalogueEntry, Cell } from "@/lib/gl-analytics";
import type {
  AccountList, CounterpartLimit, CounterpartRank, DrillFilter, DrillResult,
  EntryAnalysis, EntryMode, TwoAccountCorrelation,
} from "@/lib/gl-correlation";
import type { CheckStatus, ValidationResult } from "@/lib/gl-line";

/** The drill-down never asks for more than one page; the API caps at 500. */
const PAGE = 100;

export interface GlDatasetOption {
  id: string;
  sourceFilename: string;
  timing: "pre_audit" | "post_audit" | "prior_year";
  rowCount: number;
  createdAt: string;
}

type Tab = "entry" | "correlate" | "analytics";

interface HeadStats {
  lines: number | null;
  entries: number | null;
  accounts: number | null;
  debit: number | null;
  credit: number | null;
  difference: number | null;
}

interface Drill {
  /** what the reader clicked, spelled out in the dialog heading */
  labelEn: string;
  labelFr: string;
  filter: DrillFilter;
}

// ---------------------------------------------------------------------------
// transport

interface Fail { ok: false; error: string }
type Reply<T> = { ok: true; data: T } | Fail;

async function post<T>(engagementId: string, payload: Record<string, unknown>): Promise<Reply<T>> {
  try {
    const response = await fetch(`/api/engagements/${engagementId}/gl-analytics`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
    if (!response.ok) return { ok: false, error: String(body.error ?? "analytics-failed") };
    return { ok: true, data: body as T };
  } catch {
    return { ok: false, error: "network" };
  }
}

const numberOf = (cell: Cell | undefined): number | null => {
  if (cell === null || cell === undefined) return null;
  const n = Number(cell);
  return Number.isFinite(n) ? n : null;
};

// ---------------------------------------------------------------------------
// labels

const TIMING: Record<GlDatasetOption["timing"], { en: string; fr: string }> = {
  pre_audit: { en: "Pre-audit GL", fr: "Grand livre pré-audit" },
  post_audit: { en: "Post-audit GL", fr: "Grand livre post-audit" },
  prior_year: { en: "Prior-year GL", fr: "Grand livre N-1" },
};

const STATUS: Record<CheckStatus, { en: string; fr: string; mark: string }> = {
  passed: { en: "Passed", fr: "Conforme", mark: "✓" },
  warning: { en: "Warning", fr: "Avertissement", mark: "!" },
  failed: { en: "Failed", fr: "Échec", mark: "✕" },
};

const CATEGORY: Record<AnalyticCategory, { en: string; fr: string }> = {
  integrity: { en: "Integrity", fr: "Intégrité" },
  completeness: { en: "Completeness", fr: "Exhaustivité" },
  timing: { en: "Timing", fr: "Rattachement" },
  value: { en: "Value", fr: "Valeur" },
  pattern: { en: "Pattern", fr: "Tendance" },
  attribution: { en: "Attribution", fr: "Attribution" },
};

const RANKS: { value: CounterpartRank; en: string; fr: string }[] = [
  { value: "abs", en: "Absolute value", fr: "Valeur absolue" },
  { value: "net", en: "Net signed value", fr: "Valeur nette signée" },
  { value: "postings", en: "Posting count", fr: "Nombre de lignes" },
  { value: "entries", en: "Entry count", fr: "Nombre d'écritures" },
  { value: "account", en: "Account number", fr: "Numéro de compte" },
];

const LIMITS: CounterpartLimit[] = [10, 20, 50, "all"];

const tid = (month: string): string => month.replace(/\//g, "");

const btn =
  "h-8 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 text-[12px] font-semibold text-ink-soft transition hover:bg-surface-2 disabled:opacity-50";
const field =
  "h-8 rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2 text-[12px] text-ink outline-none focus:border-emerald-600";

// ---------------------------------------------------------------------------

export function GlConsole({
  engagementId,
  locale,
  datasets,
  entity,
  engagementName,
  periodEnd,
  fiscalYear,
  analyzerHref,
}: {
  engagementId: string;
  locale: "en" | "fr";
  datasets: GlDatasetOption[];
  entity: string;
  engagementName: string;
  periodEnd: string;
  fiscalYear: number;
  analyzerHref: string;
}) {
  const fr = locale === "fr";
  const T = (en: string, frText: string) => (fr ? frText : en);

  const [datasetId, setDatasetId] = useState(datasets[0]?.id ?? "");
  const dataset = datasets.find((d) => d.id === datasetId) ?? null;

  const [phase, setPhase] = useState<"loading" | "unbuilt" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [head, setHead] = useState<HeadStats | null>(null);
  const [catalogue, setCatalogue] = useState<CatalogueEntry[]>([]);
  const [building, setBuilding] = useState(false);
  const [buildNote, setBuildNote] = useState<string | null>(null);
  const [showAllChecks, setShowAllChecks] = useState(false);

  // shared selection
  const [selected, setSelected] = useState<string[]>([]);
  const [mode, setMode] = useState<EntryMode>("any");
  const [tab, setTab] = useState<Tab>("entry");

  // entry analysis
  const [rank, setRank] = useState<CounterpartRank>("abs");
  const [limit, setLimit] = useState<CounterpartLimit>(20);
  const [entry, setEntry] = useState<EntryAnalysis | null>(null);
  const [entryPending, setEntryPending] = useState(false);
  const [entryError, setEntryError] = useState<string | null>(null);

  // two-account correlation
  const [swapped, setSwapped] = useState(false);
  const [corr, setCorr] = useState<TwoAccountCorrelation | null>(null);
  const [corrPending, setCorrPending] = useState(false);
  const [corrError, setCorrError] = useState<string | null>(null);

  // analytics
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [analytic, setAnalytic] = useState<AnalyticResult | null>(null);
  const [analyticPending, setAnalyticPending] = useState(false);
  const [analyticError, setAnalyticError] = useState<string | null>(null);

  // drill-down
  const [drill, setDrill] = useState<Drill | null>(null);
  const [drillOffset, setDrillOffset] = useState(0);
  const [drillResult, setDrillResult] = useState<DrillResult | null>(null);
  const [drillPending, setDrillPending] = useState(false);
  const [drillError, setDrillError] = useState<string | null>(null);

  const openDrill = useCallback((next: Drill) => {
    setDrill(next);
    setDrillOffset(0);
    setDrillResult(null);
    setDrillError(null);
  }, []);

  // -- header -------------------------------------------------------------
  const loadHead = useCallback(async () => {
    const [accounts, recon, unbalanced, cat] = await Promise.all([
      post<{ accounts: AccountList }>(engagementId, { op: "accounts", datasetId }),
      post<{ result: AnalyticResult }>(engagementId, { op: "analytic", datasetId, key: "ledger-reconciliation", locale }),
      post<{ result: AnalyticResult }>(engagementId, { op: "analytic", datasetId, key: "unbalanced-entries", locale }),
      post<{ catalogue: CatalogueEntry[] }>(engagementId, { op: "catalogue", datasetId, locale }),
    ]);
    const reconTotals = recon.ok ? recon.data.result.totals : undefined;
    const entryTotals = unbalanced.ok ? unbalanced.data.result.totals : undefined;
    setHead({
      lines: numberOf(reconTotals?.[0]),
      debit: numberOf(reconTotals?.[1]),
      credit: numberOf(reconTotals?.[2]),
      difference: numberOf(reconTotals?.[3]),
      entries: numberOf(entryTotals?.[0]),
      accounts: accounts.ok ? accounts.data.accounts.total : null,
    });
    setCatalogue(cat.ok ? cat.data.catalogue : []);
  }, [engagementId, datasetId, locale]);

  useEffect(() => {
    if (!datasetId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- guard path: no dataset means the console can never load; one sync render settles it
      setPhase("error");
      return;
    }
    let live = true;
    (async () => {
      setPhase("loading");
      setError(null);
      const reply = await post<{ validation: ValidationResult }>(engagementId, { op: "validate", datasetId });
      if (!live) return;
      if (!reply.ok) {
        setError(reply.error);
        setPhase("error");
        return;
      }
      setValidation(reply.data.validation);
      if (reply.data.validation.lines === 0) {
        setPhase("unbuilt");
        return;
      }
      await loadHead();
      if (live) setPhase("ready");
    })();
    return () => {
      live = false;
    };
  }, [engagementId, datasetId, loadHead]);

  const build = async () => {
    setBuilding(true);
    setBuildNote(T("Preparing the ledger…", "Préparation du grand livre…"));
    const reply = await post<{ build: { lines: number; rejected: number; reused: boolean }; validation: ValidationResult }>(
      engagementId, { op: "build", datasetId },
    );
    setBuilding(false);
    if (!reply.ok) {
      setBuildNote(
        reply.error === "archived"
          ? T("The engagement file is archived, so the ledger cannot be prepared.", "Le dossier est archivé : le grand livre ne peut pas être préparé.")
          : T(`Preparation failed (${reply.error}).`, `Échec de la préparation (${reply.error}).`),
      );
      return;
    }
    const { build: result, validation: checked } = reply.data;
    setValidation(checked);
    setBuildNote(
      result.reused
        ? T(
            `Already prepared: ${result.lines} lines in the projection.`,
            `Déjà préparé : ${result.lines} lignes dans la projection.`,
          )
        : T(
            `Prepared: ${result.lines} lines projected, ${result.rejected} source rows rejected for a missing account or JE number.`,
            `Préparé : ${result.lines} lignes projetées, ${result.rejected} lignes source écartées faute de compte ou de numéro d'écriture.`,
          ),
    );
    await loadHead();
    setPhase("ready");
  };

  // -- entry analysis -----------------------------------------------------
  useEffect(() => {
    if (phase !== "ready" || tab !== "entry" || selected.length === 0) return;
    let live = true;
    (async () => {
      setEntryPending(true);
      setEntryError(null);
      const reply = await post<{ result: EntryAnalysis }>(engagementId, {
        op: "entry", datasetId, accounts: selected, mode, rank, limit,
      });
      if (!live) return;
      setEntryPending(false);
      if (!reply.ok) {
        setEntry(null);
        setEntryError(T("The entry analysis could not be computed.", "L'analyse des écritures n'a pas pu être calculée."));
        return;
      }
      setEntry(reply.data.result);
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, tab, engagementId, datasetId, selected, mode, rank, limit]);

  // -- two-account correlation -------------------------------------------
  const pair = useMemo(
    () => (selected.length === 2 ? (swapped ? [selected[1], selected[0]] : [selected[0], selected[1]]) : null),
    [selected, swapped],
  );

  useEffect(() => {
    if (phase !== "ready" || tab !== "correlate" || !pair) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- guard path clearing stale correlation before the async fetch below
      setCorr(null);
      return;
    }
    let live = true;
    (async () => {
      setCorrPending(true);
      setCorrError(null);
      const reply = await post<{ result: TwoAccountCorrelation }>(engagementId, {
        op: "correlate", datasetId, a: pair[0], b: pair[1],
      });
      if (!live) return;
      setCorrPending(false);
      if (!reply.ok) {
        setCorr(null);
        setCorrError(T("The correlation could not be computed.", "La corrélation n'a pas pu être calculée."));
        return;
      }
      setCorr(reply.data.result);
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, tab, engagementId, datasetId, pair]);

  // -- analytics ----------------------------------------------------------
  const runAnalytic = async (key: string) => {
    setActiveKey(key);
    setAnalyticPending(true);
    setAnalyticError(null);
    setAnalytic(null);
    const reply = await post<{ result: AnalyticResult }>(engagementId, { op: "analytic", datasetId, key, locale });
    setAnalyticPending(false);
    if (!reply.ok) {
      setAnalyticError(T("The analytic could not be run.", "L'analyse n'a pas pu être exécutée."));
      return;
    }
    setAnalytic(reply.data.result);
  };

  // -- drill-down ---------------------------------------------------------
  useEffect(() => {
    if (!drill) return;
    let live = true;
    (async () => {
      setDrillPending(true);
      setDrillError(null);
      const reply = await post<{ result: DrillResult }>(engagementId, {
        op: "drill", datasetId, filter: { ...drill.filter, limit: PAGE, offset: drillOffset },
      });
      if (!live) return;
      setDrillPending(false);
      if (!reply.ok) {
        setDrillResult(null);
        setDrillError(T("The underlying lines could not be loaded.", "Les lignes sous-jacentes n'ont pas pu être chargées."));
        return;
      }
      setDrillResult(reply.data.result);
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drill, drillOffset, engagementId, datasetId]);

  useEffect(() => {
    if (!drill) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrill(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drill]);

  const monthLabel = (month: string) => (month === "n/a" ? T("No date", "Sans date") : month);
  const modeLabel = mode === "all"
    ? T("All selected accounts", "Tous les comptes sélectionnés")
    : T("Any selected account", "L'un des comptes sélectionnés");

  // -----------------------------------------------------------------------
  // no dataset at all

  if (datasets.length === 0) {
    return (
      <Sheet
        title={T("No general ledger imported", "Aucun grand livre importé")}
        testId="gl-console-no-dataset"
      >
        <SheetNote>
          {T(
            "This engagement has no general-ledger dataset. Import the ledger in the GL Analyzer, then return here.",
            "Cette mission n'a aucun jeu de données de grand livre. Importer le grand livre dans l'analyseur, puis revenir ici.",
          )}
        </SheetNote>
        <div>
          <Link href={analyzerHref} className={btn} data-testid="gl-console-analyzer-link">
            {T("Open the GL Analyzer", "Ouvrir l'analyseur du grand livre")}
          </Link>
        </div>
      </Sheet>
    );
  }

  const failing = (validation?.checks ?? []).filter((c) => c.status !== "passed");
  const shownChecks = showAllChecks ? (validation?.checks ?? []) : failing;

  const headCols: SheetCol[] = [
    { label: T("Entity", "Entité"), width: 170 },
    { label: T("Engagement", "Mission"), width: 170 },
    { label: T("Period end", "Fin de période"), width: 110 },
    { label: T("Source file", "Fichier source"), width: 200 },
    { label: T("Version", "Version"), width: 130 },
    { label: T("Uploaded", "Importé le"), width: 120 },
    { label: T("Lines", "Lignes"), align: "right", width: 90 },
    { label: T("Entries", "Écritures"), align: "right", width: 90 },
    { label: T("Accounts", "Comptes"), align: "right", width: 90 },
    { label: T("Total debit", "Total débit"), align: "right", width: 130 },
    { label: T("Total credit", "Total crédit"), align: "right", width: 130 },
    { label: T("Difference", "Écart"), align: "right", width: 120 },
  ];

  return (
    <div className="flex flex-col gap-3">
      {/* A. HEADER STRIP ---------------------------------------------------- */}
      <Sheet
        title={T("Ledger under analysis", "Grand livre analysé")}
        subtitle={
          validation
            ? T(
                `Population validation: ${STATUS[validation.status].en}`,
                `Validation de la population : ${STATUS[validation.status].fr}`,
              )
            : undefined
        }
        testId="gl-console-header"
      >
        {datasets.length > 1 ? (
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="gl-dataset" className="text-[11px] font-semibold text-ink-soft">
                {T("General ledger version", "Version du grand livre")}
              </label>
              <select
                id="gl-dataset"
                value={datasetId}
                onChange={(e) => { setDatasetId(e.target.value); setSelected([]); setEntry(null); setCorr(null); setAnalytic(null); setActiveKey(null); }}
                className={`${field} w-[420px] max-w-full`}
                data-testid="gl-dataset-select"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {`${fr ? TIMING[d.timing].fr : TIMING[d.timing].en} · ${d.sourceFilename} · ${d.createdAt}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}

        <SheetTable cols={headCols} testId="gl-header-strip">
          <tbody>
            <SRow n={1} testId="gl-header-row">
              <SCell wrap>{entity}</SCell>
              <SCell wrap>{engagementName}</SCell>
              <SCell>{periodEnd} ({fiscalYear})</SCell>
              <SCell wrap>{dataset?.sourceFilename ?? "—"}</SCell>
              <SCell>{dataset ? (fr ? TIMING[dataset.timing].fr : TIMING[dataset.timing].en) : "—"}</SCell>
              <SCell>{dataset?.createdAt ?? "—"}</SCell>
              <SCell align="right" kind="calc">{num(head?.lines ?? validation?.lines ?? null)}</SCell>
              <SCell align="right" kind="calc">{num(head?.entries ?? null)}</SCell>
              <SCell align="right" kind="calc">{num(head?.accounts ?? null)}</SCell>
              <SCell align="right" kind="calc">{num(head?.debit ?? null)}</SCell>
              <SCell align="right" kind="calc">{num(head?.credit ?? null)}</SCell>
              <SCell align="right" kind="calc">{num(head?.difference ?? null)}</SCell>
            </SRow>
          </tbody>
        </SheetTable>

        {phase === "loading" ? (
          <SheetNote testId="gl-console-loading">{T("Loading the ledger…", "Chargement du grand livre…")}</SheetNote>
        ) : null}

        {phase === "error" ? (
          <SheetNote testId="gl-console-error">
            {T(
              `The ledger could not be read${error ? ` (${error})` : ""}.`,
              `Le grand livre n'a pas pu être lu${error ? ` (${error})` : ""}.`,
            )}
          </SheetNote>
        ) : null}

        {phase === "unbuilt" ? (
          <>
            <SheetNote testId="gl-console-unbuilt">
              {T(
                "The ledger has been imported but not yet prepared for analysis. Preparation reads the imported file once and writes a typed, indexed line for each ledger line; every figure in this console is then computed by the database, never by loading the ledger into the browser.",
                "Le grand livre est importé mais pas encore préparé pour l'analyse. La préparation lit le fichier importé une seule fois et écrit une ligne typée et indexée par ligne du grand livre ; toutes les valeurs de cette console sont ensuite calculées par la base de données, jamais en chargeant le grand livre dans le navigateur.",
              )}
            </SheetNote>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={build}
                disabled={building}
                className={btn}
                data-testid="gl-build"
              >
                {building
                  ? T("Preparing…", "Préparation…")
                  : T("Prepare ledger for analysis", "Préparer le grand livre pour l'analyse")}
              </button>
              <span className="text-[11.5px] text-ink-soft" data-testid="gl-build-source-rows">
                {T(
                  `${dataset?.rowCount ?? 0} source rows to project.`,
                  `${dataset?.rowCount ?? 0} lignes source à projeter.`,
                )}
              </span>
            </div>
          </>
        ) : null}

        {buildNote ? <SheetNote testId="gl-build-note">{buildNote}</SheetNote> : null}

        {/* population validation */}
        {validation ? (
          <>
            <SheetNote testId="gl-validation-status">
              {T(
                `Population validation: ${STATUS[validation.status].mark} ${STATUS[validation.status].en} — ${validation.passed} passed, ${validation.warnings} warning(s), ${validation.failed} failed, over ${validation.lines} projected lines from ${validation.sourceRows} source rows.`,
                `Validation de la population : ${STATUS[validation.status].mark} ${STATUS[validation.status].fr} — ${validation.passed} conforme(s), ${validation.warnings} avertissement(s), ${validation.failed} échec(s), sur ${validation.lines} lignes projetées issues de ${validation.sourceRows} lignes source.`,
              )}
            </SheetNote>
            {shownChecks.length > 0 ? (
              <SheetTable
                cols={[
                  { label: T("Check", "Contrôle"), width: 260 },
                  { label: T("Status", "État"), width: 130 },
                  { label: T("Detail", "Détail"), width: 620 },
                ]}
                testId="gl-validation-checks"
              >
                <tbody>
                  {shownChecks.map((check, i) => (
                    <SRow key={check.key} n={i + 1} testId={`gl-check-${check.key}`}>
                      <SCell wrap>{fr ? check.labelFr : check.labelEn}</SCell>
                      <SCell kind="calc">
                        {STATUS[check.status].mark} {fr ? STATUS[check.status].fr : STATUS[check.status].en}
                      </SCell>
                      <SCell wrap>{fr ? check.detailFr : check.detailEn}</SCell>
                    </SRow>
                  ))}
                </tbody>
              </SheetTable>
            ) : (
              <SheetNote testId="gl-validation-all-passed">
                {T("Every population check passed.", "Tous les contrôles de population sont conformes.")}
              </SheetNote>
            )}
            <div>
              <button
                type="button"
                onClick={() => setShowAllChecks((v) => !v)}
                className={btn}
                aria-pressed={showAllChecks}
                data-testid="gl-validation-toggle"
              >
                {showAllChecks
                  ? T("Show only exceptions", "N'afficher que les exceptions")
                  : T("Show all checks", "Afficher tous les contrôles")}
              </button>
            </div>
          </>
        ) : null}
      </Sheet>

      {phase === "ready" ? (
        <>
          {/* B. SHARED ACCOUNT PICKER --------------------------------------- */}
          <GlAccountPicker
            engagementId={engagementId}
            datasetId={datasetId}
            locale={locale}
            selected={selected}
            onSelectedChange={setSelected}
            mode={mode}
            onModeChange={setMode}
          />

          {/* C. THREE VIEWS ------------------------------------------------- */}
          <div
            role="tablist"
            aria-label={T("Correlation views", "Vues de corrélation")}
            className="flex flex-wrap gap-1.5"
            data-testid="gl-tabs"
          >
            {([
              { key: "entry" as Tab, en: "Entry Analysis", fr: "Analyse des écritures" },
              { key: "correlate" as Tab, en: "Two-Account Correlation", fr: "Corrélation entre deux comptes" },
              { key: "analytics" as Tab, en: "Analytics", fr: "Analyses" },
            ]).map((item) => {
              const on = tab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  id={`gl-tab-${item.key}`}
                  aria-selected={on}
                  aria-controls={`gl-panel-${item.key}`}
                  tabIndex={on ? 0 : -1}
                  onKeyDown={(event) => {
                    const order: Tab[] = ["entry", "correlate", "analytics"];
                    const at = order.indexOf(tab);
                    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                      event.preventDefault();
                      const next = order[(at + (event.key === "ArrowRight" ? 1 : order.length - 1)) % order.length];
                      setTab(next);
                      document.getElementById(`gl-tab-${next}`)?.focus();
                    }
                    if (event.key === "Home") { event.preventDefault(); setTab(order[0]); document.getElementById(`gl-tab-${order[0]}`)?.focus(); }
                    if (event.key === "End") { event.preventDefault(); setTab(order[2]); document.getElementById(`gl-tab-${order[2]}`)?.focus(); }
                  }}
                  onClick={() => setTab(item.key)}
                  data-testid={`gl-tab-${item.key}`}
                  className={`h-8 rounded-[var(--radius-atlas-sm)] border px-3 text-[12px] font-semibold transition ${
                    on
                      ? "border-emerald-600 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      : "border-line-strong bg-surface text-ink-soft hover:bg-surface-2"
                  }`}
                >
                  {on ? "▸ " : ""}{fr ? item.fr : item.en}
                </button>
              );
            })}
          </div>

          {/* C1. ENTRY ANALYSIS --------------------------------------------- */}
          {tab === "entry" ? (
            <div role="tabpanel" id="gl-panel-entry" aria-labelledby="gl-tab-entry" tabIndex={0}>
              <EntryView
                fr={fr}
                selected={selected}
                mode={mode}
                modeLabel={modeLabel}
                rank={rank}
                setRank={setRank}
                limit={limit}
                setLimit={setLimit}
                entry={entry}
                pending={entryPending}
                error={entryError}
                monthLabel={monthLabel}
                onCell={(month, account) =>
                  openDrill({
                    labelEn: `Entry analysis · counterpart account ${account} · ${month === "n/a" ? "no date" : month}`,
                    labelFr: `Analyse des écritures · compte de contrepartie ${account} · ${month === "n/a" ? "sans date" : month}`,
                    filter: { accounts: [account], entryAccounts: selected, entryMode: mode, month },
                  })
                }
              />
            </div>
          ) : null}

          {/* C2. TWO-ACCOUNT CORRELATION ------------------------------------ */}
          {tab === "correlate" ? (
            <div role="tabpanel" id="gl-panel-correlate" aria-labelledby="gl-tab-correlate" tabIndex={0}>
              <CorrelationView
                fr={fr}
                selected={selected}
                corr={corr}
                pending={corrPending}
                error={corrError}
                swapped={swapped}
                onSwap={() => setSwapped((v) => !v)}
                monthLabel={monthLabel}
                onCell={(month, account, other) =>
                  openDrill({
                    labelEn: `Two-account correlation · account ${account} · ${month === "n/a" ? "no date" : month} · entries shared with ${other}`,
                    labelFr: `Corrélation entre deux comptes · compte ${account} · ${month === "n/a" ? "sans date" : month} · écritures communes avec ${other}`,
                    filter: { accounts: [account], entryAccounts: [account, other], entryMode: "all", month },
                  })
                }
              />
            </div>
          ) : null}

          {/* C3. ANALYTICS -------------------------------------------------- */}
          {tab === "analytics" ? (
            <div role="tabpanel" id="gl-panel-analytics" aria-labelledby="gl-tab-analytics" tabIndex={0}>
              <AnalyticsView
                fr={fr}
                catalogue={catalogue}
                activeKey={activeKey}
                onRun={runAnalytic}
                result={analytic}
                pending={analyticPending}
                error={analyticError}
                monthLabel={monthLabel}
                onMonth={(month, title) =>
                  openDrill({
                    labelEn: `${title} · ${month === "n/a" ? "no date" : month} — the lines behind this row`,
                    labelFr: `${title} · ${month === "n/a" ? "sans date" : month} — les lignes derrière cette ligne`,
                    filter: { month },
                  })
                }
              />
            </div>
          ) : null}
        </>
      ) : null}

      {/* D. DRILL-DOWN ------------------------------------------------------ */}
      {drill ? (
        <DrillPanel
          fr={fr}
          label={fr ? drill.labelFr : drill.labelEn}
          result={drillResult}
          pending={drillPending}
          error={drillError}
          offset={drillOffset}
          page={PAGE}
          onPage={setDrillOffset}
          onClose={() => setDrill(null)}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// C1. Entry Analysis: months down, counterpart accounts across.

function EntryView({
  fr, selected, mode, modeLabel, rank, setRank, limit, setLimit, entry, pending, error, monthLabel, onCell,
}: {
  fr: boolean;
  selected: string[];
  mode: EntryMode;
  modeLabel: string;
  rank: CounterpartRank;
  setRank: (r: CounterpartRank) => void;
  limit: CounterpartLimit;
  setLimit: (l: CounterpartLimit) => void;
  entry: EntryAnalysis | null;
  pending: boolean;
  error: string | null;
  monthLabel: (m: string) => string;
  onCell: (month: string, account: string) => void;
}) {
  const T = (en: string, frText: string) => (fr ? frText : en);

  const cols: SheetCol[] = [
    { label: T("Month", "Mois"), width: 110 },
    ...(entry?.counterpartAccounts ?? []).map((a) => ({
      label: a.account,
      align: "right" as const,
      width: 120,
    })),
    { label: T("Row total", "Total ligne"), align: "right" as const, width: 130 },
  ];

  return (
    <Sheet
      title={T("Entry analysis", "Analyse des écritures")}
      subtitle={T(`Active mode: ${modeLabel}`, `Mode actif : ${modeLabel}`)}
      objective={T(
        "Every journal entry that touches the selected accounts is taken, and what those entries ALSO posted to is shown month by month. The selected accounts are excluded from the columns: an account is not its own counterpart. Amounts are signed — debits positive, credits negative, negatives in parentheses.",
        "Chaque écriture touchant les comptes sélectionnés est retenue, et ce que ces écritures ont AUSSI mouvementé est présenté mois par mois. Les comptes sélectionnés sont exclus des colonnes : un compte n'est pas sa propre contrepartie. Les montants sont signés — débits positifs, crédits négatifs, négatifs entre parenthèses.",
      )}
      testId="gl-entry-view"
    >
      <div className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="gl-entry-rank" className="text-[11px] font-semibold text-ink-soft">
            {T("Rank counterpart accounts by", "Classer les contreparties par")}
          </label>
          <select
            id="gl-entry-rank"
            value={rank}
            onChange={(e) => setRank(e.target.value as CounterpartRank)}
            className={`${field} w-56`}
            data-testid="gl-entry-rank"
          >
            {RANKS.map((r) => (
              <option key={r.value} value={r.value}>{fr ? r.fr : r.en}</option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="gl-entry-limit" className="text-[11px] font-semibold text-ink-soft">
            {T("Counterpart accounts shown", "Contreparties affichées")}
          </label>
          <select
            id="gl-entry-limit"
            value={String(limit)}
            onChange={(e) => setLimit(e.target.value === "all" ? "all" : (Number(e.target.value) as 10 | 20 | 50))}
            className={`${field} w-40`}
            data-testid="gl-entry-limit"
          >
            {LIMITS.map((l) => (
              <option key={String(l)} value={String(l)}>
                {l === "all" ? T("All", "Toutes") : `Top ${l}`}
              </option>
            ))}
          </select>
        </div>
      </div>

      {selected.length === 0 ? (
        <SheetNote testId="gl-entry-empty">
          {T("Select at least one account to run the entry analysis.", "Sélectionner au moins un compte pour lancer l'analyse des écritures.")}
        </SheetNote>
      ) : pending ? (
        <SheetNote testId="gl-entry-pending">{T("Computing…", "Calcul en cours…")}</SheetNote>
      ) : error ? (
        <SheetNote testId="gl-entry-error">{error}</SheetNote>
      ) : entry ? (
        <>
          {/* summary above the grid */}
          <SheetTable
            cols={[
              { label: T("Linked journal entries", "Écritures rattachées"), align: "right", width: 150 },
              { label: T("Counterpart accounts", "Comptes de contrepartie"), align: "right", width: 150 },
              { label: T("Total debit", "Total débit"), align: "right", width: 130 },
              { label: T("Total credit", "Total crédit"), align: "right", width: 130 },
              { label: T("Net signed", "Net signé"), align: "right", width: 130 },
              { label: T("Active mode", "Mode actif"), width: 200 },
              { label: T("Selected accounts", "Comptes sélectionnés"), width: 320 },
            ]}
            testId="gl-entry-summary"
          >
            <tbody>
              <SRow n={1} testId="gl-entry-summary-row">
                <SCell align="right" kind="calc">{num(entry.linkedEntries)}</SCell>
                <SCell align="right" kind="calc">{num(entry.counterpartAccounts.length + entry.hiddenAccounts)}</SCell>
                <SCell align="right" kind="calc">{num(entry.totalDebit)}</SCell>
                <SCell align="right" kind="calc">{num(entry.totalCredit)}</SCell>
                <SCell align="right" kind="calc">{num(entry.net)}</SCell>
                <SCell>{mode === "all" ? T("All selected accounts", "Tous les comptes sélectionnés") : T("Any selected account", "L'un des comptes sélectionnés")}</SCell>
                <SCell wrap>{entry.accounts.join(", ")}</SCell>
              </SRow>
            </tbody>
          </SheetTable>

          {entry.counterpartAccounts.length === 0 ? (
            <SheetNote testId="gl-entry-no-counterparts">
              {T(
                "The linked entries post to no other account — there is no counterpart to show.",
                "Les écritures rattachées ne mouvementent aucun autre compte — aucune contrepartie à présenter.",
              )}
            </SheetNote>
          ) : (
            <>
              <SheetTable cols={cols} testId="gl-entry-grid">
                <tbody>
                  {entry.months.map((row, i) => (
                    <SRow key={row.month} n={i + 1} testId={`gl-entry-month-${tid(row.month)}`}>
                      <SCell>{monthLabel(row.month)}</SCell>
                      {entry.counterpartAccounts.map((account, j) => {
                        const value = row.cells[j] ?? null;
                        return (
                          <SCell key={account.account} align="right" testId={`gl-entry-cell-${tid(row.month)}-${account.account}`}>
                            {value === null ? (
                              "—"
                            ) : (
                              <button
                                type="button"
                                onClick={() => onCell(row.month, account.account)}
                                className="underline decoration-dotted underline-offset-2"
                                data-testid={`gl-entry-drill-${tid(row.month)}-${account.account}`}
                                aria-label={
                                  fr
                                    ? `Détail des lignes : compte ${account.account}, ${monthLabel(row.month)}`
                                    : `Drill down: account ${account.account}, ${monthLabel(row.month)}`
                                }
                              >
                                {num(value)}
                              </button>
                            )}
                          </SCell>
                        );
                      })}
                      <SCell align="right" kind="calc">{num(row.total)}</SCell>
                    </SRow>
                  ))}
                  <SRow n={entry.months.length + 1} total testId="gl-entry-total">
                    <SCell kind="calc">{T("Total", "Total")}</SCell>
                    {entry.counterpartAccounts.map((account) => (
                      <SCell key={account.account} align="right" kind="calc">{num(account.net)}</SCell>
                    ))}
                    <SCell align="right" kind="calc">
                      {num(entry.counterpartAccounts.reduce((s, a) => s + a.net, 0))}
                    </SCell>
                  </SRow>
                </tbody>
              </SheetTable>

              {/* the column key: codes alone are not names */}
              <SheetTable
                cols={[
                  { label: T("Counterpart account", "Compte de contrepartie"), width: 120 },
                  { label: T("Account name", "Intitulé"), width: 280 },
                  { label: T("Net signed", "Net signé"), align: "right", width: 130 },
                  { label: T("Absolute value", "Valeur absolue"), align: "right", width: 130 },
                  { label: T("Postings", "Lignes"), align: "right", width: 100 },
                  { label: T("Entries", "Écritures"), align: "right", width: 100 },
                ]}
                testId="gl-entry-key"
              >
                <tbody>
                  {entry.counterpartAccounts.map((account, i) => (
                    <SRow key={account.account} n={i + 1} testId={`gl-entry-key-${account.account}`}>
                      <SCell>{account.account}</SCell>
                      <SCell wrap>{account.name ?? "—"}</SCell>
                      <SCell align="right">{num(account.net)}</SCell>
                      <SCell align="right">{num(account.gross)}</SCell>
                      <SCell align="right">{num(account.postings)}</SCell>
                      <SCell align="right">{num(account.entries)}</SCell>
                    </SRow>
                  ))}
                </tbody>
              </SheetTable>

              <SheetNote testId="gl-entry-note">
                {entry.hiddenAccounts > 0
                  ? T(
                      `The totals row covers the ${entry.counterpartAccounts.length} counterpart accounts shown; ${entry.hiddenAccounts} further counterpart accounts fall outside the chosen limit and are not in the grid. Click any amount to read the lines behind it.`,
                      `La ligne de total porte sur les ${entry.counterpartAccounts.length} comptes de contrepartie affichés ; ${entry.hiddenAccounts} autres comptes de contrepartie sortent de la limite retenue et ne figurent pas dans la grille. Cliquer sur un montant pour lire les lignes correspondantes.`,
                    )
                  : T(
                      "Every counterpart account of the linked entries is shown. Click any amount to read the lines behind it.",
                      "Tous les comptes de contrepartie des écritures rattachées sont affichés. Cliquer sur un montant pour lire les lignes correspondantes.",
                    )}
              </SheetNote>
            </>
          )}
        </>
      ) : null}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// C2. Two-account correlation: months across, three rows.

function CorrelationView({
  fr, selected, corr, pending, error, swapped, onSwap, monthLabel, onCell,
}: {
  fr: boolean;
  selected: string[];
  corr: TwoAccountCorrelation | null;
  pending: boolean;
  error: string | null;
  swapped: boolean;
  onSwap: () => void;
  monthLabel: (m: string) => string;
  onCell: (month: string, account: string, other: string) => void;
}) {
  const T = (en: string, frText: string) => (fr ? frText : en);

  const strength = (r: number | null): string => {
    if (r === null) return T("not computable — one series has no variation", "non calculable — une série est constante");
    const a = Math.abs(r);
    const s = a >= 0.7 ? T("strong", "forte") : a >= 0.4 ? T("moderate", "modérée") : T("weak", "faible");
    const sign = r >= 0 ? T("positive", "positive") : T("negative", "négative");
    return fr ? `corrélation ${s} ${sign}` : `${s} ${sign} correlation`;
  };

  if (selected.length !== 2) {
    return (
      <Sheet title={T("Two-account correlation", "Corrélation entre deux comptes")} testId="gl-correlate-view">
        <SheetNote testId="gl-correlate-needs-two">
          {T(
            "Select exactly two accounts to calculate the two-account monthly correlation.",
            "Sélectionner exactement deux comptes pour calculer la corrélation mensuelle entre deux comptes.",
          )}
        </SheetNote>
        <SheetNote>
          {T(
            `${selected.length} account(s) currently selected.`,
            `${selected.length} compte(s) actuellement sélectionné(s).`,
          )}
        </SheetNote>
      </Sheet>
    );
  }

  const totalRatio =
    corr && corr.totalB !== 0 ? Math.round((corr.totalA / corr.totalB) * 10000) / 10000 : null;

  const cols: SheetCol[] = [
    { label: T("Measure", "Mesure"), width: 240 },
    ...(corr?.months ?? []).map((m) => ({ label: monthLabel(m.month), align: "right" as const, width: 120 })),
    { label: T("Total", "Total"), align: "right" as const, width: 130 },
  ];

  return (
    <Sheet
      title={T("Two-account correlation", "Corrélation entre deux comptes")}
      subtitle={corr ? `${corr.a} ÷ ${corr.b}` : undefined}
      objective={T(
        "Restricted to the journal entries where both accounts actually meet. The ratio row is the first account divided by the second, expressed as a percentage with its sign preserved; it is blank when the denominator is nil, never infinite. The ratio is NOT a Pearson coefficient — the Pearson statistics are reported separately below. Correlation does not imply causation, and none of these figures is evidence of misstatement.",
        "Restreint aux écritures où les deux comptes se rencontrent effectivement. La ligne de ratio est le premier compte divisé par le second, exprimé en pourcentage avec conservation du signe ; elle est vide lorsque le dénominateur est nul, jamais infinie. Le ratio N'EST PAS un coefficient de Pearson — les statistiques de Pearson sont présentées séparément ci-dessous. La corrélation n'implique pas la causalité, et aucun de ces chiffres ne constitue une preuve d'anomalie.",
      )}
      testId="gl-correlate-view"
    >
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={onSwap} className={btn} data-testid="gl-correlate-swap">
          {T("Swap numerator and denominator", "Inverser numérateur et dénominateur")}
        </button>
        <span className="text-[11.5px] text-ink-soft" data-testid="gl-correlate-direction">
          {corr
            ? T(`Ratio direction: ${corr.a} ÷ ${corr.b}`, `Sens du ratio : ${corr.a} ÷ ${corr.b}`)
            : T(`Ratio direction: ${swapped ? selected[1] : selected[0]} ÷ ${swapped ? selected[0] : selected[1]}`,
                `Sens du ratio : ${swapped ? selected[1] : selected[0]} ÷ ${swapped ? selected[0] : selected[1]}`)}
        </span>
      </div>

      {pending ? (
        <SheetNote testId="gl-correlate-pending">{T("Computing…", "Calcul en cours…")}</SheetNote>
      ) : error ? (
        <SheetNote testId="gl-correlate-error">{error}</SheetNote>
      ) : corr ? (
        <>
          {corr.months.length === 0 ? (
            <SheetNote testId="gl-correlate-no-common">
              {T(
                "These two accounts never appear in the same journal entry, so there is nothing to correlate.",
                "Ces deux comptes n'apparaissent jamais dans la même écriture : il n'y a rien à corréler.",
              )}
            </SheetNote>
          ) : (
            <SheetTable cols={cols} testId="gl-correlate-grid">
              <tbody>
                <SRow n={1} testId="gl-correlate-row-a">
                  <SCell wrap>{T(`Account ${corr.a} — monthly signed total`, `Compte ${corr.a} — total mensuel signé`)}</SCell>
                  {corr.months.map((m) => (
                    <SCell key={m.month} align="right" testId={`gl-correlate-a-${tid(m.month)}`}>
                      <button
                        type="button"
                        onClick={() => onCell(m.month, corr.a, corr.b)}
                        className="underline decoration-dotted underline-offset-2"
                        data-testid={`gl-correlate-drill-a-${tid(m.month)}`}
                        aria-label={fr ? `Détail des lignes : compte ${corr.a}, ${monthLabel(m.month)}` : `Drill down: account ${corr.a}, ${monthLabel(m.month)}`}
                      >
                        {num(m.aTotal)}
                      </button>
                    </SCell>
                  ))}
                  <SCell align="right" kind="calc">{num(corr.totalA)}</SCell>
                </SRow>
                <SRow n={2} testId="gl-correlate-row-b">
                  <SCell wrap>{T(`Account ${corr.b} — monthly signed total`, `Compte ${corr.b} — total mensuel signé`)}</SCell>
                  {corr.months.map((m) => (
                    <SCell key={m.month} align="right" testId={`gl-correlate-b-${tid(m.month)}`}>
                      <button
                        type="button"
                        onClick={() => onCell(m.month, corr.b, corr.a)}
                        className="underline decoration-dotted underline-offset-2"
                        data-testid={`gl-correlate-drill-b-${tid(m.month)}`}
                        aria-label={fr ? `Détail des lignes : compte ${corr.b}, ${monthLabel(m.month)}` : `Drill down: account ${corr.b}, ${monthLabel(m.month)}`}
                      >
                        {num(m.bTotal)}
                      </button>
                    </SCell>
                  ))}
                  <SCell align="right" kind="calc">{num(corr.totalB)}</SCell>
                </SRow>
                <SRow n={3} total testId="gl-correlate-row-ratio">
                  <SCell wrap kind="calc">{T(`${corr.a} ÷ ${corr.b} (ratio, %)`, `${corr.a} ÷ ${corr.b} (ratio, %)`)}</SCell>
                  {corr.months.map((m) => (
                    <SCell key={m.month} align="right" kind="calc" testId={`gl-correlate-ratio-${tid(m.month)}`}>
                      {m.ratio === null ? "N/A" : num(m.ratio * 100, { digits: 1, suffix: "%" })}
                    </SCell>
                  ))}
                  <SCell align="right" kind="calc">
                    {totalRatio === null ? "N/A" : num(totalRatio * 100, { digits: 1, suffix: "%" })}
                  </SCell>
                </SRow>
              </tbody>
            </SheetTable>
          )}

          <SheetNote testId="gl-correlate-ratio-note">
            {T(
              "N/A means the denominator was nil for that month: a ratio was not computed rather than reported as infinite. The ratio row above is a simple division — it is not a correlation coefficient.",
              "N/A signifie que le dénominateur était nul pour ce mois : aucun ratio n'a été calculé plutôt que d'afficher une valeur infinie. La ligne de ratio ci-dessus est une simple division — ce n'est pas un coefficient de corrélation.",
            )}
          </SheetNote>

          {/* the statistics, clearly separated from the ratio */}
          <SheetTable
            cols={[
              { label: T("Statistic", "Statistique"), width: 320 },
              { label: T("Value", "Valeur"), align: "right", width: 160 },
              { label: T("Reading", "Lecture"), width: 420 },
            ]}
            testId="gl-correlate-stats"
          >
            <tbody>
              <SRow n={1} testId="gl-correlate-pearson">
                <SCell wrap>{T("Pearson correlation on monthly signed totals", "Corrélation de Pearson sur les totaux mensuels signés")}</SCell>
                <SCell align="right" kind="calc">{corr.pearson === null ? "N/A" : num(corr.pearson, { digits: 4, minDigits: 4 })}</SCell>
                <SCell wrap>{strength(corr.pearson)}</SCell>
              </SRow>
              <SRow n={2} testId="gl-correlate-pearson-abs">
                <SCell wrap>{T("Pearson correlation on absolute monthly totals", "Corrélation de Pearson sur les totaux mensuels en valeur absolue")}</SCell>
                <SCell align="right" kind="calc">{corr.pearsonAbs === null ? "N/A" : num(corr.pearsonAbs, { digits: 4, minDigits: 4 })}</SCell>
                <SCell wrap>{strength(corr.pearsonAbs)}</SCell>
              </SRow>
              <SRow n={3} testId="gl-correlate-common-entries">
                <SCell wrap>{T("Journal entries containing both accounts", "Écritures contenant les deux comptes")}</SCell>
                <SCell align="right" kind="calc">{num(corr.commonEntries)}</SCell>
                <SCell wrap>{T("the population the correlation is computed over", "la population sur laquelle la corrélation est calculée")}</SCell>
              </SRow>
              <SRow n={4} testId="gl-correlate-months">
                <SCell wrap>{T("Months with common activity", "Mois avec activité commune")}</SCell>
                <SCell align="right" kind="calc">{num(corr.monthsWithActivity)}</SCell>
                <SCell wrap>{T("months in which at least one of the two accounts moved", "mois durant lesquels au moins l'un des deux comptes a bougé")}</SCell>
              </SRow>
              <SRow n={5} testId="gl-correlate-total-a">
                <SCell wrap>{T(`Total for account ${corr.a}`, `Total du compte ${corr.a}`)}</SCell>
                <SCell align="right" kind="calc">{num(corr.totalA)}</SCell>
                <SCell wrap>{T("signed: debits positive, credits negative", "signé : débits positifs, crédits négatifs")}</SCell>
              </SRow>
              <SRow n={6} testId="gl-correlate-total-b">
                <SCell wrap>{T(`Total for account ${corr.b}`, `Total du compte ${corr.b}`)}</SCell>
                <SCell align="right" kind="calc">{num(corr.totalB)}</SCell>
                <SCell wrap>{T("signed: debits positive, credits negative", "signé : débits positifs, crédits négatifs")}</SCell>
              </SRow>
              <SRow n={7} testId="gl-correlate-largest-diff">
                <SCell wrap>{T("Largest monthly difference", "Écart mensuel le plus important")}</SCell>
                <SCell align="right" kind="calc">{num(corr.largestDifference)}</SCell>
                <SCell wrap>
                  {corr.largestDifferenceMonth
                    ? T(`in ${monthLabel(corr.largestDifferenceMonth)}`, `en ${monthLabel(corr.largestDifferenceMonth)}`)
                    : T("no month carried a difference", "aucun mois ne présente d'écart")}
                </SCell>
              </SRow>
            </tbody>
          </SheetTable>

          <SheetNote testId="gl-correlate-caveat">
            {T(
              "The ratio row and the Pearson coefficients measure different things: the ratio is the relative size of one account against the other in a given month, the Pearson coefficient is how closely the two monthly series move together. Neither is a Pearson-based conclusion about the other. Correlation does not imply causation, and a high or low value is a risk indicator requiring audit consideration — not a misstatement, an error or a finding.",
              "La ligne de ratio et les coefficients de Pearson mesurent des choses différentes : le ratio est la taille relative d'un compte par rapport à l'autre sur un mois donné, le coefficient de Pearson mesure la façon dont les deux séries mensuelles évoluent ensemble. Ni l'un ni l'autre ne conclut sur l'autre. La corrélation n'implique pas la causalité, et une valeur élevée ou faible est un indicateur de risque à examiner — non une anomalie, une erreur ou un constat.",
            )}
          </SheetNote>
        </>
      ) : null}
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// C3. Analytics: the catalogue of thirty, and one result at a time.

function AnalyticsView({
  fr, catalogue, activeKey, onRun, result, pending, error, monthLabel, onMonth,
}: {
  fr: boolean;
  catalogue: CatalogueEntry[];
  activeKey: string | null;
  onRun: (key: string) => void;
  result: AnalyticResult | null;
  pending: boolean;
  error: string | null;
  monthLabel: (m: string) => string;
  /** drill into the transactions behind one grouped (month) row */
  onMonth: (month: string, title: string) => void;
}) {
  const T = (en: string, frText: string) => (fr ? frText : en);
  const active = catalogue.find((c) => c.key === activeKey) ?? null;
  const exceptionPct =
    result && result.population > 0 ? (result.exceptions / result.population) * 100 : null;

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,460px)_minmax(0,1fr)]">
      <Sheet
        title={T("Analytics catalogue", "Catalogue des analyses")}
        subtitle={T(`${catalogue.length} declared`, `${catalogue.length} déclarées`)}
        objective={T(
          "The complete suite, with an honest status against this import. Choose one to run it.",
          "La suite complète, avec un état honnête au regard de cet import. En choisir une pour l'exécuter.",
        )}
        testId="gl-analytics-catalogue"
      >
        <SheetTable
          cols={[
            { label: T("No.", "N°"), align: "right", width: 46 },
            { label: T("Title", "Intitulé"), width: 240 },
            { label: T("Category", "Catégorie"), width: 120 },
            { label: T("Status", "État"), width: 200 },
          ]}
          testId="gl-analytics-list"
        >
          <tbody>
            {catalogue.map((item, i) => (
              <SRow key={item.key} n={i + 1} testId={`gl-analytic-row-${item.key}`}>
                <SCell align="right">{item.id}</SCell>
                <SCell wrap>
                  <button
                    type="button"
                    onClick={() => onRun(item.key)}
                    aria-pressed={activeKey === item.key}
                    className={`text-left underline decoration-dotted underline-offset-2 ${activeKey === item.key ? "font-bold" : ""}`}
                    data-testid={`gl-analytic-run-${item.key}`}
                  >
                    {activeKey === item.key ? "▸ " : ""}{item.title}
                  </button>
                </SCell>
                <SCell wrap>{fr ? CATEGORY[item.category].fr : CATEGORY[item.category].en}</SCell>
                <SCell wrap kind="calc">
                  {item.unavailable ? `✕ ${item.unavailable}` : `✓ ${T("Available", "Disponible")}`}
                </SCell>
              </SRow>
            ))}
            {catalogue.length === 0 ? (
              <SRow n={1} testId="gl-analytics-list-empty">
                <SCell colSpan={4} wrap>{T("The catalogue could not be loaded.", "Le catalogue n'a pas pu être chargé.")}</SCell>
              </SRow>
            ) : null}
          </tbody>
        </SheetTable>
      </Sheet>

      <Sheet
        title={
          active
            ? T(`Analytic ${active.id} — ${active.title}`, `Analyse ${active.id} — ${active.title}`)
            : T("No analytic selected", "Aucune analyse sélectionnée")
        }
        subtitle={active ? (fr ? CATEGORY[active.category].fr : CATEGORY[active.category].en) : undefined}
        objective={active?.objective}
        testId="gl-analytic-detail"
      >
        {!active ? (
          <SheetNote testId="gl-analytic-none">
            {T("Choose an analytic in the catalogue to run it.", "Choisir une analyse dans le catalogue pour l'exécuter.")}
          </SheetNote>
        ) : (
          <>
            <SheetTable
              cols={[
                { label: T("Attribute", "Attribut"), width: 200 },
                { label: T("Value", "Valeur"), width: 560 },
              ]}
              testId="gl-analytic-meta"
            >
              <tbody>
                <SRow n={1}>
                  <SCell>{T("Analytic number", "Numéro de l'analyse")}</SCell>
                  <SCell>{active.id}</SCell>
                </SRow>
                <SRow n={2}>
                  <SCell>{T("Category", "Catégorie")}</SCell>
                  <SCell wrap>{fr ? CATEGORY[active.category].fr : CATEGORY[active.category].en}</SCell>
                </SRow>
                <SRow n={3}>
                  <SCell>{T("Assertions", "Assertions")}</SCell>
                  <SCell wrap>{active.assertions.join(", ")}</SCell>
                </SRow>
                <SRow n={4}>
                  <SCell>{T("Required fields", "Champs requis")}</SCell>
                  <SCell wrap>{active.requiredFields.join(", ")}</SCell>
                </SRow>
                <SRow n={5}>
                  <SCell>{T("Exception definition", "Définition de l'exception")}</SCell>
                  <SCell wrap>{active.exception}</SCell>
                </SRow>
                <SRow n={6}>
                  <SCell kind="calc">{T("Exceptions", "Exceptions")}</SCell>
                  <SCell kind="calc">{result ? num(result.exceptions) : "—"}</SCell>
                </SRow>
                <SRow n={7} total>
                  <SCell kind="calc">{T("Exception rate", "Taux d'exception")}</SCell>
                  <SCell kind="calc">
                    {result
                      ? exceptionPct === null
                        ? T("no population", "population nulle")
                        : <>{num(exceptionPct, { digits: 2, suffix: "%" })} {T(`of ${result.population}`, `sur ${result.population}`)}</>
                      : "—"}
                  </SCell>
                </SRow>
              </tbody>
            </SheetTable>

            {pending ? (
              <SheetNote testId="gl-analytic-pending">{T("Running…", "Exécution en cours…")}</SheetNote>
            ) : error ? (
              <SheetNote testId="gl-analytic-error">{error}</SheetNote>
            ) : result?.unavailable ? (
              <SheetNote testId="gl-analytic-unavailable">{result.unavailable}</SheetNote>
            ) : result ? (
              <>
                <SheetTable
                  cols={[
                    { label: T("Month", "Mois"), width: 110 },
                    ...result.columns.map((c) => ({ label: c.label, align: "right" as const, width: 130 })),
                  ]}
                  testId="gl-analytic-table"
                >
                  <tbody>
                    {result.rows.map((row, i) => (
                      <SRow key={`${row.month}-${i}`} n={i + 1} testId={`gl-analytic-month-${tid(row.month)}`}>
                        <SCell>
                          <button
                            type="button"
                            onClick={() => onMonth(row.month, result.title)}
                            title={T("Show the transactions behind this row", "Voir les transactions derrière cette ligne")}
                            className="cursor-pointer underline decoration-dotted underline-offset-2 hover:text-emerald-700"
                            data-testid={`gl-analytic-drill-${tid(row.month)}`}
                          >
                            {monthLabel(row.month)}
                          </button>
                        </SCell>
                        {result.columns.map((c, j) => {
                          const value = row.cells[j];
                          return (
                            <SCell key={c.key} align="right" wrap={typeof value === "string"}>
                              {typeof value === "number" ? num(value, { digits: 2 }) : value ?? "—"}
                            </SCell>
                          );
                        })}
                      </SRow>
                    ))}
                    {result.totals ? (
                      <SRow n={result.rows.length + 1} total testId="gl-analytic-totals">
                        <SCell kind="calc">{T("Total", "Total")}</SCell>
                        {result.columns.map((c, j) => {
                          const value = result.totals?.[j];
                          return (
                            <SCell key={c.key} align="right" kind="calc" wrap={typeof value === "string"}>
                              {typeof value === "number" ? num(value, { digits: 2 }) : value ?? "—"}
                            </SCell>
                          );
                        })}
                      </SRow>
                    ) : null}
                    {result.rows.length === 0 ? (
                      <SRow n={1} testId="gl-analytic-no-rows">
                        <SCell colSpan={result.columns.length + 1} wrap>
                          {T("The analytic returned no month — nothing in the ledger met its population.", "L'analyse ne renvoie aucun mois — rien dans le grand livre ne constitue sa population.")}
                        </SCell>
                      </SRow>
                    ) : null}
                  </tbody>
                </SheetTable>

                {result.note ? <SheetNote testId="gl-analytic-note">{result.note}</SheetNote> : null}
                <SheetNote testId="gl-analytic-guidance">
                  {T(
                    "How to read this: an exception is a line or entry meeting the definition above. It is a risk indicator requiring audit consideration — not a misstatement, an error or a finding. Corroborate each exception against the underlying document before drawing any conclusion, and record the conclusion in the working paper, not here.",
                    "Lecture : une exception est une ligne ou une écriture répondant à la définition ci-dessus. Il s'agit d'un indicateur de risque à examiner — non d'une anomalie, d'une erreur ou d'un constat. Corroborer chaque exception avec la pièce justificative avant toute conclusion, et consigner la conclusion dans le papier de travail, pas ici.",
                  )}
                </SheetNote>
              </>
            ) : (
              <SheetNote testId="gl-analytic-idle">
                {T("Running…", "Exécution en cours…")}
              </SheetNote>
            )}
          </>
        )}
      </Sheet>
    </div>
  );
}

// ---------------------------------------------------------------------------
// D. Drill-down: the lines behind one cell, paginated and capped.

function DrillPanel({
  fr, label, result, pending, error, offset, page, onPage, onClose,
}: {
  fr: boolean;
  label: string;
  result: DrillResult | null;
  pending: boolean;
  error: string | null;
  offset: number;
  page: number;
  onPage: (next: number) => void;
  onClose: () => void;
}) {
  const T = (en: string, frText: string) => (fr ? frText : en);
  const total = result?.total ?? 0;
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + (result?.lines.length ?? 0), total);

  const cols: SheetCol[] = [
    { label: T("Line", "Ligne"), align: "right", width: 70 },
    { label: T("Account", "Compte"), width: 100 },
    { label: T("Account name", "Intitulé"), width: 200 },
    { label: T("JE number", "N° écriture"), width: 120 },
    { label: T("Journal code", "Code journal"), width: 110 },
    { label: T("Journal date", "Date journal"), width: 110 },
    { label: T("Entry date", "Date de saisie"), width: 110 },
    { label: T("Reference", "Référence"), width: 130 },
    { label: T("Description", "Libellé"), width: 260 },
    { label: T("Third-party code", "Code tiers"), width: 110 },
    { label: T("Third-party name", "Nom du tiers"), width: 180 },
    { label: T("Prepared by", "Préparé par"), width: 130 },
    { label: T("Reviewer", "Réviseur"), width: 130 },
    { label: T("Debit", "Débit"), align: "right", width: 120 },
    { label: T("Credit", "Crédit"), align: "right", width: 120 },
    { label: T("Signed", "Signé"), align: "right", width: 120 },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
      onClick={onClose}
      data-testid="gl-drill-overlay"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gl-drill-title"
        className="max-h-[88vh] w-full max-w-[1200px] overflow-y-auto rounded-[var(--radius-atlas)] bg-surface p-3 shadow-atlas"
        onClick={(event) => event.stopPropagation()}
        data-testid="gl-drill-panel"
      >
        <div className="mb-2 flex items-start justify-between gap-3">
          <h2 id="gl-drill-title" className="text-[13.5px] font-bold text-ink">
            {T("Lines behind the selected cell", "Lignes derrière la cellule sélectionnée")}
            <span className="ml-2 text-[11.5px] font-semibold text-muted" data-testid="gl-drill-source">
              {label}
            </span>
          </h2>
          <button
            type="button"
            autoFocus
            onClick={onClose}
            aria-label={T("Close the drill-down", "Fermer le détail")}
            className={btn}
            data-testid="gl-drill-close"
          >
            {T("Close", "Fermer")}
          </button>
        </div>

        <Sheet
          title={T("Drill-down", "Détail des lignes")}
          subtitle={
            pending
              ? T("Loading…", "Chargement…")
              : T(`Lines ${from}–${to} of ${total}`, `Lignes ${from}–${to} sur ${total}`)
          }
          testId="gl-drill-sheet"
        >
          {error ? (
            <SheetNote testId="gl-drill-error">{error}</SheetNote>
          ) : (
            <>
              <SheetTable cols={cols} testId="gl-drill-table">
                <tbody>
                  {(result?.lines ?? []).map((line, i) => (
                    <SRow key={line.lineNo} n={offset + i + 1} testId={`gl-drill-line-${line.lineNo}`}>
                      <SCell align="right">{line.lineNo}</SCell>
                      <SCell>{line.account}</SCell>
                      <SCell wrap>{line.accountName ?? "—"}</SCell>
                      <SCell>{line.jeNumber}</SCell>
                      <SCell>{line.journalCode ?? "—"}</SCell>
                      <SCell>{line.journalDate ?? "—"}</SCell>
                      <SCell>{line.entryDate ?? "—"}</SCell>
                      <SCell>{line.reference ?? "—"}</SCell>
                      <SCell wrap>{line.lineDescription ?? "—"}</SCell>
                      <SCell>{line.thirdPartyCode ?? "—"}</SCell>
                      <SCell wrap>{line.thirdPartyName ?? "—"}</SCell>
                      <SCell wrap>{line.preparer ?? "—"}</SCell>
                      <SCell wrap>{line.reviewer ?? "—"}</SCell>
                      <SCell align="right">{num(line.debit)}</SCell>
                      <SCell align="right">{num(line.credit)}</SCell>
                      <SCell align="right" kind="calc">{num(line.signed)}</SCell>
                    </SRow>
                  ))}
                  {!pending && (result?.lines.length ?? 0) === 0 ? (
                    <SRow n={1} testId="gl-drill-empty">
                      <SCell colSpan={cols.length} wrap>
                        {T("No line matches this cell.", "Aucune ligne ne correspond à cette cellule.")}
                      </SCell>
                    </SRow>
                  ) : null}
                </tbody>
              </SheetTable>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => onPage(Math.max(0, offset - page))}
                  disabled={offset === 0 || pending}
                  className={btn}
                  data-testid="gl-drill-prev"
                >
                  {T("Previous page", "Page précédente")}
                </button>
                <button
                  type="button"
                  onClick={() => onPage(offset + page)}
                  disabled={to >= total || pending}
                  className={btn}
                  data-testid="gl-drill-next"
                >
                  {T("Next page", "Page suivante")}
                </button>
                <span className="text-[11.5px] text-ink-soft" data-testid="gl-drill-count">
                  {T(
                    `${page} lines per page; the drill-down never loads the whole ledger.`,
                    `${page} lignes par page ; le détail ne charge jamais l'intégralité du grand livre.`,
                  )}
                </span>
              </div>
            </>
          )}
        </Sheet>
      </div>
    </div>
  );
}
