import Link from "next/link";
import { localizedTitle } from "@/lib/page-title";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppNav } from "@/components/AppNav";
import { ErrorBanner } from "@/components/GatesPanel";
import { TbAnalyzer } from "@/components/TbAnalyzer";
import { TbValidationReasons } from "@/components/TbValidationReasons";
import { tbStatusLabel } from "@/lib/tb-reasons";
import { Chip, Panel } from "@/components/ui/atlas";
import { getEngagement } from "@/lib/engagements";
import { getMessages } from "@/lib/i18n";
import { getLocale } from "@/lib/locale";
import { diffTbVersions, listTbTimings, listTbVersions, type TbDiffLine } from "@/lib/tb";
import { rollForward } from "@/lib/tb-rollforward";
import { RollForwardGrid } from "@/components/RollForwardGrid";

export const generateMetadata = localizedTitle("Trial Balance Analyzer", "Analyseur de balance");

/**
 * The Trial Balance Analyzer: upload to the Pre-audit or Post-audit slot
 * (each upload replaces that slot), confirm columns and classes, and read the
 * lead schedules in the workbook layout — index-named, with sub-totals,
 * current year, prior year and the variance.
 */
export default async function DataPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await props.params;
  const { error } = await props.searchParams;
  const locale = await getLocale();
  const t = getMessages(locale);
  const fr = locale === "fr";

  const engagement = await getEngagement(id);
  if (!engagement) notFound();
  const [timings, roll, versions] = await Promise.all([listTbTimings(id), rollForward(id), listTbVersions(id)]);
  // UAT B66: each version compared with the previous upload to the same slot
  // (non-zero closing differences only); bounded to the ten latest pairs
  const previousOf = new Map<number, number>();
  versions.forEach((v, i) => {
    const prev = versions.slice(i + 1).find((o) => o.timing === v.timing);
    if (prev && previousOf.size < 10) previousOf.set(v.versionNo, prev.versionNo);
  });
  const diffs = new Map<number, TbDiffLine[]>(
    await Promise.all(
      [...previousOf].map(async ([vNo, prevNo]) => [vNo, await diffTbVersions(id, prevNo, vNo)] as [number, TbDiffLine[]]),
    ),
  );
  const amount = new Intl.NumberFormat(fr ? "fr-FR" : "en-US", { maximumFractionDigits: 0 });
  const slotLabel = (timing: "pre_audit" | "post_audit" | "prior_year") =>
    timing === "pre_audit" ? (fr ? "pré-audit" : "pre-audit") : timing === "post_audit" ? (fr ? "post-audit" : "post-audit") : fr ? "N-1" : "prior year";
  const slotOf = (timing: "pre_audit" | "post_audit" | "prior_year") => timings.find((x) => x.timing === timing);

  return (
    <main className="min-h-screen w-full px-6 py-6">
      <AppNav locale={locale} hideLinks current={{ id, label: engagement.name ?? engagement.clientName }} />
      <div className="mt-5 flex items-center gap-3">
        <Link
          href={`/engagements/${id}/tools/data-analytics`}
          className="grid h-8 w-8 place-items-center rounded-full text-[16px] font-bold text-ink-soft transition hover:bg-surface-2 hover:text-ink"
          title={fr ? "Retour à l'analyse de données" : "Back to Data Analytics"}
          aria-label={fr ? "Retour" : "Back"}
          data-testid="tb-back"
        >
          ←
        </Link>
        <h1 className="text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          {fr ? "Analyseur de balance générale" : "Trial Balance Analyzer"}
        </h1>
      </div>
      <ErrorBanner error={error} locale={locale} />

      <Panel className="mt-4">
        <TbAnalyzer engagementId={id} locale={fr ? "fr" : "en"} messages={t.planning} />

        {/* the three TB slots — one file each, replaced on re-upload */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3" data-testid="tb-timings">
          {(["pre_audit", "post_audit", "prior_year"] as const).map((timing) => {
            const slot = slotOf(timing);
            return (
              <div key={timing} className="rounded-[var(--radius-atlas-sm)] border border-line bg-surface-2/50 px-4 py-3" data-testid={`tb-slot-${timing}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
                    {timing === "pre_audit"
                      ? (fr ? "TB pré-audit" : "Pre-audit TB")
                      : timing === "post_audit"
                        ? (fr ? "TB post-audit" : "Post-audit TB")
                        : fr ? "TB exercice précédent" : "Prior year TB"}
                  </span>
                  {slot ? (
                    <Chip tone={slot.status === "valid" ? "good" : slot.status === "invalid" ? "rose" : "warn"}>
                      {tbStatusLabel(slot.status, fr ? "fr" : "en")}
                    </Chip>
                  ) : null}
                </div>
                {slot ? (
                  <p className="mt-1.5 text-[12.5px] text-ink-soft">
                    {slot.filename}
                    <span className="px-1.5 text-line-strong">·</span>
                    <span className="tnum">{slot.rowCount} {fr ? "lignes" : "rows"}</span>
                    <span className="px-1.5 text-line-strong">·</span>
                    <span className="tnum">{slot.createdAt}</span>
                  </p>
                ) : (
                  <p className="mt-1.5 text-[12.5px] text-muted">
                    {fr ? "Aucun fichier — importer ci-dessus." : "No file yet — upload above."}
                  </p>
                )}
                {slot ? <TbValidationReasons summary={slot.summary} locale={fr ? "fr" : "en"} testId={`tb-reasons-${timing}`} /> : null}
              </div>
            );
          })}
        </div>
        {/* every import ever made, the live one per slot first: a re-import
            supersedes its predecessor but never deletes it, and the working
            TB (★) moves only on a valid pre-audit import */}
        {versions.length > 0 ? (
          <div className="mt-4" data-testid="tb-versions">
            <h3 className="text-[11px] font-extrabold uppercase tracking-[0.07em] text-muted">
              {fr ? "Historique des versions" : "Version history"}
            </h3>
            <ul className="mt-1.5 flex flex-col gap-0.5 text-[12px] text-ink-soft">
              {versions.map((v) => (
                <li key={v.id} className={`flex flex-wrap items-center gap-2 ${v.superseded ? "text-muted" : ""}`} data-testid={`tb-version-${v.versionNo}`}>
                  <span className="font-mono tnum">v{v.versionNo}</span>
                  <span>{slotLabel(v.timing)}</span>
                  <Chip tone={v.status === "valid" ? "good" : v.status === "invalid" ? "rose" : "warn"}>{tbStatusLabel(v.status, fr ? "fr" : "en")}</Chip>
                  {v.isCurrent ? <span title={fr ? "Balance de travail" : "Working TB"}>★</span> : null}
                  {v.superseded ? <span>({fr ? "remplacée" : "superseded"})</span> : null}
                  <span className="truncate">{v.sourceFilename ?? ""}</span>
                  <span className="tnum">{v.rowCount} {fr ? "lignes" : "rows"} · {v.createdAt}</span>
                  <span className="tnum" data-testid={`tb-version-totals-${v.versionNo}`}>
                    {fr ? "Débit" : "Debit"} {amount.format(v.totalDebit)} · {fr ? "Crédit" : "Credit"} {amount.format(v.totalCredit)}
                  </span>
                  {previousOf.has(v.versionNo) ? (
                    <details className="basis-full pl-6" data-testid={`tb-version-diff-${v.versionNo}`}>
                      <summary className="cursor-pointer text-[11.5px]">
                        {fr ? "Comparer avec la version précédente" : "Compare with the previous version"} (v{previousOf.get(v.versionNo)})
                        {" · "}
                        {(diffs.get(v.versionNo) ?? []).length} {fr ? "compte(s) modifié(s)" : "account(s) changed"}
                      </summary>
                      {(diffs.get(v.versionNo) ?? []).length === 0 ? (
                        <p className="text-[11.5px] text-muted">{fr ? "Aucune différence de solde de clôture." : "No closing-balance differences."}</p>
                      ) : (
                        <table className="mt-1 text-[11.5px]">
                          <thead>
                            <tr className="text-left text-muted">
                              <th className="pr-3">{fr ? "Compte" : "Account"}</th>
                              <th className="pr-3 text-right">v{previousOf.get(v.versionNo)}</th>
                              <th className="pr-3 text-right">v{v.versionNo}</th>
                              <th className="text-right">{fr ? "Écart" : "Difference"}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(diffs.get(v.versionNo) ?? []).slice(0, 100).map((d) => (
                              <tr key={d.account} className="tnum">
                                <td className="pr-3 font-mono">{d.account}</td>
                                <td className="pr-3 text-right">{amount.format(d.closingA)}</td>
                                <td className="pr-3 text-right">{amount.format(d.closingB)}</td>
                                <td className="text-right">{amount.format(d.difference)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {roll ? (
          <RollForwardGrid result={roll} locale={fr ? "fr" : "en"} />
        ) : (
          <p className="mt-3 text-[12px] text-muted" data-testid="rollforward-empty">
            {fr
              ? "Réconciliation indisponible — importer le grand livre dans l'Analyseur du grand livre."
              : "Roll-forward unavailable — upload the general ledger in the GL Analyzer."}
          </p>
        )}
      </Panel>

    </main>
  );
}
