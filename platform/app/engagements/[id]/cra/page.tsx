import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { CraBoard } from "@/components/CraBoard";
import { NavLink } from "@/components/NavLink";
import { Chip, Panel, PanelHeader } from "@/components/ui/atlas";
import { craBoard } from "@/lib/cra";
import { listScots } from "@/lib/scots";
import { getEngagement } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";

export const metadata = { title: "CRA · AuditISA" };

/** The Combined Risk Assessment matrix, full screen: IR × CR per relevant
    assertion of each significant account, plus the SCOT rollup. */
export default async function CraPage(props: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const locale = await getLocale();
  const t = getMessages(locale);
  const fr = locale === "fr";
  const l = {
    title: fr ? "Évaluation combinée des risques" : "Combined Risk Assessment",
    subtitle: fr
      ? "Risque inhérent × risque lié au contrôle, par assertion pertinente de chaque compte significatif"
      : "Inherent risk × control risk, per relevant assertion of each significant account",
    significant: fr ? "Risques importants" : "Significant risks",
    account: fr ? "Comptes significatifs" : "Significant accounts",
  };

  const engagement = await getEngagement(id);
  if (!engagement) notFound();

  const [view, scots] = await Promise.all([craBoard(id), listScots(id)]);
  const significantCount = view.rows.filter((row) => row.cells.some((c) => c.relevant && c.significant)).length;

  return (
    <main className="flex min-h-screen w-full flex-col gap-4 px-6 py-8">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <NavLink
            href={`/engagements/${id}/tools`}
            className="inline-flex min-h-[24px] items-center gap-1.5 text-[13px] font-semibold text-emerald-700 hover:underline dark:text-emerald-400"
            testId="back-to-dashboard"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M19 12H5M11 18l-6-6 6-6" />
            </svg>
            {locale === "fr" ? "Retour aux outils" : "Back to tools"}
          </NavLink>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-ink">{l.title}</h1>
          <p className="mt-1 text-[13px] text-ink-soft">
            {l.subtitle}
            <span className="px-2 text-line-strong">·</span>
            {engagement.clientName}
            <span className="px-2 text-line-strong">·</span>
            {t.engagements.fiscalYear} {engagement.fiscalYear}
          </p>
        </div>
        <div className="text-right">
          <div className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-muted">{l.significant}</div>
          <div className="text-[28px] font-extrabold leading-tight tracking-[-0.03em] text-rose tnum">
            {significantCount}
            <span className="text-muted">/{view.rows.length}</span>
          </div>
        </div>
      </div>

      <Panel flush className="flex flex-col">
        <div className="border-b border-line px-5 py-3.5">
          <PanelHeader
            title={l.account}
            right={<span className="text-xs font-semibold text-muted tnum">{view.rows.length}</span>}
          />
        </div>
        <div className="px-4 py-3">
          <CraBoard engagementId={id} view={view} locale={locale} />
        </div>
      </Panel>

      {/* SCOT Studio rollup — the same file summarised by process rather than
          by account: each SCOT with its WCGW/control/testing state. */}
      {scots.length > 0 ? (
        <Panel flush className="flex flex-col" data-testid="cra-by-process">
          <div className="border-b border-line px-5 py-3.5">
            <PanelHeader
              title={fr ? "Par processus (SCOT)" : "By process (SCOTs)"}
              right={<span className="text-xs font-semibold text-muted tnum">{scots.length}</span>}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  {[
                    fr ? "SCOT" : "SCOT",
                    fr ? "Type" : "Type",
                    fr ? "Comptes" : "Accounts",
                    fr ? "Stratégie" : "Strategy",
                    "WCGW",
                    fr ? "Contrôles" : "Controls",
                    fr ? "Sélectionnés" : "Selected",
                    fr ? "Fonctionnement" : "Operating",
                    fr ? "Assigné à" : "Assigned to",
                  ].map((h) => (
                    <th key={h} className="border-b border-line bg-surface-2 px-5 py-3 text-left text-[10px] font-extrabold uppercase tracking-[0.07em] text-muted">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {scots.map((scot) => {
                  const selected = scot.controls.filter((c) => c.selectedForTesting);
                  const exceptions = selected.some((c) => c.operating === "exceptions");
                  const tested = selected.filter((c) => c.operating !== null).length;
                  return (
                    <tr key={scot.id} className="hover:bg-surface-2" data-testid={`process-${scot.name.replace(/[^A-Za-z0-9]/g, "_")}`}>
                      <td className="border-t border-line px-5 py-3 text-[13px] font-semibold text-ink">{scot.name}</td>
                      <td className="border-t border-line px-5 py-3 text-[12px] text-ink-soft">
                        {scot.transactionType === "routine" ? (fr ? "Routinier" : "Routine") : scot.transactionType === "non_routine" ? (fr ? "Non routinier" : "Non-routine") : "Estimation"}
                      </td>
                      <td className="border-t border-line px-5 py-3 font-mono text-[11.5px] text-emerald-800 dark:text-emerald-300">
                        {scot.indexes.map((i) => i.indexCode).join(", ") || "—"}
                      </td>
                      <td className="border-t border-line px-5 py-3 text-[12px] text-ink-soft">
                        {scot.strategy === "controls" ? (fr ? "Contrôles" : "Controls") : fr ? "Substantif" : "Substantive"}
                      </td>
                      <td className="border-t border-line px-5 py-3 text-[13px] text-ink-soft tnum">{scot.wcgws.length}</td>
                      <td className="border-t border-line px-5 py-3 text-[13px] text-ink-soft tnum">{scot.controls.length}</td>
                      <td className="border-t border-line px-5 py-3 text-[13px] text-ink-soft tnum">{selected.length}</td>
                      <td className="border-t border-line px-5 py-3">
                        {selected.length === 0 ? (
                          <Chip tone="muted">—</Chip>
                        ) : exceptions ? (
                          <Chip tone="rose">{fr ? "Exceptions" : "Exceptions"}</Chip>
                        ) : tested === selected.length ? (
                          <Chip tone="good">{fr ? "Efficace" : "Effective"}</Chip>
                        ) : (
                          <Chip tone="warn">{`${tested}/${selected.length}`}</Chip>
                        )}
                      </td>
                      <td className="border-t border-line px-5 py-3 text-[12px] text-ink-soft">{scot.assigneeName ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Panel>
      ) : null}
    </main>
  );
}
