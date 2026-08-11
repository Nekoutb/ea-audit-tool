import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { clearFindingAction, setCorrectedAction } from "@/app/actions/execution";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { Panel, PanelHeader, Chip } from "@/components/ui/atlas";
import { getEngagement } from "@/lib/engagements";
import { evaluateB5, listFindings } from "@/lib/execution";
import { formatFCFA, getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "Findings · AuditISA" };

export default async function FindingsPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const tf = t.planning.findings;

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const [findings, b5] = await Promise.all([listFindings(id), evaluateB5(id)]);

  const btn =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-2.5 py-1 text-xs font-medium text-ink-soft hover:bg-surface-2";
  const input =
    "rounded-[var(--radius-atlas-sm)] border border-line-strong bg-surface px-3 py-2 text-xs text-ink outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20";

  const renderFindings = (route: "b4" | "c1", title: string) => {
    const list = findings.filter((finding) => finding.route === route);
    return (
      <Panel className="mt-6">
        <PanelHeader title={title} />
        {list.length === 0 ? (
          <p className="mt-2 text-sm text-muted">{tf.empty}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2" data-testid={`${route}-list`}>
            {list.map((finding) => (
              <li
                key={finding.id}
                className="rounded-[var(--radius-atlas)] border border-line bg-surface-2 p-3 text-sm"
              >
                <p className="text-ink">
                  {finding.title}
                  {finding.sectionCode ? (
                    <span className="ml-2 font-mono text-xs text-muted">[{finding.sectionCode}]</span>
                  ) : null}
                  <span className="ml-2 inline-flex align-middle">
                    <Chip tone={finding.status === "open" ? "warn" : "good"}>
                      {finding.status === "open" ? tf.openLabel : tf.clearedLabel}
                    </Chip>
                  </span>
                </p>
                {finding.detail ? <p className="mt-1 text-ink-soft">{finding.detail}</p> : null}
                {finding.response ? (
                  <p className="mt-1 text-xs text-muted">{tf.response}: {finding.response}</p>
                ) : null}
                {finding.status === "open" ? (
                  <form
                    action={clearFindingAction.bind(null, id, finding.id)}
                    className="mt-2 flex flex-wrap items-center gap-2"
                  >
                    <input name="response" required placeholder={tf.response} className={input} />
                    <button type="submit" className={btn} data-testid={`clear-finding-${finding.id}`}>
                      {tf.clear}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    );
  };

  return (
    <main className="min-h-screen w-full px-6 py-8">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-5 flex items-center gap-3">
        <Link
          href={`/engagements/${id}/tools`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={locale === "fr" ? "Retour aux outils" : "Back to tools"}
          aria-label={locale === "fr" ? "Retour" : "Back"}
          data-testid="findings-back"
        >
          ←
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {tf.title}
        </h1>
      </div>
      <ErrorBanner error={error} locale={locale} />

      <Panel className="mt-6">
        <PanelHeader title={tf.b5} />
        <div className="mt-3 flex flex-wrap gap-4 text-sm" data-testid="b5-totals">
          <span>
            {tf.uncorrected}: <b className="tnum">{formatFCFA(b5.uncorrectedTotal)}</b>
          </span>
          <span>
            {tf.corrected}: <span className="tnum">{formatFCFA(b5.correctedTotal)}</span>
          </span>
          <span>
            {tf.vsMateriality}:{" "}
            <span className="tnum">
              {b5.finalMateriality !== null ? formatFCFA(b5.finalMateriality) : "—"}
            </span>
          </span>
          <span
            data-testid="b5-verdict"
            className={b5.exceedsMateriality ? "font-semibold text-rose" : "text-emerald-700 dark:text-emerald-400"}
          >
            {b5.exceedsMateriality ? tf.exceeds : tf.within}
          </span>
          {b5.trivialCount > 0 ? (
            <span className="text-muted tnum">
              {b5.trivialCount} {tf.trivialNote}
            </span>
          ) : null}
        </div>
        {b5.items.length > 0 ? (
          <div className="mt-3 overflow-x-auto rounded-[var(--radius-atlas)] border border-line">
            <table className="w-full text-sm" data-testid="b5-table">
              <thead className="bg-surface-2 text-left text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2">{tf.section}</th>
                  <th className="px-4 py-2">Description</th>
                  <th className="px-4 py-2 text-right">{tf.amountCol}</th>
                  <th className="px-4 py-2">{tf.typeCol}</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {b5.items.map((item) => (
                  <tr key={item.id} className={`border-t border-line ${item.trivial ? "opacity-50" : ""}`}>
                    <td className="px-4 py-2 font-mono text-xs tnum">{item.sectionCode ?? "—"}</td>
                    <td className="px-4 py-2 text-ink">
                      {item.description}
                      {item.accounts ? <span className="ml-1 text-xs text-muted">({item.accounts})</span> : null}
                      {item.trivial ? <span className="ml-1 text-xs text-muted">· trivial</span> : null}
                    </td>
                    <td className="px-4 py-2 text-right tnum">{formatFCFA(item.amount)}</td>
                    <td className="px-4 py-2 text-xs">{t.planning.execution.mtypes[item.mtype as keyof typeof t.planning.execution.mtypes]}</td>
                    <td className="px-4 py-2 text-right">
                      {!item.trivial ? (
                        <span className="inline-flex items-center gap-2">
                          {!item.corrected ? (
                            <Link
                              href={`/engagements/${id}/data?jdesc=${encodeURIComponent(`[B5] ${item.description}`.slice(0, 120))}&jamount=${Math.abs(item.amount)}#journal`}
                              className="text-xs font-medium text-emerald-700 hover:underline dark:text-emerald-400"
                              data-testid={`propose-adjustment-${item.id}`}
                            >
                              {t.planning.findings.proposeAdjustment}
                            </Link>
                          ) : null}
                          <form action={setCorrectedAction.bind(null, id, item.id, !item.corrected)}>
                            <button type="submit" className={btn} data-testid={`toggle-corrected-${item.id}`}>
                              {item.corrected ? tf.markUncorrected : tf.markCorrected}
                            </button>
                          </form>
                        </span>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </Panel>

      {renderFindings("b4", tf.b4)}
      {renderFindings("c1", tf.c1)}
    </main>
  );
}
