import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { approveMaterialityAction, createMaterialityAction } from "@/app/actions/planning";
import { AppNav } from "@/components/AppNav";
import { MaterialityBasis } from "@/components/MaterialityBasis";
import { ErrorBanner } from "@/components/GatesPanel";
import { Panel, PanelHeader } from "@/components/ui/atlas";
import { getEngagement } from "@/lib/engagements";
import { formatFCFA, getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { BENCHMARKS, BENCHMARK_RANGES, listMaterialityVersions, tbBenchmarkAmounts } from "@/lib/materiality";

export const metadata = { title: "Materiality · AuditISA" };

/**
 * The Materiality tool: trial-balance bases, one Generate, the current
 * thresholds in bold with their amounts, and partner approval. No version
 * management — generating again replaces the display; the justification lives
 * on the D5.1 working paper.
 */
export default async function MaterialityPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const tp = t.planning;
  const fr = locale === "fr";

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const [versions, tbBases] = await Promise.all([listMaterialityVersions(id), tbBenchmarkAmounts(id)]);
  const latest = versions[0] ?? null;
  const returnTo = `/engagements/${id}/tools/materiality`;

  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  return (
    <main className="min-h-screen w-full px-6 py-6">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-5 flex items-center gap-3">
        <Link
          href={`/engagements/${id}/tools`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={fr ? "Retour aux outils" : "Back to tools"}
          aria-label={fr ? "Retour" : "Back"}
          data-testid="materiality-back"
        >
          ←
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {fr ? "Seuil de signification" : "Materiality"}
        </h1>
      </div>
      <ErrorBanner error={error} locale={locale} />

      <Panel className="mt-4">
        <PanelHeader title={tp.materiality.title} />
        {tbBases ? (
          <MaterialityBasis locale={locale} bases={tbBases} />
        ) : (
          <p className="mt-3 text-[12.5px] text-muted" data-testid="materiality-no-tb">
            {fr
              ? "Aucune balance ingérée — importer la balance dans l'Analyseur de balance pour dériver les bases."
              : "No trial balance ingested yet — import one in the Trial Balance Analyzer to derive the bases."}
          </p>
        )}

        <form action={createMaterialityAction.bind(null, id)} className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-3 xl:grid-cols-6">
          <input type="hidden" name="returnTo" value={returnTo} />
          <label className="flex flex-col gap-1 text-[12.5px]">
            <span className="text-ink-soft">{tp.materiality.benchmark}</span>
            <select name="benchmark" className={input} data-testid="materiality-benchmark">
              {BENCHMARKS.map((benchmark) => (
                <option key={benchmark} value={benchmark}>
                  {tp.materiality.benchmarks[benchmark]} ({BENCHMARK_RANGES[benchmark].min}–{BENCHMARK_RANGES[benchmark].max} %)
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12.5px]">
            <span className="text-ink-soft">{tp.materiality.amount}</span>
            <input name="benchmarkAmount" type="number" min="1" required className={input} data-testid="materiality-amount" />
          </label>
          <label className="flex flex-col gap-1 text-[12.5px]">
            <span className="text-ink-soft">{tp.materiality.percentage}</span>
            <input name="percentage" type="number" step="0.1" min="0.1" max="100" required className={input} data-testid="materiality-pct" />
          </label>
          <label className="flex flex-col gap-1 text-[12.5px]">
            <span className="text-ink-soft">{tp.materiality.performancePct}</span>
            <input name="performancePct" type="number" min="60" max="85" defaultValue="75" className={input} />
          </label>
          <label className="flex flex-col gap-1 text-[12.5px]">
            <span className="text-ink-soft">{tp.materiality.trivialPct}</span>
            <input name="trivialPct" type="number" step="0.5" min="0.5" max="10" defaultValue="5" className={input} />
          </label>
          <div className="flex items-end">
            <button
              type="submit"
              className="rounded-[var(--radius-atlas-sm)] bg-emerald-700 px-4 py-1.5 text-[13px] font-semibold text-white hover:bg-emerald-800"
              data-testid="create-materiality"
            >
              {fr ? "Générer" : "Generate"}
            </button>
          </div>
        </form>

        {/* the current thresholds — names in bold, then the amounts */}
        {latest ? (
          <div className="mt-4 rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2/50 px-4 py-3" data-testid="materiality-current">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[13px]">
              <span className="text-muted">
                {fr ? "Base" : "Basis"}: <b className="text-ink">{tp.materiality.benchmarks[latest.benchmark]}</b> · {latest.percentage}%
              </span>
              <span className="text-muted">
                <b className="text-ink">{fr ? "Seuil global (PM)" : "Planning Materiality"}</b>:{" "}
                <span className="font-semibold text-ink tnum">{formatFCFA(latest.overall)}</span>
              </span>
              <span className="text-muted">
                <b className="text-ink">{fr ? "Seuil de travail (TE)" : "Tolerable Error"}</b>:{" "}
                <span className="font-semibold text-ink tnum">{formatFCFA(latest.performance)}</span>
              </span>
              <span className="text-muted">
                <b className="text-ink">{fr ? "Seuil SAD" : "SAD Nominal Amount"}</b>:{" "}
                <span className="font-semibold text-ink tnum">{formatFCFA(latest.trivial)}</span>
              </span>
              <span data-testid="materiality-status">
                {latest.status === "approved" ? (
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {fr ? "Approuvé" : "Approved"}
                    {latest.approvedByName ? ` — ${latest.approvedByName}` : ""}
                  </span>
                ) : (
                  <form action={approveMaterialityAction.bind(null, id, latest.versionNo)} className="inline">
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <button
                      type="submit"
                      className="rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-surface-2"
                      data-testid="approve-materiality"
                    >
                      {tp.materiality.approve}
                    </button>
                  </form>
                )}
              </span>
            </div>
          </div>
        ) : null}
      </Panel>
    </main>
  );
}
