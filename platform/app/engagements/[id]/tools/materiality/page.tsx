import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { approveMaterialityAction, createMaterialityAction } from "@/app/actions/planning";
import { AppNav } from "@/components/AppNav";
import { MaterialityBasis } from "@/components/MaterialityBasis";
import { MaterialityBenchmarkSelect } from "@/components/MaterialityBenchmarkSelect";
import { ErrorBanner } from "@/components/GatesPanel";
import { Chip, Panel, PanelHeader } from "@/components/ui/atlas";
import { getEngagement } from "@/lib/engagements";
import { formatFCFA, getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { BENCHMARKS, BENCHMARK_RANGES, PERFORMANCE_PCT_RANGE, TRIVIAL_PCT_RANGE, listMaterialityVersions, materialityDeviations, tbBenchmarkAmounts } from "@/lib/materiality";
import { canPartnerSignoff } from "@/lib/rbac";

export const metadata = { title: "Materiality · AuditISA" };

/**
 * The Materiality tool: trial-balance bases, one Generate, the current
 * thresholds in bold with their amounts, and partner approval. No version
 * management — generating again replaces the display; the justification lives
 * on the P6.1 working paper.
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
  // The version in force stays visible while a draft revision exists (UAT B49):
  // the SAD and P6.1 still run on it, and the tool used to show only the draft.
  const approved = versions.find((v) => v.status === "approved") ?? null;
  const draftPending = Boolean(latest && approved && latest.versionNo !== approved.versionNo);
  const isPartner = canPartnerSignoff(session.user.role);
  const deviation = latest ? materialityDeviations(latest, tbBases) : null;
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
            {/* switching the benchmark refills the amount and the suggested % (UAT B47) */}
            <MaterialityBenchmarkSelect
              className={input}
              bases={tbBases}
              options={BENCHMARKS.map((benchmark) => ({
                value: benchmark,
                label: `${tp.materiality.benchmarks[benchmark]} (${BENCHMARK_RANGES[benchmark].min}–${BENCHMARK_RANGES[benchmark].max} %)`,
              }))}
            />
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
            <input name="performancePct" type="number" min={PERFORMANCE_PCT_RANGE.min} max={PERFORMANCE_PCT_RANGE.max} defaultValue={PERFORMANCE_PCT_RANGE.default} className={input} />
          </label>
          <label className="flex flex-col gap-1 text-[12.5px]">
            <span className="text-ink-soft">{tp.materiality.trivialPct}</span>
            <input name="trivialPct" type="number" step="0.5" min={TRIVIAL_PCT_RANGE.min} max={TRIVIAL_PCT_RANGE.max} defaultValue={TRIVIAL_PCT_RANGE.default} className={input} />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-[12.5px] md:col-span-3 xl:col-span-2">
            <span className="text-ink-soft">{tp.materiality.performanceJustification}</span>
            <input name="performanceJustification" className={input} data-testid="materiality-te-justification" />
          </label>
          <label className="col-span-2 flex flex-col gap-1 text-[12.5px] md:col-span-3 xl:col-span-3">
            <span className="text-ink-soft">
              {fr
                ? "Justification d'un écart (pourcentage hors fourchette ou montant différent de la balance)"
                : "Justification for a deviation (percentage outside the range or amount away from the trial balance)"}
            </span>
            <input name="overrideJustification" className={input} data-testid="materiality-justification" />
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

        {/* the version in force, when a draft revision sits above it (UAT B49) */}
        {draftPending && approved ? (
          <div className="mt-4 rounded-[var(--radius-atlas-sm)] border border-emerald-600/40 bg-emerald-50 px-4 py-3 text-[13px] dark:bg-emerald-950/30" data-testid="materiality-in-force">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5">
              <Chip tone="good">{fr ? `En vigueur — v${approved.versionNo}` : `In force — v${approved.versionNo}`}</Chip>
              <span className="text-muted">
                {fr ? "Base" : "Basis"}: <b className="text-ink">{tp.materiality.benchmarks[approved.benchmark]}</b> · {approved.percentage}%
              </span>
              <span className="text-muted">PM: <b className="text-ink tnum">{formatFCFA(approved.overall)}</b></span>
              <span className="text-muted">TE: <b className="text-ink tnum">{formatFCFA(approved.performance)}</b></span>
              <span className="text-muted">SAD: <b className="text-ink tnum">{formatFCFA(approved.trivial)}</b></span>
              <span className="text-muted">{approved.approvedByName ? `${fr ? "Approuvé par" : "Approved by"} ${approved.approvedByName}` : ""}</span>
            </div>
            <p className="mt-1 text-[12px] text-muted">
              {fr
                ? `Le brouillon v${latest?.versionNo} ci-dessous ne s'applique qu'une fois approuvé par l'associé ; jusque-là les papiers et le SAD utilisent la v${approved.versionNo}.`
                : `Draft v${latest?.versionNo} below applies only once the partner approves it; until then the papers and the SAD use v${approved.versionNo}.`}
            </p>
          </div>
        ) : null}

        {/* the current thresholds — names in bold, then the amounts */}
        {latest ? (
          <div className="mt-4 rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2/50 px-4 py-3" data-testid="materiality-current">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-[13px]">
              {latest.status !== "approved" ? (
                <Chip tone="warn">{fr ? `Brouillon — v${latest.versionNo}` : `Draft — v${latest.versionNo}`}</Chip>
              ) : (
                <Chip tone="good">v{latest.versionNo}</Chip>
              )}
              <span className="text-muted">
                {fr ? "Base" : "Basis"}: <b className="text-ink">{tp.materiality.benchmarks[latest.benchmark]}</b> · {latest.percentage}%
              </span>
              {deviation?.outOfRange ? (
                <span data-testid="materiality-deviation-pct">
                  <Chip tone="warn">
                    {fr
                      ? `Hors fourchette ${BENCHMARK_RANGES[latest.benchmark].min}–${BENCHMARK_RANGES[latest.benchmark].max} %`
                      : `Outside the ${BENCHMARK_RANGES[latest.benchmark].min}–${BENCHMARK_RANGES[latest.benchmark].max} % range`}
                  </Chip>
                </span>
              ) : null}
              {deviation?.basisMismatch ? (
                <span data-testid="materiality-deviation-basis">
                  <Chip tone="warn">
                    {fr ? "Montant différent de la base issue de la balance" : "Amount differs from the trial-balance base"}
                  </Chip>
                </span>
              ) : null}
              <span className="text-muted">
                <b className="text-ink">{fr ? "Seuil global (PM)" : "Planning Materiality"}</b>:{" "}
                <span className="font-semibold text-ink tnum">{formatFCFA(latest.overall)}</span>{" "}
                <span className="tnum">({latest.percentage}% {fr ? "de la base" : "of basis"})</span>
              </span>
              <span className="text-muted">
                <b className="text-ink">{fr ? "Seuil de travail (TE)" : "Tolerable Error"}</b>:{" "}
                <span className="font-semibold text-ink tnum">{formatFCFA(latest.performance)}</span>{" "}
                <span className="tnum">({latest.performancePct}% {fr ? "de PM" : "of PM"} · {latest.benchmarkAmount > 0 ? ((latest.performance / latest.benchmarkAmount) * 100).toFixed(2) : "—"}% {fr ? "de la base" : "of basis"})</span>
              </span>
              <span className="text-muted">
                <b className="text-ink">{fr ? "SAD nominal" : "SAD Nominal"}</b>:{" "}
                <span className="font-semibold text-ink tnum">{formatFCFA(latest.trivial)}</span>{" "}
                <span className="tnum">({latest.trivialPct}% {fr ? "de PM" : "of PM"} · {latest.benchmarkAmount > 0 ? ((latest.trivial / latest.benchmarkAmount) * 100).toFixed(2) : "—"}% {fr ? "de la base" : "of basis"})</span>
              </span>
              <span data-testid="materiality-status">
                {latest.status === "approved" ? (
                  <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                    {fr ? "Approuvé" : "Approved"}
                    {latest.approvedByName ? ` — ${latest.approvedByName}` : ""}
                  </span>
                ) : isPartner ? (
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
                ) : (
                  // no button to press and be refused below partner (UAT B129)
                  <span className="text-xs text-muted" data-testid="approve-materiality-partner-only">
                    {fr ? "En attente de l'approbation de l'associé" : "Awaiting partner approval"}
                  </span>
                )}
              </span>
            </div>
          </div>
        ) : null}

        {/* every version, so a reviewer sees what moved and when (UAT B49) */}
        {versions.length > 1 ? (
          <div className="mt-4 overflow-x-auto rounded-[var(--radius-atlas-sm)] border border-line" data-testid="materiality-history">
            <table className="w-full text-[12.5px]">
              <thead className="bg-surface-2 text-left text-[10.5px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-3 py-2">v</th>
                  <th className="px-3 py-2">{fr ? "Base" : "Basis"}</th>
                  <th className="px-3 py-2 text-right">%</th>
                  <th className="px-3 py-2 text-right">PM</th>
                  <th className="px-3 py-2 text-right">TE</th>
                  <th className="px-3 py-2 text-right">SAD</th>
                  <th className="px-3 py-2">{fr ? "Statut" : "Status"}</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((v) => (
                  <tr key={v.id} className="border-t border-line" data-testid={`materiality-version-${v.versionNo}`}>
                    <td className="px-3 py-1.5 font-mono tnum">v{v.versionNo}</td>
                    <td className="px-3 py-1.5">{tp.materiality.benchmarks[v.benchmark]}</td>
                    <td className="px-3 py-1.5 text-right tnum">{v.percentage}</td>
                    <td className="px-3 py-1.5 text-right tnum">{formatFCFA(v.overall)}</td>
                    <td className="px-3 py-1.5 text-right tnum">{formatFCFA(v.performance)}</td>
                    <td className="px-3 py-1.5 text-right tnum">{formatFCFA(v.trivial)}</td>
                    <td className="px-3 py-1.5">
                      {v.status === "approved"
                        ? `${fr ? "Approuvée" : "Approved"}${v.approvedByName ? ` — ${v.approvedByName}` : ""}`
                        : v.status === "superseded"
                          ? fr ? "Remplacée" : "Superseded"
                          : fr ? "Brouillon" : "Draft"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>
    </main>
  );
}
